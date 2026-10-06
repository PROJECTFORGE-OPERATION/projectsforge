/**
 * Hero illustration for the landing page — a stylised mock of what the app
 * actually produces: a match badge, a weekly learn→build→deliver block, and
 * skill-gap bars. Drawn with the site's own design tokens so it always matches
 * the brand, ships no external image payload, and can't drift from the UI.
 * Decorative only (hidden from assistive tech) and labelled as an example so
 * it is never mistaken for canned product output.
 */

const BLOCK_ROWS = [
  { dot: "bg-sky", label: "Learn", text: "JS fundamentals & DOM" },
  { dot: "bg-warn", label: "Build", text: "Budget list UI" },
  { dot: "bg-accent", label: "Deliver", text: "Working prototype" },
] as const;

const GAP_BARS = [
  { label: "Python", pct: 80 },
  { label: "React", pct: 45 },
  { label: "Charts", pct: 30 },
] as const;

const TECHS = ["JavaScript", "React", "Charts"] as const;

export function HeroVisual({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`} aria-hidden="true">
      {/* brand glow behind the card */}
      <div className="pointer-events-none absolute -inset-4 rounded-[2.5rem] bg-[radial-gradient(60%_55%_at_55%_35%,rgba(96,165,250,0.18),transparent_70%)] blur-2xl" />

      <div className="card relative p-5">
        <div className="flex items-center justify-between">
          <span className="inline-flex items-center gap-2 text-[11px] text-mist">
            <span className="size-1.5 rounded-full bg-accent" />
            AI analysis · example
          </span>
          <span className="rounded-full border border-accent/40 bg-accent/10 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
            92% match
          </span>
        </div>

        <p className="mt-4 text-sm font-semibold text-chalk">
          Personal Finance Tracker
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {TECHS.map((tech) => (
            <span
              key={tech}
              className="rounded-md border border-line bg-panel-2 px-2 py-0.5 text-[11px] text-mist"
            >
              {tech}
            </span>
          ))}
        </div>

        <div className="mt-4 rounded-xl border border-line bg-ink/60 p-3">
          <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-[0.14em] text-mist">
            <span>Week 1 block</span>
            <span className="normal-case tracking-normal">
              learn → build → deliver
            </span>
          </div>
          <div className="mt-2.5 space-y-2">
            {BLOCK_ROWS.map((row) => (
              <div key={row.label} className="flex items-center gap-2.5">
                <span className={`size-1.5 shrink-0 rounded-full ${row.dot}`} />
                <span className="w-12 shrink-0 text-[11px] text-mist">
                  {row.label}
                </span>
                <span className="truncate text-xs text-chalk">{row.text}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.14em] text-mist">
            Skill gap
          </div>
          <div className="mt-2 space-y-2">
            {GAP_BARS.map((bar) => (
              <div key={bar.label} className="flex items-center gap-3">
                <span className="w-14 shrink-0 text-[11px] text-mist">
                  {bar.label}
                </span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel-2">
                  <span
                    className="block h-full rounded-full bg-gradient-to-r from-accent/70 to-accent"
                    style={{ width: `${bar.pct}%` }}
                  />
                </span>
                <span className="w-8 shrink-0 text-right font-mono text-[10px] text-mist">
                  {bar.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
