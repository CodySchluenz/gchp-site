import { describe, it, expect } from 'vitest';
import { toCsv } from '../src/lib/csv';

describe('toCsv', () => {
  it('quotes fields containing comma, quote, or newline and escapes quotes', () => {
    const out = toCsv(['a', 'b'], [['plain', 'has,comma'], ['has"quote', 'has\nnewline']]);
    // strip BOM for assertion
    const body = out.replace(/^﻿/, '');
    expect(body).toBe(
      'a,b\r\n' +
        'plain,"has,comma"\r\n' +
        '"has""quote","has\nnewline"\r\n',
    );
  });

  it('starts with a UTF-8 BOM and renders null as empty', () => {
    const out = toCsv(['x'], [[null]]);
    expect(out.charCodeAt(0)).toBe(0xfeff);
    expect(out.replace(/^﻿/, '')).toBe('x\r\n\r\n');
  });

  it('renders numbers without quoting', () => {
    expect(toCsv(['n'], [[42]]).replace(/^﻿/, '')).toBe('n\r\n42\r\n');
  });
});
