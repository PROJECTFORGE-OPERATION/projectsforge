import Image from "next/image";

/**
 * ProjectsForge brand — the original logo artwork supplied by the team.
 *
 *   /logo-mark.png  square crop of the "PR" glyph (headers, footer, chips)
 *   /logo.png       full lockup with wordmark + tagline (hero, login card)
 *
 * Both PNGs are alpha-keyed at build time (black -> transparent), so the
 * artwork floats on any surface — no blend modes, no visible tile edge.
 * Regenerate both from scripts/logo-source.png: node scripts/make-brand.mjs
 */

const LOCKUP_RATIO = 658 / 663; // height / width of public/logo.png

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
    <Image
      src="/logo-mark.png"
      width={size}
      height={size}
      alt="ProjectsForge logo"
      className={className}
      style={{
        filter: glow ? "drop-shadow(0 0 14px rgba(47,127,255,0.45))" : undefined,
      }}
    />
  );
}

export function LogoLockup({
  width = 300,
  className,
}: {
  width?: number;
  className?: string;
}) {
  return (
    <Image
      src="/logo.png"
      width={width}
      height={Math.round(width * LOCKUP_RATIO)}
      alt="ProjectsForge — Ideas to Projects to Careers"
      className={className}
    />
  );
}
