import { pingEngine } from "@/lib/ollama";

export const runtime = "nodejs";

/** Reports the real state of the active AI engine — no synthetic "online". */
export async function GET(): Promise<Response> {
  const engine = await pingEngine();
  if (!engine.ok) {
    return Response.json({
      ok: false,
      provider: engine.provider,
      model: engine.model,
      error: engine.error,
    });
  }
  return Response.json({
    ok: true,
    provider: engine.provider,
    model: engine.model,
    modelPresent: engine.modelPresent,
    ...(engine.modelCount !== undefined ? { modelCount: engine.modelCount } : {}),
  });
}
