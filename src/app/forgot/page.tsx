"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { accountExists, resetPassword } from "@/lib/auth";
import { LogoLockup } from "@/components/logo";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Forgot-password flow with a REAL emailed OTP:
 *   1. Enter the registered email → /api/otp/request mails a 6-digit code.
 *   2. Enter code + new password → /api/otp/verify checks the signed ticket →
 *      the local account hash is rewritten and the student is signed in.
 * The code only ever exists in the email — it is never rendered on screen.
 */
export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "verify">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [ticket, setTicket] = useState<{ expiresAt: number; mac: string } | null>(null);
  const [cooldown, setCooldown] = useState(0);
  const [ttlSeconds, setTtlSeconds] = useState(300);
  const [attempts, setAttempts] = useState(0);

  // Resend cooldown ticker (runs while on the verify step).
  useEffect(() => {
    if (step !== "verify" || cooldown <= 0) return;
    const id = window.setInterval(
      () => setCooldown((s) => (s > 0 ? s - 1 : 0)),
      1000,
    );
    return () => window.clearInterval(id);
  }, [step, cooldown]);

  async function requestCode(event?: React.FormEvent) {
    event?.preventDefault();
    setError(null);

    const clean = email.trim().toLowerCase();
    if (!EMAIL_RE.test(clean)) {
      setError("That email doesn't look right.");
      return;
    }
    if (!accountExists(clean)) {
      setError("No account found on this device — create one first.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/otp/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: clean }),
        signal: AbortSignal.timeout(30_000),
      });
      const data = (await res.json().catch(() => null)) as
        | { error?: string; expiresAt?: number; mac?: string; cooldownSeconds?: number; ttlSeconds?: number }
        | null;

      if (!res.ok || !data?.mac || !data.expiresAt) {
        setError(
          data?.error
            ? data.error
            : `Could not send the code — the server returned ${res.status}.`,
        );
        return;
      }

      setTicket({ expiresAt: data.expiresAt, mac: data.mac });
      setTtlSeconds(data.ttlSeconds ?? 300);
      setCooldown(data.cooldownSeconds ?? 60);
      setAttempts(0);
      setCode("");
      setPassword("");
      setConfirm("");
      setNotice(
        `Code sent to ${clean} — check your inbox (and spam). It expires in ${
          Math.max(1, Math.round((data.ttlSeconds ?? 300) / 60))
        } minute${(data.ttlSeconds ?? 300) <= 60 ? "" : "s"}.`,
      );
      setStep("verify");
    } catch (cause) {
      const timedOut =
        cause instanceof DOMException &&
        (cause.name === "TimeoutError" || cause.name === "AbortError");
      setError(
        timedOut
          ? "Sending the code took too long — please try again."
          : "Could not reach the server — check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function verifyAndReset(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const clean = email.trim().toLowerCase();
    if (!/^\d{6}$/.test(code.trim())) {
      setError("Enter the 6-digit code from the email.");
      return;
    }
    if (password.length < 6) {
      setError("New password needs at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    if (!ticket) {
      setError("Request a new code first.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/otp/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email: clean,
          code: code.trim(),
          expiresAt: ticket.expiresAt,
          mac: ticket.mac,
        }),
        signal: AbortSignal.timeout(30_000),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;

      if (!res.ok) {
        const next = attempts + 1;
        setAttempts(next);
        if (next >= 5 || res.status === 429) {
          setStep("request");
          setTicket(null);
          setNotice(null);
          setError("Too many wrong attempts — request a fresh code.");
        } else {
          setError(
            `${data?.error ?? `Verification failed — the server returned ${res.status}.`} (${
              5 - next
            } attempt${5 - next === 1 ? "" : "s"} left)`,
          );
        }
        return;
      }

      const result = resetPassword(clean, password);
      if (!result.ok) {
        setError(result.error ?? "Could not update the password on this device.");
        return;
      }
      router.push("/profile");
    } catch (cause) {
      const timedOut =
        cause instanceof DOMException &&
        (cause.name === "TimeoutError" || cause.name === "AbortError");
      setError(
        timedOut
          ? "Verification took too long — please try again."
          : "Could not reach the server — check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const ttlMinutes = Math.max(1, Math.round(ttlSeconds / 60));

  return (
    <div className="flex flex-1 items-center justify-center px-6 py-14">
      <div className="w-full max-w-md">
        <div className="card p-8">
          <div className="flex flex-col items-center text-center">
            <LogoLockup width={200} />
            <h1 className="mt-5 text-2xl font-semibold tracking-tight">
              {step === "request" ? "Forgot your password?" : "Enter your code"}
            </h1>
            <p className="mt-2 text-sm text-mist">
              {step === "request"
                ? "Enter the email you signed up with on this device — we’ll email you a 6-digit code."
                : `We emailed a 6-digit code to ${email}. It expires in ${ttlMinutes} minute${
                    ttlSeconds <= 60 ? "" : "s"
                  }.`}
            </p>
          </div>

          {step === "request" ? (
            <form onSubmit={requestCode} className="mt-7 space-y-4">
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

              {error && (
                <p
                  role="alert"
                  className="rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
                >
                  {error}
                </p>
              )}

              <button type="submit" className="btn btn-accent w-full" disabled={busy}>
                {busy ? "Sending…" : "Email me a code"}
              </button>
            </form>
          ) : (
            <form onSubmit={verifyAndReset} className="mt-7 space-y-4">
              <label className="block">
                <span className="label">6-digit code</span>
                <input
                  className="field text-center font-mono tracking-[0.4em]"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  autoComplete="one-time-code"
                />
              </label>

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

              <button type="submit" className="btn btn-accent w-full" disabled={busy || !ticket}>
                {busy ? "Verifying…" : "Reset password"}
              </button>

              <div className="flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => requestCode()}
                  disabled={cooldown > 0 || busy}
                  className="text-sky hover:underline disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
                </button>
                <Link href="/login" className="text-mist transition hover:text-chalk">
                  ← Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-xs text-mist">
          Codes are sent by real email and expire in {ttlMinutes} minute
          {ttlSeconds <= 60 ? "" : "s"} — the code never appears on screen.
        </p>
      </div>
    </div>
  );
}
