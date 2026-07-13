import { describe, it, expect } from 'vitest';
import { renderApplicationReceivedEmail } from '../src/lib/email/render';

describe('renderApplicationReceivedEmail', () => {
  it('has a PII-free subject', () => {
    const r = renderApplicationReceivedEmail('Sue');
    expect(r.subject).toBe('We received your Holiday Project application');
    expect(r.subject).not.toContain('Sue');
  });

  it('greets by first name (escaped) and explains what happens next', () => {
    const r = renderApplicationReceivedEmail('<Sue>');
    expect(r.html).toContain('&lt;Sue&gt;');
    expect(r.html).not.toContain('<Sue>');
    expect(r.html).toContain('volunteers');
    expect(r.html).toContain('608-723-2136 ext 1194');
    expect(r.text).toContain('608-723-2136 ext 1194');
  });
});
