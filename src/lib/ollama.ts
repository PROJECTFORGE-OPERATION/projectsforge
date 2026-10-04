import { z, type ZodType } from "zod";

/**
 * Real AI layer — dual-mode, zero fallback.
 *
 * Provider selection (resolved once at module load):
 *   AI_PROVIDER=ollama|gemini — force a provider (scripts/tests use this)
 *   otherwise: GEMINI_API_KEY set → Google Gemini (cloud, for hosted deploys)
 *              no key             → local Ollama (the judge-demo default)
 *
 * There is intentionally NO canned/demo mode. If the engine is unreachable
 * or the model produces output that fails validation twice, the request fails
 * loudly with a precise error instead of silently returning data.
 */

const OLLAMA_HOST = (process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434").replace(
  /\/+$/,
  "");
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "phi4-gpu";
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const GEMINI_KEY = process.env.GEMINI_API_KEY?.trim() || undefined;
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS ?? 180_000);
const ATTEMPTS = 2;

export type Provider = "ollama" | "gemini";

export const PROVIDER: Provider =
  process.env.AI_PROVIDER === "ollama"
    ? "ollama"
    : process.env.AI_PROVIDER === "gemini"
      ? "gemini"
      : GEMINI_KEY
        ? "gemini"
        : "ollama";

/** Model name reported to the API/UI for the active provider. */
export const ACTIVE_MODEL = PROVIDER === "gemini" ? GEMINI_MODEL : OLLAMA_MODEL;

export class AiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AiError";
  }
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/**
 * Keywords that some JSON-schema grammars handle poorly. Stripping them keeps
 * the constrained-decoding schema conservative; every stripped constraint is
 * still enforced by the zod validation + retry loop below.
 *
 * NOTE: pruning must be schema-aware — a field literally named "title" or
 * "format" lives under `properties` and must never be stripped, even though
 * those names are also JSON-schema annotation keywords.
 */
const DROP_KEYS = new Set([
  "$schema",
  "$anchor",
  "$id",
  "minLength",
  "maxLength",
  "minProperties",
  "maxProperties",
  "minimum",
  "maximum",
  "exclusiveMinimum",
  "exclusiveMaximum",
  "multipleOf",
  "pattern",
  "format",
  "default",
  "examples",
  "title",
  "description",
  // NOTE: minItems/maxItems are deliberately KEPT — they let constrained
  // decoding hard-guarantee e.g. an exactly-N-week roadmap.
]);

/** Keys whose value is a map of property-name -> subschema. */
const PROPERTY_MAP_KEYS = new Set(["properties", "patternProperties"]);

/** Keys whose value is a subschema (or array of subschemas). */
const SUBSCHEMA_KEYS = new Set([
  "items",
  "additionalItems",
  "additionalProperties",
  "not",
  "if",
  "then",
  "else",
]);

export function prune(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(prune);
  if (!node || typeof node !== "object") return node;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (DROP_KEYS.has(key)) continue;

    if (PROPERTY_MAP_KEYS.has(key) && value && typeof value === "object" && !Array.isArray(value)) {
      // Keep every property NAME; only prune each property's schema.
      const map: Record<string, unknown> = {};
      for (const [name, sub] of Object.entries(value)) {
        map[name] = prune(sub);
      }
      out[key] = map;
    } else if (SUBSCHEMA_KEYS.has(key)) {
      out[key] = prune(value);
    } else if (key === "anyOf" || key === "oneOf" || key === "allOf") {
      out[key] = Array.isArray(value) ? value.map(prune) : value;
    } else {
      // Leaf-ish values (type, enum, required, const…) — copy untouched.
      out[key] = value;
    }
  }
  return out;
}

function parseJson(content: string): unknown | undefined {
  try {
    return JSON.parse(content);
  } catch {
    const start = content.indexOf("{");
    const end = content.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(content.slice(start, end + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}

function formatIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 6)
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}

/**
 * Send a prompt to Ollama and return output validated against `schema`.
 *
 * @param validate extra business-rule checks run after zod passes; return an
 *   error string to trigger a corrective retry, or null when valid.
 */
export async function chatStructured<T>(
  messages: ChatMessage[],
  schema: ZodType<T>,
  validate?: (value: T) => string | null,
): Promise<T> {
  const format = prune(z.toJSONSchema(schema)) as Record<string, unknown>;
  const conversation = [...messages];
  let lastError = "unknown validation error";

  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const attemptStart = Date.now();
    const response = await request(conversation, format);
    const parsed = parseJson(response);
    const log = (message: string) =>
      console.log(
        `[${PROVIDER}] attempt ${attempt}/${ATTEMPTS} (${((Date.now() - attemptStart) / 1000).toFixed(1)}s): ${message}`,
      );

    if (parsed === undefined) {
      lastError = "the reply was not valid JSON";
      log(`invalid JSON (${response.length} chars)`);
    } else {
      const result = schema.safeParse(parsed);
      if (result.success) {
        const ruleError = validate?.(result.data) ?? null;
        if (ruleError === null) {
          log(`valid (${response.length} chars)`);
          return result.data;
        }
        lastError = ruleError;
        log(`business rule failed: ${ruleError}`);
      } else {
        lastError = formatIssues(result.error);
        log(`zod failed: ${lastError}`);
      }
    }

    if (attempt < ATTEMPTS) {
      conversation.push(
        { role: "assistant", content: response },
        {
          role: "user",
          content:
            `Your reply failed validation: ${lastError}.\n` +
            "Reply again with a single corrected JSON object only. No prose, no markdown.",
        },
      );
    }
  }

  throw new AiError(
    `The model produced invalid output after ${ATTEMPTS} attempts: ${lastError}`,
    502,
  );
}

async function requestOllama(
  messages: ChatMessage[],
  format: Record<string, unknown>,
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages,
        stream: false,
        format,
        // Large per-request schemas + long roadmaps need headroom over the
        // 4096-token default, otherwise long replies get truncated mid-JSON.
        options: { temperature: 0.35, num_ctx: 8192 },
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (cause) {
    const timedOut =
      cause instanceof Error &&
      (cause.name === "TimeoutError" || cause.name === "AbortError");
    if (timedOut) {
      throw new AiError(
        `The local model did not respond within ${Math.round(TIMEOUT_MS / 1000)}s.`,
        504,
      );
    }
    throw new AiError(
      `Cannot reach Ollama at ${OLLAMA_HOST}. Start it with "ollama serve" and make sure the "${OLLAMA_MODEL}" model is pulled.`,
      503,
    );
  }

  if (!response.ok) {
    const detail = (await response.text().catch(() => "")).slice(0, 400);
    throw new AiError(
      `Ollama responded ${response.status}: ${detail || "(no body)"}`,
      502,
    );
  }

  const data = (await response.json()) as {
    message?: { content?: string };
    error?: string;
  };
  if (data.error) throw new AiError(`Ollama error: ${data.error}`, 502);

  const content = data.message?.content;
  if (typeof content !== "string" || content.length === 0) {
    throw new AiError("The model returned an empty response.", 502);
  }
  return content;
}

/** One provider call for the active engine — same contract both ways. */
async function request(
  messages: ChatMessage[],
  format: Record<string, unknown>,
): Promise<string> {
  return PROVIDER === "gemini"
    ? requestGemini(messages, format)
    : requestOllama(messages, format);
}

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Gemini's responseSchema is an OpenAPI subset and rejects a few
 * JSON-schema keywords outright. Dropping them is safe: every constraint
 * they encode (e.g. minItems/maxItems roadmap length) is re-enforced by the
 * zod + business-rule retry loop in chatStructured.
 */
function toGeminiSchema(node: unknown): unknown {
  const drop = new Set([
    "minItems",
    "maxItems",
    "minLength",
    "maxLength",
    "pattern",
    "additionalProperties",
    "additionalItems",
    "unevaluatedProperties",
    "patternProperties",
    "$ref",
    "$defs",
  ]);
  if (Array.isArray(node)) return node.map(toGeminiSchema);
  if (!node || typeof node !== "object") return node;

  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node)) {
    if (drop.has(key)) continue;
    if (key === "properties" && value && typeof value === "object") {
      const map: Record<string, unknown> = {};
      for (const [name, sub] of Object.entries(value)) {
        map[name] = toGeminiSchema(sub);
      }
      out[key] = map;
    } else if (key === "items" || key === "not") {
      out[key] = toGeminiSchema(value);
    } else if (key === "anyOf" || key === "oneOf" || key === "allOf") {
      out[key] = Array.isArray(value) ? value.map(toGeminiSchema) : value;
    } else {
      out[key] = value;
    }
  }
  return out;
}

async function requestGemini(
  messages: ChatMessage[],
  format: Record<string, unknown>,
): Promise<string> {
  if (!GEMINI_KEY) {
    throw new AiError(
      "AI_PROVIDER=gemini but GEMINI_API_KEY is not set. Add it to .env.local (or the host's environment variables).",
      503,
    );
  }

  const system = messages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n\n");
  const contents = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

  let response: Response;
  for (let call = 1; ; call++) {
    try {
      response = await fetch(`${GEMINI_BASE}/${GEMINI_MODEL}:generateContent`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-goog-api-key": GEMINI_KEY,
        },
        body: JSON.stringify({
          ...(system
            ? { systemInstruction: { parts: [{ text: system }] } }
            : {}),
          contents,
          generationConfig: {
            temperature: 0.35,
            responseMimeType: "application/json",
            responseSchema: toGeminiSchema(format),
          },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (cause) {
      const timedOut =
        cause instanceof Error &&
        (cause.name === "TimeoutError" || cause.name === "AbortError");
      if (timedOut) {
        throw new AiError(
          `Gemini did not respond within ${Math.round(TIMEOUT_MS / 1000)}s.`,
          504,
        );
      }
      throw new AiError(
        "Cannot reach generativelanguage.googleapis.com — check the network connection.",
        503,
      );
    }

    if (response.ok) break;

    // Upstream 5xx (e.g. "high demand") is transient — one real retry of the
    // SAME engine, never canned data. Everything else fails loudly at once.
    if (response.status >= 500 && call < 2) {
      console.log(`[gemini] upstream ${response.status}, retrying once...`);
      await new Promise((resolve) => setTimeout(resolve, 2000));
      continue;
    }

    const detail = (await response.text().catch(() => "")).slice(0, 400);
    const body = detail || "(no body)";
    if (response.status === 401 || response.status === 403) {
      throw new AiError(
        `Gemini rejected GEMINI_API_KEY (${response.status}): ${body}`,
        503,
      );
    }
    if (response.status === 429) {
      throw new AiError(`Gemini rate limit or quota exceeded (429): ${body}`, 503);
    }
    throw new AiError(`Gemini responded ${response.status}: ${body}`, 503);
  }

  const data = (await response.json().catch(() => ({}))) as {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  if (data.promptFeedback?.blockReason) {
    throw new AiError(
      `Gemini refused the request: ${data.promptFeedback.blockReason}`,
      502,
    );
  }
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("");
  if (text.length === 0) {
    throw new AiError("Gemini returned an empty response.", 502);
  }
  return text;
}

/** Cheap liveness check used by the header status badge. */
export async function pingOllama(): Promise<
  { ok: true; models: string[] } | { ok: false; error: string }
> {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/tags`, {
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) {
      return { ok: false, error: `Ollama responded ${response.status}` };
    }
    const data = (await response.json()) as { models?: Array<{ name: string }> };
    return { ok: true, models: (data.models ?? []).map((m) => m.name) };
  } catch {
    return { ok: false, error: `No Ollama server at ${OLLAMA_HOST}` };
  }
}

/**
 * Real liveness of the ACTIVE provider for the header badge / health route.
 * Gemini: a free model-metadata lookup (validates key + model name).
 * Ollama: /api/tags plus a real model-presence check.
 */
export async function pingEngine(): Promise<
  | {
      ok: true;
      provider: Provider;
      model: string;
      modelPresent: boolean;
      modelCount?: number;
    }
  | { ok: false; provider: Provider; model: string; error: string }
> {
  if (PROVIDER === "gemini") {
    if (!GEMINI_KEY) {
      return {
        ok: false,
        provider: "gemini",
        model: GEMINI_MODEL,
        error: "GEMINI_API_KEY is not set",
      };
    }
    try {
      const response = await fetch(`${GEMINI_BASE}/${GEMINI_MODEL}`, {
        headers: { "x-goog-api-key": GEMINI_KEY },
        signal: AbortSignal.timeout(5_000),
      });
      if (response.ok) {
        return {
          ok: true,
          provider: "gemini",
          model: GEMINI_MODEL,
          modelPresent: true,
        };
      }
      const detail = (await response.text().catch(() => "")).slice(0, 300);
      return {
        ok: false,
        provider: "gemini",
        model: GEMINI_MODEL,
        error: `Gemini ${response.status}: ${detail || "(no body)"}`,
      };
    } catch {
      return {
        ok: false,
        provider: "gemini",
        model: GEMINI_MODEL,
        error: "Cannot reach generativelanguage.googleapis.com",
      };
    }
  }

  const engine = await pingOllama();
  if (!engine.ok) {
    return { ok: false, provider: "ollama", model: OLLAMA_MODEL, error: engine.error };
  }
  return {
    ok: true,
    provider: "ollama",
    model: OLLAMA_MODEL,
    modelPresent: engine.models.some(
      (name) => name === OLLAMA_MODEL || name.startsWith(`${OLLAMA_MODEL}:`),
    ),
    modelCount: engine.models.length,
  };
}
