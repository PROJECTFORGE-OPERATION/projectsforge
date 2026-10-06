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
  getCompletedServerSnapshot,
  getCompletedSnapshot,
  getRecordsErrorSnapshot,
  getServerRecordsErrorSnapshot,
  loadRecords,
  recordsResolved,
  subscribeCompleted,
} from "@/lib/records";
import {
  getDraftSnapshot,
  getRunSnapshot,
  getServerSnapshot,
  subscribeDraft,
  subscribeRun,
} from "@/lib/session";
import { COMM_TOPICS } from "@/lib/communication";
import { ResourceLink } from "@/components/resource-link";
import { SelfIntroCard } from "@/components/self-intro";
import { Monogram } from "@/components/logo";
import { AccountChip } from "@/components/account-chip";

/**
 * Communication Skills — locked until the student marks their first project
 * complete on the roadmap. Unlocked: the generated self-introduction,
 * completed-project records (Phase 1 stored locally; Firestore moves them
 * server-side for the founder dashboard) and the curated interview guide.
 */
export default function CommunicationPage() {
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
  const draft = useSyncExternalStore(subscribeDraft, getDraftSnapshot, getServerSnapshot);
  const run = useSyncExternalStore(subscribeRun, getRunSnapshot, getServerSnapshot);

  // The unlock state lives in Firestore now — refresh it on every visit
  // (loadRecords dedupes concurrent callers, refetches across navigations).
  useEffect(() => {
    void loadRecords();
  }, []);

  // Same gate as /profile: signed-out visitors are sent to login — but only
  // after Firebase has resolved its first state (hydration-safe).
  useEffect(() => {
    if (authReady && getAuthSnapshot() === null && student === null)
      router.replace("/login");
  }, [authReady, student, router]);
  if (!student) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-24 text-center">
        <p className="text-sm text-mist">Sign in required — taking you to the login page…</p>
      </div>
    );
  }

  const unlocked = completed.length > 0;

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 px-6 pb-16">
      <header className="flex items-center justify-between py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Monogram size={30} glow={false} />
          <span className="text-sm font-semibold tracking-wide">ProjectsForge</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="hidden text-xs text-mist sm:inline">Communication Skills</span>
          <AccountChip />
        </div>
      </header>

      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        Communication Skills
      </h1>
      <p className="mt-2 text-sm text-mist">
        Your self-introduction, records of what you have built, and a curated
        interview guide — everything in one place when it matters.
      </p>

      {!recordsReady ? (
        <section className="card mt-6 p-6 text-center text-sm text-mist">
          Loading your records from the cloud…
        </section>
      ) : recordsError ? (
        <section
          className="card mt-6 border-danger/40 bg-danger/5 p-6 text-center"
          role="alert"
        >
          <span className="label">Records unavailable</span>
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
      ) : !unlocked ? (
        <section className="card mt-6 border-dashed p-6 text-center">
          <span className="label">Locked</span>
          <h2 className="mt-2 text-xl font-bold tracking-tight">
            Complete one project to open this section
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-mist">
            This section unlocks the moment you mark a project complete on your
            roadmap. Inside: your generated self-introduction, the record of
            what you built, and the interview communication guide.
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            {run ? (
              <Link href="/result" className="btn btn-accent">
                Go to my roadmap <span aria-hidden>→</span>
              </Link>
            ) : (
              <Link href="/profile" className="btn btn-accent">
                Build a roadmap <span aria-hidden>→</span>
              </Link>
            )}
            <Link href="/" className="btn btn-ghost">
              Home
            </Link>
          </div>
        </section>
      ) : (
        <div className="mt-6 space-y-6">
          {/* Generated self-introduction (shared store with the result page) */}
          <SelfIntroCard profile={draft?.profile ?? null} />

          {/* Completed-project records */}
          <section>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-mist">
                Your completed projects
              </span>
              <span className="h-px flex-1 bg-line" />
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                {completed.length}
              </span>
            </div>
            <div className="space-y-3">
              {completed.map((record) => {
                const matching =
                  draft && draft.analysis.primary.id === record.id
                    ? draft.analysis
                    : null;
                const finalWeek = matching
                  ? matching.roadmap[matching.roadmap.length - 1]
                  : undefined;
                return (
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
                      <span className="tag">{record.weeks} weeks</span>
                      {record.technologies.map((tech) => (
                        <span key={tech} className="tag">
                          {tech}
                        </span>
                      ))}
                    </div>
                    {record.skillsCovered.length > 0 && (
                      <p className="mt-2 text-xs text-mist">
                        Skills covered:{" "}
                        <span className="text-chalk">
                          {record.skillsCovered.join(" · ")}
                        </span>
                      </p>
                    )}
                    {matching && (
                      <div className="mt-3 space-y-2 border-t border-line pt-3 text-xs leading-relaxed text-mist">
                        <p>
                          <span className="text-chalk">Why you picked it:</span>{" "}
                          {matching.primary.whyMatched}
                        </p>
                        {finalWeek && (
                          <p>
                            <span className="text-chalk">Final deliverable:</span>{" "}
                            {finalWeek.deliverable}
                          </p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          </section>

          {/* Curated interview communication guide */}
          <section>
            <div className="mb-3 flex items-center gap-3">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-mist">
                Interview communication guide
              </span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="grid gap-4">
              {COMM_TOPICS.map((topic) => (
                <article key={topic.id} className="card p-5">
                  <h3 className="text-sm font-semibold">{topic.title}</h3>
                  <p className="mt-1 text-xs text-sky">{topic.blurb}</p>
                  <ul className="mt-3 space-y-1.5">
                    {topic.points.map((point) => (
                      <li
                        key={point}
                        className="flex items-start gap-2 text-xs leading-relaxed text-mist"
                      >
                        <span className="text-accent">•</span>
                        {point}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 rounded-xl border border-line bg-panel/60 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[0.64rem] font-bold uppercase tracking-[0.16em] text-sky">
                        Resources
                      </span>
                      <span className="h-px flex-1 bg-line" />
                    </div>
                    <ul className="mt-2 grid gap-1.5">
                      {topic.resources.map((resource) => (
                        <li key={resource.url}>
                          <ResourceLink resource={resource} />
                        </li>
                      ))}
                    </ul>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
