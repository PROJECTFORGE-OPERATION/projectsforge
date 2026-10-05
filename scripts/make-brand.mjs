// ProjectsForge brand asset pipeline.
// Source of truth: scripts/logo-source.png — the original logo delivered by
// the team (667x662, screenshot border lines on the top 3px / right 2px).
//
//   scripts/logo-source.png
//     -> public/logo.png             full lockup, border removed (README, hero, login)
//     -> public/logo-mark.png        square "PR" glyph crop (headers, footer, chips)
//     -> src/app/icon.png            512 browser-tab icon
//     -> src/app/apple-icon.png      180 home-screen icon
//     -> src/app/opengraph-image.png 1200x630 link preview (lockup + site URL)
//
// The source sits on pure black; every asset except the OG image is
// alpha-keyed (black -> transparent) so it floats on any page surface.
// The OG image keeps the black backdrop (it IS the backdrop there).
//
// Re-run: node scripts/make-brand.mjs
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(root, "scripts", "logo-source.png");

// Drop the screenshot border (top 3px, right 2px) — content starts well inside.
const CLEAN = { left: 0, top: 4, width: 663, height: 658 };
// Square crop centred on the "PR" glyph (x 254-429, y 177-389), stopping
// above the wordmark (y 414) so the mark reads cleanly at small sizes.
const MARK = { left: 216, top: 160, width: 250, height: 250 };

// Key out the black background: alpha ramps 0 -> 255 while the brightest
// channel climbs 6 -> 40, so deep blues stay solid and the faintest glow
// fades naturally instead of ending in a visible tile edge.
async function alphaKey(buf) {
  const { data, info } = await sharp(buf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    const maxc = Math.max(data[i], data[i + 1], data[i + 2]);
    data[i + 3] =
      maxc <= 6 ? 0 : maxc >= 40 ? 255 : Math.round(((maxc - 6) * 255) / 34);
  }
  return sharp(data, { raw: info }).png().toBuffer();
}

const lockupRaw = await sharp(SRC).extract(CLEAN).png().toBuffer();
const markRaw = await sharp(SRC).extract(MARK).png().toBuffer();
const lockup = await alphaKey(lockupRaw);
const mark = await alphaKey(markRaw);

await sharp(lockup).toFile(join(root, "public", "logo.png"));
await sharp(mark).toFile(join(root, "public", "logo-mark.png"));
await sharp(mark).resize(512, 512).toFile(join(root, "src", "app", "icon.png"));
await sharp(mark).resize(180, 180).toFile(join(root, "src", "app", "apple-icon.png"));

// Link preview: full lockup on black + site URL underneath (black kept).
const big = await sharp(lockupRaw).resize({ height: 470 }).png().toBuffer();
const { width: bigW } = await sharp(big).metadata();
const caption = Buffer.from(
  `<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
     <text x="600" y="578" font-family="Segoe UI, Arial, sans-serif" font-size="30"
           fill="#93a4ba" text-anchor="middle" letter-spacing="3"
           >projectsforge-nu.vercel.app</text>
   </svg>`,
);
await sharp({
  create: { width: 1200, height: 630, channels: 4, background: "#000000" },
})
  .composite([
    { input: big, left: Math.round((1200 - bigW) / 2), top: 34 },
    { input: caption, left: 0, top: 0 },
  ])
  .png()
  .toFile(join(root, "src", "app", "opengraph-image.png"));

console.log("brand assets regenerated from scripts/logo-source.png");
