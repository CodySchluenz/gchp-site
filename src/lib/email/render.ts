export type RenderedEmail = { subject: string; html: string; text: string };

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Shared shell: short, plain, large type. Plans 2-3 reuse this for the
// application-received / approved / denied / sign-in templates.
export function emailShell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html lang="en">
  <body style="margin:0;padding:24px;background:#fffdf7;font-family:Georgia,serif;color:#1c1917;">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-top:6px solid #14532d;padding:24px;font-size:18px;line-height:1.6;">
      <h1 style="font-size:22px;color:#14532d;margin-top:0;">${escapeHtml(title)}</h1>
      ${bodyHtml}
      <p style="font-size:15px;color:#57534e;border-top:1px solid #e7e5e4;padding-top:12px;margin-bottom:0;">
        Grant County Holiday Project · 235 W. Elm St., Lancaster WI 53813 · 608-723-2136 ext 1194
      </p>
    </div>
  </body>
</html>`;
}

export function renderContactEmail(values: {
  name: string;
  email: string;
  message: string;
}): RenderedEmail {
  const subject = 'New message from the website contact form';
  const nameLine = values.name === '' ? '(no name given)' : values.name;
  const html = emailShell(
    'New contact form message',
    `<p><strong>From:</strong> ${escapeHtml(nameLine)} &lt;${escapeHtml(values.email)}&gt;</p>
     <p style="white-space:pre-wrap;">${escapeHtml(values.message)}</p>
     <p>Reply directly to this email to answer them.</p>`,
  );
  const text = `New contact form message\n\nFrom: ${nameLine} <${values.email}>\n\n${values.message}\n\nReply directly to this email to answer them.`;
  return { subject, html, text };
}
