import { describe, it, expect } from 'vitest';
import { buildXlsx } from '../src/lib/xlsx';

// The workbook is a "stored" (uncompressed) ZIP, so the XML parts are embedded
// verbatim — decoding the bytes as latin1 (byte -> char) lets us assert both
// structure and content without pulling in Node's Buffer types.
function latin1(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return s;
}

describe('buildXlsx', () => {
  it('produces a ZIP container with the parts Excel requires', () => {
    const out = buildXlsx('Applications', ['Name', 'Age'], [['Sue', 42]]);
    expect([out[0], out[1], out[2], out[3]]).toEqual([0x50, 0x4b, 0x03, 0x04]); // PK\x03\x04 local header
    const s = latin1(out);
    expect(s).toContain('PK\x05\x06'); // end-of-central-directory signature
    expect(s).toContain('[Content_Types].xml');
    expect(s).toContain('_rels/.rels');
    expect(s).toContain('xl/workbook.xml');
    expect(s).toContain('xl/worksheets/sheet1.xml');
    expect(s).toContain('Applications'); // sheet name in workbook.xml
  });

  it('writes headers and rows: numbers as numeric cells, text as escaped inline strings', () => {
    const out = buildXlsx('Applications', ['First', 'Amount'], [["O'Brien", 250], ['Later', null]]);
    const s = latin1(out);
    expect(s).toContain('<t xml:space="preserve">First</t>');       // header
    expect(s).toContain('<t xml:space="preserve">O\'Brien</t>');    // text cell (apostrophe kept)
    expect(s).toContain('<v>250</v>');                              // numeric cell, unquoted
    expect(s).not.toContain('>null<');                             // a null becomes an empty cell, not "null"
  });

  it('escapes XML-special characters in text values', () => {
    const out = buildXlsx('S', ['H'], [['a & b < c > d "q"']]);
    expect(latin1(out)).toContain('a &amp; b &lt; c &gt; d &quot;q&quot;');
  });
});
