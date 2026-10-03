import { z, type ZodType } from "zod";

/**
 * Real AI layer — talks directly to a local Ollama server.
 *
 * There is intentionally NO fallback/demo mode here. If Ollama is unreachable
 * or the model produces output that fails validation twice, the request fails
 * loudly with a precise error instead of silently returning canned data.
 */

const OLLAMA_HOST = (process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434").replace(
  /\/+$/,
  "");
export const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "phi4-gpu";
const TIMEOUT_MS = Number(process.env.OLLAMA_TIMEOUT_MS ?? 180_000);
const ATTEMPTS = 2;

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
        `[ollama] attempt ${attempt}/${ATTEMPTS} (${((Date.now() - attemptStart) / 1000).toFixed(1)}s): ${message}`,
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

async function request(
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
