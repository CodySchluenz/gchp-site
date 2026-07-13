import type { RenderedEmail } from './render';

export type SendResult = { sent: true } | { sent: false; error: string };

type EmailEnv = { RESEND_API_KEY: string; EMAIL_FROM: string; EMAIL_REPLY_TO: string };

// Thin Resend REST call. Never throws — callers surface failure in plain
// words and never lose data over an email problem (spec §7).
export async function sendEmail(env: EmailEnv, to: string, email: RenderedEmail, replyTo?: string): Promise<SendResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: env.EMAIL_FROM,
        reply_to: replyTo ?? env.EMAIL_REPLY_TO,
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
    });
    if (!res.ok) {
      let detail = '';
      try {
        detail = (await res.text()).slice(0, 300);
      } catch {
        // unreadable body: fall through with no detail
      }
      return {
        sent: false,
        error: `Resend responded ${res.status}${detail ? `: ${detail}` : ''}`,
      };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, error: e instanceof Error ? e.message : 'send failed' };
  }
}
