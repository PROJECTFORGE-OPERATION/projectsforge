import {
  apiErrorResponse,
  claimProject,
  requireUser,
  type ServerUser,
} from "@/lib/server/firebase";
import { claimRequestSchema, type ErrorResponse } from "@/lib/types";

export const runtime = "nodejs";
/** Vercel function cap — two Firestore reads + two writes fit inside 30s. */
export const maxDuration = 30;

/**
 * POST /api/claim — allot a project to exactly one student (Phase 3).
 *
 * Contract mirrors /api/records: verified ID token first (401), then JSON
 * (400), then zod (400), then the transactional claim with its loud cap and
 * uniqueness refusals (403/409) — plain words, no canned fallbacks. The tier
 * is derived from the server-side catalog, never trusted from the body.
 */
async function auth(request: Request): Promise<ServerUser | Response> {
  try {
    return await requireUser(request);
  } catch (cause) {
    const mapped = apiErrorResponse(cause);
    if (mapped) return mapped;
    console.error("[api/claim] unexpected auth failure:", cause);
    return Response.json(
      { error: "Unexpected server error while checking your session." } satisfies ErrorResponse,
      { status: 500 },
    );
  }
}

export async function POST(request: Request): Promise<Response> {
  const user = await auth(request);
  if (user instanceof Response) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body is not valid JSON." } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  const parsed = claimRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid claim request.",
        issues: parsed.error.issues.map(
          (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
        ),
      } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  try {
    const result = await claimProject(user, parsed.data);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json(result);
  } catch (cause) {
    console.error("[api/claim] claim failed:", cause);
    return Response.json(
      {
        error:
          "Your project allotment couldn't be saved to the cloud — please try again.",
      } satisfies ErrorResponse,
      { status: 500 },
    );
  }
}
