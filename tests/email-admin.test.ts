import { describe, it, expect } from 'vitest';
import { renderSignInEmail, renderApprovedEmail, renderDeniedEmail } from '../src/lib/email/render';

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
