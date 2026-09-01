/**
 * Email delivery abstraction. Until an email provider (e.g. Gmail or Resend)
 * is connected, sending is unavailable and callers should surface a clear
 * "not configured" error instead of pretending the email was sent.
 */

export interface OutgoingEmail {
  to: string;
  subject: string;
  text: string;
  imageUrl?: string | null;
}

export function isEmailConfigured(): boolean {
  return false;
}

export async function sendEmail(_email: OutgoingEmail): Promise<void> {
  throw new Error(
    "Email sending is not configured yet. Connect an email provider first.",
  );
}
