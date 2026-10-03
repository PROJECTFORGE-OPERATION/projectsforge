import { z } from "zod";
import { prune } from "../src/lib/ollama";
import { analysisSchema, makeAnalysisSchema } from "../src/lib/types";

type Obj = Record<string, unknown>;

const asObj = (value: unknown): Obj =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Obj)
    : {};

const propsOf = (node: unknown): Obj => asObj(asObj(node).properties);

const pruned = asObj(prune(z.toJSONSchema(analysisSchema)));
const primary = asObj(propsOf(pruned).primary);
const primaryProps = propsOf(primary);

console.log("field 'title' present under properties:", "title" in primaryProps);
console.log("annotation 'title' stripped from node:", !("title" in primary));
console.log("primary properties:", Object.keys(primaryProps).join(", "));
console.log("required:", JSON.stringify(primary.required));

// Per-request schema: array lengths must be baked into the grammar.
const weeks = 6;
const fixed = asObj(prune(z.toJSONSchema(makeAnalysisSchema(weeks))));
const fixedProps = asObj(fixed.properties);
const roadmap = asObj(fixedProps.roadmap);
const alternatives = asObj(fixedProps.alternatives);

console.log(
  `roadmap constraints (expect min=max=${weeks}):`,
  `min=${String(roadmap.minItems)} max=${String(roadmap.maxItems)}`,
);
console.log(
  "alternatives constraints (expect min=2 max=3):",
  `min=${String(alternatives.minItems)} max=${String(alternatives.maxItems)}`,
);

// Field names that collide with annotation keywords must survive.
const tricky = asObj(
  prune(
    z.toJSONSchema(
      z.object({ title: z.string(), format: z.string(), pattern: z.string() }),
    ),
  ),
);
const trickyProps = propsOf(tricky);
console.log(
  "tricky field names survive:",
  ["title", "format", "pattern"].every((k) => k in trickyProps),
);

const ok =
  "title" in primaryProps &&
  !("title" in primary) &&
  roadmap.minItems === weeks &&
  roadmap.maxItems === weeks &&
  alternatives.minItems === 2 &&
  alternatives.maxItems === 3 &&
  ["title", "format", "pattern"].every((k) => k in trickyProps);

console.log(ok ? "OK" : "SCHEMA CHECK FAILED");
process.exit(ok ? 0 : 1);
