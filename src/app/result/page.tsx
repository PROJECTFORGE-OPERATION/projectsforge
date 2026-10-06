"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useState, useSyncExternalStore } from "react";
import {
  clearRun,
  getRunSnapshot,
  getServerSnapshot,
  saveDraft,
  saveRun,
  subscribeRun,
  type StoredRun,
} from "@/lib/session";
import type { Analysis, Recommendation, RoadmapWeek } from "@/lib/types";
import { copyReport, downloadReport } from "@/lib/report";
import { resourcesForWeek } from "@/lib/resources";
import { buildMailtoUrl, openWhatsApp, whatsappConfigured } from "@/lib/whatsapp";
import {
  getAuthSnapshot,
  getServerSnapshot as getAuthServerSnapshot,
  subscribeAuth,
} from "@/lib/auth";
import { Monogram } from "@/components/logo";
import { AccountChip } from "@/components/account-chip";
import { ResourceLink } from "@/components/resource-link";
import { SelfIntroCard } from "@/components/self-intro";
import {
  addCompletion,
  getCompletedServerSnapshot,
  getCompletedSnapshot,
  getServerResolvedSnapshot,
  loadRecords,
  recordsResolved,
  subscribeCompleted,
} from "@/lib/records";

type Tab = "recommendation" | "skillgap" | "roadmap" | "intro";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "recommendation", label: "Recommendation" },
  { id: "skillgap", label: "Skill Gap" },
  { id: "roadmap", label: "Roadmap" },
  { id: "intro", label: "Self-intro" },
];

const PRIORITY_STYLES: Record<string, string> = {
  high: "border-danger/40 bg-danger/10 text-danger",
  medium: "border-warn/40 bg-warn/10 text-warn",
  low: "border-sky/40 bg-sky/10 text-sky",
};

export default function ResultPage() {
  const router = useRouter();
  const run = useSyncExternalStore(subscribeRun, getRunSnapshot, getServerSnapshot);
  const [tab, setTab] = useState<Tab>("recommendation");
  const [copied, setCopied] = useState<"done" | "failed" | null>(null);

  // Fresh visit / cleared storage: the analysis lives in Firestore now, so a
  // fresh device first asks the cloud for the latest run — only when that
  // comes back empty too do we go back to the form. Reads the stores directly
  // instead of `run`: during hydration the hook still returns the server
  // snapshot (null) when effects fire, which would otherwise falsify both
  // the local check and the redirect.
  useEffect(() => {
    let cancelled = false;
    const hadLocal = getRunSnapshot() !== null;
    void loadRecords().then((state) => {
      if (cancelled) return;
      if (hadLocal) return;
      if (state?.run) {
        saveRun(state.run);
        saveDraft(state.run);
      } else if (getRunSnapshot() === null) {
        router.replace("/profile");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!run) {
    return (
      <div className="grid flex-1 place-items-center text-sm text-mist">
        Loading your analysis…
      </div>
    );
  }

  const { analysis, profile, model, provider, elapsedMs, candidateCount } = run;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Monogram size={30} glow={false} />
          <span className="text-sm font-semibold tracking-wide">ProjectsForge</span>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-accent !px-3 !py-2 text-xs"
            onClick={() => downloadReport(run)}
            data-testid="save-report"
          >
            Save report
          </button>
          <button
            type="button"
            className="btn btn-ghost !px-3 !py-2 text-xs"
            onClick={async () => {
              const ok = await copyReport(run);
              setCopied(ok ? "done" : "failed");
              window.setTimeout(() => setCopied(null), 2200);
            }}
          >
            {copied === "done" ? "Copied ✓" : copied === "failed" ? "Copy failed" : "Copy"}
          </button>
          <button
            type="button"
            className="btn btn-ghost !px-3 !py-2 text-xs"
            onClick={() => router.push("/profile")}
          >
            Edit profile
          </button>
          <button
            type="button"
            className="btn btn-ghost !px-3 !py-2 text-xs"
            onClick={() => {
              clearRun();
              router.push("/profile");
            }}
          >
            New analysis
          </button>
          <AccountChip />
        </div>
      </header>

      {/* Profile summary strip */}
      <div className="flex flex-wrap items-center gap-2 text-xs text-mist">
        <span className="tag">{profile.branch}</span>
        <span className="tag">{profile.year}</span>
        <span className="tag">{profile.availableWeeks} weeks</span>
        <span className="tag">{profile.careerGoal}</span>
        <span className="tag">{profile.interests.join(" · ")}</span>
        {profile.skills.length > 0 && (
          <span className="hidden sm:inline">+ {profile.skills.length} skills</span>
        )}
      </div>

      <h1 className="mt-5 text-2xl font-bold tracking-tight sm:text-3xl">
        Step 2 of 2 · Your analysis
      </h1>

      {/* Tabs */}
      <nav className="mt-5 flex gap-1 rounded-xl border border-line bg-panel/70 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`flex-1 rounded-lg px-3 py-2.5 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_rgba(52,211,153,0.35)]"
                : "text-mist hover:text-chalk"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "recommendation" && (
        <RecommendationTab analysis={analysis} />
      )}
      {tab === "skillgap" && <SkillGapTab analysis={analysis} />}
      {tab === "roadmap" && <RoadmapTab analysis={analysis} />}
      {tab === "intro" && <SelfIntroCard profile={profile} />}

      <FeedbackCard run={run} />

      {/* Run metadata — transparency for judges */}
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[11px] text-mist">
        <span>
          Model: <span className="font-mono text-chalk">{model}</span> ·{" "}
          {provider === "gemini" ? "Gemini API" : "local Ollama"} ·
          generated in {(elapsedMs / 1000).toFixed(1)}s · {candidateCount} candidate
          projects scored
        </span>
        <span>{new Date().toLocaleString()}</span>
      </footer>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function RecommendationTab({ analysis }: { analysis: Analysis }) {
  const { primary, alternatives, nextStep } = analysis;

  return (
    <section className="mt-5 space-y-4">
      {/* Next step banner */}
      <div className="flex items-center gap-3 rounded-xl border border-accent/35 bg-accent/10 px-4 py-3 text-sm">
        <span className="font-semibold text-accent">Next step:</span>
        <span className="text-chalk">{nextStep}</span>
        <span className="ml-auto hidden text-xs text-mist sm:inline">
          Start with week 1 of your roadmap
        </span>
      </div>

      {/* Primary recommendation */}
      <article className="card overflow-hidden">
        <div className="border-b border-line bg-panel-2/50 px-5 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-accent">
          Primary recommendation
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">{primary.title}</h2>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="tag">{primary.difficulty}</span>
                <span className="tag">~{primary.estimatedWeeks} weeks</span>
                {primary.technologies.map((tech) => (
                  <span key={tech} className="tag">
                    {tech}
                  </span>
                ))}
              </div>
            </div>

            <ScoreRing score={primary.matchScore} />
          </div>

          <div className="mt-5">
            <span className="label">Why this project?</span>
            <p className="text-sm leading-relaxed text-chalk/90">{primary.whyMatched}</p>
          </div>

          <div className="mt-5">
            <span className="label">Prerequisites</span>
            <ul className="grid gap-2 sm:grid-cols-2">
              {primary.prerequisites.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2 rounded-lg border border-line bg-panel-2/40 px-3 py-2 text-xs text-mist"
                >
                  <span className="text-accent">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </article>

      {/* Alternatives */}
      <div>
        <div className="mb-3 flex items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-mist">
            Alternatives
          </span>
          <span className="h-px flex-1 bg-line" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {alternatives.map((alt) => (
            <AlternativeCard key={alt.id} alt={alt} />
          ))}
        </div>
      </div>
    </section>
  );
}

function AlternativeCard({ alt }: { alt: Recommendation }) {
  return (
    <article className="card p-4 transition hover:border-accent/35">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{alt.title}</h3>
        <span className="font-mono text-xs text-accent">{alt.matchScore}%</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="tag !text-[0.7rem]">{alt.difficulty}</span>
        <span className="tag !text-[0.7rem]">~{alt.estimatedWeeks}w</span>
        {alt.technologies.slice(0, 3).map((tech) => (
          <span key={tech} className="tag !text-[0.7rem]">
            {tech}
          </span>
        ))}
      </div>
      <p className="mt-3 text-xs leading-relaxed text-mist">{alt.whyMatched}</p>
    </article>
  );
}

function ScoreRing({ score }: { score: number }) {
  const degrees = Math.round(Math.min(100, Math.max(0, score)) * 3.6);
  return (
    <div
      className="grid size-16 shrink-0 place-items-center rounded-full"
      style={{
        background: `conic-gradient(var(--color-accent) ${degrees}deg, var(--color-line) ${degrees}deg)`,
      }}
      title={`Match score ${score}/100`}
    >
      <div className="grid size-12 place-items-center rounded-full bg-ink">
        <span className="font-mono text-sm font-bold text-accent">{score}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

function SkillGapTab({ analysis }: { analysis: Analysis }) {
  const { skillGap } = analysis;

  return (
    <section className="mt-5 grid gap-4 lg:grid-cols-2">
      <article className="card p-5">
        <div className="flex items-center justify-between">
          <span className="label mb-0">You already know</span>
          <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
            {skillGap.alreadyKnown.length}
          </span>
        </div>
        {skillGap.alreadyKnown.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {skillGap.alreadyKnown.map((skill) => (
              <span key={skill} className="chip chip-on chip-static">
                ✓ {skill}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-mist">
            No existing skills listed — the plan starts from the fundamentals.
          </p>
        )}
        <p className="mt-5 border-t border-line pt-4 text-xs leading-relaxed text-mist">
          These are echoed directly from your profile — the model does not invent
          skills you did not enter.
        </p>
      </article>

      <article className="card p-5">
        <div className="flex items-center justify-between">
          <span className="label mb-0">You need to learn</span>
          <span className="rounded-full bg-warn/15 px-2 py-0.5 text-xs font-semibold text-warn">
            {skillGap.needToLearn.length}
          </span>
        </div>
        <ul className="mt-4 space-y-3">
          {skillGap.needToLearn.map((item) => (
            <li key={item.skill} className="rounded-xl border border-line bg-panel-2/40 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{item.skill}</span>
                <span
                  className={`rounded-full border px-2 py-0.5 text-[0.68rem] font-semibold uppercase tracking-wide ${
                    PRIORITY_STYLES[item.priority] ?? PRIORITY_STYLES.low
                  }`}
                >
                  {item.priority}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-mist">{item.why}</p>
            </li>
          ))}
        </ul>
      </article>
    </section>
  );
}

/* ------------------------------------------------------------------------ */

/** Connector between diagram blocks: ↓ on mobile, → on desktop. */
function BlockArrow() {
  return (
    <span
      className="grid h-5 shrink-0 place-items-center text-mist sm:h-auto sm:w-6"
      aria-hidden
    >
      <span className="sm:hidden">↓</span>
      <span className="hidden text-lg sm:block">→</span>
    </span>
  );
}

function BlockPanel({
  label,
  tint,
  children,
}: {
  label: string;
  tint: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex-1 rounded-xl border bg-panel-2/40 p-3 ${tint}`}>
      <div className="text-[0.64rem] font-bold uppercase tracking-[0.16em]">
        {label}
      </div>
      <div className="mt-1.5 text-xs leading-relaxed text-chalk/90">{children}</div>
    </div>
  );
}

/** One-click weekly check-in → WhatsApp with a prefilled message (email fallback). */
function WeekFeedback({ week, project }: { week: RoadmapWeek; project: string }) {
  const [fallbackUrl, setFallbackUrl] = useState<string | null>(null);

  function send() {
    const student = getAuthSnapshot();
    const msg = [
      "ProjectsForge — weekly check-in",
      `Project: ${project}`,
      `Week ${week.week} done: ${week.focus}`,
      student ? `Student: ${student.name}` : null,
      "",
      "How did this week go? Write your experience here:",
    ]
      .filter((line): line is string => line !== null)
      .join("\n");
    if (!openWhatsApp(msg)) {
      setFallbackUrl(buildMailtoUrl(`Week ${week.week} feedback — ${project}`, msg));
    }
  }

  if (fallbackUrl) {
    return (
      <a href={fallbackUrl} className="text-xs text-sky hover:underline">
        WhatsApp number not configured — email it instead →
      </a>
    );
  }

  return (
    <button type="button" className="chip" onClick={send}>
      ✓ Week done? Send feedback →
    </button>
  );
}

function RoadmapTab({ analysis }: { analysis: Analysis }) {
  const projectTitle = analysis.primary.title;

  return (
    <section className="mt-5 space-y-6">
      <p className="text-xs text-mist">
        Each week is a block flow: what you <span className="text-sky">learn</span>, what
        you <span className="text-warn">build</span> with it, what you{" "}
        <span className="text-accent">deliver</span> — plus vetted resources for that
        week&apos;s topics.
      </p>

      <ol className="relative space-y-4 border-l border-line pl-6">
        {analysis.roadmap.map((week) => {
          const resources = resourcesForWeek(week);
          return (
            <li key={week.week} className="relative">
              <span className="absolute -left-[31px] grid size-6 place-items-center rounded-full border border-accent/50 bg-ink font-mono text-[0.65rem] font-bold text-accent">
                {week.week}
              </span>

              <div className="card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-sm font-semibold">
                    Week {week.week} · {week.focus}
                  </h3>
                </div>

                {/* Weekly block diagram: Learn → Build → Deliver */}
                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-stretch">
                  <BlockPanel label="Learn" tint="border-sky/35 text-sky">
                    {week.learn.length > 0 ? (
                      <ul className="space-y-1">
                        {week.learn.map((topic) => (
                          <li key={topic}>• {topic}</li>
                        ))}
                      </ul>
                    ) : (
                      <span className="text-mist">
                        No itemised topics this week — follow the Build block for
                        the focus: <span className="text-chalk">{week.focus}</span>
                      </span>
                    )}
                  </BlockPanel>
                  <BlockArrow />
                  <BlockPanel label="Build" tint="border-warn/40 text-warn">
                    {week.build}
                  </BlockPanel>
                  <BlockArrow />
                  <BlockPanel label="Deliver" tint="border-accent/45 text-accent">
                    {week.deliverable}
                  </BlockPanel>
                </div>

                {/* Vetted resources for this week's topics */}
                <div className="mt-3 rounded-xl border border-line bg-panel/60 p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[0.64rem] font-bold uppercase tracking-[0.16em] text-sky">
                      Resources
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {resources.map((resource) => (
                      <li key={resource.url}>
                        <ResourceLink resource={resource} />
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3">
                  <span className="text-[0.7rem] text-mist">
                    Finished learning this week&apos;s block?
                  </span>
                  <WeekFeedback week={week} project={projectTitle} />
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Final block diagram — the whole journey after every week */}
      <FinalFlow analysis={analysis} />

      {/* Completion record → unlocks the Communication Skills section */}
      <MarkComplete analysis={analysis} />

      {/* Honest caveats (roadmap doc §11: don't present assumptions as facts) */}
      <div className="grid gap-4 sm:grid-cols-2">
        <article className="card p-4">
          <span className="label">Risks</span>
          <ul className="space-y-2 text-xs leading-relaxed text-mist">
            {analysis.risks.map((risk) => (
              <li key={risk} className="flex gap-2">
                <span className="text-warn">▲</span>
                {risk}
              </li>
            ))}
          </ul>
        </article>
        <article className="card p-4">
          <span className="label">Assumptions</span>
          <ul className="space-y-2 text-xs leading-relaxed text-mist">
            {analysis.assumptions.map((assumption) => (
              <li key={assumption} className="flex gap-2">
                <span className="text-sky">◆</span>
                {assumption}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}

const PHASE_NAMES = ["Learn foundations", "Build features", "Integrate & demo"];
const PHASE_TINTS = [
  "border-sky/35 bg-sky/5 text-sky",
  "border-warn/40 bg-warn/5 text-warn",
  "border-line bg-panel-2/40 text-chalk",
];

/** Whole-roadmap block flow: phases → final deliverable. */
function FinalFlow({ analysis }: { analysis: Analysis }) {
  const weeks = analysis.roadmap;
  if (weeks.length === 0) return null;

  const size = Math.ceil(weeks.length / 3);
  const phases: RoadmapWeek[][] = [];
  for (let i = 0; i < weeks.length; i += size) {
    phases.push(weeks.slice(i, i + size));
  }

  return (
    <div className="card p-5">
      <span className="label">Final block diagram · after every week</span>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        {phases.map((phase, index) => {
          const first = phase[0];
          const last = phase[phase.length - 1];
          const range =
            first.week === last.week
              ? `Week ${first.week}`
              : `Weeks ${first.week}–${last.week}`;
          const focusLine =
            first.week === last.week ? first.focus : `${first.focus} → ${last.focus}`;
          return (
            <Fragment key={first.week}>
              {index > 0 && <BlockArrow />}
              <div className={`flex-1 rounded-xl border p-3 ${PHASE_TINTS[index] ?? PHASE_TINTS[2]}`}>
                <div className="text-[0.64rem] font-bold uppercase tracking-[0.16em]">
                  Phase {index + 1} · {PHASE_NAMES[index] ?? "Extend"}
                </div>
                <div className="mt-1.5 text-xs font-semibold text-chalk">{range}</div>
                <div className="mt-1 text-[0.72rem] leading-relaxed text-mist">
                  {focusLine}
                </div>
              </div>
            </Fragment>
          );
        })}
        <BlockArrow />
        <div className="flex-1 rounded-xl border border-accent/45 bg-accent/10 p-3 text-accent">
          <div className="text-[0.64rem] font-bold uppercase tracking-[0.16em]">
            Final deliverable
          </div>
          <div className="mt-1.5 text-sm font-semibold text-chalk">
            {analysis.primary.title}
          </div>
          <div className="mt-1 text-[0.72rem] leading-relaxed text-mist">
            Demo-ready project — built, documented, explained honestly.
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Completion record: marks the primary project done, snapshots an
 * interview-ready record (stack, weeks, skills covered) and links into the
 * Communication Skills section this unlocks.
 */
function MarkComplete({ analysis }: { analysis: Analysis }) {
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const record = completed.find((entry) => entry.id === analysis.primary.id);

  async function markComplete(): Promise<void> {
    setSaving(true);
    setSaveError(null);
    const result = await addCompletion({
      id: analysis.primary.id,
      title: analysis.primary.title,
      technologies: analysis.primary.technologies,
      skillsCovered: analysis.skillGap.needToLearn.map((item) => item.skill),
      weeks: analysis.roadmap.length,
      completedAt: new Date().toISOString(),
    });
    setSaving(false);
    if (!result.ok) {
      setSaveError(
        result.error ?? "Your record couldn't be saved — please try again.",
      );
    }
  }

  // Never flash "Mark project complete" while the cloud record list loads.
  if (!recordsReady) {
    return (
      <div className="card p-5 text-sm text-mist">
        Loading your project records…
      </div>
    );
  }

  if (record) {
    return (
      <div className="card border-accent/40 bg-accent/5 p-5">
        <span className="label">Project recorded</span>
        <p className="mt-1 text-sm leading-relaxed text-chalk/90">
          ✓ Marked complete
          {record.completedAt
            ? ` on ${new Date(record.completedAt).toLocaleDateString()}`
            : ""}
          . Your Communication Skills section is unlocked and this project is
          saved as your interview record.
        </p>
        <Link href="/communication" className="btn btn-accent mt-4">
          Open Communication Skills <span aria-hidden>→</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <span className="label">Finished building the project?</span>
      <p className="mt-1 text-sm leading-relaxed text-mist">
        Mark it complete to record what you built — stack, weeks and skills
        covered — and unlock the Communication Skills section for interview
        prep.
      </p>
      {saveError && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {saveError}
        </p>
      )}
      <button
        type="button"
        className="btn btn-accent mt-4"
        disabled={saving}
        onClick={() => {
          void markComplete();
        }}
      >
        {saving ? "Saving…" : "Mark project complete"}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------------ */

/** Post-analysis feedback + suggestions → team WhatsApp (email fallback). */
function FeedbackCard({ run }: { run: StoredRun }) {
  const student = useSyncExternalStore(
    subscribeAuth,
    getAuthSnapshot,
    getAuthServerSnapshot,
  );
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [suggestion, setSuggestion] = useState("");
  const [error, setError] = useState<string | null>(null);

  const { analysis, profile } = run;

  function message(): string {
    const lines = [
      "ProjectsForge feedback",
      `Project: ${analysis.primary.title} (${analysis.primary.matchScore}% match)`,
      `Student: ${student ? `${student.name} · ` : ""}${profile.branch}, ${profile.year}`,
      `Rating: ${rating}/5`,
    ];
    if (comment.trim()) lines.push(`Comment: ${comment.trim()}`);
    if (suggestion.trim()) lines.push(`Suggestion: ${suggestion.trim()}`);
    lines.push("— sent from the result page");
    return lines.join("\n");
  }

  function validate(): boolean {
    if (rating < 1) {
      setError("Tap a star first — we need a rating.");
      return false;
    }
    setError(null);
    return true;
  }

  function sendWhatsApp() {
    if (!validate()) return;
    if (!openWhatsApp(message())) {
      setError("WhatsApp number isn't configured on this deployment yet — use “Email instead”.");
    }
  }

  function sendEmail() {
    if (!validate()) return;
    window.location.href = buildMailtoUrl(
      `Feedback — ${analysis.primary.title}`,
      message(),
    );
  }

  return (
    <section className="card mt-8 p-5" aria-labelledby="feedback-heading">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 id="feedback-heading" className="text-base font-semibold">
            How useful was this analysis?
          </h2>
          <p className="mt-1 text-xs text-mist">
            Rate it and tell us what to improve — feedback goes straight to our
            team&apos;s phone.
          </p>
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Rating out of 5">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => {
                setRating(star);
                setError(null);
              }}
              aria-label={`${star} star${star > 1 ? "s" : ""}`}
              className={`text-2xl leading-none transition ${
                star <= rating ? "text-warn" : "text-line hover:text-warn/60"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">What worked / what confused you</span>
          <textarea
            className="field min-h-24 resize-y"
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="The skill-gap section was spot on… (optional)"
          />
        </label>
        <label className="block">
          <span className="label">Suggest a feature or improvement</span>
          <textarea
            className="field min-h-24 resize-y"
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
            placeholder="Add a mock-interview section later… (optional)"
          />
        </label>
      </div>

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger"
        >
          {error}
        </p>
      )}

      {!whatsappConfigured && (
        <p className="mt-3 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2 text-xs text-warn">
          Heads up: the WhatsApp number isn&apos;t configured on this deployment
          yet — email delivery works right now.
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" className="btn btn-accent" onClick={sendWhatsApp}>
          Send feedback on WhatsApp
        </button>
        <button type="button" className="btn btn-ghost" onClick={sendEmail}>
          Email instead
        </button>
        <span className="ml-auto text-xs text-mist">
          projectforgestartup@gmail.com
        </span>
      </div>
    </section>
  );
}
