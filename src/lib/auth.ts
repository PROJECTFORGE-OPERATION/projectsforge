/**
 * Device-local student accounts (hackathon-grade auth, honestly labelled).
 *
 * Accounts live in localStorage on the student's own device — there is no
 * server database and no claim of real security. Passwords are stored as a
 * salted non-cryptographic hash so they are not sitting in plain text, but
 * this exists to give the demo a real login flow, not to be production auth.
 *
 * Exposed as an external store (subscribe + snapshot) like session.ts so
 * pages can read the signed-in student with useSyncExternalStore — SSR-safe.
 */

const STUDENTS_KEY = "projectsforge:students:v1";
const SESSION_KEY = "projectsforge:session:v1";

export interface Student {
  name: string;
  email: string;
  joinedAt: string;
}

interface StoredAccount {
  name: string;
  hash: string;
  joinedAt: string;
}

type Accounts = Record<string, StoredAccount>;
type Listener = () => void;

const listeners = new Set<Listener>();
let cache: Student | null | undefined; // undefined = not read yet

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeAuth(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getServerSnapshot(): null {
  return null;
}

export function getAuthSnapshot(): Student | null {
  if (typeof window === "undefined") return null;
  if (cache !== undefined) return cache;
  cache = readSession();
  return cache;
}

/** Demo-grade password digest: salted FNV-1a. Not cryptographic — device-local only. */
function digest(password: string): string {
  const salted = `projectsforge:${password}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < salted.length; i++) {
    hash ^= salted.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  // Second pass with reversed input to widen the avalanche a little.
  for (let i = salted.length - 1; i >= 0; i--) {
    hash ^= salted.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function readAccounts(): Accounts {
  try {
    const raw = window.localStorage.getItem(STUDENTS_KEY);
    return raw ? (JSON.parse(raw) as Accounts) : {};
  } catch {
    return {};
  }
}

const STORAGE_ERROR = "Couldn't save to this device — its storage is full or blocked.";

/** Returns false when storage is full or blocked (private mode) — never throws. */
function writeAccounts(accounts: Accounts): boolean {
  try {
    window.localStorage.setItem(STUDENTS_KEY, JSON.stringify(accounts));
    return true;
  } catch {
    return false;
  }
}

/** Session write — same contract as writeAccounts. */
function writeSession(email: string): boolean {
  try {
    window.localStorage.setItem(SESSION_KEY, email);
    return true;
  } catch {
    return false;
  }
}

function readSession(): Student | null {
  try {
    const email = window.localStorage.getItem(SESSION_KEY);
    if (!email) return null;
    const account = readAccounts()[email.toLowerCase()];
    if (!account) return null;
    return { name: account.name, email: email.toLowerCase(), joinedAt: account.joinedAt };
  } catch {
    return null;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface AuthResult {
  ok: boolean;
  error?: string;
}

export function signUp(name: string, email: string, password: string): AuthResult {
  const cleanName = name.trim();
  const cleanEmail = email.trim().toLowerCase();
  if (cleanName.length < 2) return { ok: false, error: "Enter your full name." };
  if (!EMAIL_RE.test(cleanEmail)) return { ok: false, error: "That email doesn't look right." };
  if (password.length < 6)
    return { ok: false, error: "Password needs at least 6 characters." };

  const accounts = readAccounts();
  if (accounts[cleanEmail])
    return { ok: false, error: "An account already exists on this device — sign in instead." };

  accounts[cleanEmail] = {
    name: cleanName,
    hash: digest(password),
    joinedAt: new Date().toISOString(),
  };
  if (!writeAccounts(accounts)) return { ok: false, error: STORAGE_ERROR };
  if (!writeSession(cleanEmail)) return { ok: false, error: STORAGE_ERROR };
  cache = { name: cleanName, email: cleanEmail, joinedAt: accounts[cleanEmail].joinedAt };
  emit();
  return { ok: true };
}

export function signIn(email: string, password: string): AuthResult {
  const cleanEmail = email.trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail)) return { ok: false, error: "That email doesn't look right." };
  if (!password) return { ok: false, error: "Enter your password." };

  const account = readAccounts()[cleanEmail];
  if (!account)
    return {
      ok: false,
      error: "No account found on this device — create one first.",
    };
  if (account.hash !== digest(password))
    return { ok: false, error: "Wrong password. Try again." };

  if (!writeSession(cleanEmail)) return { ok: false, error: STORAGE_ERROR };
  cache = { name: account.name, email: cleanEmail, joinedAt: account.joinedAt };
  emit();
  return { ok: true };
}

export function signOut(): void {
  try {
    window.localStorage.removeItem(SESSION_KEY);
  } catch {
    // Blocked storage — still drop the in-memory session below.
  }
  cache = null;
  emit();
}
