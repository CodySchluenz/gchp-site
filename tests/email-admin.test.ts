import { describe, it, expect } from 'vitest';
import { renderSignInEmail, renderApprovedEmail, renderDeniedEmail, renderAdoptedEmail } from '../src/lib/email/render';

describe('renderSignInEmail', () => {
  it('has a PII-free subject and includes the link and expiry', () => {
    const r = renderSignInEmail('https://example.org/admin/verify?token=abc');
    expect(r.subject).toBe('Your Grant County Holiday Project sign-in link');
    expect(r.html).toContain('https://example.org/admin/verify?token=abc');
    expect(r.text).toContain('https://example.org/admin/verify?token=abc');
    expect(r.html).toContain('15 minutes');
  });
});

describe('renderApprovedEmail', () => {
  it('greets by escaped name, mentions the pickup slip, PII-free subject', () => {
    const r = renderApprovedEmail('<Sue>');
    expect(r.subject).toBe('Your Holiday Project application was approved');
    expect(r.subject).not.toContain('Sue');
    expect(r.html).toContain('&lt;Sue&gt;');
    expect(r.html).toContain('pickup slip');
    expect(r.text).toContain('608-723-2136 ext 1194');
  });
});

describe('renderDeniedEmail', () => {
  it('is kind, PII-free subject, invites a phone call', () => {
    const r = renderDeniedEmail('Sue');
    expect(r.subject).toBe('An update on your Holiday Project application');
    expect(r.subject).not.toContain('Sue');
    expect(r.html).toContain('608-723-2136 ext 1194');
    expect(r.text).toContain('608-723-2136 ext 1194');
  });
});

describe('renderAdoptedEmail', () => {
  it('has the owner-approved subject and the spec body verbatim, PII-free subject, escaped name', () => {
    const r = renderAdoptedEmail('<Sue>');
    expect(r.subject).toBe('Your Holiday Project family has been adopted');
    expect(r.subject).not.toContain('Sue');
    expect(r.html).toContain('&lt;Sue&gt;');
    // Spec §Owner-approved-decisions #2, verbatim:
    expect(r.text).toContain(
      'Per your approval, you have been adopted! You will not receive a pickup slip as stated in your approval notice. A community organization or adoptive family will contact you before December 10th to arrange a time and place for you to receive your gifts. Everything they receive about your family is kept confidential.',
    );
    expect(r.html).toContain('December 10th');
    expect(r.html).toContain('kept confidential');
    expect(r.text).toContain('608-723-2136 ext 1194');
  });
});
