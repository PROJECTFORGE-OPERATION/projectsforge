import { z } from "zod";
import {
  cooldownRemaining,
  issueOtp,
  markSent,
  otpConfigured,
  otpHmac,
  OTP_TTL_MS,
  RESEND_COOLDOWN_MS,
  sendOtpEmail,
  smtpConfigured,
} from "@/lib/otp";

export const runtime = "nodejs";
export const maxDuration = 30;

const bodySchema = z.object({ email: z.email() });

function errorResponse(status: number, payload: Record<string, unknown>): Response {
  return Response.json(payload, { status });
}

/**
 * Step 1 of password reset: email a 6-digit OTP to the requested address.
 * Never reveals whether an account exists (accounts are device-local anyway)
 * and never returns the code — it only travels by email.
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
      error: "Invalid email address.",
      issues: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`),
    });
  }
  const email = parsed.data.email.toLowerCase();

  if (!otpConfigured) {
    return errorResponse(503, {
      error: "OTP signing is not configured on this server (OTP_SECRET / GEMINI_API_KEY missing).",
    });
  }
  if (!smtpConfigured) {
    return errorResponse(503, {
      error:
        "Email delivery is not configured on this server — set SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS.",
    });
  }

  // Best-effort rate limits: per recipient and per caller.
  const emailWait = cooldownRemaining(email);
  if (emailWait > 0) {
    return errorResponse(429, {
      error: `A code was already sent to that address — wait ${Math.ceil(emailWait / 1000)}s before requesting another.`,
    });
  }
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const ipWait = cooldownRemaining(`ip:${ip}`);
  if (ipWait > 0) {
    return errorResponse(429, {
      error: `Too many reset requests from this network — wait ${Math.ceil(ipWait / 1000)}s.`,
    });
  }

  try {
    const ticket = issueOtp();
    await sendOtpEmail(email, ticket);
    markSent(email);
    markSent(`ip:${ip}`);
    return Response.json({
      ok: true,
      expiresAt: ticket.expiresAt,
      mac: otpHmac(email, ticket),
      cooldownSeconds: Math.round(RESEND_COOLDOWN_MS / 1000),
      ttlSeconds: Math.round(OTP_TTL_MS / 1000),
    });
  } catch (cause) {
    console.error("[api/otp/request] delivery failed:", cause);
    const detail = String((cause as Error)?.message ?? cause).slice(0, 300);
    return errorResponse(502, {
      error: `Could not deliver the reset email — ${detail}`,
    });
  }
}
