import Link from "next/link";
import { EngineStatus } from "@/components/engine-status";
import { Monogram } from "@/components/logo";
import { AccountChip } from "@/components/account-chip";

const FLOW = [
  {
    step: "01",
    title: "Student Profile",
    text: "Branch, year, skills, interests, career goal, available time.",
  },
  {
    step: "02",
    title: "Project Recommendation",
    text: "One primary project plus alternatives, with match reasons.",
  },
  {
    step: "03",
    title: "Skill Gap",
    text: "What you already know vs. what you need to learn.",
  },
  {
    step: "04",
    title: "Roadmap",
    text: "Weekly block diagram: learn → build → deliver, with vetted resources.",
  },
];

export default function Home() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-6">
      <header className="flex items-center justify-between py-6">
        <div className="flex items-center gap-2.5">
          <Monogram size={28} glow={false} />
          <span className="text-sm font-semibold tracking-wide">ProjectsForge</span>
        </div>
        <div className="flex items-center gap-3">
          <EngineStatus />
          <AccountChip />
        </div>
      </header>

      <main className="flex flex-1 flex-col justify-center py-10">
        <div className="max-w-3xl">
          <Monogram size={76} className="mb-6" />
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-panel/70 px-3 py-1.5 text-xs font-medium text-mist">
            <span className="size-1.5 rounded-full bg-accent" />
            Hackathon MVP · one focused student journey
          </span>

          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight sm:text-6xl">
            From project ideas to{" "}
            <span className="bg-gradient-to-r from-accent to-sky bg-clip-text text-transparent">
              career-ready skills
            </span>
          </h1>

          <p className="mt-6 max-w-2xl text-base leading-relaxed text-mist sm:text-lg">
            ProjectsForge helps an engineering student choose a project that fits
            their branch, year, skills, interests, career goal and available time —
            then produces a skill-gap analysis and a practical project roadmap.
          </p>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <Link href="/profile" className="btn btn-accent">
              Get Started
              <span aria-hidden>→</span>
            </Link>
            <a href="#flow" className="btn btn-ghost">
              See the flow
            </a>
          </div>

          <p className="mt-5 text-xs text-mist">
            Real AI, no canned answers — Gemini in production, Ollama locally. Errors
            surface loudly.
          </p>
        </div>

        <section id="flow" className="mt-16">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-mist">
              The demo flow
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {FLOW.map((item) => (
              <div key={item.step} className="card group p-5 transition hover:border-accent/40">
                <div className="font-mono text-xs font-semibold text-accent">
                  {item.step}
                </div>
                <h3 className="mt-3 text-sm font-semibold">{item.title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-mist">{item.text}</p>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
