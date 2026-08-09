import { describe, it, expect } from 'vitest';
import {
  renderApplicationReceivedEmail, renderApprovedEmail, renderElderlyApprovedEmail,
  renderDeniedEmail, renderAdoptedEmail, renderSignInEmail, renderContactEmail,
} from '../src/lib/email/render';

// The shared shell, reviewed 2026-08-08: table-based (desktop Outlook ignores
// div max-width and the operator reads county mail in Outlook), a title that
// clearly outranks the 18px body, a two-line footer, and a hidden preheader
// line per applicant-facing email so the inbox preview says something useful.
const rendered = {
  received: renderApplicationReceivedEmail('Sue'),
  approved: renderApprovedEmail('Sue'),
  elderly: renderElderlyApprovedEmail('Sue'),
  denied: renderDeniedEmail('Sue'),
  adopted: renderAdoptedEmail('Sue'),
  signin: renderSignInEmail('https://example.org/admin/verify?token=abc'),
  contact: renderContactEmail({ name: 'Sue', email: 'sue@example.com', message: 'Hi' }),
};
const all = Object.entries(rendered);

describe('email shell', () => {
  it('uses a 560px presentation table, not a div (Outlook-safe)', () => {
    for (const [name, r] of all) {
      expect(r.html, name).toContain('role="presentation"');
      expect(r.html, name).toContain('width="560"');
      expect(r.html, name).not.toContain('max-width:560px');
    }
  });

  it('renders the title at 26px so it outranks the 18px body', () => {
    for (const [name, r] of all) {
      expect(r.html, name).toContain('font-size:26px');
      expect(r.html, name).not.toContain('font-size:22px');
    }
  });

  it('splits the footer onto two lines (org name, then address and phone)', () => {
    for (const [name, r] of all) {
      expect(r.html, name).toContain('Grant County Holiday Project<br');
      expect(r.html, name).toContain('245 W. Elm St., Lancaster WI 53813 · 608-723-2136 ext 1194');
    }
  });

  it('never uses a bare hyphen as a dash (house style: em dash)', () => {
    for (const [name, r] of all) {
      // " - " with spaces on both sides is a hyphen posing as a dash; list
      // markers ("\n- Excess income") and phone numbers are untouched.
      expect(r.text, name).not.toMatch(/ - /);
      expect(r.html, name).not.toMatch(/ - /);
    }
  });
});

describe('email preheaders (hidden inbox preview line)', () => {
  const expectations: [keyof typeof rendered, string][] = [
    ['received', 'nothing else to do right now'],
    ['approved', 'Good news'],
    ['elderly', 'Good news'],
    ['denied', 'Questions? Call our message line'],
    ['adopted', 'December 7th'],
    ['signin', '15 minutes'],
  ];

  it.each(expectations)('%s email carries its preview line, hidden', (name, phrase) => {
    const r = rendered[name];
    expect(r.html).toContain(phrase);
    const preheaderAt = r.html.indexOf('display:none');
    const tableAt = r.html.indexOf('<table');
    expect(preheaderAt).toBeGreaterThan(-1);
    expect(tableAt).toBeGreaterThan(-1);
    expect(preheaderAt).toBeLessThan(tableAt);
  });

  it('the denied preview line never reveals the outcome', () => {
    const html = rendered.denied.html;
    const preheader = html.slice(0, html.indexOf('<table'));
    expect(preheader).not.toContain('denied');
    expect(preheader).not.toContain('not able to approve');
  });
});
