import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Email OTP for password reset (device-local accounts, real delivery).
 *
 * The server never stores OTPs: each code is bound to (email, expiry) with an
 * HMAC signature, so verification is stateless and survives serverless cold
 * starts. The signing secret is OTP_SECRET when set, otherwise it is derived
 * from GEMINI_API_KEY (already present on every deployment — the key is never
 * sent anywhere; it only derives a local signing key).
 *
 * Delivery is real SMTP (nodemailer). There is intentionally NO fallback: if
 * SMTP is not configured or the send fails, the request fails loudly instead
 * of ever showing a code the user never received.
 *
 * Rate limits (per-email resend cooldown, per-email attempt counter) are
 * best-effort in-memory — effective on a warm single instance, honest about
 * what a stateless serverless deployment can guarantee.
 */

export const OTP_TTL_MS = Number(process.env.OTP_TTL_MS ?? 5 * 60_000);
export const RESEND_COOLDOWN_MS = Number(process.env.OTP_COOLDOWN_MS ?? 60_000);
export const MAX_VERIFY_ATTEMPTS = 5;

const SMTP_HOST = process.env.SMTP_HOST?.trim();
const SMTP_PORT = Number(process.env.SMTP_PORT ?? 465);
const SMTP_USER = process.env.SMTP_USER?.trim() || undefined;
const SMTP_PASS = process.env.SMTP_PASS?.trim() || undefined;
const MAIL_FROM =
  process.env.MAIL_FROM?.trim() || SMTP_USER || "ProjectsForge <no-reply@localhost>";

/** Signing key: explicit OTP_SECRET > derived from GEMINI_API_KEY > unconfigured. */
const OTP_SECRET =
  process.env.OTP_SECRET?.trim() ||
  (process.env.GEMINI_API_KEY?.trim()
    ? createHmac("sha256", process.env.GEMINI_API_KEY.trim())
        .update("projectsforge:otp:v1")
        .digest("hex")
    : undefined);

export const smtpConfigured = Boolean(SMTP_HOST);
export const otpConfigured = Boolean(OTP_SECRET);

export function smtpConfig(): string {
  return SMTP_HOST
    ? `${SMTP_HOST}:${SMTP_PORT}${SMTP_USER ? " (authenticated)" : " (no auth)"}`
    : "SMTP_HOST is not set";
}

/** 6-digit numeric code, crypto-random. */
export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function signature(email: string, code: string, expiresAt: number): string {
  return createHmac("sha256", OTP_SECRET as string)
    .update(`${email}|${code}|${expiresAt}`)
    .digest("hex");
}

export interface OtpTicket {
  code: string;
  expiresAt: number;
}

/** Generates a fresh code + expiry (binding to the email happens in otpHmac). */
export function issueOtp(): OtpTicket {
  const expiresAt = Date.now() + OTP_TTL_MS;
  return { code: generateOtp(), expiresAt };
}

/** Signature for a ticket — pass to hmacMatches after sending. */
export function otpHmac(email: string, ticket: OtpTicket): string {
  return signature(email, ticket.code, ticket.expiresAt);
}

/** Constant-time HMAC check for a submitted code. */
export function otpValid(email: string, code: string, expiresAt: number, mac: string): boolean {
  const expected = Buffer.from(signature(email, code, expiresAt));
  const got = Buffer.from(mac);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** Lazily build the SMTP transport so config errors surface at send time. */
let transporter: Transporter | null = null;
function mailer(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
    });
  }
  return transporter;
}

export interface MailResult {
  accepted: string;
}

/** Sends the OTP email. Throws with the SMTP cause when delivery fails. */
export async function sendOtpEmail(
  to: string,
  ticket: OtpTicket,
): Promise<MailResult> {
  const minutes = Math.max(1, Math.round(OTP_TTL_MS / 60_000));
  const info = await mailer().sendMail({
    from: MAIL_FROM,
    to,
    subject: "ProjectsForge password reset code",
    text:
      `Your ProjectsForge reset code is: ${ticket.code}\n\n` +
      `It expires in ${minutes} minute${minutes === 1 ? "" : "s"}.\n` +
      `If you did not request this, you can ignore this email — the code\n` +
      `only works for ${to} and stops working when it expires. Never share it.\n\n` +
      `— ProjectsForge · Ideas → Projects → Careers`,
    html:
      `<p>Your ProjectsForge reset code is:</p>` +
      `<p style="font-size:28px;letter-spacing:8px;font-weight:bold">${ticket.code}</p>` +
      `<p>It expires in <strong>${minutes} minute${minutes === 1 ? "" : "s"}</strong>.</p>` +
      `<p>If you did not request this, ignore this email — the code only works ` +
      `for <strong>${to}</strong> and stops working when it expires. Never share it.</p>` +
      `<p style="color:#93a4ba;font-size:12px">— ProjectsForge · Ideas → Projects → Careers</p>`,
  });
  const accepted = (info.accepted ?? []).join(", ");
  if (!accepted) throw new Error("SMTP server accepted no recipients");
  return { accepted };
}

/** Best-effort in-memory rate limits (single warm instance). */
const lastSent = new Map<string, number>();
const attempts = new Map<string, { count: number; expiresAt: number }>();

export function cooldownRemaining(email: string): number {
  const at = lastSent.get(email);
  if (!at) return 0;
  return Math.max(0, at + RESEND_COOLDOWN_MS - Date.now());
}

export function markSent(email: string): void {
  lastSent.set(email, Date.now());
}

/** Returns false once the code has burned MAX_VERIFY_ATTEMPTS tries. */
export function attemptAllowed(email: string, expiresAt: number): boolean {
  const now = Date.now();
  const rec = attempts.get(email);
  if (!rec || rec.expiresAt < now) {
    attempts.set(email, { count: 1, expiresAt });
    return true;
  }
  rec.count += 1;
  return rec.count <= MAX_VERIFY_ATTEMPTS;
}

export function clearAttempts(email: string): void {
  attempts.delete(email);
}
