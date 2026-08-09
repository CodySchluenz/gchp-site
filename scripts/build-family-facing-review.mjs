// Builds "What Families See — review copy" for Sherlyn: every outward-facing
// email (rendered by the site's real code) and paper, with when-it-happens
// notes and questions for her feedback. Output: review.html (then PDF).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
// review-emails.json is written by scripts/render-review-emails.mjs from the
// site's real render code — run that first after any email wording change.
const emails = JSON.parse(readFileSync(join(here, 'review-emails.json'), 'utf8'));

// The emails carry every style inline; lift the content out of its page shell
// so it embeds cleanly in the review. Since 2026-08-08 the shell is a table
// (Outlook-safe), so grab the outermost table; the hidden preheader above it
// is invisible anyway.
const inner = (html) => html.slice(html.indexOf('<table'), html.lastIndexOf('</table>') + 8);

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
  /* ---- faithful copies of the printed papers (2026-08-08 layouts) ---- */
  .notice { box-sizing: border-box; padding: 10px 10px 8px; border: 1px dashed #666; font-size: 14px; line-height: 1.35; background: #fff; }
  .notice p { margin: 5px 0; }
  .notice .org { text-align: center; font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: #44403c; margin: 0; }
  .notice .doc { text-align: center; font-size: 18px; font-weight: bold; margin: 0 0 6px; }
  .notice .keyrow { display: flex; justify-content: space-between; gap: 16px; font-size: 16px; border-top: 1.5px solid #000; border-bottom: 1.5px solid #000; padding: 4px 2px; }
  .notice .keyrow strong { font-size: 17px; }
  .notice .when { font-size: 16px; }
  .slip { border: 2px solid #000; font-size: 14px; background: #fff; }
  .slip p { margin: 4px 0; }
  .slip .head { display: flex; justify-content: space-between; border-bottom: 2px solid #000; }
  .slip .head-left { padding: 8px 14px; }
  .slip .org { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; color: #44403c; margin: 0; }
  .slip .doc { font-size: 17px; font-weight: bold; margin: 0; }
  .slip .pu { border-left: 2px solid #000; padding: 4px 16px; text-align: center; display: flex; flex-direction: column; justify-content: center; }
  .slip .pulabel { font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; margin: 0; }
  .slip .punum { font-size: 28px; font-weight: bold; line-height: 1.05; margin: 0; }
  .slip .bodypad { padding: 8px 14px 12px; }
  .slip .name { font-size: 20px; font-weight: bold; margin: 4px 0 0; }
  .slip .contact { color: #44403c; }
  .slip .pickup { font-size: 16px; margin: 6px 0 0; }
  .slip .badge { display: inline-block; border: 2px solid #000; font-weight: bold; padding: 0 8px; margin: 8px 8px 0 0; font-size: 14px; }
  .slip .factgrid { display: grid; grid-template-columns: repeat(4, 1fr); border: 1px solid #666; margin: 10px 0 0; }
  .slip .fact { padding: 4px 8px; border-right: 1px solid #666; }
  .slip .fact:last-child { border-right: none; }
  .slip .flabel { font-size: 10px; letter-spacing: 0.08em; text-transform: uppercase; color: #44403c; margin: 0; }
  .slip .fvalue { font-size: 14px; font-weight: bold; margin: 0; }
  .slip .applied { font-size: 12px; color: #44403c; margin: 6px 0 0; }
  .slip table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 12.5px; }
  .slip th, .slip td { border: 1px solid #666; padding: 4px 6px; text-align: left; vertical-align: top; }
  .slip .sz { display: block; white-space: nowrap; }
  .slip .pnote { border: 2px solid #000; padding: 6px 10px; margin: 10px 0 0; font-size: 14px; }
  .slip .notes-label { font-weight: 700; margin: 12px 0 2px; font-size: 14px; }
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
    <li>You'll get an email from us when we've reviewed it, telling you how you'll receive your gifts.</li></ol>
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
    <p class="org">Grant County Holiday Project</p>
    <p class="doc">Pick Up Notice</p>
    <div class="keyrow"><span>Name <strong>Merry Testhouse</strong></span> <span>ID# <strong>1500</strong></span></div>
    <p class="when"><strong>Pick up:</strong> <strong>Tuesday Dec. 16th 11–2:30 PM</strong></p>
    <p><strong>You must bring this slip in order to pick up your packages.</strong> Please do not bring
      children. Make sure there is a place to put your items in vehicle.
      <strong>Please clean out car prior to pick-up.</strong></p>
    <p>Project items will not be delivered. You may send someone else to pick up your items.
      <strong>They must bring this slip and you must print their name and sign on back of slip that they
      can pick up your items.</strong></p>
    <p><strong>Location:</strong> The address is: 245 West Elm St. Lancaster WI. (Gray building
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
    <div class="head">
      <div class="head-left">
        <p class="org">Grant County Holiday Project · 2026</p>
        <p class="doc">Packing Slip</p>
      </div>
      <div class="pu"><p class="pulabel">PU #</p><p class="punum">1500</p></div>
    </div>
    <div class="bodypad">
      <p class="name">Merry Testhouse</p>
      <p class="contact">608-555-0101 · 101 Candy Cane Ln, Platteville · merry@example.com</p>
      <p class="pickup"><strong>Pickup:</strong> Tuesday Dec. 16th — 11–2:30 PM</p>
      <p><span class="badge">DIABETIC</span> <span class="badge">Bed: sheets (full)</span> <span class="badge">5 people</span></p>
      <div class="factgrid">
        <div class="fact"><p class="flabel">Household</p><p class="fvalue">Family</p></div>
        <div class="fact"><p class="flabel">Sponsor OK</p><p class="fvalue">Yes</p></div>
        <div class="fact"><p class="flabel">Years helped</p><p class="fvalue">2</p></div>
        <div class="fact"><p class="flabel">Adopted last yr</p><p class="fvalue">No</p></div>
      </div>
      <p class="applied">Applied: Jul 30, 2026, 2:14 PM</p>
      <table>
        <thead><tr><th>Name</th><th>Relationship</th><th>Sex</th><th>Age</th><th>Sizes</th><th>Gifts to pack</th><th>Doll</th></tr></thead>
        <tbody>
          <tr><td>Merry Testhouse</td><td>Myself (head of household)</td><td>F</td><td>34</td><td><span class="sz">Pants: 12</span><span class="sz">Shirt: L</span><span class="sz">Underwear: M</span><span class="sz">Socks: 9-11</span><span class="sz">Shoe: 8</span><span class="sz">Coat: L</span></td><td>warm blanket, cookbook</td><td></td></tr>
          <tr><td>Nick Testhouse</td><td>The other parent</td><td>M</td><td>36</td><td><span class="sz">Pants: 34x32</span><span class="sz">Shirt: XL</span><span class="sz">Underwear: L</span><span class="sz">Socks: 10-13</span><span class="sz">Shoe: 11</span><span class="sz">Coat: XL</span></td><td>work gloves, thermos</td><td></td></tr>
          <tr><td>Holly Testhouse</td><td>Daughter</td><td>F</td><td>7</td><td><span class="sz">Pants: 7</span><span class="sz">Shirt: 7-8</span><span class="sz">Underwear: 7</span><span class="sz">Socks: S</span><span class="sz">Shoe: 1Y</span><span class="sz">Coat: 8</span></td><td>art set, doll clothes</td><td>White</td></tr>
          <tr><td>Max Testhouse</td><td>Son</td><td>M</td><td>10</td><td><span class="sz">Pants: 10</span><span class="sz">Shirt: 10-12</span><span class="sz">Underwear: 10</span><span class="sz">Socks: M</span><span class="sz">Shoe: 4Y</span><span class="sz">Coat: 10-12</span></td><td>Legos, football</td><td></td></tr>
          <tr><td>Ivy Testhouse</td><td>Daughter</td><td>F</td><td>2</td><td><span class="sz">Pants: 2T</span><span class="sz">Shirt: 2T</span><span class="sz">Underwear: 2T</span><span class="sz">Socks: 2T</span><span class="sz">Shoe: 6T</span><span class="sz">Coat: 2T</span><span class="sz">Diapers: size 5</span></td><td>stacking blocks, stuffed bear</td><td>Non-White</td></tr>
        </tbody>
      </table>
      <p class="pnote"><strong>Note for packers:</strong> Ivy uses a wheelchair — please choose toys she can hold easily.</p>
      <p class="notes-label">Notes</p>
      <div class="rule"></div><div class="rule"></div><div class="rule"></div><div class="rule"></div><div class="rule"></div>
    </div>
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
