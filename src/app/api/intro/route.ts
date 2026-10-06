import { ACTIVE_MODEL, PROVIDER, AiError, chatStructured } from "@/lib/ollama";
import { buildIntroMessages, makeIntroValidator } from "@/lib/prompt";
import { apiErrorResponse, requireUser, saveIntroDoc, type ServerUser } from "@/lib/server/firebase";
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

  const { name, profile, signature } = parsed.data;

  // Same order as /api/analyze: precise 400s first, then the caller's
  // identity — a signed-out or expired session fails loudly before any AI
  // budget is spent.
  let user: ServerUser;
  try {
    user = await requireUser(request);
  } catch (cause) {
    const mapped = apiErrorResponse(cause);
    if (mapped) return mapped;
    console.error("[api/intro] unexpected auth failure:", cause);
    return errorResponse(500, { error: "Unexpected server error while checking your session." });
  }

  const startedAt = Date.now();

  try {
    const intro: Introduction = await chatStructured(
      buildIntroMessages(name, profile),
      introductionSchema,
      makeIntroValidator(name),
    );
    const response = {
      introduction: intro.introduction.trim(),
      model: ACTIVE_MODEL,
      provider: PROVIDER,
      elapsedMs: Date.now() - startedAt,
      persisted: false,
    };
    // Phase 2: the text + its profile fingerprint land in Firestore so the
    // introduction survives a device change and feeds the founder dashboard.
    try {
      await saveIntroDoc(user, {
        text: response.introduction,
        signature,
        generatedAt: new Date().toISOString(),
      });
      response.persisted = true;
    } catch (cause) {
      console.error("[api/intro] Firestore save failed:", cause);
    }
    return Response.json(response);
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
