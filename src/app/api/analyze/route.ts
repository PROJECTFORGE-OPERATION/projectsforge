import { selectCandidates } from "@/lib/projects";
import { ACTIVE_MODEL, PROVIDER, AiError, chatStructured } from "@/lib/ollama";
import { buildMessages, makeValidator } from "@/lib/prompt";
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
    };
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
