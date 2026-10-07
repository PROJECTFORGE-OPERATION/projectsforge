import { FOUNDER_EMAIL } from "@/lib/founder";
import {
  apiErrorResponse,
  requireUser,
  transferClaim,
  type ServerUser,
} from "@/lib/server/firebase";
import { claimTransferSchema, type ErrorResponse } from "@/lib/types";

export const runtime = "nodejs";
/** Vercel function cap — three Firestore reads + three writes fit inside 30s. */
export const maxDuration = 30;

/**
 * POST /api/founder/transfer — move an allotment between students.
 *
 * Edge contract (order is part of the contract and tested):
 *
 *   401 session  → 403 founder-only  → 400 JSON  → 400 zod issues
 *   → transfer refusals (404 / 400 / 409 / 403 in that order)  → 200 state.
 *
 * The founder gate sits BEFORE the body is even parsed: a signed-in student
 * learns nothing about request shapes, and a non-founder can never trigger
 * a Firestore transaction. Refusals come back as plain words — no raw
 * Firebase codes, no canned fallbacks.
 */
export async function POST(request: Request): Promise<Response> {
  let user: ServerUser;
  try {
    user = await requireUser(request);
  } catch (cause) {
    const mapped = apiErrorResponse(cause);
    if (mapped) return mapped;
    console.error("[api/founder/transfer] unexpected auth failure:", cause);
    return Response.json(
      { error: "Unexpected server error while checking your session." } satisfies ErrorResponse,
      { status: 500 },
    );
  }

  if (user.email !== FOUNDER_EMAIL) {
    return Response.json(
      { error: "This dashboard is for the ProjectsForge founder account." } satisfies ErrorResponse,
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: "Request body is not valid JSON." } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  const parsed = claimTransferSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid transfer request.",
        issues: parsed.error.issues.map(
          (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
        ),
      } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  try {
    const result = await transferClaim(user, parsed.data);
    if (!result.ok) {
      return Response.json({ error: result.error }, { status: result.status });
    }
    return Response.json(result);
  } catch (cause) {
    console.error("[api/founder/transfer] transfer failed:", cause);
    return Response.json(
      {
        error:
          "The allotment couldn't be moved in the cloud — nothing changed, please try again.",
      } satisfies ErrorResponse,
      { status: 500 },
    );
  }
}
