import {
  addCompletionTx,
  apiErrorResponse,
  migrateRecords,
  readRecords,
  requireUser,
  type ServerUser,
} from "@/lib/server/firebase";
import { recordsRequestSchema, type ErrorResponse } from "@/lib/types";

export const runtime = "nodejs";
/** Vercel function cap — Firestore round trips fit well inside 30s. */
export const maxDuration = 30;

/**
 * Cloud records for the signed-in student (Phase 2 backbone).
 *
 *   GET  — profile, intro, completions and the latest analysis run in one
 *          round trip. This is what hydrates /result and /communication on a
 *          fresh device, and what the localStorage migration compares against.
 *   POST — { action: "complete" } marks a project done (idempotent inside a
 *          transaction) or { action: "migrate" } imports records a Phase-1
 *          student still keeps only in this browser. Both never overwrite
 *          newer cloud data.
 *
 * Identity comes from the verified ID token — there is no anonymous access
 * and no way to read another student's document from the client.
 */
async function auth(request: Request): Promise<ServerUser | Response> {
  try {
    return await requireUser(request);
  } catch (cause) {
    const mapped = apiErrorResponse(cause);
    if (mapped) return mapped;
    console.error("[api/records] unexpected auth failure:", cause);
    return Response.json(
      { error: "Unexpected server error while checking your session." } satisfies ErrorResponse,
      { status: 500 },
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  const user = await auth(request);
  if (user instanceof Response) return user;

  try {
    return Response.json(await readRecords(user));
  } catch (cause) {
    console.error("[api/records] read failed:", cause);
    return Response.json(
      {
        error:
          "Couldn't read your records from the cloud — check your connection and try again.",
      } satisfies ErrorResponse,
      { status: 502 },
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

  const parsed = recordsRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Invalid records request.",
        issues: parsed.error.issues.map(
          (i) => `${i.path.join(".") || "(root)"}: ${i.message}`,
        ),
      } satisfies ErrorResponse,
      { status: 400 },
    );
  }

  const action = parsed.data.action;
  try {
    if (action === "complete") {
      const completions = await addCompletionTx(user, parsed.data.record);
      return Response.json({ completions });
    }
    const completions = await migrateRecords(user, {
      completions: parsed.data.completions,
      intro: parsed.data.intro ?? null,
    });
    return Response.json({ completions });
  } catch (cause) {
    // Label with the action: "complete" and "migrate" both write
    // students/{uid}, and without the action a contention failure is
    // impossible to attribute to the request that caused it.
    console.error(`[api/records] ${action} failed:`, cause);
    return Response.json(
      {
        error: "Your record couldn't be saved to the cloud — please try again.",
      } satisfies ErrorResponse,
      { status: 500 },
    );
  }
}
