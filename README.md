# ProjectsForge — Hackathon MVP

> From project ideas to career-ready skills.

**🟢 Live demo: https://projectsforge-nu.vercel.app** (Gemini cloud mode) — locally the same app runs on Ollama with no API key (see Configuration).

A focused hackathon prototype: **student profile → personalized project recommendation → skill gap → week-by-week roadmap**. One strong working journey, powered by a real local LLM — no canned demo data, no fallback mode.

## Stack

- **Next.js 16** (App Router, Turbopack) + TypeScript + Tailwind CSS v4
- **Dual-mode AI layer** — local **Ollama** (`phi4-gpu` by default) or cloud **Gemini** (`gemini-3.8-flash`), selected by env, both with **JSON-schema-constrained output**
- **zod** validation on every model reply, with one corrective retry
- **Curated dataset** of 16 project records that grounds the model (it may only recommend ids from the shortlist)

## Prerequisites

1. [Ollama](https://ollama.com) installed and running (`ollama serve`)
2. A model pulled: `ollama pull phi4-gpu` (or `qwen3:4b`, `phi4-mini`…)
3. Node.js 20.9+
4. *(Optional, cloud mode)* a [Gemini API key](https://aistudio.google.com/apikey)

## Run

```bash
npm install
npm run dev
```

Open http://localhost:3000 — the header badge shows the **real** engine status.

### Configuration (`.env.local`)

| Variable            | Default                   | Purpose                                       |
| ------------------- | ------------------------- | --------------------------------------------- |
| `OLLAMA_HOST`       | `http://127.0.0.1:11434`  | Ollama server URL                             |
| `OLLAMA_MODEL`      | `phi4-gpu`                | Local model used when Ollama is active        |
| `OLLAMA_TIMEOUT_MS` | `180000`                  | Per-request model timeout (both providers)    |
| `GEMINI_API_KEY`    | *(unset)*                 | **Enables cloud mode** — Gemini replaces Ollama |
| `GEMINI_MODEL`      | `gemini-3.8-flash`        | Gemini model name                             |
| `AI_PROVIDER`       | *(auto)*                  | Force `ollama` or `gemini` regardless of key  |

**Provider resolution:** `AI_PROVIDER` wins → else `GEMINI_API_KEY` set means
Gemini → else local Ollama. Same contract both ways: zod + business-rule retry,
and loud 502/503/504 on failure — never canned data. For a hosted deploy
(e.g. Vercel) set `GEMINI_API_KEY`; locally leave it unset to keep the
"local LLM, no API key" story.

## API

### `POST /api/analyze`

```jsonc
{
  "branch": "CSE",
  "year": "1st year",
  "skills": ["Python", "HTML/CSS"],
  "interests": ["AI / ML", "Web Development"],
  "careerGoal": "Placement / Job",
  "availableWeeks": 4
}
```

**200** → `{ profile, analysis, model, candidateCount, elapsedMs }`

`analysis` contains `primary`, `alternatives` (2–3), `skillGap`, `roadmap` (exactly `availableWeeks` entries), `nextStep`, `risks`, `assumptions`.

**Failure modes (deliberately loud — there is no canned fallback):**

| Status | Meaning                                                                                     |
| ------ | ------------------------------------------------------------------------------------------- |
| 400    | Invalid profile (zod issues returned)                                                       |
| 502    | Model returned invalid JSON/structure twice                                                 |
| 503    | Engine unreachable/rejected — Ollama down, Gemini key rejected, or upstream 5xx after retries |
| 504    | Model timed out                                                                             |

### `GET /api/health`

Real liveness of the active engine: `{ ok, provider, model, region, modelPresent }`
(`provider` is `ollama` or `gemini`; `region` is the Vercel function region or `local`).

### `GET /api/pingai` *(diagnostics)*

Probes the active Gemini model twice from the server's own egress — one plain
call, one JSON-schema-constrained call — and reports status + latency for each.
Useful for distinguishing "engine down" from "structured-output mode rejected".

## How the "zero fallback" AI layer works

```
profile ──► deterministic candidate ranking (top 8 of 16 records)
                 │
                 ▼
        prompt + zod-derived JSON schema
                 │
                 ▼
        Ollama /api/chat (format: <schema>)        ← constrained decoding
        Gemini  generateContent (responseSchema)   ← structured output
                 │   (if upstream 5xx's structured mode — e.g. from
                 │    datacenter IPs — retry is prompt-enforced JSON;
                 │    the zod gate below is identical either way)
                 │
                 ▼
        zod parse + business rules ──fail──► corrective retry (once)
                 │                              │
               pass                          fail
                 │                              │
                 ▼                              ▼
              200 OK                    502 with precise reason
```

- The JSON schema sent to the engine is **generated from the zod schema** (`z.toJSONSchema`), so the contract has a single source of truth.
- Business rules (ids must exist in the dataset, unique alternatives, roadmap length, non-empty skill gap) run after zod and also trigger retries.
- If the engine is down, the UI shows the exact error — it never silently swaps in fake results.

## Demo script (per the roadmap)

1. **Landing** → value proposition + live engine badge.
2. **Profile** → enter a 1st-year CSE-IoT student, 2–3 skills, 4 weeks.
3. **Recommendation** → primary project + match score + *why this project* + 2–3 alternatives.
4. **Skill Gap** → existing skills (echoed from the form) vs. skills to learn with priorities.
5. **Roadmap** → exactly N weeks of learn/build/deliverable, plus honest risks & assumptions.

**Personalization proof:** change one field (e.g. 4 → 12 weeks, or add "Arduino") and re-run — the recommendation, skill gap and roadmap visibly change.

## Team split

| You (Product/Frontend/Pitch) | Teammate (AI/Backend) |
| ---------------------------- | --------------------- |
| Screens, flow, story          | `src/lib/ollama.ts`, `src/lib/prompt.ts` |
| Demo choreography            | Prompt rules, dataset tuning in `src/lib/projects.ts` |
| Judge Q&A                    | Failure modes (502/503/504) explanation |

## Scripts

```bash
npm run dev      # dev server (Turbopack)
npm run build    # production build (type-checked)
npm run start    # serve the production build
npm run lint     # eslint
```
