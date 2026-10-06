import { FOUNDER_EMAIL } from "@/lib/founder";
import {
  apiErrorResponse,
  db,
  requireUser,
  type ServerUser,
} from "@/lib/server/firebase";
import type {
  ClaimRecord,
  CompletionRecord,
  ErrorResponse,
  StoredIntro,
} from "@/lib/types";

export const runtime = "nodejs";
/** Vercel function cap — one collection read fits well inside 30s. */
export const maxDuration = 30;

/** One student's row in the all-students dashboard. */
export interface FounderStudent {
  uid: string;
  name: string;
  email: string;
  joinedAt: string | null;
  updatedAt: string | null;
  branch: string | null;
  year: string | null;
  careerGoal: string | null;
  interests: string[];
  skills: string[];
  primaryTitle: string | null;
  matchScore: number | null;
  model: string | null;
  runCount: number;
  introCount: number;
  introText: string | null;
  completions: CompletionRecord[];
  /** Phase 3: this student's project allotments. */
  claims: ClaimRecord[];
}

/** Firestore Timestamp | ISO string | missing → ISO string | null. */
function iso(value: unknown): string | null {
  if (value && typeof (value as { toDate?: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  return typeof value === "string" ? value : null;
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function toStudent(uid: string, data: Record<string, unknown>): FounderStudent {
  const email = typeof data.email === "string" ? data.email : "";
  const run = data.latestRun as
    | {
        analysis?: { primary?: { title?: string; matchScore?: number } };
        model?: string;
      }
    | undefined;
  const profile = data.profile as
    | { branch?: string; year?: string; careerGoal?: string }
    | undefined;
  const intro = data.intro as StoredIntro | null | undefined;
  const completions = Array.isArray(data.completions)
    ? (data.completions as CompletionRecord[])
    : [];
  const claims = Array.isArray(data.claims)
    ? (data.claims as ClaimRecord[])
    : [];

  return {
    uid,
    name:
      (typeof data.name === "string" && data.name.trim()) ||
      email.split("@")[0] ||
      "Student",
    email,
    joinedAt: iso(data.joinedAt),
    updatedAt: iso(data.updatedAt),
    branch: profile?.branch ?? null,
    year: profile?.year ?? null,
    careerGoal: profile?.careerGoal ?? null,
    interests: asStrings((data.profile as { interests?: unknown } | undefined)?.interests),
    skills: asStrings((data.profile as { skills?: unknown } | undefined)?.skills),
    primaryTitle: run?.analysis?.primary?.title ?? null,
    matchScore: typeof run?.analysis?.primary?.matchScore === "number"
      ? run.analysis.primary.matchScore
      : null,
    model: run?.model ?? null,
    runCount: typeof data.runCount === "number" ? data.runCount : 0,
    introCount: typeof data.introCount === "number" ? data.introCount : 0,
    introText: intro?.text ?? null,
    completions,
    claims,
  };
}

/**
 * GET /api/founder — the all-students dashboard feed.
 *
 * Identity first (verified ID token), then the email gate: only the founder
 * account ever gets the list. The client cannot reach Firestore directly —
 * the database runs locked — so this route is the single read path.
 */
export async function GET(request: Request): Promise<Response> {
  let user: ServerUser;
  try {
    user = await requireUser(request);
  } catch (cause) {
    const mapped = apiErrorResponse(cause);
    if (mapped) return mapped;
    console.error("[api/founder] unexpected auth failure:", cause);
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

  try {
    const snap = await db()
      .collection("students")
      .orderBy("updatedAt", "desc")
      .limit(500)
      .get();
    const students = snap.docs.map((doc) =>
      toStudent(doc.id, (doc.data() ?? {}) as Record<string, unknown>),
    );
    return Response.json({ students, founderEmail: FOUNDER_EMAIL });
  } catch (cause) {
    console.error("[api/founder] read failed:", cause);
    return Response.json(
      {
        error:
          "Couldn't read the student list from the cloud — check your connection and try again.",
      } satisfies ErrorResponse,
      { status: 502 },
    );
  }
}
