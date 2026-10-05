"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { completeReset, sendResetEmail } from "@/lib/auth";
import { LogoLockup } from "@/components/logo";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Forgot-password on Firebase Auth:
 *   request → Google emails a reset link to the registered address (any
 *   domain) → the link opens here (/forgot?mode=resetPassword&oobCode=…)
 *   → set a new password in-app → sign in. The emailed link is the proof of
 *   inbox control; there is no fallback UI and nothing is ever faked.
 *
 * searchParams are read at render time (inside the Suspense boundary the
 * docs require for useSearchParams on statically prerendered pages).
 */
function ResetFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const resetCode =
    params.get("mode") === "resetPassword" ? params.get("oobCode") : null;

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setError("That email doesn't look right.");
      return;
    }

    setBusy(true);
    try {
      const result = await sendResetEmail(clean);
      if (!result.ok) {
        setError(result.error ?? "Could not send the reset link.");
        return;
      }
      setNotice(
        `Reset link sent to ${clean} — open it on any device and you'll land back here to set a new password. Check spam if it doesn't arrive in a few minutes.`,
      );
    } finally {
      setBusy(false);
    }
  }

  async function applyReset(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("New password needs at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (!resetCode) {
      setError("That reset link is incomplete — request a new one.");
      return;
    }

    setBusy(true);
    try {
      const result = await completeReset(resetCode, password);
      if (!result.ok) {
        setError(result.error ?? "Could not update the password.");
        return;
      }
      setDone(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-14">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="flex flex-col items-center text-center">
            <LogoLockup width={200} />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">
              {done
                ? "Password updated"
                : resetCode
                  ? "Set a new password"
                  : "Forgot your password?"}
            </h1>
            <p className="mt-2 text-sm text-mist">
              {done
                ? "Your password has been changed. Sign in with it to continue."
                : resetCode
                  ? "Pick a new password for your ProjectsForge account."
                  : "Enter the email you signed up with — we'll email you a reset link."}
            </p>
          </div>

          {done ? (
            <div className="mt-7 space-y-4">
              <button
                type="button"
                className="btn btn-accent w-full"
                onClick={() => router.push("/login")}
              >
                Go to sign in
              </button>
            </div>
          ) : resetCode ? (
            <form onSubmit={applyReset} noValidate className="mt-7 space-y-4">
              <label className="block">
                <span className="label">New password</span>
                <input
                  className="field"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                />
              </label>

              <label className="block">
                <span className="label">Confirm new password</span>
                <input
                  className="field"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat it"
                  autoComplete="new-password"
                />
              </label>

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  {error}
                </p>
              )}

              <button type="submit" className="btn btn-accent w-full" disabled={busy}>
                {busy ? "Updating…" : "Update password"}
              </button>
            </form>
          ) : (
            <form onSubmit={requestCode} noValidate className="mt-7 space-y-4">
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

              {notice && (
                <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
                  {notice}
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
                {busy ? "Sending…" : "Email me a reset link"}
              </button>
            </form>
          )}

          {!resetCode && (
            <p className="mt-5 text-center text-sm">
              <Link href="/login" className="text-mist transition hover:text-chalk">
                ← Back to sign in
              </Link>
            </p>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-mist">
          Reset emails are sent by Google to your own address — the link is the
          proof, and it only works for your account.
        </p>
      </div>
    </div>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetFlow />
    </Suspense>
  );
}
