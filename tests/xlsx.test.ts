import { describe, it, expect } from 'vitest';
import { buildXlsx, buildXlsxWorkbook } from '../src/lib/xlsx';

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

  // 2026-08-19 (Sherlyn): columns arrive pre-sized to their content so she
  // never has to widen a column in Excel herself.
  it('pre-sizes each column to fit its widest content', () => {
    const out = buildXlsx('S', ['Name', 'Address'], [['Sue', '123 Winterberry Lane, Platteville']]);
    const s = latin1(out);
    expect(s).toContain('<cols>');
    expect(s).toContain('<col min="1" max="1" width="8" customWidth="1"/>');   // short column, clamped to the 8-char floor
    expect(s).toContain('<col min="2" max="2" width="35" customWidth="1"/>');  // 33-char address + 2 padding
  });

  it('caps very long columns and honors explicit width overrides', () => {
    const out = buildXlsx('S', ['A', 'B'], [['x'.repeat(100), 'hi']], [undefined, 20]);
    const s = latin1(out);
    expect(s).toContain('<col min="1" max="1" width="45" customWidth="1"/>');  // ceiling, so one note can't make a mile-wide sheet
    expect(s).toContain('<col min="2" max="2" width="20" customWidth="1"/>');  // caller override wins
  });

  // 2026-08-19 (Sherlyn): every cell gets a thin border so the sheet reads as
  // a ruled grid on screen and on paper — including empty cells like the
  // Special Gift column she fills in by hand.
  it('draws thin borders around every cell, empty ones included', () => {
    const out = buildXlsx('S', ['A'], [['x'], [null]]);
    const s = latin1(out);
    expect(s).toContain('xl/styles.xml');
    expect(s).toContain('<left style="thin">');
    expect(s).toContain('<c r="A1" s="1" t="inlineStr">');  // header cell styled
    expect(s).toContain('<c r="A2" s="1" t="inlineStr">');  // data cell styled
    expect(s).toContain('<c r="A3" s="1"/>');               // empty cell still bordered
  });
});

// 2026-08-19 (Sherlyn): the "All towns" download splits into one worksheet
// per town, so each town's stack lives on its own tab.
describe('buildXlsxWorkbook (multi-sheet)', () => {
  const sheets = [
    { name: 'Fennimore', headers: ['Name'], rows: [['Sue']] },
    { name: 'Lancaster', headers: ['Name'], rows: [['Bob']] },
  ];

  it('writes one worksheet part per sheet, all wired into the workbook', () => {
    const s = latin1(buildXlsxWorkbook(sheets));
    expect(s).toContain('xl/worksheets/sheet1.xml');
    expect(s).toContain('xl/worksheets/sheet2.xml');
    expect(s).toContain('<sheet name="Fennimore" sheetId="1" r:id="rId1"/>');
    expect(s).toContain('<sheet name="Lancaster" sheetId="2" r:id="rId2"/>');
    // content-type override and relationship per sheet, styles rel after them
    expect(s).toContain('PartName="/xl/worksheets/sheet2.xml"');
    expect(s).toContain('Target="worksheets/sheet2.xml"');
    expect(s).toContain('Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles"');
    // each sheet carries its own rows
    expect(s).toContain('<t xml:space="preserve">Sue</t>');
    expect(s).toContain('<t xml:space="preserve">Bob</t>');
  });

  it('sanitizes sheet names Excel would reject (31-char cap, forbidden characters)', () => {
    const s = latin1(buildXlsxWorkbook([
      { name: 'A[very]:long/town\\name?that*keeps-going-and-going', headers: ['H'], rows: [] },
    ]));
    expect(s).toContain('<sheet name="Averylongtownnamethatkeeps-goin" sheetId="1"');
  });

  it('single-sheet buildXlsx still produces the same shape (one sheet, one rel + styles)', () => {
    const s = latin1(buildXlsx('Applications', ['H'], [['x']]));
    expect(s).toContain('<sheet name="Applications" sheetId="1" r:id="rId1"/>');
    expect(s).not.toContain('sheet2.xml');
  });
});
