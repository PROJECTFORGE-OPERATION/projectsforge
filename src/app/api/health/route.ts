import { OLLAMA_MODEL, pingOllama } from "@/lib/ollama";

export const runtime = "nodejs";

/** Reports the real state of the local AI engine — no synthetic "online". */
export async function GET(): Promise<Response> {
  const engine = await pingOllama();
  if (!engine.ok) {
    return Response.json({
      ok: false,
      model: OLLAMA_MODEL,
      error: engine.error,
    });
  }
  return Response.json({
    ok: true,
    model: OLLAMA_MODEL,
    modelPresent: engine.models.some(
      (name) => name === OLLAMA_MODEL || name.startsWith(`${OLLAMA_MODEL}:`),
    ),
    modelCount: engine.models.length,
  });
}
