import { pingEngine } from "@/lib/ollama";

export const runtime = "nodejs";

/** Reports the real state of the active AI engine — no synthetic "online". */
export async function GET(): Promise<Response> {
  const engine = await pingEngine();
  // Where THIS function actually runs (Vercel sets it; "local" when self-hosted).
  const region = process.env.VERCEL_REGION ?? "local";
  if (!engine.ok) {
    return Response.json({
      ok: false,
      provider: engine.provider,
      model: engine.model,
      region,
      error: engine.error,
    });
  }
  return Response.json({
    ok: true,
    provider: engine.provider,
    model: engine.model,
    region,
    modelPresent: engine.modelPresent,
    ...(engine.modelCount !== undefined ? { modelCount: engine.modelCount } : {}),
  });
}
