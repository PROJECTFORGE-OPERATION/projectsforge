"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import {
  clearRun,
  getRunSnapshot,
  getServerSnapshot,
  subscribeRun,
} from "@/lib/session";
import type { Analysis, Recommendation } from "@/lib/types";
import { copyReport, downloadReport } from "@/lib/report";

type Tab = "recommendation" | "skillgap" | "roadmap";

const TABS: Array<{ id: Tab; label: string }> = [
  { id: "recommendation", label: "Recommendation" },
  { id: "skillgap", label: "Skill Gap" },
  { id: "roadmap", label: "Roadmap" },
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

  // No stored analysis (fresh visit / cleared) -> back to the form.
  // Reads the store directly instead of `run`: during hydration the hook still
  // returns the server snapshot (null) when effects fire, which would falsely
  // redirect even though sessionStorage has the analysis.
  useEffect(() => {
    if (getRunSnapshot() === null) router.replace("/profile");
  }, [router]);

  if (!run) {
    return (
      <div className="grid flex-1 place-items-center text-sm text-mist">
        Loading your analysis…
      </div>
    );
  }

  const { analysis, profile, model, elapsedMs, candidateCount } = run;

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 px-6 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3 py-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-accent/15 font-mono text-sm font-bold text-accent">
            PF
          </span>
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

      {/* Run metadata — transparency for judges */}
      <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4 text-[11px] text-mist">
        <span>
          Model: <span className="font-mono text-chalk">{model}</span> · local Ollama ·
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

function RoadmapTab({ analysis }: { analysis: Analysis }) {
  return (
    <section className="mt-5 space-y-6">
      <ol className="relative space-y-4 border-l border-line pl-6">
        {analysis.roadmap.map((week) => (
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

              <div className="mt-3 flex flex-wrap gap-1.5">
                {week.learn.map((topic) => (
                  <span key={topic} className="tag !text-[0.7rem]">
                    {topic}
                  </span>
                ))}
              </div>

              <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                <div className="rounded-lg bg-panel-2/40 px-3 py-2">
                  <dt className="text-[0.68rem] font-semibold uppercase tracking-wide text-mist">
                    Build
                  </dt>
                  <dd className="mt-0.5 text-chalk/90">{week.build}</dd>
                </div>
                <div className="rounded-lg bg-panel-2/40 px-3 py-2">
                  <dt className="text-[0.68rem] font-semibold uppercase tracking-wide text-mist">
                    Deliverable
                  </dt>
                  <dd className="mt-0.5 text-chalk/90">{week.deliverable}</dd>
                </div>
              </dl>
            </div>
          </li>
        ))}
      </ol>

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
