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
        Grant County Holiday Project · 245 W. Elm St., Lancaster WI 53813 · 608-723-2136 ext 1194
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

// Step 2's wording deliberately fits BOTH programs (Sherlyn approved it
// 2026-08-08): family households later hear about a pickup slip, elderly/
// disabled households about their Christmas card — this email promises
// neither, just "how you'll receive your gifts".
export function renderApplicationReceivedEmail(firstName: string): RenderedEmail {
  const subject = 'We received your Holiday Project application';
  const bodyText = `Hello ${firstName},

We received your application — thank you. Here's what happens next:

1. Our volunteers will review your application.
2. You'll get an email from us when it has been reviewed, telling you how you'll receive your gifts.

You don't need to do anything else right now. Your information is private and
is used only to prepare your family's gifts.

Questions? Call our message line at 608-723-2136 ext 1194 and leave your name
and phone number.`;
  const html = emailShell(
    'We received your application',
    `<p>Hello ${escapeHtml(firstName)},</p>
     <p>We received your application — thank you. Here's what happens next:</p>
     <ol>
       <li>Our volunteers will review your application.</li>
       <li>You'll get an email from us when it has been reviewed, telling you how
           you'll receive your gifts.</li>
     </ol>
     <p>You don't need to do anything else right now. Your information is private
        and is used only to prepare your family's gifts.</p>
     <p>Questions? Call our message line at <strong>608-723-2136 ext 1194</strong>
        and leave your name and phone number.</p>`,
  );
  return { subject, html, text: bodyText };
}

export function renderSignInEmail(link: string): RenderedEmail {
  const subject = 'Your Grant County Holiday Project sign-in link';
  const text = `Here is your sign-in link for the Grant County Holiday Project admin:

${link}

Click it to sign in. For your security, this link expires in 15 minutes and
can be used once. If you did not ask to sign in, you can ignore this email.`;
  const html = emailShell(
    'Your sign-in link',
    `<p>Here is your sign-in link for the Grant County Holiday Project admin:</p>
     <p><a href="${escapeHtml(link)}">${escapeHtml(link)}</a></p>
     <p>Click it to sign in. For your security, this link expires in
        <strong>15 minutes</strong> and can be used once. If you did not ask to
        sign in, you can ignore this email.</p>`,
  );
  return { subject, html, text };
}

export function renderApprovedEmail(firstName: string): RenderedEmail {
  const subject = 'Your Holiday Project application was approved';
  const text = `Hello ${firstName},

Good news - your Grant County Holiday Project application has been approved.

Watch your mail and email for your pickup slip, which will have your pickup
date in December. Please bring your pickup slip with you.

Questions? Call our message line at 608-723-2136 ext 1194 and leave your name
and phone number.`;
  const html = emailShell(
    'Your application was approved',
    `<p>Hello ${escapeHtml(firstName)},</p>
     <p>Good news - your Grant County Holiday Project application has been
        <strong>approved</strong>.</p>
     <p>Watch your mail and email for your <strong>pickup slip</strong>, which
        will have your pickup date in December. Please bring your pickup slip
        with you.</p>
     <p>Questions? Call our message line at <strong>608-723-2136 ext 1194</strong>
        and leave your name and phone number.</p>`,
  );
  return { subject, html, text };
}

// Sherlyn's wording, verbatim substance (2026-07-31; spec 2026-07-27
// Addendum 2 — matches her Adoption Request form's "contact by Dec 7th").
// Sent only to the family, never mentions the adopter (contact happens
// adopter -> family, not the other way around).
export function renderAdoptedEmail(firstName: string): RenderedEmail {
  const subject = 'Your Holiday Project family has been adopted';
  const text = `Hello ${firstName},

Per your approval, you have been adopted! You will not receive a pickup slip in December. The adoptive organization or community family will contact you by December 7th to set up pickup dates and times. Please make sure your phone is working so you can get the information you need. Everything they receive about your family is kept confidential.

Questions? Call our message line at 608-723-2136 ext 1194 and leave your name
and phone number.`;
  const html = emailShell(
    'You have been adopted!',
    `<p>Hello ${escapeHtml(firstName)},</p>
     <p>Per your approval, you have been adopted! You will not receive a
        <strong>pickup slip</strong> in December. The adoptive organization or
        community family will contact you by <strong>December 7th</strong> to
        set up pickup dates and times. Please make sure your
        <strong>phone is working</strong> so you can get the information you
        need. Everything they receive about your family is kept confidential.</p>
     <p>Questions? Call our message line at <strong>608-723-2136 ext 1194</strong>
        and leave your name and phone number.</p>`,
  );
  return { subject, html, text };
}

// Owner-approved body, verbatim (spec 2026-07-29-elderly-application-design.md,
// "What happens after" — Sherlyn's request doc's exact wording for the
// Elderly/Disabled program's approval; family households keep renderApprovedEmail).
export function renderElderlyApprovedEmail(firstName: string): RenderedEmail {
  const subject = 'Your Holiday Project Elderly/Disabled application was approved';
  const text = `Hello ${firstName},

You have been found eligible for the Grant County Holiday Project Elderly/Disabled program. Your gifts are a Christmas card containing a food and a gift card. You should receive the card the second week in December.

Questions? Call our message line at 608-723-2136 ext 1194 and leave your name
and phone number.`;
  const html = emailShell(
    'Your application was approved',
    `<p>Hello ${escapeHtml(firstName)},</p>
     <p>You have been found eligible for the Grant County Holiday Project
        <strong>Elderly/Disabled program</strong>. Your gifts are a Christmas
        card containing a food and a gift card. You should receive the card
        the second week in December.</p>
     <p>Questions? Call our message line at <strong>608-723-2136 ext 1194</strong>
        and leave your name and phone number.</p>`,
  );
  return { subject, html, text };
}

// The reasons list mirrors Sherlyn's paper denial slip (her words,
// 2026-08-08): ALL reasons are listed and none is singled out — "If they
// have questions they will call."
export function renderDeniedEmail(firstName: string): RenderedEmail {
  const subject = 'An update on your Holiday Project application';
  const text = `Hello ${firstName},

Thank you for applying to the Grant County Holiday Project. After review, we
are not able to approve your application this season. Applications are denied
for one of the following reasons:

- Excess income
- No children under 18 living in the household
- Receiving benefits from another program
- Someone else has already applied for the children

We know this is hard to hear. If you have questions, or think there may have
been a mistake, please call our message line at 608-723-2136 ext 1194 and
leave your name and phone number - we are glad to talk with you.`;
  const html = emailShell(
    'An update on your application',
    `<p>Hello ${escapeHtml(firstName)},</p>
     <p>Thank you for applying to the Grant County Holiday Project. After
        review, we are not able to approve your application this season.
        Applications are denied for one of the following reasons:</p>
     <ul>
       <li>Excess income</li>
       <li>No children under 18 living in the household</li>
       <li>Receiving benefits from another program</li>
       <li>Someone else has already applied for the children</li>
     </ul>
     <p>We know this is hard to hear. If you have questions, or think there may
        have been a mistake, please call our message line at
        <strong>608-723-2136 ext 1194</strong> and leave your name and phone
        number - we are glad to talk with you.</p>`,
  );
  return { subject, html, text };
}
