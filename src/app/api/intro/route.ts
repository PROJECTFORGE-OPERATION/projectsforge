import { ACTIVE_MODEL, PROVIDER, AiError, chatStructured } from "@/lib/ollama";
import { buildIntroMessages, makeIntroValidator } from "@/lib/prompt";
import {
  introRequestSchema,
  introductionSchema,
  type ErrorResponse,
  type Introduction,
} from "@/lib/types";

export const runtime = "nodejs";
/** Vercel function cap — same budget as /api/analyze; retries fit inside 60s. */
export const maxDuration = 60;

function errorResponse(status: number, payload: ErrorResponse): Response {
  return Response.json(payload, { status });
}

/**
 * POST /api/intro — first-person self-introduction from the student's profile
 * (hobbies / schooling / college included).
 *
 * Zero fallback, same contract as /api/analyze: an unreachable engine or two
 * invalid replies fails loudly with a precise error instead of returning text
 * that was not produced by the model.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, { error: "Send a JSON body: { name, profile }." });
  }

  const parsed = introRequestSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, {
      error: "Invalid self-introduction request — check the name and profile fields.",
      issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  }

  const { name, profile } = parsed.data;
  const startedAt = Date.now();

  try {
    const intro: Introduction = await chatStructured(
      buildIntroMessages(name, profile),
      introductionSchema,
      makeIntroValidator(name),
    );
    return Response.json({
      introduction: intro.introduction.trim(),
      model: ACTIVE_MODEL,
      provider: PROVIDER,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (cause) {
    if (cause instanceof AiError) {
      return errorResponse(cause.status, { error: cause.message });
    }
    console.error("[api/intro] unexpected error:", cause);
    return errorResponse(500, {
      error:
        "Unexpected server error — please try again. If it keeps failing, the server logs need review.",
    });
  }
}
