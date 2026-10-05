"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { StudentProfile } from "@/lib/types";
import {
  clearIntro,
  getIntroServerSnapshot,
  getIntroSnapshot,
  introSignature,
  saveIntro,
  subscribeIntro,
} from "@/lib/records";
import {
  getAuthSnapshot,
  getServerSnapshot as getAuthServerSnapshot,
  subscribeAuth,
} from "@/lib/auth";

/**
 * First-person self-introduction generated from the student's profile
 * (hobbies / schooling / college included). Generated automatically the first
 * time the card is viewed for a given profile; Regenerate forces a fresh pass.
 *
 * Zero fallback: a failed generation shows the engine's error loudly instead
 * of substituting text the model did not write.
 */
export function SelfIntroCard({ profile }: { profile: StudentProfile | null }) {
  const student = useSyncExternalStore(
    subscribeAuth,
    getAuthSnapshot,
    getAuthServerSnapshot,
  );
  const intro = useSyncExternalStore(
    subscribeIntro,
    getIntroSnapshot,
    getIntroServerSnapshot,
  );

  const [status, setStatus] = useState<"idle" | "generating" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const attemptedRef = useRef<string | null>(null);

  const signature =
    student !== null && profile !== null ? introSignature(student.name, profile) : null;
  const fresh = signature !== null && intro !== null && intro.signature === signature;
  const text = intro?.text ?? "";

  // Auto-generate once per profile. The attempted-guard stops failure loops;
  // cleanup resets it when the request never finished (unmount / StrictMode
  // remount), so an interrupted attempt can be retried on the next render.
  useEffect(() => {
    if (signature === null || student === null) return;
    if (fresh) return;
    if (attemptedRef.current === signature) return;
    attemptedRef.current = signature;

    const controller = new AbortController();
    let done = false;
    setStatus("generating");
    setError(null);

    (async () => {
      try {
        const res = await fetch("/api/intro", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: student.name, profile }),
          signal: controller.signal,
        });
        const data = (await res.json().catch(() => null)) as
          | { introduction?: string; error?: string }
          | null;
        if (controller.signal.aborted) return;
        if (!res.ok || !data?.introduction) {
          done = true;
          setStatus("error");
          setError(
            data?.error ??
              `The server returned ${res.status} without an introduction.`,
          );
          return;
        }
        done = true;
        saveIntro(data.introduction.trim(), signature);
        setStatus("idle");
      } catch (cause) {
        if (controller.signal.aborted) return;
        done = true;
        setStatus("error");
        setError(
          cause instanceof DOMException &&
            (cause.name === "TimeoutError" || cause.name === "AbortError")
            ? "Generating the introduction took too long — please try again."
            : "Could not reach the server — check your connection and try again.",
        );
      }
    })();

    return () => {
      controller.abort();
      if (!done) attemptedRef.current = null;
    };
  }, [signature, student, profile, fresh, retryTick]);

  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  function regenerate(): void {
    clearIntro();
    attemptedRef.current = null;
    setCopied(false);
    setRetryTick((tick) => tick + 1);
  }

  return (
    <section className="card p-5" aria-labelledby="self-intro-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="self-intro-heading" className="text-base font-semibold">
            Self-introduction
          </h2>
          <p className="mt-1 text-xs text-mist">
            Written from your profile in first person — read it aloud until it
            sounds like you.
          </p>
        </div>
        {text && status !== "generating" && (
          <div className="flex gap-2">
            <button type="button" onClick={copy} className="btn btn-ghost">
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <button type="button" onClick={regenerate} className="btn btn-ghost">
              Regenerate
            </button>
          </div>
        )}
      </div>

      {status === "error" && (
        <div
          role="alert"
          className="mt-4 rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger"
        >
          <span className="font-semibold">AI engine error:</span> {error}
          <p className="mt-1 text-xs opacity-80">
            This app has no canned fallback — the introduction is only ever
            model-written.
          </p>
          <button
            type="button"
            onClick={() => {
              attemptedRef.current = null;
              setRetryTick((tick) => tick + 1);
            }}
            className="btn btn-ghost mt-3"
          >
            Try again
          </button>
        </div>
      )}

      {status === "generating" && !text && (
        <div className="mt-4 flex items-center gap-3 text-sm text-mist">
          <span className="size-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          Writing your introduction from your profile — usually under a minute…
        </div>
      )}

      {text && (
        <div className="mt-4">
          {status === "generating" && (
            <p className="mb-2 text-xs text-accent">Updating…</p>
          )}
          <p className="whitespace-pre-line rounded-xl border border-line bg-panel-2/40 p-4 text-sm leading-relaxed text-chalk/90">
            {text}
          </p>
        </div>
      )}

      {!text && status === "idle" && (!student || profile === null) && (
        <p className="mt-4 text-sm text-mist">
          {!student ? (
            <>
              <Link href="/login" className="text-sky underline underline-offset-2">
                Sign in
              </Link>{" "}
              to generate your introduction.
            </>
          ) : profile === null ? (
            <>
              Build your{" "}
              <Link href="/profile" className="text-sky underline underline-offset-2">
                profile
              </Link>{" "}
              first — the introduction is written from it.
            </>
          ) : null}
        </p>
      )}
    </section>
  );
}
