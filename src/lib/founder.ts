/**
 * Who sees the all-students founder dashboard.
 *
 * The server enforces it for real: /api/founder compares the verified ID
 * token's email against this constant. The client only uses the same value
 * to hide the entry link — the address is public anyway (it is the contact
 * email in the footer), so NEXT_PUBLIC exposure is by design.
 *
 * Local test runs override it through .env.local (NEXT_PUBLIC_FOUNDER_EMAIL);
 * production falls back to the real founder account.
 */
export const FOUNDER_EMAIL =
  process.env.NEXT_PUBLIC_FOUNDER_EMAIL?.trim().toLowerCase() ||
  "projectforgestartup@gmail.com";
