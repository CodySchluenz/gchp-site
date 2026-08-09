import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
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

  // 2026-08-08 review: active voice for the fits-all step 2 (same meaning as
  // the sentence Sherlyn approved that day, one word shorter).
  it('says "when we\'ve reviewed it", in active voice, in both versions', () => {
    const r = renderApplicationReceivedEmail('Sue');
    expect(r.text).toContain("when we've reviewed it");
    expect(r.html).toContain("when we've reviewed it");
    expect(r.text).not.toContain('when it has been reviewed');
  });

  // The thank-you page deliberately mirrors this email's step 2, word for
  // word — if one changes, both change (spec 2026-08-08-family-facing-review).
  it('stays in sync with the thank-you page wording', () => {
    const page = readFileSync('src/pages/apply/thank-you.astro', 'utf8');
    expect(page).toContain("when we've reviewed it");
    expect(page).not.toContain('when it has been reviewed');
  });
});
