import { describe, it, expect } from 'vitest';
import {
  renderSignInEmail, renderApprovedEmail, renderDeniedEmail, renderAdoptedEmail,
  renderElderlyApprovedEmail,
} from '../src/lib/email/render';

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

  // Sherlyn 2026-08-08: her paper denial slip lists ALL the reasons and never
  // singles one out ("If they have questions they will call") — the email
  // does the same, all four, verbatim from her message.
  it('lists all four denial reasons without singling one out', () => {
    const r = renderDeniedEmail('Sue');
    expect(r.text).toContain('one of the following reasons');
    for (const reason of [
      'Excess income',
      'No children under 18 living in the household',
      'Receiving benefits from another program',
      'Someone else has already applied for the children',
    ]) {
      expect(r.text).toContain(reason);
      expect(r.html).toContain(reason);
    }
  });
});

describe('renderAdoptedEmail', () => {
  it('has the owner-approved subject and the coordinator\'s 2026-07-31 body verbatim, PII-free subject, escaped name', () => {
    const r = renderAdoptedEmail('<Sue>');
    expect(r.subject).toBe('Your Holiday Project family has been adopted');
    expect(r.subject).not.toContain('Sue');
    expect(r.html).toContain('&lt;Sue&gt;');
    // Sherlyn's wording (spec 2026-07-27 Addendum 2): December 7th, pickup
    // dates and times, the working-phone reminder; confidentiality kept.
    expect(r.text).toContain(
      'Per your approval, you have been adopted! You will not receive a pickup slip in December. The adoptive organization or community family will contact you by December 7th to set up pickup dates and times. Please make sure your phone is working so you can get the information you need. Everything they receive about your family is kept confidential.',
    );
    expect(r.html).toContain('December 7th');
    expect(r.html).toContain('phone is working');
    expect(r.html).toContain('kept confidential');
    expect(r.text).toContain('608-723-2136 ext 1194');
  });
});

describe('renderElderlyApprovedEmail', () => {
  it('has the spec body verbatim, PII-free subject, escaped name, and the phone number', () => {
    const r = renderElderlyApprovedEmail('<Sue>');
    expect(r.subject).toBe('Your Holiday Project Elderly/Disabled application was approved');
    expect(r.subject).not.toContain('Sue');
    expect(r.subject).not.toContain('!');
    expect(r.html).toContain('&lt;Sue&gt;');
    // Spec "What happens after", verbatim:
    expect(r.text).toContain(
      'You have been found eligible for the Grant County Holiday Project Elderly/Disabled program. Your gifts are a Christmas card containing a food and a gift card. You should receive the card the second week in December.',
    );
    expect(r.html).toContain('Elderly/Disabled program');
    expect(r.text).toContain('608-723-2136 ext 1194');
    expect(r.html).toContain('608-723-2136 ext 1194');
  });
});
