// Builds "What Families See — review copy" for Sherlyn: every outward-facing
// email (rendered by the site's real code) and paper, with when-it-happens
// notes and questions for her feedback. Output: review.html (then PDF).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const emails = JSON.parse(readFileSync(join(here, 'emails.json'), 'utf8'));

// The emails carry every style inline; lift the content out of its page shell
// so it embeds cleanly in the review (the shell is just background + centering).
const inner = (html) => html.slice(html.indexOf('<div'), html.lastIndexOf('</div>') + 6);

const emailBlock = (eyebrow, subject, note, html) => `
  <section class="item">
    <p class="eyebrow">${eyebrow}</p>
    <p class="note">${note}</p>
    <div class="envelope">
      <p class="meta">From: Grant County Holiday Project &lt;no-reply@grantcountyholidayproject.org&gt;<br>
         Subject: <strong>${subject}</strong></p>
      <div class="emailpaper">${inner(html)}</div>
    </div>
  </section>`;

const page = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8">
<title>What Families See — Review Copy</title>
<style>
  @page { size: letter; margin: 0.6in; }
  body { font-family: Georgia, serif; color: #1c1917; margin: 0; font-size: 15px; line-height: 1.5; }
  h1 { font-size: 26px; color: #14532d; margin: 0 0 4px; }
  h2 { font-size: 20px; color: #14532d; border-bottom: 3px solid #14532d; padding-bottom: 4px; margin: 28px 0 10px; page-break-after: avoid; }
  .eyebrow { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #b45309; font-weight: 700; margin: 0 0 2px; }
  .note { margin: 2px 0 8px; color: #44403c; }
  .item { break-inside: avoid; page-break-inside: avoid; margin-bottom: 22px; }
  .envelope { border: 1.5px solid #a8a29e; padding: 10px 12px 14px; background: #fafaf9; }
  .meta { font-family: 'Segoe UI', Arial, sans-serif; font-size: 12.5px; color: #57534e; margin: 0 0 8px; }
  .emailpaper { background: #fffdf7; padding: 12px; }
  .qbox { border-left: 5px solid #9f1239; padding: 10px 14px; margin-top: 16px; background: #fff; }
  .qbox h2 { border: none; color: #9f1239; margin: 0 0 6px; padding: 0; }
  .pagebreak { page-break-before: always; }
  ul, ol { margin: 6px 0; }
  /* ---- faithful copies of the printed papers ---- */
  .notice { box-sizing: border-box; padding: 12px 8px 8px; border: 1px dashed #666; font-size: 13px; line-height: 1.35; background: #fff; }
  .notice p { margin: 4px 0; }
  .notice .title { text-align: center; font-weight: bold; font-size: 15px; }
  .notice .who { display: flex; justify-content: space-between; gap: 16px; font-size: 17px; margin-top: 8px; }
  .notice .when { font-size: 16px; }
  .slip { border: 2px solid #000; padding: 14px; font-size: 15px; background: #fff; }
  .slip .row { display: flex; gap: 24px; font-size: 19px; }
  .slip .name { font-size: 21px; margin: 8px 0 2px; }
  .slip .pickup { font-size: 17px; margin: 4px 0; }
  .slip .facts { font-size: 15px; margin: 4px 0; }
  .slip table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12.5px; }
  .slip th, .slip td { border: 1px solid #666; padding: 4px 6px; text-align: left; }
  .slip .flag { font-weight: bold; color: #b91c1c; margin-right: 8px; }
  .slip .packer-note { margin-top: 12px; font-size: 15px; }
  .slip .notes-label { font-weight: 700; margin: 14px 0 2px; font-size: 15px; }
  .slip .rule { border-bottom: 1px solid #999; height: 1.6em; }
  .label { width: 2.625in; height: 1in; border: 1px dashed #a8a29e; display: flex; flex-direction: column; justify-content: center; padding: 0 10px; box-sizing: border-box; font-size: 13px; line-height: 1.3; background: #fff; }
</style>
</head>
<body>

<h1>What Families See — Review Copy</h1>
<p class="note">August 2026 · Every email and paper a family can receive from the Holiday Project website,
shown exactly as it goes out, with a note on when each one happens.</p>

<h2>The journey, in order</h2>
<ol>
  <li>A family applies online and immediately sees the <strong>thank-you page</strong> (below), and gets
    <strong>Email 1</strong> if they typed an email address (the Elderly/Disabled form makes email optional —
    no address means no emails; everything else still works).</li>
  <li>You review and decide: approve → <strong>Email 2</strong> (family) or <strong>Email 3</strong>
    (elderly/disabled). Deny → <strong>Email 4</strong>.</li>
  <li>If you later mark a family adopted → <strong>Email 5</strong>.</li>
  <li>In December: families get the mailed <strong>Pick Up Notice</strong>; elderly/disabled households get
    your Christmas card with the food and gift cards (hand-prepared by you — the website prints the
    <strong>envelope labels</strong>); volunteers pack from the <strong>Packing slip</strong>, which
    families never see.</li>
</ol>

<h2>The thank-you page (on screen, right after they press Send)</h2>
<section class="item"><div class="envelope"><div class="emailpaper">
  <p style="font-size:19px;font-weight:bold;color:#14532d;margin:0;">We received your application. Thank you!</p>
  <div style="border-left:4px solid #14532d;background:#fff;padding:10px 14px;margin-top:10px;">
    <p style="font-weight:bold;color:#14532d;margin:0;">Here's what happens next:</p>
    <ol><li>Our volunteers will review your application.</li>
    <li>You'll get an email from us when it has been reviewed, telling you how you'll receive your gifts.</li></ol>
    <p style="margin:6px 0 0;">You don't need to do anything else right now. A confirmation email is on its way to your inbox.</p>
  </div>
  <p style="margin:10px 0 0;">Your information is private. We use it only to prepare your family's gifts, and we never share your name with donors or sponsors without your permission.</p>
  <p style="margin:8px 0 0;">Questions? Call our message line at <strong>608-723-2136 ext 1194</strong> and leave your name and phone number. You can also check <u>this year's pickup schedule</u>.</p>
</div></div></section>

<h2 class="pagebreak">The five emails</h2>
${emailBlock('Email 1 of 5 — sent the moment an application arrives', emails.received.subject,
  'Goes to everyone who typed an email address, family and elderly alike.', emails.received.html)}
${emailBlock('Email 2 of 5 — sent when you press "Approve and email them" on a FAMILY household', emails.approvedFamily.subject,
  'Family households only.', emails.approvedFamily.html)}
${emailBlock('Email 3 of 5 — sent when you press "Approve and email them" on an ELDERLY/DISABLED household', emails.approvedElderly.subject,
  'The website picks this version automatically from the household type.', emails.approvedElderly.html)}
${emailBlock('Email 4 of 5 — sent when you press "Deny and email them"', emails.denied.subject,
  'Same wording for every household type.', emails.denied.html)}
${emailBlock('Email 5 of 5 — sent when you press "Mark adopted and email them"', emails.adopted.subject,
  'Only for approved families who said Yes to sharing with a sponsor. Your new December 7th wording.', emails.adopted.html)}

<h2 class="pagebreak">The mailed Pick Up Notice (families receive this)</h2>
<section class="item">
  <p class="note">Prints three to a page with dashed cut lines; you cut and mail one per family. The day
  fills in from your Pickup days screen (or the family's own pickup day if you chose one).</p>
  <article class="notice">
    <p class="title">Grant County Holiday Project Pick Up Notice</p>
    <p class="who"><span>Name <strong>Merry Testhouse</strong></span> <span>ID# <strong>1500</strong></span></p>
    <p class="when"><u>Pick up:</u> <strong>Tuesday Dec. 16th 11–2:30 PM</strong></p>
    <p><strong>You must bring this slip in order to pick up your packages.</strong> Please do not bring
      children. Make sure there is a place to put your items in vehicle.
      <strong>Please clean out car prior to pick-up.</strong></p>
    <p>Project items will not be delivered. You may send someone else to pick up your items.
      <u>They must bring this slip and you must print their name and sign on back of slip that they
      can pick up your items.</u></p>
    <p><strong><u>Location:</u></strong> The address is: 245 West Elm St. Lancaster WI. (Gray building
      across from the Fire Station). Park in parking lot only. DO NOT park in front of the Fire
      Station. Cars will be towed.</p>
  </article>
</section>

<h2 class="pagebreak">The Packing slip (volunteers only — families never see it)</h2>
<section class="item">
  <p class="note">One family per page, for the packers' pile. The <strong>Gifts to pack</strong> column
  prints whatever you've set in each person's "Gifts / toys wanted" — your final pack list. The DIABETIC
  flag, bed line, and packers' note appear only when set; this sample shows everything at once.
  Income, good deeds, and your private notes never appear.</p>
  <article class="slip">
    <div class="row"><span><strong>PU #:</strong> 1500</span> <span><strong>People:</strong> 5</span></div>
    <p class="name"><strong>Merry Testhouse</strong> — 608-555-0101</p>
    <p>101 Candy Cane Ln, Platteville</p>
    <p class="pickup"><strong>Pickup:</strong> Tuesday Dec. 16th — 11–2:30 PM</p>
    <p><span class="flag">DIABETIC</span> <span>Bed: sheets (full)</span></p>
    <p class="facts">Applied: Jul 30, 2026, 2:14 PM · Email: merry@example.com</p>
    <p class="facts">Household type: family · OK to share with a sponsor: Yes · Years received help: 2 · Adopted last year: No</p>
    <table>
      <thead><tr><th>Name</th><th>Relationship</th><th>Sex</th><th>Age</th><th>Sizes</th><th>Gifts to pack</th><th>Doll</th></tr></thead>
      <tbody>
        <tr><td>Merry Testhouse</td><td>Myself (head of household)</td><td>F</td><td>34</td><td>Pants: 12, Shirt: L, Underwear: M, Socks: 9-11, Shoe: 8, Coat: L</td><td>warm blanket, cookbook</td><td>—</td></tr>
        <tr><td>Nick Testhouse</td><td>The other parent</td><td>M</td><td>36</td><td>Pants: 34x32, Shirt: XL, Underwear: L, Socks: 10-13, Shoe: 11, Coat: XL</td><td>work gloves, thermos</td><td>—</td></tr>
        <tr><td>Holly Testhouse</td><td>Daughter</td><td>F</td><td>7</td><td>Pants: 7, Shirt: 7-8, Underwear: 7, Socks: S, Shoe: 1Y, Coat: 8</td><td>art set, doll clothes</td><td>White doll</td></tr>
        <tr><td>Max Testhouse</td><td>Son</td><td>M</td><td>10</td><td>Pants: 10, Shirt: 10-12, Underwear: 10, Socks: M, Shoe: 4Y, Coat: 10-12</td><td>Legos, football</td><td>—</td></tr>
        <tr><td>Ivy Testhouse</td><td>Daughter</td><td>F</td><td>2</td><td>Pants: 2T, Shirt: 2T, Underwear: 2T, Socks: 2T, Shoe: 6T, Coat: 2T, Diapers: size 5</td><td>stacking blocks, stuffed bear</td><td>Non-White doll</td></tr>
      </tbody>
    </table>
    <p class="packer-note"><strong>Note for packers:</strong> Ivy uses a wheelchair — please choose toys she can hold easily.</p>
    <p class="notes-label">Notes</p>
    <div class="rule"></div><div class="rule"></div><div class="rule"></div><div class="rule"></div><div class="rule"></div>
  </article>
</section>

<h2>The Christmas-card envelope label (elderly &amp; disabled mail)</h2>
<section class="item">
  <p class="note">Avery 30-per-sheet; one per approved mailed household. Zip codes print only if they
  were typed into the address.</p>
  <div class="label"><span>Edna Testelder</span><span>3 Holly Berry Way</span><span>Potosi, WI</span></div>
</section>


</body>
</html>`;

writeFileSync(join(here, 'review.html'), page);
console.log('review.html written');
