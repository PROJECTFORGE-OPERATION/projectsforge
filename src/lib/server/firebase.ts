import { createPublicKey, verify as verifyRsa } from "node:crypto";
import { cert, getApps, initializeApp, type App, type ServiceAccount } from "firebase-admin/app";
import { FieldValue, getFirestore, type Firestore } from "firebase-admin/firestore";
import type {
  AnalyzeResponse,
  CompletionRecord,
  RecordsResponse,
  StoredIntro,
} from "@/lib/types";

/**
 * Phase 2 backbone: Firestore through the Admin SDK.
 *
 * Every server route identifies the caller by verifying the Firebase ID token
 * the client sends as `Authorization: Bearer …`, then reads/writes that
 * student's own `students/{uid}` document. There is no service-account-free
 * path and no fallback: if FIREBASE_SERVICE_ACCOUNT_KEY is missing or invalid,
 * every call fails loudly with a plain-word 503 instead of pretending to save.
 *
 * The database itself runs with locked (production-mode) rules — the client
 * SDK never talks to Firestore; all access happens here, behind the token.
 */

/** Plain-word failure the routes surface as their JSON Response body. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export interface ServerUser {
  uid: string;
  email: string;
  /** displayName claim — null until Firebase has it (self-heals on next write). */
  displayName: string | null;
  /** First sign-in time (unix seconds) — immutable, doubles as joinedAt. */
  authTime: number;
}

let app: App | null = null;
let initFailure: string | null = null;

const NOT_CONFIGURED =
  "Cloud storage isn't configured on this server — set FIREBASE_SERVICE_ACCOUNT_KEY and redeploy.";

/** Lazily create the Admin app once per warm lambda / dev server. */
function admin(): App | null {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }
  if (!initFailure) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY?.trim();
    const emulator = process.env.FIRESTORE_EMULATOR_HOST?.trim();
    if (emulator) {
      // Emulator runs need no credentials at all.
      app = initializeApp({ projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID });
      return app;
    }
    if (!raw) {
      initFailure = NOT_CONFIGURED;
    } else {
      try {
        const json = JSON.parse(raw) as ServiceAccount & { project_id?: string };
        app = initializeApp({
          credential: cert(json),
          projectId: json.project_id || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
        });
      } catch (cause) {
        initFailure = `FIREBASE_SERVICE_ACCOUNT_KEY isn't valid service-account JSON — ${String(cause).slice(0, 200)}`;
      }
    }
  }
  return app;
}

/** Firestore handle or a loud 503 when the server has no credentials. */
export function db(): Firestore {
  const instance = admin();
  if (!instance) throw new ApiError(503, initFailure ?? NOT_CONFIGURED);
  // Database id chosen when the database was created — the console's reserved
  // "(default)" unless FIRESTORE_DATABASE_ID overrides it (named database).
  const databaseId = process.env.FIRESTORE_DATABASE_ID?.trim() || "(default)";
  return getFirestore(instance, databaseId);
}

/** JSON error Response for a route-level failure (ApiError → status+copy). */
export function apiErrorResponse(cause: unknown): Response | null {
  if (cause instanceof ApiError) {
    return Response.json({ error: cause.message }, { status: cause.status });
  }
  return null;
}

/**
 * Verify a Firebase ID token against Google's public JWKS.
 *
 * Deliberately NOT `firebase-admin/auth`: that entry point pulls in
 * jwks-rsa → jose, an ESM-only chain that dies with ERR_REQUIRE_ESM when a
 * Vercel lambda loads it — an empty 500 on every route that imports it. The
 * Admin app and Firestore load fine there, so identity is checked here
 * instead with the platform's own crypto: the same checks firebase-admin
 * makes (RS256 signature, issuer, audience, expiry, subject), no extra
 * dependencies.
 */

const SESSION_INVALID = "Your session is no longer valid — sign out and sign back in.";
const JWKS_URL =
  "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
const JWKS_TTL_MS = 10 * 60 * 1000;

interface JwkKey {
  kty?: string;
  n?: string;
  e?: string;
  kid?: string;
}

interface IdClaims {
  sub: string;
  email?: string;
  name?: string;
  auth_time?: number;
}

let jwksCache: { keys: JwkKey[]; at: number } | null = null;
let jwksInFlight: Promise<JwkKey[]> | null = null;

/** Google's signing keys — cached per lambda; `force` busts it (key rotation). */
async function googleKeys(force: boolean): Promise<JwkKey[]> {
  if (!force && jwksCache && Date.now() - jwksCache.at < JWKS_TTL_MS) return jwksCache.keys;
  if (!jwksInFlight) {
    jwksInFlight = (async () => {
      let res: Response;
      try {
        res = await fetch(JWKS_URL);
      } catch (cause) {
        throw new ApiError(
          503,
          `Sessions can't be checked right now — Google's key service is unreachable (${String(cause).slice(0, 80)}). Try again in a moment.`,
        );
      }
      if (!res.ok) {
        throw new ApiError(
          503,
          `Sessions can't be checked right now — Google's key service answered ${res.status}. Try again in a moment.`,
        );
      }
      const body = (await res.json().catch(() => null)) as { keys?: JwkKey[] } | null;
      const keys = Array.isArray(body?.keys) ? body.keys : [];
      jwksCache = { keys, at: Date.now() };
      return keys;
    })().finally(() => {
      jwksInFlight = null;
    });
  }
  return jwksInFlight;
}

async function verifyGoogleIdToken(token: string, projectId: string): Promise<IdClaims> {
  const parts = token.split(".");
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
    throw new ApiError(401, SESSION_INVALID);
  }
  const [head, body, signature] = parts;

  let header: { alg?: unknown; kid?: unknown };
  try {
    header = JSON.parse(Buffer.from(head, "base64url").toString("utf8")) as {
      alg?: unknown;
      kid?: unknown;
    };
  } catch {
    throw new ApiError(401, SESSION_INVALID);
  }
  if (header.alg !== "RS256" || typeof header.kid !== "string") {
    throw new ApiError(401, SESSION_INVALID);
  }

  let claims: {
    sub?: unknown;
    email?: unknown;
    name?: unknown;
    auth_time?: unknown;
    iss?: unknown;
    aud?: unknown;
    exp?: unknown;
  };
  try {
    claims = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    throw new ApiError(401, SESSION_INVALID);
  }

  let keys = await googleKeys(false);
  let key = keys.find((candidate) => candidate.kid === header.kid);
  if (!key) {
    keys = await googleKeys(true); // rotated key id — bust the cache once
    key = keys.find((candidate) => candidate.kid === header.kid);
  }
  if (!key) throw new ApiError(401, SESSION_INVALID);

  let signed = false;
  try {
    const publicKey = createPublicKey({ key: { kty: key.kty, n: key.n, e: key.e }, format: "jwk" });
    signed = verifyRsa(
      "RSA-SHA256",
      Buffer.from(`${head}.${body}`),
      publicKey,
      Buffer.from(signature, "base64url"),
    );
  } catch {
    signed = false;
  }
  if (!signed) throw new ApiError(401, SESSION_INVALID);

  const now = Math.floor(Date.now() / 1000);
  const sub = claims.sub;
  if (
    claims.iss !== `https://securetoken.google.com/${projectId}` ||
    claims.aud !== projectId ||
    typeof claims.exp !== "number" ||
    claims.exp <= now ||
    typeof sub !== "string" ||
    !sub ||
    sub.length > 128
  ) {
    throw new ApiError(401, SESSION_INVALID);
  }

  return {
    sub,
    email: typeof claims.email === "string" ? claims.email : undefined,
    name: typeof claims.name === "string" ? claims.name : undefined,
    auth_time: typeof claims.auth_time === "number" ? claims.auth_time : undefined,
  };
}

/**
 * Verify the caller's `Authorization: Bearer <idToken>` header.
 * Throws ApiError(401/503) with plain-word copy — never a stack trace.
 */
export async function requireUser(request: Request): Promise<ServerUser> {
  const instance = admin();
  if (!instance) throw new ApiError(503, initFailure ?? NOT_CONFIGURED);

  const header = (request.headers.get("authorization") ?? "").trim();
  const match = /^Bearer +(.+)$/.exec(header);
  if (!match) {
    throw new ApiError(401, "Sign in required — this request didn't include your session.");
  }

  const projectId =
    instance.options.projectId ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID?.trim();
  if (!projectId) {
    throw new ApiError(
      503,
      "This server doesn't know its Firebase project id — set NEXT_PUBLIC_FIREBASE_PROJECT_ID and redeploy.",
    );
  }

  let decoded: IdClaims;
  try {
    decoded = await verifyGoogleIdToken(match[1], projectId);
  } catch (cause) {
    // A key-service outage stays loud (503); anything else is a bad session.
    if (cause instanceof ApiError && cause.status === 503) throw cause;
    throw new ApiError(401, SESSION_INVALID);
  }

  const email = (decoded.email ?? "").trim().toLowerCase();
  if (!email) {
    throw new ApiError(401, "That account has no email address — sign back in with a normal email.");
  }
  const displayName = (decoded.name ?? "").trim() || null;
  return {
    uid: decoded.sub,
    email,
    displayName,
    authTime: typeof decoded.auth_time === "number" ? decoded.auth_time : 0,
  };
}

/* --- student document writes ------------------------------------------- */

function studentDoc(uid: string) {
  return db().collection("students").doc(uid);
}

/** First sign-in timestamp — immutable, so re-writes never move join date. */
function joinedAt(user: ServerUser): Date {
  return user.authTime > 0 ? new Date(user.authTime * 1000) : new Date();
}

/**
 * Persist the newest analysis under `students/{uid}` (profile + full run +
 * counters). Fire-and-forget semantics live in the callers: they render the
 * analysis either way and only log + flag `persisted:false` on failure.
 */
export async function saveLatestRun(user: ServerUser, run: AnalyzeResponse): Promise<void> {
  const payload = { ...run };
  delete payload.persisted; // never store the flag
  await studentDoc(user.uid).set(
    {
      ...(user.displayName ? { name: user.displayName } : {}),
      email: user.email,
      joinedAt: joinedAt(user),
      profile: payload.profile,
      latestRun: payload,
      runCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

/** Store the freshly generated self-introduction with its fingerprint. */
export async function saveIntroDoc(user: ServerUser, intro: StoredIntro): Promise<void> {
  await studentDoc(user.uid).set(
    {
      ...(user.displayName ? { name: user.displayName } : {}),
      email: user.email,
      joinedAt: joinedAt(user),
      intro,
      introCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
}

function asComplections(value: unknown): CompletionRecord[] {
  return Array.isArray(value) ? (value as CompletionRecord[]) : [];
}

/**
 * Idempotent: the same project id is recorded once, newest first — inside a
 * transaction so two tabs marking complete can't double-write.
 */
export async function addCompletionTx(
  user: ServerUser,
  record: CompletionRecord,
): Promise<CompletionRecord[]> {
  const ref = studentDoc(user.uid);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const current = asComplections(snap.data()?.completions);
    const merged = current.some((entry) => entry.id === record.id)
      ? current
      : [record, ...current];
    tx.set(
      ref,
      {
        ...(user.displayName ? { name: user.displayName } : {}),
        email: user.email,
        joinedAt: joinedAt(user),
        completions: merged,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    return merged;
  });
}

/**
 * One-time import of records a Phase-1 student still has only in this
 * browser's localStorage. Merges by id (server wins on conflicts) and only
 * fills an intro when the cloud has none — never overwrites newer data.
 */
export async function migrateRecords(
  user: ServerUser,
  incoming: { completions: CompletionRecord[]; intro?: StoredIntro | null },
): Promise<CompletionRecord[]> {
  const ref = studentDoc(user.uid);
  return db().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() ?? {};
    const current = asComplections(data.completions);
    const known = new Set(current.map((entry) => entry.id));
    const merged = [
      ...current,
      ...incoming.completions.filter((record) => !known.has(record.id)),
    ];
    const patch: Record<string, unknown> = {
      ...(user.displayName ? { name: user.displayName } : {}),
      email: user.email,
      joinedAt: joinedAt(user),
      completions: merged,
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (incoming.intro && !data.intro) patch.intro = incoming.intro;
    tx.set(ref, patch, { merge: true });
    return merged;
  });
}

/** Read one student's cloud state (the payload behind GET /api/records). */
export async function readRecords(user: ServerUser): Promise<RecordsResponse> {
  const snap = await studentDoc(user.uid).get();
  const data = snap.exists ? (snap.data() ?? {}) : {};
  return {
    profile: (data.profile as RecordsResponse["profile"]) ?? null,
    intro: (data.intro as StoredIntro | null) ?? null,
    completions: asComplections(data.completions),
    run: (data.latestRun as RecordsResponse["run"]) ?? null,
    runCount: typeof data.runCount === "number" ? data.runCount : 0,
    introCount: typeof data.introCount === "number" ? data.introCount : 0,
  };
}
