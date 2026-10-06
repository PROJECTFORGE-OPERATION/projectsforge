/**
 * TEMPORARY deployment diagnostic — answers why /api/* crash on Vercel.
 * Uses ONLY dynamic imports inside try/catch so a failing import becomes
 * visible JSON instead of an empty 500. Removed after diagnosis.
 */
export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  const steps: Record<string, string> = {};

  try {
    await import("firebase-admin/app");
    steps["import_app"] = "ok";
  } catch (cause) {
    steps["import_app"] = `FAIL ${String(cause).slice(0, 300)}`;
  }
  try {
    await import("firebase-admin/auth");
    steps["import_auth"] = "ok";
  } catch (cause) {
    steps["import_auth"] = `FAIL ${String(cause).slice(0, 300)}`;
  }
  try {
    await import("firebase-admin/firestore");
    steps["import_firestore"] = "ok";
  } catch (cause) {
    steps["import_firestore"] = `FAIL ${String(cause).slice(0, 300)}`;
  }

  try {
    const mod = await import("@/lib/server/firebase");
    steps["import_firebase_ts"] = "ok";
    try {
      await mod.requireUser(new Request("http://localhost/"));
      steps["requireUser_noheader"] = "unexpected-ok";
    } catch (cause) {
      const err = cause as { status?: number; message?: string };
      steps["requireUser_noheader"] = `${err.status ?? "?"}: ${String(err.message ?? cause).slice(0, 200)}`;
    }
    try {
      await mod.requireUser(
        new Request("http://localhost/", {
          headers: { authorization: "Bearer bogus-token" },
        }),
      );
      steps["requireUser_bogus"] = "unexpected-ok";
    } catch (cause) {
      const err = cause as { status?: number; message?: string };
      steps["requireUser_bogus"] = `${err.status ?? "?"}: ${String(err.message ?? cause).slice(0, 200)}`;
    }
  } catch (cause) {
    steps["import_firebase_ts"] = `FAIL ${String(cause).slice(0, 400)}`;
  }

  const key = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  steps["env_key"] = key
    ? `len=${key.length} head=${JSON.stringify(key.slice(0, 1))} tail=${JSON.stringify(key.slice(-1))}`
    : "MISSING";
  steps["env_db"] = process.env.FIRESTORE_DATABASE_ID ?? "(unset)";
  steps["env_project"] = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "(unset)";
  steps["node"] = process.version;

  return Response.json(steps);
}
