/**
 * ProjectsForge brand mark — recreation of the supplied logo as SVG.
 *
 * Geometry: a stylized "P/R" monogram built from three strokes —
 *   1. stem   — vertical bar with the signature diagonal cut at the top-left
 *   2. bowl   — angular hook with a triangular counter (evenodd hole)
 *   3. leg    — diagonal foot, flat-cut at the baseline
 * Colours: light blue (top-right) → deep blue (bottom-left), soft outer glow.
 */

const GRADIENT_ID = "pf-mark-grad";

const STEM = "M14 26 L46 12 L46 104 L14 104 Z";
const BOWL_OUTER = "M46 12 H96 V72 L46 92 Z";
const BOWL_COUNTER = "M46 34 H78 V52 L46 74 Z";
const LEG = "M54 78 L84 78 L102 104 L74 104 Z";

export function Monogram({
  size = 32,
  className,
  glow = true,
}: {
  size?: number;
  className?: string;
  glow?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 110 112"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="ProjectsForge logo"
      style={
        glow
          ? { filter: "drop-shadow(0 0 14px rgba(47,127,255,0.45))" }
          : undefined
      }
    >
      <defs>
        <linearGradient id={GRADIENT_ID} x1="1" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5fb0ff" />
          <stop offset="45%" stopColor="#2e86ff" />
          <stop offset="100%" stopColor="#0a46d8" />
        </linearGradient>
      </defs>
      <g fill={`url(#${GRADIENT_ID})`}>
        <path d={STEM} />
        <path d={`${BOWL_OUTER} ${BOWL_COUNTER}`} fillRule="evenodd" />
        <path d={LEG} />
      </g>
    </svg>
  );
}
