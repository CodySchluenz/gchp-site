import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Sherlyn 2026-09-02: "you can't see all thats there unless you start
// deleting stuff" — the member editor's Gifts box was a one-line input, so a
// long gift list was invisible past the first few words. It must be a real
// multi-line textarea, full width, in BOTH the edit form and the add form,
// labeled as the thing that prints on the packing slip.
describe('member editor gifts box', () => {
  const src = readFileSync('src/pages/admin/applications/[id]/members.astro', 'utf8');

  it('renders gifts as a multi-line textarea, never a one-line input', () => {
    expect(src).not.toContain('type="text" name="gifts"');
    const textareas = src.match(/<textarea[^>]*name="gifts"/g) ?? [];
    expect(textareas.length).toBe(2); // per-person edit form + Add a person form
  });

  it('spans the full card width and says it prints on the packing slip', () => {
    expect(src).toContain('sm:col-span-2');
    expect(src.toLowerCase()).toContain('packing slip');
  });
});
