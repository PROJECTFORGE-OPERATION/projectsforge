"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import {
  authResolved,
  getAuthSnapshot,
  getServerResolvedSnapshot,
  getServerSnapshot as getAuthServerSnapshot,
  subscribeAuth,
} from "@/lib/auth";
import {
  getClaimsServerSnapshot,
  getClaimsSnapshot,
  getCompletedServerSnapshot,
  getCompletedSnapshot,
  getRecordsErrorSnapshot,
  getServerRecordsErrorSnapshot,
  loadRecords,
  recordsResolved,
  subscribeClaims,
  subscribeCompleted,
} from "@/lib/records";
import {
  getRunSnapshot,
  getServerSnapshot,
  subscribeRun,
} from "@/lib/session";
import { tierOf } from "@/lib/projects";
import { AllotmentBanner } from "@/components/allotment-banner";

/**
 * My Projects — the portfolio home after login (Phase 3).
 *
 *   My Projects   → completed projects (interview records, unlock Communication)
 *   Draft Projects → allotted-but-incomplete work, plus the current
 *                    recommendation that hasn't been claimed yet
 *
 * Completed/incomplete moves happen server-side when a project is marked
 * complete — this page only renders the two states from /api/records.
 */
export default function MyProjectsPage() {
  const router = useRouter();
  const student = useSyncExternalStore(
    subscribeAuth,
    getAuthSnapshot,
    getAuthServerSnapshot,
  );
  const authReady = useSyncExternalStore(
    subscribeAuth,
    authResolved,
    getServerResolvedSnapshot,
  );
  const completed = useSyncExternalStore(
    subscribeCompleted,
    getCompletedSnapshot,
    getCompletedServerSnapshot,
  );
  const claims = useSyncExternalStore(
    subscribeClaims,
    getClaimsSnapshot,
    getClaimsServerSnapshot,
  );
  const recordsReady = useSyncExternalStore(
    subscribeCompleted,
    recordsResolved,
    getServerResolvedSnapshot,
  );
  const recordsError = useSyncExternalStore(
    subscribeCompleted,
    getRecordsErrorSnapshot,
    getServerRecordsErrorSnapshot,
  );
  const run = useSyncExternalStore(subscribeRun, getRunSnapshot, getServerSnapshot);

  useEffect(() => {
    void loadRecords();
  }, []);

  // Same gate as /profile and /communication: signed-out → login, hydration-safe.
  useEffect(() => {
    if (authReady && getAuthSnapshot() === null && student === null)
      router.replace("/login");
  }, [authReady, student, router]);

  if (!student) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-24 text-center">
        <p className="text-sm text-mist">
          Sign in required — taking you to the login page…
        </p>
      </div>
    );
  }

  const completedIds = new Set(completed.map((entry) => entry.id));
  const claimedIds = new Set(claims.map((entry) => entry.projectId));
  const drafts = claims.filter((entry) => !completedIds.has(entry.projectId));
  const analyzedUnclaimed =
    run &&
    !completedIds.has(run.analysis.primary.id) &&
    !claimedIds.has(run.analysis.primary.id)
      ? run.analysis.primary
      : null;

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 px-6 pb-16">
      <header className="flex items-center justify-end py-6">
        <span className="hidden text-xs text-mist sm:inline">My Projects</span>
      </header>

      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        My Projects
      </h1>
      <p className="mt-2 text-sm text-mist">
        Completed work lives here as interview records; allotted-but-incomplete
        projects stay in drafts until you finish them.
      </p>

      <div className="mt-5">
        <AllotmentBanner />
      </div>

      {!recordsReady ? (
        <section className="card mt-6 p-6 text-center text-sm text-mist">
          Loading your projects from the cloud…
        </section>
      ) : recordsError ? (
        <section
          className="card mt-6 border-danger/40 bg-danger/5 p-6 text-center"
          role="alert"
        >
          <span className="label">Projects unavailable</span>
          <p className="mt-2 text-sm text-danger">{recordsError}</p>
          <button
            type="button"
            className="btn btn-ghost mt-4"
            onClick={() => {
              void loadRecords();
            }}
          >
            Try again
          </button>
        </section>
      ) : (
        <div className="mt-8 space-y-10">
          {/* ---- Completed ---- */}
          <section>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-mist">
                My Projects
              </span>
              <span className="h-px flex-1 bg-line" />
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                {completed.length}
              </span>
            </div>

            {completed.length === 0 ? (
              <div className="card border-dashed p-6 text-center text-sm text-mist">
                No completed projects yet — mark one complete on your roadmap
                and it moves here as an interview record.
                <div className="mt-4">
                  <Link href="/profile" className="btn btn-accent">
                    Build a roadmap <span aria-hidden>→</span>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {completed.map((record) => (
                  <article key={record.id} className="card p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold">{record.title}</h3>
                      <span className="text-[0.7rem] text-mist">
                        {record.completedAt
                          ? `Completed ${new Date(record.completedAt).toLocaleDateString()}`
                          : "Completed"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span
                        className={
                          tierOf(record.id) === "strong"
                            ? "tag !border-accent/50 !text-accent"
                            : "tag"
                        }
                      >
                        {tierOf(record.id) === "strong"
                          ? "Strong project"
                          : "Normal project"}
                      </span>
                      <span className="tag">{record.weeks} weeks</span>
                      {record.technologies.slice(0, 6).map((tech) => (
                        <span key={tech} className="tag">
                          {tech}
                        </span>
                      ))}
                    </div>
                    <Link
                      href="/communication"
                      className="mt-3 inline-block text-xs text-sky hover:underline"
                    >
                      Interview record (Communication Skills) →
                    </Link>
                  </article>
                ))}
              </div>
            )}
          </section>

          {/* ---- Incomplete ---- */}
          <section>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-mist">
                Draft Projects
              </span>
              <span className="h-px flex-1 bg-line" />
              <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">
                {drafts.length + (analyzedUnclaimed ? 1 : 0)}
              </span>
            </div>

            {drafts.length === 0 && !analyzedUnclaimed ? (
              <div className="card border-dashed p-6 text-center text-sm text-mist">
                No projects in progress. Claim a recommendation and it shows up
                here until you complete it.
                <div className="mt-4">
                  <Link href="/profile" className="btn btn-ghost">
                    Start an analysis
                  </Link>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {analyzedUnclaimed && (
                  <article className="card border-warn/35 p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold">
                        {analyzedUnclaimed.title}
                      </h3>
                      <span className="text-[0.7rem] text-warn">
                        Recommended — not allotted yet
                      </span>
                    </div>
                    <p className="mt-1.5 text-xs text-mist">
                      Claim it on the analysis page to move it into Draft
                      Projects.
                    </p>
                    <Link
                      href="/result"
                      className="btn btn-ghost mt-3 !px-3 !py-1.5 !text-xs"
                    >
                      Open recommendation →
                    </Link>
                  </article>
                )}

                {drafts.map((claim) => (
                  <article key={claim.projectId} className="card p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="text-sm font-semibold">{claim.title}</h3>
                      <span className="text-[0.7rem] text-mist">
                        {claim.claimedAt
                          ? `Allotted ${new Date(claim.claimedAt).toLocaleDateString()}`
                          : "Allotted"}
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span
                        className={
                          claim.tier === "strong"
                            ? "tag !border-accent/50 !text-accent"
                            : "tag"
                        }
                      >
                        {claim.tier === "strong"
                          ? "Strong project"
                          : "Normal project"}
                      </span>
                      <span className="tag !border-warn/45 !text-warn">
                        In progress
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <Link
                        href="/result"
                        className="text-xs text-sky hover:underline"
                      >
                        Open roadmap →
                      </Link>
                      <Link
                        href="/result?tab=roadmap"
                        className="text-xs text-mist hover:text-chalk"
                      >
                        Mark complete from the Roadmap tab
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
