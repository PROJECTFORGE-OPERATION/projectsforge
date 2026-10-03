import type { AnalyzeResponse } from "./types";

/**
 * sessionStorage persistence so a page refresh on /result does not lose the
 * analysis, and so /profile can prefill the last submitted profile.
 *
 * Exposed as an external store (subscribe + snapshot) so pages can read it
 * with `useSyncExternalStore` — SSR-safe, no setState-in-effect.
 */

const RUN_KEY = "projectsforge:run:v1";
const DRAFT_KEY = "projectsforge:draft:v1";

export type StoredRun = AnalyzeResponse;
type Listener = () => void;
interface Cache {
  raw: string | null;
  value: StoredRun | null;
}

const listeners = new Set<Listener>();
const runCache: Cache = { raw: null, value: null };
const draftCache: Cache = { raw: null, value: null };

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function read(cache: Cache, key: string): StoredRun | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(key);
  } catch {
    raw = null;
  }
  if (raw !== cache.raw) {
    cache.raw = raw;
    try {
      cache.value = raw ? (JSON.parse(raw) as StoredRun) : null;
    } catch {
      cache.value = null;
    }
  }
  return cache.value;
}

function write(cache: Cache, key: string, run: StoredRun): void {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(run);
  try {
    window.sessionStorage.setItem(key, raw);
  } catch {
    // storage full/unavailable — snapshots simply re-read on next access
  }
  cache.raw = raw;
  cache.value = run;
  emit();
}

/* --- run (analysis result) ------------------------------------------- */

export function subscribeRun(listener: Listener): () => void {
  return subscribe(listener);
}

export function getRunSnapshot(): StoredRun | null {
  return read(runCache, RUN_KEY);
}

export function saveRun(run: StoredRun): void {
  write(runCache, RUN_KEY, run);
}

export function clearRun(): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(RUN_KEY);
  } catch {
    // ignore
  }
  runCache.raw = null;
  runCache.value = null;
  emit();
}

/* --- draft (last submitted profile) ---------------------------------- */

export function subscribeDraft(listener: Listener): () => void {
  return subscribe(listener);
}

export function getDraftSnapshot(): StoredRun | null {
  return read(draftCache, DRAFT_KEY);
}

export function saveDraft(run: StoredRun): void {
  write(draftCache, DRAFT_KEY, run);
}

/** Server snapshot for useSyncExternalStore — storage does not exist on SSR. */
export function getServerSnapshot(): StoredRun | null {
  return null;
}
