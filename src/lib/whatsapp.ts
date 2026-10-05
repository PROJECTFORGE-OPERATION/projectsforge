/**
 * Feedback delivery plumbing.
 *
 * Primary channel: a wa.me deep link that opens WhatsApp with the message
 * prefilled, addressed to the team's number (NEXT_PUBLIC_WHATSAPP_NUMBER).
 * Free, no Twilio account. If the number is not configured we fail loudly
 * instead of pretending a message was sent — email stays as the fallback.
 */

export const CONTACT_EMAIL = "projectforgestartup@gmail.com";

/** Digits only, country code without +. Empty string = not configured. */
export const WHATSAPP_NUMBER = (
  process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? ""
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
