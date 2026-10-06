"use client";

import { useSyncExternalStore } from "react";
import {
  getCountersServerSnapshot,
  getCountersSnapshot,
  subscribeClaims,
} from "@/lib/records";

/**
 * Live year allotment counters — shared by /result and /my-projects.
 * Tone escalates with the caps: neutral → amber on the last slot → red at
 * the yearly limit (copy mirrors the server's loud cap messages).
 */
export function AllotmentBanner() {
  const counters = useSyncExternalStore(
    subscribeClaims,
    getCountersSnapshot,
    getCountersServerSnapshot,
  );
  if (!counters) return null;

  const atCap = counters.yearUsed >= counters.yearMax;
  const lastSlot = !atCap && counters.yearUsed >= counters.yearMax - 1;
  const tone = atCap
    ? "border-danger/45 bg-danger/10 text-danger"
    : lastSlot
      ? "border-warn/45 bg-warn/10 text-warn"
      : "border-line bg-panel/70 text-mist";

  return (
    <div
      className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border px-4 py-2.5 text-xs ${tone}`}
      data-testid="allotment-banner"
    >
      <span className="font-semibold">
        Projects in {counters.year}: {counters.yearUsed}/{counters.yearMax}
      </span>
      <span className="font-semibold">
        Strong: {counters.strongUsed}/{counters.strongMax}
      </span>
      <span className="font-normal">
        {atCap
          ? `Yearly limit reached — new allotments open in ${counters.year + 1}. Finish and document what you have.`
          : lastSlot
            ? "Last project slot for this year — choose carefully."
            : "One strong project per year; 3-4 strong across four years is the right pace."}
      </span>
    </div>
  );
}
