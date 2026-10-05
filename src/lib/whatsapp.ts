/**
 * Feedback delivery plumbing.
 *
 * Primary channel: a wa.me deep link that opens WhatsApp with the message
 * prefilled, addressed to the team's number (NEXT_PUBLIC_WHATSAPP_NUMBER).
 * Free, no Twilio account. If the number is not configured we fail loudly
 * instead of pretending a message was sent — email stays as the fallback.
 */

export const CONTACT_EMAIL = "projectforgestartup@gmail.com";

/**
 * Team WhatsApp number — intentionally NOT rendered anywhere in the UI.
 * Users only ever see WhatsApp open with a prefilled message; the number
 * lives in the wa.me URL. NEXT_PUBLIC_* values are inlined into the client
 * bundle regardless of how they're set, so the baked-in default keeps the
 * feature working on deploys where the env var isn't configured.
 */
const DEFAULT_WHATSAPP_NUMBER = "918328627605";

/** Digits only, country code without +. Empty string = not configured. */
export const WHATSAPP_NUMBER = (
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || DEFAULT_WHATSAPP_NUMBER
).replace(/\D/g, "");

export const whatsappConfigured = WHATSAPP_NUMBER.length >= 10;

export function buildWhatsAppUrl(text: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}

/** Opens WhatsApp with a prefilled message. Returns false if unconfigured. */
export function openWhatsApp(text: string): boolean {
  if (!whatsappConfigured) return false;
  window.open(buildWhatsAppUrl(text), "_blank", "noopener,noreferrer");
  return true;
}

export function buildMailtoUrl(subject: string, body: string): string {
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}
