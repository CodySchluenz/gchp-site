import { describe, it, expect } from 'vitest';
import { escapeHtml, renderContactEmail } from '../src/lib/email/render';

describe('escapeHtml', () => {
  it('escapes HTML metacharacters', () => {
    expect(escapeHtml(`<b>&"'</b>`)).toBe('&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
  });
});

describe('renderContactEmail', () => {
  const values = { name: 'Sue', email: 'sue@example.com', message: 'Hello <there>' };

  it('has a PII-free subject', () => {
    const r = renderContactEmail(values);
    expect(r.subject).toBe('New message from the website contact form');
    expect(r.subject).not.toContain('Sue');
  });

  it('includes sender and message in html, escaped', () => {
    const r = renderContactEmail(values);
    expect(r.html).toContain('sue@example.com');
    expect(r.html).toContain('Hello &lt;there&gt;');
    expect(r.html).not.toContain('Hello <there>');
  });

  it('includes a plain-text version', () => {
    const r = renderContactEmail(values);
    expect(r.text).toContain('Hello <there>');
    expect(r.text).toContain('sue@example.com');
  });
});
