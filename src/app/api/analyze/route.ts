import { selectCandidates } from "@/lib/projects";
import { ACTIVE_MODEL, PROVIDER, AiError, chatStructured } from "@/lib/ollama";
import { buildMessages, makeValidator } from "@/lib/prompt";
import { apiErrorResponse, requireUser, saveLatestRun, type ServerUser } from "@/lib/server/firebase";
import {
  makeAnalysisSchema,
  profileSchema,
  type AnalyzeResponse,
  type Analysis,
  type ErrorResponse,
  type StudentProfile,
} from "@/lib/types";

export const runtime = "nodejs";
/** Vercel function cap — Gemini answers in 5–30s; retry loop fits in 60. */
export const maxDuration = 60;

function errorResponse(status: number, payload: ErrorResponse): Response {
  return Response.json(payload, { status });
}

/** Trim/renumber the roadmap to exactly the requested number of weeks. */
function normalizeRoadmap(analysis: Analysis, profile: StudentProfile): Analysis {
  const weeks = analysis.roadmap
    .slice(0, profile.availableWeeks)
    .map((week, index) => ({ ...week, week: index + 1 }));
  return { ...analysis, roadmap: weeks };
}

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, { error: "Request body is not valid JSON." });
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, {
      error: "Invalid student profile.",
      issues: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
      ),
    });
  }

  const profile = parsed.data;

  // Identity before any AI budget: /profile is gated, so a real student is
  // always signed in. Validation above runs first so a bad body still fails
  // with its precise 400 (edge suite) before auth is even considered.
  let user: ServerUser;
  try {
    user = await requireUser(request);
  } catch (cause) {
    const mapped = apiErrorResponse(cause);
    if (mapped) return mapped;
    console.error("[api/analyze] unexpected auth failure:", cause);
    return errorResponse(500, { error: "Unexpected server error while checking your session." });
  }

  const candidates = selectCandidates(profile);
  const startedAt = Date.now();

  try {
    const analysis = await chatStructured(
      buildMessages(profile, candidates),
      makeAnalysisSchema(profile.availableWeeks),
      makeValidator(profile, candidates),
    );

    const response: AnalyzeResponse = {
      profile,
      analysis: normalizeRoadmap(analysis, profile),
      model: ACTIVE_MODEL,
      provider: PROVIDER,
      candidateCount: candidates.length,
      elapsedMs: Date.now() - startedAt,
      persisted: false,
    };
    // Phase 2 backbone: the run lands in Firestore under the student's uid.
    // A save failure never hides the analysis (it already cost an AI round
    // trip) — it is logged loudly and leaves persisted:false in the payload.
    try {
      await saveLatestRun(user, response);
      response.persisted = true;
    } catch (cause) {
      console.error("[api/analyze] Firestore save failed:", cause);
    }
    return Response.json(response);
  } catch (cause) {
    if (cause instanceof AiError) {
      return errorResponse(cause.status, { error: cause.message });
    }
    console.error("[api/analyze] unexpected error:", cause);
    return errorResponse(500, {
      error: "Unexpected server error — please try again. If it keeps failing, the server logs need review.",
    });
  }
}
