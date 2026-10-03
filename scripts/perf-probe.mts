import { z } from "zod";
import { prune } from "../src/lib/ollama";
import { selectCandidates } from "../src/lib/projects";
import { buildMessages } from "../src/lib/prompt";
import { makeAnalysisSchema, profileSchema } from "../src/lib/types";

const profile = profileSchema.parse({
  branch: "CSE",
  year: "1st year",
  skills: ["Python", "HTML/CSS"],
  interests: ["AI / ML", "Web Development"],
  careerGoal: "Placement / Job",
  availableWeeks: 4,
});

const candidates = selectCandidates(profile);
const messages = buildMessages(profile, candidates);
const schema = makeAnalysisSchema(profile.availableWeeks);
const format = prune(z.toJSONSchema(schema));

const promptChars = JSON.stringify(messages).length;
console.log(
  `messages: ${messages.length}, chars: ${promptChars}, candidates: ${candidates.length}`,
);
console.log(
  "schema bytes:",
  JSON.stringify(format).length,
);

const started = Date.now();
let res: Response;
try {
  res = await fetch("http://127.0.0.1:11434/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: "phi4-gpu",
      messages,
      stream: false,
      format,
      options: { temperature: 0.35, num_ctx: 8192 },
    }),
    signal: AbortSignal.timeout(300_000),
  });
} catch (e) {
  console.log("REQUEST FAILED after", ((Date.now() - started) / 1000).toFixed(1), "s:", (e as Error).message);
  process.exit(1);
}

const wall = (Date.now() - started) / 1000;
console.log("http status:", res.status, `wall=${wall.toFixed(1)}s`);

if (!res.ok) {
  console.log("body:", (await res.text()).slice(0, 500));
  process.exit(1);
}

const data = (await res.json()) as {
  message?: { content?: string };
  prompt_eval_count?: number;
  eval_count?: number;
  eval_duration?: number;
  prompt_eval_duration?: number;
  done_reason?: string;
};

console.log(
  `prompt_eval=${data.prompt_eval_count} tokens in ${((data.prompt_eval_duration ?? 0) / 1e9).toFixed(1)}s`,
);
console.log(
  `eval=${data.eval_count} tokens in ${((data.eval_duration ?? 0) / 1e9).toFixed(1)}s` +
    ` (${data.eval_count && data.eval_duration ? (data.eval_count / (data.eval_duration / 1e9)).toFixed(1) : "?"} tok/s)`,
);
console.log("done_reason:", data.done_reason);

const content = data.message?.content ?? "";
console.log("content chars:", content.length);
try {
  const parsed = JSON.parse(content);
  const check = schema.safeParse(parsed);
  console.log("JSON parse: OK");
  console.log(
    "zod validation:",
    check.success
      ? `OK (roadmap=${check.data.roadmap.length} weeks, alts=${check.data.alternatives.length})`
      : `FAIL: ${check.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
  );
} catch {
  console.log("JSON parse: FAIL — first 200 chars:", content.slice(0, 200));
}
