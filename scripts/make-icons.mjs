// One-off build asset generator: SVG sources -> PNG metadata images.
//   scripts/og.svg     -> src/app/opengraph-image.png  (1200x630 link preview)
//   scripts/apple.svg  -> src/app/apple-icon.png       (512x512 home screen)
// Re-run: node scripts/make-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const og = await sharp(Buffer.from(readFileSync(join(root, "scripts/og.svg")))).png().toBuffer();
writeFileSync(join(root, "src/app/opengraph-image.png"), og);

const apple = await sharp(Buffer.from(readFileSync(join(root, "scripts/apple.svg")))).png().toBuffer();
writeFileSync(join(root, "src/app/apple-icon.png"), apple);

const ogMeta = await sharp(og).metadata();
const appleMeta = await sharp(apple).metadata();
console.log(`opengraph-image.png ${ogMeta.width}x${ogMeta.height}`);
console.log(`apple-icon.png ${appleMeta.width}x${appleMeta.height}`);
