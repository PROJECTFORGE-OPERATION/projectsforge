import { z } from "zod";
import {
  attemptAllowed,
  clearAttempts,
  otpConfigured,
  otpValid,
} from "@/lib/otp";

export const runtime = "nodejs";
export const maxDuration = 15;

const bodySchema = z.object({
  email: z.email().transform((e) => e.toLowerCase()),
  code: z.string().regex(/^\d{6}$/, "Code must be 6 digits"),
  expiresAt: z.number().int().positive(),
  mac: z.string().regex(/^[0-9a-f]{64}$/, "Malformed ticket"),
});

function errorResponse(status: number, payload: Record<string, unknown>): Response {
  return Response.json(payload, { status });
}

/**
 * Step 2 of password reset: prove the emailed code. Verification is
 * stateless — the HMAC from /api/otp/request binds (email, code, expiry), so
 * nothing has to survive a serverless cold start. The caller supplies the
 * ticket; the secret never leaves the server.
 */
export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse(400, { error: "Request body is not valid JSON." });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse(400, {
      error: "That doesn't look like a reset request.",
      issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  }
  const { email, code, expiresAt, mac } = parsed.data;

  if (!otpConfigured) {
    return errorResponse(503, {
      error: "OTP signing is not configured on this server (OTP_SECRET / GEMINI_API_KEY missing).",
    });
  }

  if (Date.now() > expiresAt) {
    return errorResponse(400, { error: "That code has expired — request a new one." });
  }

  if (!attemptAllowed(email, expiresAt)) {
    return errorResponse(429, {
      error: "Too many attempts for this code — request a new one.",
    });
  }

  if (!otpValid(email, code, expiresAt, mac)) {
    return errorResponse(400, { error: "Wrong code. Check the email and try again." });
  }

  clearAttempts(email);
  return Response.json({ ok: true });
}
