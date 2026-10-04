"use client";

import { useEffect, useState } from "react";

type Status =
  | { kind: "checking" }
  | { kind: "online"; model: string; provider: "ollama" | "gemini" }
  | { kind: "offline"; message: string };

/**
 * Live badge showing whether the active AI engine (local Ollama or Gemini)
 * is actually reachable. Reports real state only — when it is down it says so.
 */
export function EngineStatus() {
  const [status, setStatus] = useState<Status>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const res = await fetch("/api/health", { cache: "no-store" });
        const data = (await res.json()) as {
          ok: boolean;
          model: string;
          provider?: "ollama" | "gemini";
          error?: string;
          modelPresent?: boolean;
        };
        if (cancelled) return;
        if (data.ok && data.modelPresent !== false) {
          setStatus({
            kind: "online",
            model: data.model,
            provider: data.provider ?? "ollama",
          });
        } else {
          setStatus({
            kind: "offline",
            message: data.error ?? `model "${data.model}" is not pulled`,
          });
        }
      } catch {
        if (!cancelled) setStatus({ kind: "offline", message: "status check failed" });
      }
    }

    check();
    const timer = window.setInterval(check, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  const base =
    "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium";

  if (status.kind === "checking") {
    return (
      <span className={`${base} border-line bg-panel text-mist`}>
        <span className="size-1.5 animate-pulse rounded-full bg-mist" />
        Checking AI engine…
      </span>
    );
  }

  if (status.kind === "online") {
    return (
      <span
        className={`${base} border-accent/30 bg-accent/10 text-accent`}
        title={`${status.provider === "gemini" ? "Gemini API" : "Local Ollama"} · ${status.model}`}
      >
        <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
        AI engine online · {status.model}
      </span>
    );
  }

  return (
    <span
      className={`${base} border-danger/30 bg-danger/10 text-danger`}
      title={status.message}
    >
      <span className="size-1.5 rounded-full bg-danger" />
      AI engine offline
    </span>
  );
}
