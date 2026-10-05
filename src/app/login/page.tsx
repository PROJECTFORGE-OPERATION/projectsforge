"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  getAuthSnapshot,
  getServerSnapshot,
  signIn,
  signUp,
  subscribeAuth,
} from "@/lib/auth";
import { LogoLockup } from "@/components/logo";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const router = useRouter();
  const student = useSyncExternalStore(subscribeAuth, getAuthSnapshot, getServerSnapshot);
  const [mode, setMode] = useState<Mode>("signin");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Already signed in? Go straight to the profile builder.
  useEffect(() => {
    if (student) router.replace("/profile");
  }, [student, router]);

  async function submit(event: React.FormEvent): Promise<void> {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result =
        mode === "signin" ? await signIn(email, password) : await signUp(name, email, password);
      if (!result.ok) {
        setError(result.error ?? "Something went wrong.");
        return;
      }
      router.push("/profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-14">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="flex flex-col items-center text-center">
            <LogoLockup width={230} />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">
              {mode === "signin" ? "Welcome back" : "Create your student account"}
            </h1>
            <p className="mt-2 text-sm text-mist">
              {mode === "signin"
                ? "Sign in to continue building your roadmap."
                : "One minute to set up — then build your first project plan."}
            </p>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            {mode === "signup" && (
              <label className="block">
                <span className="label">Full name</span>
                <input
                  className="field"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Priya Sharma"
                  autoComplete="name"
                />
              </label>
            )}

            <label className="block">
              <span className="label">Email</span>
              <input
                className="field"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@college.edu"
                autoComplete="email"
              />
            </label>

            <label className="block">
              <span className="label">Password</span>
              <input
                className="field"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === "signup" ? "At least 6 characters" : "Your password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
              />
            </label>

            {mode === "signin" && (
              <div className="-mt-2 text-right">
                <Link href="/forgot" className="text-xs text-sky hover:underline">
                  Forgot password?
                </Link>
              </div>
            )}

            {error && (
              <p
                role="alert"
                className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
              >
                {error}
              </p>
            )}

            <button type="submit" className="btn btn-accent w-full" disabled={busy}>
              {busy
                ? mode === "signin"
                  ? "Signing in…"
                  : "Creating account…"
                : mode === "signin"
                  ? "Sign in"
                  : "Create account"}
            </button>
          </form>

          <p className="mt-5 text-center text-sm text-mist">
            {mode === "signin" ? "New here?" : "Already have an account?"}{" "}
            <button
              type="button"
              className="font-medium text-sky hover:underline"
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError(null);
              }}
            >
              {mode === "signin" ? "Create one" : "Sign in"}
            </button>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-mist">
          Accounts run on Firebase Authentication — sign in from any device with
          your email and password.
        </p>

        <p className="mt-3 text-center text-sm">
          <Link href="/" className="text-mist hover:text-chalk">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  );
}
