"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  authResolved,
  getAuthSnapshot,
  getServerResolvedSnapshot,
  getServerSnapshot as getAuthServerSnapshot,
  getIdToken,
  subscribeAuth,
} from "@/lib/auth";
import { FOUNDER_EMAIL } from "@/lib/founder";
import type { ClaimRecord, CompletionRecord } from "@/lib/types";

/** Mirrors the FounderStudent shape returned by /api/founder. */
interface FounderStudent {
  uid: string;
  name: string;
  email: string;
  joinedAt: string | null;
  updatedAt: string | null;
  branch: string | null;
  year: string | null;
  careerGoal: string | null;
  interests: string[];
  skills: string[];
  primaryTitle: string | null;
  matchScore: number | null;
  model: string | null;
  runCount: number;
  introCount: number;
  introText: string | null;
  completions: CompletionRecord[];
  claims: ClaimRecord[];
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
}

/**
 * One read path for the dashboard: used on first load AND after a transfer
 * so the founder always sees cloud truth instead of an optimistic guess.
 */
async function fetchStudents(): Promise<FounderStudent[]> {
  const token = await getIdToken();
  if (!token) {
    throw new Error("Sign in required — your session wasn't sent with this request.");
  }
  const res = await fetch("/api/founder", {
    headers: { authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(20_000),
  });
  const data = (await res.json().catch(() => null)) as
    | { students?: FounderStudent[]; error?: string }
    | null;
  if (!res.ok || !data || !Array.isArray(data.students)) {
    throw new Error(
      (data && typeof data.error === "string" && data.error) ||
        `The server returned ${res.status} without the student list.`,
    );
  }
  return data.students;
}

/**
 * Founder dashboard — every student's profile, analysis and completion
 * records in one view. Client-side the email only hides the door; the real
 * gate is /api/founder, which checks the verified ID token's email.
 */
export default function FounderPage() {
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

  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<FounderStudent[]>([]);

  const isFounder = student !== null && student.email.toLowerCase() === FOUNDER_EMAIL;

  // Same hydration-safe gate as /profile and /communication.
  useEffect(() => {
    if (authReady && getAuthSnapshot() === null) router.replace("/login");
  }, [authReady, router]);

  useEffect(() => {
    if (!isFounder) return;
    let cancelled = false;
    (async () => {
      try {
        const list = await fetchStudents();
        if (cancelled) return;
        setStudents(list);
        setStatus("ready");
      } catch (cause) {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "The dashboard couldn't be loaded.");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isFounder]);

  /** Re-read the cloud after a successful transfer. */
  async function handleTransferred(): Promise<void> {
    const list = await fetchStudents();
    setStudents(list);
  }

  if (!authReady || !student) {
    return (
      <div className="grid flex-1 place-items-center text-sm text-mist">
        Checking your session…
      </div>
    );
  }

  if (!isFounder) {
    return (
      <div className="mx-auto w-full max-w-3xl flex-1 px-6 py-24 text-center">
        <h1 className="text-2xl font-bold tracking-tight">Founder dashboard</h1>
        <p className="mt-3 text-sm text-mist">
          This dashboard is only available to the ProjectsForge founder account
          — signed in as {student?.email ?? "a non-founder account"}.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/" className="btn btn-ghost">
            Home
          </Link>
          <Link href="/profile" className="btn btn-accent">
            My roadmap
          </Link>
        </div>
      </div>
    );
  }

  const totalAnalyses = students.reduce((sum, entry) => sum + entry.runCount, 0);
  const totalCompletions = students.reduce(
    (sum, entry) => sum + entry.completions.length,
    0,
  );

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 pb-16">
      <header className="flex items-center justify-end py-6">
        <span className="hidden text-xs text-mist sm:inline">Founder dashboard</span>
      </header>

      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
        All students
      </h1>
      <p className="mt-2 text-sm text-mist">
        Every account&apos;s profile, latest analysis and completion records —
        refreshed each time you open this page.
      </p>

      {status === "loading" && (
        <div className="card mt-6 flex items-center gap-3 p-6 text-sm text-mist">
          <span className="size-4 animate-spin rounded-full border-2 border-accent/30 border-t-accent" />
          Loading the student list…
        </div>
      )}

      {status === "error" && (
        <section
          className="card mt-6 border-danger/40 bg-danger/5 p-6"
          role="alert"
        >
          <span className="label">Dashboard unavailable</span>
          <p className="mt-2 text-sm text-danger">{error}</p>
          <button
            type="button"
            className="btn btn-ghost mt-4"
            onClick={() => window.location.reload()}
          >
            Reload page
          </button>
        </section>
      )}

      {status === "ready" && (
        <>
          {/* Totals */}
          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <StatCard label="Students" value={String(students.length)} />
            <StatCard label="Analyses run" value={String(totalAnalyses)} />
            <StatCard label="Projects completed" value={String(totalCompletions)} />
          </div>

          {students.length === 0 ? (
            <section className="card mt-6 border-dashed p-6 text-center text-sm text-mist">
              No students yet — records appear here the moment someone runs
              their first analysis.
            </section>
          ) : (
            <div className="mt-6 space-y-4">
              {students.map((entry) => (
                <StudentCard
                  key={entry.uid}
                  student={entry}
                  students={students}
                  onTransferred={handleTransferred}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <div className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-mist">
        {label}
      </div>
      <div className="mt-1 font-mono text-2xl font-bold text-accent">{value}</div>
    </div>
  );
}

function StudentCard({
  student,
  students,
  onTransferred,
}: {
  student: FounderStudent;
  students: FounderStudent[];
  onTransferred: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  /** Project currently being transferred (null = panel closed). */
  const [transferId, setTransferId] = useState<string | null>(null);
  const [recipient, setRecipient] = useState("");
  const [busy, setBusy] = useState(false);
  const [transferError, setTransferError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const others = students.filter((entry) => entry.uid !== student.uid);

  function openTransfer(claim: ClaimRecord) {
    setNotice(null);
    setTransferError(null);
    setRecipient(others[0]?.uid ?? "");
    setTransferId(claim.projectId);
  }

  /**
   * Founder transfer — POST, then a full cloud re-read. The server is the
   * only source of truth: on refusal the loud plain-word copy is shown
   * verbatim; on success the list refreshes so the row really disappears.
   */
  async function confirmTransfer(claim: ClaimRecord) {
    if (!recipient) {
      setTransferError("Pick a student to move this project to first.");
      return;
    }
    setBusy(true);
    setTransferError(null);
    let moved = false;
    try {
      const token = await getIdToken();
      if (!token) {
        throw new Error("Sign in required — your session wasn't sent with this request.");
      }
      const res = await fetch("/api/founder/transfer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          projectId: claim.projectId,
          title: claim.title,
          toUid: recipient,
        }),
        signal: AbortSignal.timeout(20_000),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        throw new Error(
          (data && typeof data.error === "string" && data.error) ||
            `The server returned ${res.status} — nothing was moved.`,
        );
      }
      moved = true;
    } catch (cause) {
      setTransferError(
        cause instanceof Error ? cause.message : "The transfer couldn't be completed.",
      );
    } finally {
      setBusy(false);
    }
    if (!moved) return;

    const to = others.find((entry) => entry.uid === recipient);
    setNotice(`“${claim.title}” moved to ${to?.email ?? "that student"}.`);
    setTransferId(null);
    try {
      await onTransferred();
    } catch {
      setTransferError(
        "The project was moved, but the student list couldn't refresh — reload the page to see it.",
      );
    }
  }

  return (
    <article className="card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">
            {student.name}{" "}
            <span className="font-mono text-xs font-normal text-mist">
              {student.email}
            </span>
          </h2>
          <div className="mt-1.5 flex flex-wrap gap-2 text-xs">
            {student.branch && <span className="tag">{student.branch}</span>}
            {student.year && <span className="tag">{student.year}</span>}
            {student.careerGoal && <span className="tag">{student.careerGoal}</span>}
            <span className="tag">joined {formatDate(student.joinedAt)}</span>
          </div>
        </div>

        <div className="text-right">
          {student.matchScore !== null ? (
            <>
              <div className="font-mono text-lg font-bold text-accent">
                {student.matchScore}%
              </div>
              <div className="max-w-[16rem] text-[0.7rem] leading-tight text-mist">
                {student.primaryTitle}
              </div>
            </>
          ) : (
            <div className="text-xs text-warn">No analysis yet</div>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-[0.7rem] text-mist">
        <span>{student.runCount} analyses</span>
        <span>{student.introCount} introductions</span>
        <span className={student.claims.length > 0 ? "text-accent" : ""}>
          {student.claims.length} allotted
        </span>
        <span className={student.completions.length > 0 ? "text-accent" : ""}>
          {student.completions.length} completed
        </span>
        {student.model && <span className="font-mono">{student.model}</span>}
        <button
          type="button"
          className="chip ml-auto"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? "Hide details" : "Details"}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-3 border-t border-line pt-3">
          {student.skills.length > 0 && (
            <div>
              <span className="label">Skills</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {student.skills.map((skill) => (
                  <span key={skill} className="tag">
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          )}
          {student.interests.length > 0 && (
            <div>
              <span className="label">Interests</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {student.interests.map((interest) => (
                  <span key={interest} className="tag">
                    {interest}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="label">Allotted projects (Phase 3)</span>
            {notice && (
              <p className="mt-1.5 text-xs text-accent" role="status">
                {notice}
              </p>
            )}
            {student.claims.length === 0 ? (
              <p className="mt-1.5 text-xs text-mist">No project claimed yet.</p>
            ) : (
              <ul className="mt-1.5 space-y-2">
                {student.claims.map((claim) => (
                  <li
                    key={claim.projectId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line bg-panel-2/40 p-3 text-xs"
                  >
                    <span className="font-semibold text-chalk">
                      {claim.title}
                    </span>
                    <span className="flex items-center gap-2">
                      <span
                        className={
                          claim.tier === "strong"
                            ? "tag !border-accent/50 !text-accent"
                            : "tag"
                        }
                      >
                        {claim.tier === "strong" ? "Strong" : "Normal"}
                      </span>
                      <span className="text-mist">
                        {formatDate(claim.claimedAt)}
                      </span>
                      <button
                        type="button"
                        className="chip"
                        disabled={busy}
                        onClick={() =>
                          transferId === claim.projectId
                            ? setTransferId(null)
                            : openTransfer(claim)
                        }
                      >
                        {transferId === claim.projectId ? "Cancel" : "Transfer…"}
                      </button>
                    </span>

                    {transferId === claim.projectId && (
                      <div
                        className="w-full rounded-lg border border-accent/40 bg-panel-2/60 p-3"
                        role="group"
                        aria-label={`Transfer ${claim.title}`}
                      >
                        <span className="label">Move this project to</span>
                        {others.length === 0 ? (
                          <p className="mt-1.5 text-xs text-mist">
                            No other student accounts yet — the transfer
                            needs a second account to move to.
                          </p>
                        ) : (
                          <>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <select
                                className="field min-w-0 flex-1"
                                value={recipient}
                                onChange={(event) => setRecipient(event.target.value)}
                                disabled={busy}
                                aria-label="Student to receive the project"
                              >
                                <option value="">Choose a student…</option>
                                {others.map((entry) => (
                                  <option key={entry.uid} value={entry.uid}>
                                    {entry.name} — {entry.email}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="btn btn-accent"
                                disabled={busy || !recipient}
                                onClick={() => confirmTransfer(claim)}
                              >
                                {busy ? "Moving…" : "Move project"}
                              </button>
                            </div>
                            <p className="mt-1.5 text-[0.7rem] text-mist">
                              Moves the allotment and both students&apos;
                              counters in one transaction — caps are
                              re-checked for the recipient first.
                            </p>
                          </>
                        )}
                        {transferError && (
                          <p className="mt-2 text-xs text-danger" role="alert">
                            {transferError}
                          </p>
                        )}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <span className="label">Completed projects</span>
            {student.completions.length === 0 ? (
              <p className="mt-1.5 text-xs text-mist">None recorded yet.</p>
            ) : (
              <ul className="mt-1.5 space-y-2">
                {student.completions.map((record) => (
                  <li key={record.id} className="rounded-lg border border-line bg-panel-2/40 p-3">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-sm font-semibold">{record.title}</span>
                      <span className="text-[0.7rem] text-mist">
                        {formatDate(record.completedAt)} · {record.weeks} weeks
                      </span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {record.technologies.map((tech) => (
                        <span key={tech} className="tag !text-[0.7rem]">
                          {tech}
                        </span>
                      ))}
                    </div>
                    {record.skillsCovered.length > 0 && (
                      <p className="mt-1.5 text-[0.7rem] text-mist">
                        Skills: {record.skillsCovered.join(" · ")}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {student.introText && (
            <div>
              <span className="label">Latest self-introduction</span>
              <p className="mt-1.5 whitespace-pre-line rounded-lg border border-line bg-panel-2/40 p-3 text-xs leading-relaxed text-chalk/90">
                {student.introText}
              </p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
