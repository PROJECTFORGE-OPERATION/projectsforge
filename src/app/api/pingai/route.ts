export const runtime = "nodejs";
export const maxDuration = 60;

/** TEMPORARY diagnostic: isolates whether Gemini503 from Vercel egress is
 * IP-wide or payload-specific. Plain text vs JSON-schema constrained. */
const KEY = process.env.GEMINI_API_KEY;
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

async function attempt(label: string, body: Record<string, unknown>) {
  const started = Date.now();
  try {
    const res = await fetch(`${ENDPOINT}/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": KEY ?? "" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    const text = (await res.text()).slice(0, 180);
    return { label, status: res.status, ms: Date.now() - started, body: text };
  } catch (cause) {
    return { label, status: 0, ms: Date.now() - started, error: String(cause) };
  }
}

export async function GET(): Promise<Response> {
  const plain = await attempt("plain", {
    contents: [{ role: "user", parts: [{ text: "Say OK" }] }],
    generationConfig: { maxOutputTokens: 100 },
  });
  const schema = await attempt("schema", {
    contents: [{ role: "user", parts: [{ text: "Give one greeting" }] }],
    generationConfig: {
      maxOutputTokens: 200,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: { msg: { type: "string" } },
        required: ["msg"],
      },
    },
  });
  return Response.json({
    model: MODEL,
    region: process.env.VERCEL_REGION ?? "local",
    plain,
    schema,
  });
}
