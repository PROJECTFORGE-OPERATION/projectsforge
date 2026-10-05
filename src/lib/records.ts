import type { StudentProfile } from "./types";

/**
 * Student portfolio records kept alongside the analysis (localStorage — unlike
 * the analysis run, an achievement must survive a browser restart):
 *
 *  - the generated self-introduction, fingerprinted against the profile it
 *    was written from so an edit to hobbies/schooling/college regenerates it
 *  - completed-project records, which unlock the Communication Skills section
 *
 * Phase 1 stores both in the browser like the analysis run; the Firestore
 * migration (Phase 2) moves them server-side with the same shapes so the
 * founder dashboard can read them. External-store pattern matches session.ts.
 */

const INTRO_KEY = "projectsforge:intro:v1";
const COMPLETED_KEY = "projectsforge:completed:v1";

export interface StoredIntro {
  text: string;
  /** Profile fingerprint the text was generated from — mismatch = stale. */
  signature: string;
  generatedAt: string;
}

/** Interview-ready record of a project the student marked complete. */
export interface CompletionRecord {
  id: string;
  title: string;
  technologies: string[];
  skillsCovered: string[];
  weeks: number;
  completedAt: string;
}

type Listener = () => void;
interface Cache<T> {
  raw: string | null;
  value: T | null;
}

const listeners = new Set<Listener>();
const introCache: Cache<StoredIntro> = { raw: null, value: null };
const completedCache: Cache<CompletionRecord[]> = { raw: null, value: null };

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function read<T>(cache: Cache<T>, key: string, pick: (data: unknown) => T | null): T | null {
  if (typeof window === "undefined") return null;
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(key);
  } catch {
    raw = null;
  }
  if (raw !== cache.raw) {
    cache.raw = raw;
    try {
      cache.value = raw ? pick(JSON.parse(raw)) : null;
    } catch {
      cache.value = null;
    }
  }
  return cache.value;
}

function write<T>(cache: Cache<T>, key: string, value: T): void {
  if (typeof window === "undefined") return;
  const raw = JSON.stringify(value);
  try {
    window.localStorage.setItem(key, raw);
  } catch {
    // storage full/unavailable — snapshots simply re-read on next access
  }
  cache.raw = raw;
  cache.value = value;
  emit();
}

function clear<T>(cache: Cache<T>, key: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // ignore
  }
  cache.raw = null;
  cache.value = null;
  emit();
}

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

/* --- self-introduction ------------------------------------------------- */

export function subscribeIntro(listener: Listener): () => void {
  return subscribe(listener);
}

export function getIntroSnapshot(): StoredIntro | null {
  return read(introCache, INTRO_KEY, pickIntro);
}

/** Server snapshot for useSyncExternalStore — storage does not exist on SSR. */
export function getIntroServerSnapshot(): StoredIntro | null {
  return null;
}

export function saveIntro(text: string, signature: string): void {
  write(introCache, INTRO_KEY, {
    text,
    signature,
    generatedAt: new Date().toISOString(),
  });
}

export function clearIntro(): void {
  clear(introCache, INTRO_KEY);
}

/**
 * Fingerprint of every fact the introduction was written from — the stored
 * text is regenerated the moment any of them changes (or the name differs).
 */
export function introSignature(name: string, profile: StudentProfile): string {
  return JSON.stringify([name, profile]);
}

/* --- completed projects ------------------------------------------------ */

export function subscribeCompleted(listener: Listener): () => void {
  return subscribe(listener);
}

/**
 * Stable empty array — `useSyncExternalStore` compares snapshots with
 * Object.is and React THROWS ("getSnapshot should be cached") when a getter
 * allocates a fresh [] on every call while storage is empty.
 */
const EMPTY_COMPLETED: CompletionRecord[] = [];

export function getCompletedSnapshot(): CompletionRecord[] {
  return read(completedCache, COMPLETED_KEY, pickCompleted) ?? EMPTY_COMPLETED;
}

/** Server snapshot for useSyncExternalStore — storage does not exist on SSR. */
export function getCompletedServerSnapshot(): CompletionRecord[] {
  return EMPTY_COMPLETED;
}

/** Idempotent: marking the same project complete twice keeps one record. */
export function addCompletion(record: CompletionRecord): void {
  const current = getCompletedSnapshot();
  if (current.some((entry) => entry.id === record.id)) return;
  write(completedCache, COMPLETED_KEY, [record, ...current]);
}
