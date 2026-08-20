// Minimal, dependency-free .xlsx writer for the admin "Download for Excel" export.
//
// Why hand-rolled: most xlsx libraries assume Node APIs and do not run in the
// Cloudflare Workers runtime, and this project keeps dependencies to a minimum.
// This builds exactly the parts Excel needs for a single sheet of text/number
// cells, packaged as a "stored" (uncompressed) ZIP — valid per the ZIP spec and
// opened natively by Excel, Numbers, Google Sheets, and LibreOffice.
//
// It is NOT a general spreadsheet library — just enough for the applications export.

const enc = new TextEncoder();

// --- CRC-32 (the ZIP format requires a checksum for every entry) ---
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function xmlEscape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// 0 -> "A", 25 -> "Z", 26 -> "AA" (spreadsheet column letters)
function colLetter(i: number): string {
  let s = '';
  let n = i + 1;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Every cell carries s="1" — the thin-border style from styles.xml — so the
// sheet reads as a ruled grid on screen and on paper, empty cells included
// (the operator fills the blank Special Gift column in by hand).
function cellXml(col: number, rowNum: number, value: string | number | null): string {
  const ref = `${colLetter(col)}${rowNum}`;
  if (value === null || value === undefined || value === '') return `<c r="${ref}" s="1"/>`;
  if (typeof value === 'number' && Number.isFinite(value)) return `<c r="${ref}" s="1"><v>${value}</v></c>`;
  // Inline string keeps the writer simple (no shared-strings table).
  return `<c r="${ref}" s="1" t="inlineStr"><is><t xml:space="preserve">${xmlEscape(String(value))}</t></is></c>`;
}

// Pre-size each column to its widest content (Excel width units are roughly
// character counts in the default font) so the operator never has to widen a
// column herself. Floor of 8 keeps short columns clickable; ceiling of 45
// keeps one long note from making a mile-wide sheet. A caller-provided
// override wins — used to leave writing room in deliberately blank columns.
function columnWidths(
  headers: string[],
  rows: (string | number | null)[][],
  overrides: (number | undefined)[],
): number[] {
  return headers.map((h, c) => {
    const override = overrides[c];
    if (typeof override === 'number') return override;
    let max = h.length;
    for (const row of rows) {
      const v = row[c];
      if (v === null || v === undefined) continue;
      const len = String(v).length;
      if (len > max) max = len;
    }
    return Math.min(45, Math.max(8, max + 2));
  });
}

function sheetXml(
  headers: string[],
  rows: (string | number | null)[][],
  widthOverrides: (number | undefined)[],
): string {
  const cols = columnWidths(headers, rows, widthOverrides)
    .map((w, c) => `<col min="${c + 1}" max="${c + 1}" width="${w}" customWidth="1"/>`)
    .join('');
  const allRows = [headers, ...rows];
  const body = allRows
    .map((row, r) => `<row r="${r + 1}">${row.map((v, c) => cellXml(c, r + 1, v)).join('')}</row>`)
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<cols>${cols}</cols>` +
    `<sheetData>${body}</sheetData></worksheet>`
  );
}

// --- ZIP writer (store method / no compression) ---
function u16(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
}
function u32(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
}
function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

type Entry = { name: string; data: Uint8Array };

function zipStore(entries: Entry[]): Uint8Array {
  const locals: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const nameBytes = enc.encode(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;
    // Local file header (30 bytes) + name + data. method=0, mod time/date=0.
    const local = concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0),
      nameBytes, e.data,
    ]);
    locals.push(local);
    // Central directory header (46 bytes) + name.
    central.push(concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0), u16(0), u16(0), u16(0),
      u32(0), u32(offset), nameBytes,
    ]));
    offset += local.length;
  }
  const centralBytes = concat(central);
  const eocd = concat([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralBytes.length), u32(offset), u16(0),
  ]);
  return concat([...locals, centralBytes, eocd]);
}

function contentTypesXml(sheetCount: number): string {
  const sheetOverrides = Array.from({ length: sheetCount }, (_, i) =>
    `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
  ).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheetOverrides +
    '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
    '</Types>'
  );
}

// Minimal stylesheet: style index 0 is Excel's required default; index 1 is
// the same cell with a thin border on all four sides (what cellXml references).
// fonts/fills carry the mandatory defaults Excel expects in any styles part.
const STYLES =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts>' +
  '<fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>' +
  '<borders count="2">' +
  '<border><left/><right/><top/><bottom/><diagonal/></border>' +
  '<border><left style="thin"><color auto="1"/></left><right style="thin"><color auto="1"/></right>' +
  '<top style="thin"><color auto="1"/></top><bottom style="thin"><color auto="1"/></bottom><diagonal/></border>' +
  '</borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="2">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>' +
  '</cellXfs>' +
  '</styleSheet>';

const ROOT_RELS =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

function wbRelsXml(sheetCount: number): string {
  const sheetRels = Array.from({ length: sheetCount }, (_, i) =>
    `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
  ).join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheetRels +
    `<Relationship Id="rId${sheetCount + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    '</Relationships>'
  );
}

// Excel rejects sheet names over 31 chars, containing [ ] : * ? / \, or
// duplicated within a workbook. Town names are tame, but sanitize anyway so
// one odd name can't produce a workbook Excel refuses to open.
function sanitizeSheetNames(names: string[]): string[] {
  const seen = new Set<string>();
  return names.map((raw, i) => {
    let name = raw.replace(/[[\]:*?/\\]/g, '').trim().slice(0, 31) || `Sheet ${i + 1}`;
    while (seen.has(name)) name = `${name.slice(0, 27)} (${i + 1})`;
    seen.add(name);
    return name;
  });
}

function workbookXml(sheetNames: string[]): string {
  const sheets = sheetNames
    .map((name, i) => `<sheet name="${xmlEscape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('');
  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    `<sheets>${sheets}</sheets></workbook>`
  );
}

export type SheetSpec = {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
  widthOverrides?: (number | undefined)[];
};

// Build an .xlsx workbook with one tab per SheetSpec (used by the "All towns"
// download, which splits into a worksheet per town). Cells that are finite
// numbers become numeric cells; everything else is text. Columns are
// pre-sized to their content (see columnWidths); `widthOverrides` pins an
// exact width for specific columns (sparse — leave entries undefined to keep
// auto-sizing). Every cell gets a thin border.
export function buildXlsxWorkbook(sheets: SheetSpec[]): Uint8Array {
  const names = sanitizeSheetNames(sheets.map((s) => s.name));
  const sheetEntries: Entry[] = sheets.map((s, i) => ({
    name: `xl/worksheets/sheet${i + 1}.xml`,
    data: enc.encode(sheetXml(s.headers, s.rows, s.widthOverrides ?? [])),
  }));
  return zipStore([
    { name: '[Content_Types].xml', data: enc.encode(contentTypesXml(sheets.length)) },
    { name: '_rels/.rels', data: enc.encode(ROOT_RELS) },
    { name: 'xl/workbook.xml', data: enc.encode(workbookXml(names)) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(wbRelsXml(sheets.length)) },
    { name: 'xl/styles.xml', data: enc.encode(STYLES) },
    ...sheetEntries,
  ]);
}

// Single-sheet convenience wrapper — the shape every export used before the
// per-town split, still used by the specific-view and backup downloads.
export function buildXlsx(
  sheetName: string,
  headers: string[],
  rows: (string | number | null)[][],
  widthOverrides: (number | undefined)[] = [],
): Uint8Array {
  return buildXlsxWorkbook([{ name: sheetName, headers, rows, widthOverrides }]);
}
