import { authHeaders } from "./auth";
import type {
  CompletionRecord,
  RecordsResponse,
  StoredIntro,
  StudentProfile,
} from "./types";

/**
 * Student portfolio records — Phase 2: Firestore through /api/records.
 *
 * The cloud is the single source of truth; this module is only the in-memory
 * mirror exposed as an external store (subscribe + snapshot) so pages keep
 * reading with useSyncExternalStore — SSR-safe, no setState-in-effect.
 *
 *  - the generated self-introduction, fingerprinted against the profile it
 *    was written from so an edit to hobbies/schooling/college regenerates it
 *  - completed-project records, which unlock the Communication Skills section
 *  - the latest analysis run, used to hydrate /result on a fresh device
 *
 * Phase-1 data still sitting in this browser's localStorage is imported once
 * (migrate) and then cleared — the server never overwrites newer cloud data.
 */

export type { CompletionRecord, StoredIntro };

type Listener = () => void;

const listeners = new Set<Listener>();

/**
 * Stable empty array — `useSyncExternalStore` compares snapshots with
 * Object.is and React THROWS ("getSnapshot should be cached") when a getter
 * allocates a fresh [] on every call while there is no data yet.
 */
const EMPTY_COMPLETIONS: CompletionRecord[] = [];

let intro: StoredIntro | null = null;
let completions: CompletionRecord[] = EMPTY_COMPLETIONS;
/** True once the first load attempt finished (success or loud failure). */
let resolved = false;
let loadError: string | null = null;
let inflight: Promise<RecordsResponse | null> | null = null;

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/* --- storage (kept for the one-time migration) -------------------------- */

const LEGACY_INTRO_KEY = "projectsforge:intro:v1";
const LEGACY_COMPLETED_KEY = "projectsforge:completed:v1";

/** Shape guard — corrupt or pre-v1 storage degrades to "no intro". */
function pickIntro(data: unknown): StoredIntro | null {
  if (typeof data !== "object" || data === null) return null;
  const value = data as Partial<StoredIntro>;
  if (typeof value.text !== "string" || typeof value.signature !== "string") return null;
  return {
    text: value.text,
    signature: value.signature,
    generatedAt: typeof value.generatedAt === "string" ? value.generatedAt : "",
  };
}

/** Shape guard — corrupt entries are dropped, valid ones kept. */
function pickCompleted(data: unknown): CompletionRecord[] {
  if (!Array.isArray(data)) return [];
  const asStrings = (value: unknown): string[] =>
    Array.isArray(value)
      ? value.filter((item): item is string => typeof item === "string")
      : [];
  return data.flatMap((item) => {
    if (typeof item !== "object" || item === null) return [];
    const record = item as Partial<CompletionRecord>;
    if (typeof record.id !== "string" || typeof record.title !== "string") return [];
    return [
      {
        id: record.id,
        title: record.title,
        technologies: asStrings(record.technologies),
        skillsCovered: asStrings(record.skillsCovered),
        weeks: typeof record.weeks === "number" ? record.weeks : 0,
        completedAt: typeof record.completedAt === "string" ? record.completedAt : "",
      },
    ];
  });
}

function parseLegacy(raw: string | null): unknown {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** What this browser still holds from Phase 1 — null when there is none. */
function readLegacy(): { completions: CompletionRecord[]; intro: StoredIntro | null } | null {
  if (typeof window === "undefined") return null;
  let introRaw: string | null = null;
  let completedRaw: string | null = null;
  try {
    introRaw = window.localStorage.getItem(LEGACY_INTRO_KEY);
    completedRaw = window.localStorage.getItem(LEGACY_COMPLETED_KEY);
  } catch {
    return null;
  }
  if (!introRaw && !completedRaw) return null;
  const legacyIntro = pickIntro(parseLegacy(introRaw));
  const legacyCompleted = pickCompleted(parseLegacy(completedRaw));
  if (!legacyIntro && legacyCompleted.length === 0) {
    clearLegacy();
    return null;
  }
  return { completions: legacyCompleted, intro: legacyIntro };
}

function clearLegacy(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(LEGACY_INTRO_KEY);
    window.localStorage.removeItem(LEGACY_COMPLETED_KEY);
  } catch {
    // storage unavailable — a re-migrate is harmless (it merges by id)
  }
}

/* --- loading ------------------------------------------------------------ */

/**
 * Fetch the student's cloud records (concurrent callers share one request;
 * a later call refetches so navigation always sees fresh data). Returns the
 * payload for callers that need the run/profile directly, or null on a loud
 * failure (see getRecordsErrorSnapshot).
 */
export function loadRecords(): Promise<RecordsResponse | null> {
  if (inflight) return inflight;
  inflight = fetchRecords();
  return inflight;
}

async function fetchRecords(): Promise<RecordsResponse | null> {
  try {
    const headers = await authHeaders();
    if (!headers.authorization) {
      // Signed out — there is nothing (and nobody) to load. Not an error.
      resolved = true;
      loadError = null;
      emit();
      return null;
    }

    const res = await fetch("/api/records", {
      headers,
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => null)) as
      | (RecordsResponse & { error?: string })
      | null;
    if (!res.ok || !data || !Array.isArray(data.completions)) {
      throw new Error(
        (data && "error" in data && typeof data.error === "string" && data.error) ||
          `The server returned ${res.status} without your records.`,
      );
    }

    await migrateLegacy(headers, data);

    intro = data.intro ?? null;
    completions = data.completions.length > 0 ? data.completions : EMPTY_COMPLETIONS;
    resolved = true;
    loadError = null;
    emit();
    return data;
  } catch (cause) {
    loadError =
      cause instanceof Error ? cause.message : "Your records couldn't be loaded from the cloud.";
    resolved = true;
    emit();
    console.error("[records] load failed:", cause);
    return null;
  } finally {
    inflight = null;
  }
}

/** One-time Phase-1 import: merge this browser's old records into the cloud. */
async function migrateLegacy(
  headers: Record<string, string>,
  data: RecordsResponse,
): Promise<void> {
  const legacy = readLegacy();
  if (!legacy) return;
  const needsIntro = !data.intro && legacy.intro !== null;
  const needsCompletions =
    legacy.completions.length > 0 &&
    legacy.completions.some(
      (record) => !data.completions.some((entry) => entry.id === record.id),
    );
  if (!needsIntro && !needsCompletions) {
    clearLegacy();
    return;
  }
  try {
    const res = await fetch("/api/records", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({
        action: "migrate",
        completions: legacy.completions,
        intro: legacy.intro,
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new Error(`server returned ${res.status}`);
    const merged = (await res.json().catch(() => null)) as {
      completions?: CompletionRecord[];
    } | null;
    if (Array.isArray(merged?.completions)) data.completions = merged.completions;
    if (!data.intro && legacy.intro) data.intro = legacy.intro;
    clearLegacy();
  } catch (cause) {
    console.error("[records] localStorage → cloud migration failed:", cause);
  }
}

/* --- self-introduction -------------------------------------------------- */

export function subscribeIntro(listener: Listener): () => void {
  return subscribe(listener);
}

export function getIntroSnapshot(): StoredIntro | null {
  return intro;
}

/** Server snapshot for useSyncExternalStore — records don't exist during SSR. */
export function getIntroServerSnapshot(): StoredIntro | null {
  return null;
}

/**
 * Update the in-memory intro after /api/intro succeeded — the cloud write
 * already happened inside that route, so there is no second save here.
 */
export function saveIntro(text: string, signature: string): void {
  intro = { text, signature, generatedAt: new Date().toISOString() };
  emit();
}

export function clearIntro(): void {
  intro = null;
  emit();
}

/**
 * Fingerprint of every fact the introduction was written from — the stored
 * text is regenerated the moment any of them changes (or the name differs).
 */
export function introSignature(name: string, profile: StudentProfile): string {
  return JSON.stringify([name, profile]);
}

/* --- completed projects ------------------------------------------------- */

export function subscribeCompleted(listener: Listener): () => void {
  return subscribe(listener);
}

export function getCompletedSnapshot(): CompletionRecord[] {
  return completions;
}

/** Server snapshot for useSyncExternalStore — records don't exist during SSR. */
export function getCompletedServerSnapshot(): CompletionRecord[] {
  return EMPTY_COMPLETIONS;
}

/**
 * Mark a project complete in the cloud (idempotent server-side). Returns
 * { ok:false, error } with plain-word copy instead of throwing, so the
 * button can show the failure loudly right where the student clicked.
 */
export async function addCompletion(
  record: CompletionRecord,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const headers = await authHeaders();
    if (!headers.authorization) {
      return {
        ok: false,
        error: "Sign in required — sign back in to record a completed project.",
      };
    }
    const res = await fetch("/api/records", {
      method: "POST",
      headers: { ...headers, "content-type": "application/json" },
      body: JSON.stringify({ action: "complete", record }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = (await res.json().catch(() => null)) as
      | { completions?: CompletionRecord[]; error?: string }
      | null;
    if (!res.ok) {
      return {
        ok: false,
        error:
          (data && typeof data.error === "string" && data.error) ||
          `The server returned ${res.status} without saving your record.`,
      };
    }
    if (Array.isArray(data?.completions)) {
      completions = data.completions.length > 0 ? data.completions : EMPTY_COMPLETIONS;
      emit();
    }
    return { ok: true };
  } catch (cause) {
    console.error("[records] addCompletion failed:", cause);
    return {
      ok: false,
      error: "Could not reach the server — check your connection and try again.",
    };
  }
}

/* --- load state (gates + loud errors) ----------------------------------- */

/** True once the first load attempt finished — never shows "Locked" early. */
export function recordsResolved(): boolean {
  return resolved;
}

export function getRecordsErrorSnapshot(): string | null {
  return loadError;
}

/** Server snapshots for useSyncExternalStore — unknown until the browser asks. */
export function getServerResolvedSnapshot(): false {
  return false;
}

export function getServerRecordsErrorSnapshot(): null {
  return null;
}
