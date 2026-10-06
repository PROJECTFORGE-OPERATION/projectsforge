/**
 * Firebase Authentication — cloud student accounts (Email + Password).
 *
 * Accounts live in Firebase, so students sign in from any device and
 * password-reset emails are sent by Google to any address (150/day on the
 * free Spark plan, no SMTP credentials of our own). There is no database of
 * ours and no fallback mode: if Firebase is unconfigured or unreachable,
 * every call fails loudly with the provider's error mapped to plain copy.
 *
 * Local development can set NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL (e.g.
 * http://localhost:9099) — the SDK then keeps everything on the Firebase
 * Auth emulator, which stores reset links instead of sending email.
 *
 * Exposed as an external store (subscribe + snapshot) like session.ts so
 * pages can read the signed-in student with useSyncExternalStore — SSR-safe.
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import {
  connectAuthEmulator,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
  type Auth,
  type User,
} from "firebase/auth";

export interface Student {
  name: string;
  email: string;
  joinedAt: string;
}

export interface AuthResult {
  ok: boolean;
  error?: string;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let cache: Student | null = null;
let resolved = false;
/**
 * Name entered at signup. Set BEFORE createUser so any auth-state event that
 * arrives while displayName is still being written shows the real name (not
 * the email prefix); cleared on sign-out so it can never resurrect a session.
 */
let pendingName: string | null = null;
let authInstance: Auth | null = null;
/** First-onAuthStateChanged handshake — see whenAuthReady(). */
let readyPromise: Promise<void> | null = null;
let markReady: (() => void) | null = null;

const AUTH_RESTORE_TIMEOUT_MS = 10_000;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const EMULATOR_URL =
  process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_URL?.trim() || null;

const NOT_CONFIGURED =
  "Firebase Authentication isn't configured on this build — set the NEXT_PUBLIC_FIREBASE_* values and redeploy.";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function emit(): void {
  for (const listener of listeners) listener();
}

function toStudent(user: User): Student {
  const email = (user.email ?? "").toLowerCase();
  return {
    name: user.displayName?.trim() || pendingName || email.split("@")[0] || "Student",
    email,
    joinedAt: user.metadata.creationTime || new Date().toISOString(),
  };
}

function configured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.authDomain &&
      firebaseConfig.projectId &&
      firebaseConfig.appId,
  );
}

/** Lazily create the client Auth instance (browser only) + state listener. */
function auth(): Auth | null {
  if (typeof window === "undefined" || !configured()) return null;
  if (!authInstance) {
    const app: FirebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
    const instance = getAuth(app);
    if (EMULATOR_URL) {
      connectAuthEmulator(instance, EMULATOR_URL, { disableWarnings: true });
    }
    onAuthStateChanged(instance, (user) => {
      cache = user ? toStudent(user) : null;
      resolved = true;
      markReady?.(); // first event = persisted session restored (or none)
      emit();
    });
    authInstance = instance;
  }
  return authInstance;
}

/** Provider error codes → plain, loud copy. Never silent. */
function authError(cause: unknown): string {
  const err = cause as { code?: string; message?: string } | null;
  const code = err?.code ?? "";
  const message = err?.message ?? String(cause ?? "");
  switch (code) {
    case "auth/email-already-in-use":
      return "An account already exists for that email — sign in instead.";
    case "auth/invalid-email":
      return "That email doesn't look right.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/invalid-login-credentials":
      return "Wrong email or password. Try again.";
    case "auth/user-not-found":
      return "No account found for that email — create one first.";
    case "auth/missing-password":
      return "Enter your password.";
    case "auth/weak-password":
      return "Password needs at least 6 characters.";
    case "auth/network-request-failed":
      return "Could not reach Firebase — check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts — wait a minute and try again.";
    case "auth/expired-action-code":
      return "That reset link has expired — request a new one.";
    case "auth/invalid-action-code":
      return "That reset link is invalid or was already used — request a new one.";
    case "auth/user-disabled":
      return "That account has been disabled.";
    case "auth/operation-not-allowed":
      return "Email/Password sign-in isn't enabled in the Firebase console.";
    default:
      return `Firebase Authentication failed${code ? ` (${code})` : ""} — ${message || "unknown error"}.`;
  }
}

export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener);
  auth(); // first subscriber starts the Firebase state listener
  return () => {
    listeners.delete(listener);
  };
}

export function getServerSnapshot(): null {
  return null;
}

/** Server snapshot for the resolved flag — auth state is unknown during SSR. */
export function getServerResolvedSnapshot(): false {
  return false;
}

export function getAuthSnapshot(): Student | null {
  if (typeof window === "undefined") return null;
  return cache;
}

/**
 * True once Firebase has resolved the first auth state (or a direct call
 * succeeded). Gates must wait for this before redirecting signed-out users —
 * unlike the old device-local store, resolution is asynchronous.
 */
export function authResolved(): boolean {
  return typeof window !== "undefined" && resolved;
}

/**
 * Resolves once Firebase has restored any persisted session (the first
 * onAuthStateChanged) — callers that run at page mount must await this,
 * because reading currentUser earlier races the asynchronous restore and
 * mistakes a signed-in student for a signed-out one (that race silently
 * emptied /result hydration, the Phase-1 migration and the unlock gate).
 * Never hangs: if no answer comes within 10s it throws loud plain copy.
 */
export async function whenAuthReady(): Promise<void> {
  // `resolved` covers every "state is known" path: the first onAuthStateChanged
  // fired, or a direct signUp/signIn/signOut already decided it. Checking the
  // flag (not just a registered resolver) is what prevents a 10s hang when the
  // event beat us to the call.
  if (resolved || typeof window === "undefined" || !configured()) return;
  if (!readyPromise) {
    readyPromise = new Promise<void>((resolve) => {
      markReady = resolve;
    });
  }
  auth(); // first caller starts the state listener if nothing else has
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          "Your session is taking too long to restore — reload the page and sign in again.",
        ),
      );
    }, AUTH_RESTORE_TIMEOUT_MS);
  });
  try {
    await Promise.race([readyPromise, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<AuthResult> {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (cleanName.length < 2) return { ok: false, error: "Enter your full name." };
  if (!EMAIL_RE.test(cleanEmail)) return { ok: false, error: "That email doesn't look right." };
  if (password.length < 6)
    return { ok: false, error: "Password needs at least 6 characters." };

  const client = auth();
  if (!client) return { ok: false, error: NOT_CONFIGURED };

  try {
    pendingName = cleanName;
    const cred = await createUserWithEmailAndPassword(client, cleanEmail, password);
    // Publish the session BEFORE the profile write. updateProfile can take
    // seconds (observed 15s+ against the live API); if the cache assignment
    // waited for it, a response landing AFTER sign-out would resurrect the
    // session — a late-response stomp the real-config smoke test caught.
    cache = {
      name: cleanName,
      email: cleanEmail,
      joinedAt: cred.user.metadata.creationTime || new Date().toISOString(),
    };
    resolved = true;
    emit();
    // Fire-and-forget the display-name write. Awaiting it held signUp() open
    // for seconds (observed 15s+ on the live API), so the login page's success
    // navigation (router.push("/profile")) fired long after the user had
    // signed out and moved on — a stale navigation that bounced
    // login → profile → login, remounted the form and silently discarded an
    // in-flight sign-in error. pendingName keeps the entered name visible
    // until displayName lands.
    void updateProfile(cred.user, { displayName: cleanName }).catch((cause) => {
      console.error("[auth] displayName update failed:", cause); // account exists — keep going
    });
    return { ok: true };
  } catch (cause) {
    pendingName = null;
    return { ok: false, error: authError(cause) };
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail)) return { ok: false, error: "That email doesn't look right." };
  if (!password) return { ok: false, error: "Enter your password." };

  const client = auth();
  if (!client) return { ok: false, error: NOT_CONFIGURED };

  try {
    const cred = await signInWithEmailAndPassword(client, cleanEmail, password);
    cache = toStudent(cred.user);
    resolved = true;
    emit();
    return { ok: true };
  } catch (cause) {
    return { ok: false, error: authError(cause) };
  }
}

export function signOut(): void {
  const client = auth();
  cache = null;
  pendingName = null;
  resolved = true;
  emit();
  if (client) {
    firebaseSignOut(client).catch((cause) => console.error("[auth] signOut failed:", cause));
  }
}

/**
 * ID token for the API (`Authorization: Bearer …`). Server routes verify it
 * with the Admin SDK, so every cloud call knows which student is calling —
 * there is no cookie of our own. Null when signed out or Firebase isn't set
 * up; callers surface that loudly instead of sending an anonymous request.
 */
export async function getIdToken(): Promise<string | null> {
  // Wait for the persisted session to be restored before reading currentUser
  // — at mount, restoration is still in flight and a premature null would be
  // indistinguishable from "signed out". Throws loud copy if it never lands.
  await whenAuthReady();
  const client = auth();
  const user = client?.currentUser ?? null;
  if (!user) return null;
  try {
    return await user.getIdToken();
  } catch (cause) {
    console.error("[auth] getIdToken failed:", cause);
    return null;
  }
}

/** Convenience wrapper: auth header map, or {} when there is no session. */
export async function authHeaders(): Promise<Record<string, string>> {
  const token = await getIdToken();
  return token ? { authorization: `Bearer ${token}` } : {};
}

/**
 * Asks Firebase to email a password-reset link. The link lands back on
 * /forgot?mode=resetPassword with an oobCode, so the new password is set
 * inside this app. Google delivers to any address — there is no SMTP of ours.
 */
export async function sendResetEmail(email: string): Promise<AuthResult> {
  const cleanEmail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail)) return { ok: false, error: "That email doesn't look right." };

  const client = auth();
  if (!client) return { ok: false, error: NOT_CONFIGURED };

  try {
    await sendPasswordResetEmail(client, cleanEmail, {
      url: `${window.location.origin}/forgot?mode=resetPassword`,
      handleCodeInApp: true,
    });
    return { ok: true };
  } catch (cause) {
    return { ok: false, error: authError(cause) };
  }
}

/** Applies the emailed link's oobCode — the proof of inbox control. */
export async function completeReset(oobCode: string, password: string): Promise<AuthResult> {
  if (password.length < 6)
    return { ok: false, error: "Password needs at least 6 characters." };

  const client = auth();
  if (!client) return { ok: false, error: NOT_CONFIGURED };

  try {
    await confirmPasswordReset(client, oobCode, password);
    return { ok: true };
  } catch (cause) {
    return { ok: false, error: authError(cause) };
  }
}
