# Plan 4 — Data Migration & Go-Live Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the offline tooling that turns the old MySQL dump into a reviewable `import.sql` for Cloudflare D1, plus a go-live runbook the owner executes to migrate data and cut over DNS.

**Architecture:** Dependency-free ESM modules in `scripts/migrate/` — a `mysqldump` parser (maps by column name read from `CREATE TABLE`), donor + applicant transforms per the spec's field-mapping table, a SQL generator, and a CLI. Tested with Vitest `.test.mjs` specs (including an end-to-end load into a fresh local D1) against synthetic rows only. The running app (public site + admin) is not touched.

**Tech Stack:** Node ESM (`.mjs`, no new deps), Vitest, Cloudflare D1 (target), wrangler (owner-run).

**Spec:** `docs/superpowers/specs/2026-07-14-plan-4-migration-golive-design.md` — read its field-mapping table; this plan implements it.

## Global Constraints

- **No new dependencies.** Migration code is plain ESM `.mjs` run by `node`; tested by Vitest via an added `include` glob. It lives in `scripts/migrate/`, outside `src/`/`tests/`, so `tsc` and the app build are untouched.
- **Never commit real PII or secrets.** The dump and generated `import.sql` are local-only, git-ignored. All tests use synthetic rows.
- **Map by column name**, never by position (old tables carry extra key columns like `appEmpID`, `benID`). Read names from `CREATE TABLE`.
- **Preserve the old `appID` as the new `applications.id`** (production applications table is empty at go-live), carrying all parent/child links exactly. Old `cityID` maps 1:1 to seeded `cities.id`.
- **SQL generation escapes single quotes** (SQLite `''` doubling) so PII like `O'Brien` cannot break or inject the file.
- **Straight apostrophes only** (`'`) in code-authored strings.
- **Verify before done:** each code task ends green on its `.test.mjs`; the whole plan ends green on `npm run test`, `npm run build`, `npx tsc --noEmit`. Baseline suite is **141 tests**.
- The app is unchanged — no file under `src/`, `public/`, or the admin is modified.

## Field mapping (from the spec — implemented in Tasks 2-3)
- **Donors:** `donName`→`name`, `donContact`→`contact_person`, `address`/`city`/`state`/`zip`/`phone`/`email` 1:1; `donID` dropped.
- **Applications:** `id`=`appID`; names/address/phone/email 1:1; `cityID`→`city_id`; `diabetic`→`diabetic`; `tree`→`share_with_sponsor`; `date`(`YYYY/M/D`)→`submitted_at` ISO + `season_year` (fallback `2025-01-01T00:00:00Z`/2025); `approved`=`'1'`→`status='approved'` else `'new'`; `bedType`→`bed_choice` (`sheet`→`sheets`); `bedSize`→`bed_size` (valid or NULL, NULL when choice none); benefits `fsAmount`/`socAmount`/`ssiAmount`/`csAmount`→ the matching amounts; `omAmount`(+`w2Amount` if >0, with `other_income_for='includes migrated W-2 wages'`)→`other_income_amount`; `unemployment_weekly_amount`=NULL; `good_deed`=`deedText`; `no_employment_confirmed`=1 unless an employer exists; defaults `household_type='family'`, `permanently_disabled=0`, `full_time_residence_confirmed=0`, `years_received_help=0`, `adopted_last_year=0`, `may_not_be_eligible=0`.
- **Members:** `children`→`household_members` (`position` 1..n by `childID`, `relationship=''`); a childless applicant gets a synthesized `{name:"fName lName", relationship:'self', sex:'', age:0, sizes '', gifts ''}` member (flagged).
- **Employers:** `appEmp` slots 1..4 with non-blank `employerN`→one row each (`worker_name`="fName lName", `hourly_wage=wageN??0`, `hours_per_week=hrsPerWkN??0`).

## File Structure
- `scripts/migrate/parse.mjs` — `parseColumns`, `parseRows` (T1)
- `scripts/migrate/transform-donors.mjs` — `transformDonors` (T2)
- `scripts/migrate/transform-applicants.mjs` — `transformApplicants` (T3)
- `scripts/migrate/sql.mjs` — `generateImportSql` (T4)
- `scripts/migrate/run.mjs` — `buildImport` + CLI (T5)
- `scripts/migrate/*.test.mjs` — one per module + `e2e.test.mjs` (T1-T5, T6)
- `vitest.config.ts` — add `scripts/migrate/**/*.test.mjs` to `include` (T1)
- `.gitignore` — ignore local dump + `import.sql` (T5)
- `docs/go-live-runbook.md` — owner runbook (T7)

---

### Task 1: Dump parser (`parse.mjs`)

**Files:**
- Create: `scripts/migrate/parse.mjs`, `scripts/migrate/parse.test.mjs`
- Modify: `vitest.config.ts`

**Interfaces:**
- Produces:
  - `parseColumns(sql: string, table: string): string[]` — ordered column names from `CREATE TABLE \`table\``.
  - `parseRows(sql: string, table: string): Array<Record<string, string|number|null>>` — one object per INSERT row, keyed by column name; quoted→string, `NULL`→`null`, bare numeric→`number`.

- [ ] **Step 1: Add the `.mjs` test glob to `vitest.config.ts`**

Replace the `include` line so the migration specs run (keep the existing timeouts):

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts', 'scripts/migrate/**/*.test.mjs'],
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
```

- [ ] **Step 2: Write the failing test** — `scripts/migrate/parse.test.mjs`

```js
import { describe, it, expect } from 'vitest';
import { parseColumns, parseRows } from './parse.mjs';

// Synthetic dump: a table with an extra key column, escaped quotes (both '' and \'),
// a comma inside a quoted value, and a NULL.
const DUMP = `
CREATE TABLE \`donor\` (
  \`donID\` int(11) NOT NULL AUTO_INCREMENT,
  \`donName\` varchar(100) DEFAULT NULL,
  \`donContact\` varchar(100) DEFAULT NULL,
  \`address\` varchar(100) DEFAULT NULL,
  \`phone\` varchar(20) DEFAULT NULL,
  PRIMARY KEY (\`donID\`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;

INSERT INTO \`donor\` VALUES (1,'O''Brien Co','Pat','123 Main St, Apt 4',NULL),(2,'Acme','Sue','5 Oak',5551234),(3,'D\\'Angelo','x','y',NULL);
`;

describe('parse', () => {
  it('reads column order from CREATE TABLE including the key column', () => {
    expect(parseColumns(DUMP, 'donor')).toEqual(['donID', 'donName', 'donContact', 'address', 'phone']);
  });

  it('maps values to names; handles doubled-quote and backslash escapes, commas, NULL, numbers', () => {
    const rows = parseRows(DUMP, 'donor');
    expect(rows.length).toBe(3);
    expect(rows[0]).toEqual({ donID: 1, donName: "O'Brien Co", donContact: 'Pat', address: '123 Main St, Apt 4', phone: null });
    expect(rows[1].donName).toBe('Acme');
    expect(rows[1].phone).toBe(5551234);
    expect(rows[2].donName).toBe("D'Angelo");
  });

  it('returns [] for a table absent from the dump', () => {
    expect(parseRows(DUMP, 'nope')).toEqual([]);
    expect(parseColumns(DUMP, 'nope')).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npm run test -- scripts/migrate/parse.test.mjs`
Expected: FAIL — `parse.mjs` does not exist.

- [ ] **Step 4: Write the implementation** — `scripts/migrate/parse.mjs`

```js
// Parse a mysqldump .sql file. Read column order from CREATE TABLE, then map each
// INSERT row's values to those names (mysqldump omits column lists, and some old
// tables carry extra key columns — mapping by name keeps the data aligned).

export function parseColumns(sql, table) {
  const re = new RegExp('CREATE TABLE `' + table + '` \\(([\\s\\S]*?)\\n\\)', 'm');
  const m = sql.match(re);
  if (!m) return [];
  const cols = [];
  for (const line of m[1].split('\n')) {
    // A column definition line starts with a backtick-quoted name then a type.
    // Index/key/constraint lines start with a keyword (PRIMARY/UNIQUE/KEY/CONSTRAINT), not a backtick.
    const cm = line.match(/^\s*`([^`]+)`\s+\S/);
    if (cm) cols.push(cm[1]);
  }
  return cols;
}

// Parse the `(v1, v2, ...),(...)` tuples starting after VALUES; stop at a top-level ';'.
function parseTuples(sql, start) {
  const tuples = [];
  let i = start;
  const n = sql.length;
  while (i < n) {
    while (i < n && sql[i] !== '(' && sql[i] !== ';') i++;
    if (i >= n || sql[i] === ';') { i++; break; }
    i++; // past '('
    const vals = [];
    while (i < n) {
      while (i < n && /\s/.test(sql[i])) i++;
      if (sql[i] === ')') { i++; break; }
      if (sql[i] === "'") {
        i++;
        let s = '';
        while (i < n) {
          const ch = sql[i];
          if (ch === '\\') { s += sql[i + 1] ?? ''; i += 2; continue; }
          if (ch === "'") {
            if (sql[i + 1] === "'") { s += "'"; i += 2; continue; }
            i++; break;
          }
          s += ch; i++;
        }
        vals.push(s);
      } else {
        let t = '';
        while (i < n && sql[i] !== ',' && sql[i] !== ')') { t += sql[i]; i++; }
        t = t.trim();
        vals.push(t.toUpperCase() === 'NULL' || t === '' ? null : Number(t));
      }
      while (i < n && sql[i] !== ',' && sql[i] !== ')') i++;
      if (i < n && sql[i] === ',') { i++; continue; }
      if (i < n && sql[i] === ')') { i++; break; }
    }
    tuples.push(vals);
  }
  return { tuples, end: i };
}

export function parseRows(sql, table) {
  const cols = parseColumns(sql, table);
  const rows = [];
  const marker = 'INSERT INTO `' + table + '`';
  let idx = 0;
  while (true) {
    const at = sql.indexOf(marker, idx);
    if (at === -1) break;
    const vIdx = sql.indexOf('VALUES', at);
    if (vIdx === -1) break;
    const between = sql.slice(at + marker.length, vIdx);
    const colMatch = between.match(/\(([^)]*)\)/);
    const useCols = colMatch ? colMatch[1].replace(/`/g, '').split(',').map((s) => s.trim()) : cols;
    const { tuples, end } = parseTuples(sql, vIdx + 'VALUES'.length);
    for (const vals of tuples) {
      const obj = {};
      for (let k = 0; k < useCols.length; k++) obj[useCols[k]] = vals[k] ?? null;
      rows.push(obj);
    }
    idx = end;
  }
  return rows;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test -- scripts/migrate/parse.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add scripts/migrate/parse.mjs scripts/migrate/parse.test.mjs vitest.config.ts
git commit -m "feat: mysqldump parser (column-name mapping, escape/comma/NULL-aware tokenizer)"
```

---

### Task 2: Donor transform (`transform-donors.mjs`)

**Files:**
- Create: `scripts/migrate/transform-donors.mjs`, `scripts/migrate/transform-donors.test.mjs`

**Interfaces:**
- Consumes: donor row objects from `parseRows(sql, 'donor')`.
- Produces:
  - `transformDonors(rows): { donors: object[], flagged: string[] }` — each donor object has keys `name, contact_person, address, city, state, zip, phone, email` (all strings); `flagged` holds names that look like junk.

- [ ] **Step 1: Write the failing test** — `scripts/migrate/transform-donors.test.mjs`

```js
import { describe, it, expect } from 'vitest';
import { transformDonors } from './transform-donors.mjs';

describe('transformDonors', () => {
  it('maps donor fields and keeps every row', () => {
    const rows = [
      { donID: 1, donName: 'Allegiant Oil', donContact: 'Jane', address: '190 N 2nd', city: 'Platteville', state: 'WI', zip: '53818', phone: '555', email: 'j@x.co' },
      { donID: 2, donName: 'Acme', donContact: null, address: null, city: null, state: null, zip: null, phone: '5551', email: null },
    ];
    const { donors } = transformDonors(rows);
    expect(donors.length).toBe(2);
    expect(donors[0]).toEqual({ name: 'Allegiant Oil', contact_person: 'Jane', address: '190 N 2nd', city: 'Platteville', state: 'WI', zip: '53818', phone: '555', email: 'j@x.co' });
    expect(donors[1]).toEqual({ name: 'Acme', contact_person: '', address: '', city: '', state: '', zip: '', phone: '5551', email: '' });
  });

  it('flags likely-junk rows (too short, no letters, or no contact info) but keeps them', () => {
    const rows = [
      { donName: 'buspar', donContact: '', address: '', city: '', state: '', zip: '', phone: '', email: '' }, // no contact info
      { donName: 'gh', donContact: '', address: '', city: '', state: '', zip: '', phone: '', email: '' },      // too short + no contact
      { donName: '1234', donContact: 'x', address: '', city: '', state: '', zip: '', phone: '', email: '' },   // no letters
      { donName: 'Real Donor', donContact: 'Bob', address: '1 St', city: 'Lancaster', state: 'WI', zip: '53813', phone: '555', email: '' },
    ];
    const { donors, flagged } = transformDonors(rows);
    expect(donors.length).toBe(4);
    expect(flagged).toContain('buspar');
    expect(flagged).toContain('gh');
    expect(flagged).toContain('1234');
    expect(flagged).not.toContain('Real Donor');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- scripts/migrate/transform-donors.test.mjs`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation** — `scripts/migrate/transform-donors.mjs`

```js
const str = (v) => (v == null ? '' : String(v).trim());

function isJunk(name, contact, address, phone, email) {
  if (name.length < 3) return true;            // "gh"
  if (!/[a-zA-Z]/.test(name)) return true;     // "1234"
  if (!contact && !address && !phone && !email) return true; // no way to reach them
  return false;
}

export function transformDonors(rows) {
  const donors = [];
  const flagged = [];
  for (const r of rows) {
    const name = str(r.donName);
    const contact_person = str(r.donContact);
    const address = str(r.address);
    const city = str(r.city);
    const state = str(r.state);
    const zip = str(r.zip);
    const phone = str(r.phone);
    const email = str(r.email);
    donors.push({ name, contact_person, address, city, state, zip, phone, email });
    if (isJunk(name, contact_person, address, phone, email)) flagged.push(name);
  }
  return { donors, flagged };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- scripts/migrate/transform-donors.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate/transform-donors.mjs scripts/migrate/transform-donors.test.mjs
git commit -m "feat: donor transform (field map + junk-row flag, keeps all rows)"
```

---

### Task 3: Applicant transform (`transform-applicants.mjs`)

**Files:**
- Create: `scripts/migrate/transform-applicants.mjs`, `scripts/migrate/transform-applicants.test.mjs`

**Interfaces:**
- Consumes: row objects from `parseRows` for `applicants`, `appEmp`, `benefits`, `children`, `goodDeed`.
- Produces:
  - `transformApplicants({ applicants, appEmp, benefits, children, goodDeed }): { applications: object[], members: object[], employers: object[], flagged: object[] }`.
  - Each `applications` object has exactly the keys listed in `APP_KEYS` below (used by `sql.mjs`).
  - `flagged` entries are `{ type: 'synth-member'|'w2-fold', appID: number }`.

`APP_KEYS` (order used by the SQL generator in Task 4): `id, season_year, status, submitted_at, first_name, last_name, address, city_id, phone, email, diabetic, share_with_sponsor, permanently_disabled, bed_choice, bed_size, full_time_residence_confirmed, years_received_help, adopted_last_year, household_type, no_employment_confirmed, food_share_amount, social_security_amount, social_security_for, ssi_amount, ssi_for, child_support_amount, child_support_for, unemployment_weekly_amount, unemployment_for, other_income_amount, other_income_for, good_deed, may_not_be_eligible`.

- [ ] **Step 1: Write the failing test** — `scripts/migrate/transform-applicants.test.mjs`

```js
import { describe, it, expect } from 'vitest';
import { transformApplicants } from './transform-applicants.mjs';

const base = {
  applicants: [
    { appID: 10, fName: 'Sue', lName: "O'Neil", address: '1 Elm', cityID: 13, tree: 1, diabetic: 0, phone: '555', email: 's@x.co', date: '2025/8/15', approved: '1', reviewed: '1', bedType: 'blanket', bedSize: 'queen' },
    { appID: 11, fName: 'Ann', lName: 'Roe', address: '2 Oak', cityID: 13, tree: 0, diabetic: 1, phone: '556', email: 'a@x.co', date: '2025/10/1', approved: '0', reviewed: '0', bedType: 'sheet', bedSize: '' },
  ],
  appEmp: [
    { appID: 10, employer1: 'Acme', wage1: 15, hrsPerWk1: 40, employer2: 'Bee', wage2: 12.5, hrsPerWk2: 10, employer3: '', wage3: null, hrsPerWk3: null, employer4: '', wage4: null, hrsPerWk4: null },
  ],
  benefits: [
    { appID: 10, fsAmount: 200, ssiAmount: null, w2Amount: 500, csAmount: 120, omAmount: 30, socAmount: null },
  ],
  children: [
    { childID: 5, appID: 10, name: 'Kid B', sex: 'M', age: 8, pantSize: '8', shirtSize: 'M', undSize: '8', sockSize: 'M', diaperSize: '', gift: 'lego' },
    { childID: 4, appID: 10, name: 'Kid A', sex: 'F', age: 10, pantSize: '10', shirtSize: 'L', undSize: '10', sockSize: 'L', diaperSize: '', gift: 'books' },
  ],
  goodDeed: [{ appID: 10, deedText: 'Helped a neighbor' }],
};

describe('transformApplicants', () => {
  it('maps an approved applicant with benefits, employers, children, and good deed', () => {
    const { applications, members, employers, flagged } = transformApplicants(base);
    const a = applications.find((x) => x.id === 10);
    expect(a.first_name).toBe('Sue');
    expect(a.last_name).toBe("O'Neil");
    expect(a.city_id).toBe(13);
    expect(a.share_with_sponsor).toBe(1);       // from tree
    expect(a.status).toBe('approved');          // approved '1'
    expect(a.submitted_at).toBe('2025-08-15T00:00:00Z');
    expect(a.season_year).toBe(2025);
    expect(a.bed_choice).toBe('blanket');
    expect(a.bed_size).toBe('queen');
    expect(a.food_share_amount).toBe(200);
    expect(a.other_income_amount).toBe(530);    // omAmount 30 + w2Amount 500
    expect(a.other_income_for).toBe('includes migrated W-2 wages');
    expect(a.no_employment_confirmed).toBe(0);  // has employers
    expect(a.household_type).toBe('family');
    expect(a.good_deed).toBe('Helped a neighbor');
    expect(flagged).toContainEqual({ type: 'w2-fold', appID: 10 });

    const kids = members.filter((m) => m.application_id === 10);
    expect(kids.map((m) => m.name)).toEqual(['Kid A', 'Kid B']); // ordered by childID
    expect(kids.map((m) => m.position)).toEqual([1, 2]);
    expect(kids[0].relationship).toBe('');

    const emps = employers.filter((e) => e.application_id === 10);
    expect(emps.length).toBe(2);                // blank slots 3/4 skipped
    expect(emps[0]).toEqual({ application_id: 10, employer_name: 'Acme', worker_name: 'Sue O\'Neil', hourly_wage: 15, hours_per_week: 40 });
  });

  it('handles a not-approved, childless, employer-less applicant with a sheet bed', () => {
    const { applications, members, employers, flagged } = transformApplicants(base);
    const a = applications.find((x) => x.id === 11);
    expect(a.status).toBe('new');
    expect(a.diabetic).toBe(1);
    expect(a.share_with_sponsor).toBe(0);
    expect(a.bed_choice).toBe('sheets');        // 'sheet' -> 'sheets'
    expect(a.bed_size).toBe(null);              // blank size
    expect(a.no_employment_confirmed).toBe(1);  // no employer row
    expect(a.other_income_amount).toBe(null);   // no benefits row

    const mem = members.filter((m) => m.application_id === 11);
    expect(mem.length).toBe(1);                 // synthesized head member
    expect(mem[0]).toEqual({ application_id: 11, position: 1, name: 'Ann Roe', relationship: 'self', sex: '', age: 0, pants: '', shirt_top: '', underwear: '', socks: '', diapers: '', gifts: '' });
    expect(flagged).toContainEqual({ type: 'synth-member', appID: 11 });
    expect(employers.filter((e) => e.application_id === 11).length).toBe(0);
  });

  it('falls back for an unparseable date', () => {
    const { applications } = transformApplicants({ ...base, applicants: [{ ...base.applicants[0], appID: 12, date: 'garbage' }], children: [], appEmp: [], benefits: [], goodDeed: [] });
    const a = applications.find((x) => x.id === 12);
    expect(a.submitted_at).toBe('2025-01-01T00:00:00Z');
    expect(a.season_year).toBe(2025);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- scripts/migrate/transform-applicants.test.mjs`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation** — `scripts/migrate/transform-applicants.mjs`

```js
const str = (v) => (v == null ? '' : String(v).trim());
const numOrNull = (v) => {
  if (v == null || String(v).trim() === '') return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
};
const bool01 = (v) => (String(v).trim() === '1' ? 1 : 0);

// Old date is text 'YYYY/M/D'. Returns { iso, year } or null.
function parseOldDate(v) {
  const m = String(v ?? '').trim().match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}T00:00:00Z`;
  return { iso, year: Number(y) };
}

function indexByApp(rows) {
  const map = {};
  for (const r of rows) map[Number(r.appID)] = r; // one row per applicant
  return map;
}
function groupByApp(rows) {
  const map = {};
  for (const r of rows) (map[Number(r.appID)] ||= []).push(r);
  return map;
}

export function transformApplicants({ applicants, appEmp, benefits, children, goodDeed }) {
  const empByApp = indexByApp(appEmp || []);
  const benByApp = indexByApp(benefits || []);
  const deedByApp = indexByApp(goodDeed || []);
  const kidsByApp = groupByApp(children || []);

  const applications = [];
  const members = [];
  const employers = [];
  const flagged = [];

  for (const a of applicants || []) {
    const appID = Number(a.appID);
    const fullName = `${str(a.fName)} ${str(a.lName)}`.trim();

    // Date
    const d = parseOldDate(a.date);
    const submitted_at = d ? d.iso : '2025-01-01T00:00:00Z';
    const season_year = d ? d.year : 2025;

    // Bed
    const bedType = str(a.bedType).toLowerCase();
    const bed_choice = bedType === 'sheet' ? 'sheets' : bedType === 'blanket' ? 'blanket' : 'none';
    const rawSize = str(a.bedSize).toLowerCase();
    const bed_size = bed_choice !== 'none' && ['twin', 'full', 'queen', 'king'].includes(rawSize) ? rawSize : null;

    // Employers (up to 4 inline slots)
    const e = empByApp[appID];
    let hasEmployer = false;
    if (e) {
      for (let k = 1; k <= 4; k++) {
        const name = str(e['employer' + k]);
        if (name !== '') {
          hasEmployer = true;
          employers.push({
            application_id: appID,
            employer_name: name,
            worker_name: fullName,
            hourly_wage: numOrNull(e['wage' + k]) ?? 0,
            hours_per_week: numOrNull(e['hrsPerWk' + k]) ?? 0,
          });
        }
      }
    }

    // Benefits
    const b = benByApp[appID];
    const om = numOrNull(b?.omAmount);
    const w2 = numOrNull(b?.w2Amount);
    let other_income_amount = om;
    let other_income_for = '';
    if (w2 != null && w2 > 0) {
      other_income_amount = (om ?? 0) + w2;
      other_income_for = 'includes migrated W-2 wages';
      flagged.push({ type: 'w2-fold', appID });
    }

    // Members
    const kids = (kidsByApp[appID] || []).slice().sort((x, y) => Number(x.childID) - Number(y.childID));
    if (kids.length === 0) {
      members.push({ application_id: appID, position: 1, name: fullName, relationship: 'self', sex: '', age: 0, pants: '', shirt_top: '', underwear: '', socks: '', diapers: '', gifts: '' });
      flagged.push({ type: 'synth-member', appID });
    } else {
      kids.forEach((c, idx) => {
        members.push({
          application_id: appID, position: idx + 1, name: str(c.name), relationship: '',
          sex: str(c.sex), age: numOrNull(c.age) ?? 0, pants: str(c.pantSize), shirt_top: str(c.shirtSize),
          underwear: str(c.undSize), socks: str(c.sockSize), diapers: str(c.diaperSize), gifts: str(c.gift),
        });
      });
    }

    applications.push({
      id: appID,
      season_year,
      status: str(a.approved) === '1' ? 'approved' : 'new',
      submitted_at,
      first_name: str(a.fName),
      last_name: str(a.lName),
      address: str(a.address),
      city_id: numOrNull(a.cityID) ?? 0,
      phone: str(a.phone),
      email: str(a.email),
      diabetic: bool01(a.diabetic),
      share_with_sponsor: bool01(a.tree),
      permanently_disabled: 0,
      bed_choice,
      bed_size,
      full_time_residence_confirmed: 0,
      years_received_help: 0,
      adopted_last_year: 0,
      household_type: 'family',
      no_employment_confirmed: hasEmployer ? 0 : 1,
      food_share_amount: numOrNull(b?.fsAmount),
      social_security_amount: numOrNull(b?.socAmount),
      social_security_for: '',
      ssi_amount: numOrNull(b?.ssiAmount),
      ssi_for: '',
      child_support_amount: numOrNull(b?.csAmount),
      child_support_for: '',
      unemployment_weekly_amount: null,
      unemployment_for: '',
      other_income_amount,
      other_income_for,
      good_deed: str(deedByApp[appID]?.deedText),
      may_not_be_eligible: 0,
    });
  }

  return { applications, members, employers, flagged };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- scripts/migrate/transform-applicants.test.mjs`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate/transform-applicants.mjs scripts/migrate/transform-applicants.test.mjs
git commit -m "feat: applicant transform (5 old tables -> applications/members/employers per field map)"
```

---

### Task 4: SQL generator (`sql.mjs`)

**Files:**
- Create: `scripts/migrate/sql.mjs`, `scripts/migrate/sql.test.mjs`

**Interfaces:**
- Consumes: `{ donors, applications, members, employers }` (the transform outputs).
- Produces:
  - `generateImportSql({ donors, applications, members, employers }): string` — INSERT statements in the order donors → applications → members → employers. Strings single-quote-escaped; `null`→`NULL`; numbers unquoted.

- [ ] **Step 1: Write the failing test** — `scripts/migrate/sql.test.mjs`

```js
import { describe, it, expect } from 'vitest';
import { generateImportSql } from './sql.mjs';

describe('generateImportSql', () => {
  it('escapes apostrophes, renders NULL/numbers, and orders the tables', () => {
    const sql = generateImportSql({
      donors: [{ name: "O'Brien", contact_person: '', address: '', city: '', state: '', zip: '', phone: '', email: '' }],
      applications: [{ id: 10, season_year: 2025, status: 'approved', submitted_at: '2025-08-15T00:00:00Z', first_name: 'Sue', last_name: "O'Neil", address: '1 Elm', city_id: 13, phone: '555', email: 's@x.co', diabetic: 0, share_with_sponsor: 1, permanently_disabled: 0, bed_choice: 'blanket', bed_size: 'queen', full_time_residence_confirmed: 0, years_received_help: 0, adopted_last_year: 0, household_type: 'family', no_employment_confirmed: 0, food_share_amount: 200, social_security_amount: null, social_security_for: '', ssi_amount: null, ssi_for: '', child_support_amount: 120, child_support_for: '', unemployment_weekly_amount: null, unemployment_for: '', other_income_amount: 530, other_income_for: 'includes migrated W-2 wages', good_deed: 'Helped', may_not_be_eligible: 0 }],
      members: [{ application_id: 10, position: 1, name: 'Kid A', relationship: '', sex: 'F', age: 10, pants: '10', shirt_top: 'L', underwear: '10', socks: 'L', diapers: '', gifts: 'books' }],
      employers: [{ application_id: 10, employer_name: 'Acme', worker_name: 'Sue O\'Neil', hourly_wage: 15, hours_per_week: 40 }],
    });
    // Escaping
    expect(sql).toContain("'O''Brien'");
    expect(sql).toContain("'O''Neil'");
    // NULL and numbers unquoted
    expect(sql).toContain('NULL');
    expect(sql).toContain('200');
    // Preserved id + ordering (donors before applications before members before employers)
    expect(sql.indexOf('INSERT INTO donors')).toBeLessThan(sql.indexOf('INSERT INTO applications'));
    expect(sql.indexOf('INSERT INTO applications')).toBeLessThan(sql.indexOf('INSERT INTO household_members'));
    expect(sql.indexOf('INSERT INTO household_members')).toBeLessThan(sql.indexOf('INSERT INTO employers'));
    expect(sql).toContain('INSERT INTO applications (id,');
  });

  it('emits nothing for empty groups', () => {
    expect(generateImportSql({ donors: [], applications: [], members: [], employers: [] })).toBe('');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test -- scripts/migrate/sql.test.mjs`
Expected: FAIL — module missing.

- [ ] **Step 3: Write the implementation** — `scripts/migrate/sql.mjs`

```js
const DONOR_COLS = ['name', 'contact_person', 'address', 'city', 'state', 'zip', 'phone', 'email'];
const APP_COLS = ['id', 'season_year', 'status', 'submitted_at', 'first_name', 'last_name', 'address', 'city_id', 'phone', 'email', 'diabetic', 'share_with_sponsor', 'permanently_disabled', 'bed_choice', 'bed_size', 'full_time_residence_confirmed', 'years_received_help', 'adopted_last_year', 'household_type', 'no_employment_confirmed', 'food_share_amount', 'social_security_amount', 'social_security_for', 'ssi_amount', 'ssi_for', 'child_support_amount', 'child_support_for', 'unemployment_weekly_amount', 'unemployment_for', 'other_income_amount', 'other_income_for', 'good_deed', 'may_not_be_eligible'];
const MEMBER_COLS = ['application_id', 'position', 'name', 'relationship', 'sex', 'age', 'pants', 'shirt_top', 'underwear', 'socks', 'diapers', 'gifts'];
const EMPLOYER_COLS = ['application_id', 'employer_name', 'worker_name', 'hourly_wage', 'hours_per_week'];

function render(v) {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return String(v);
  return "'" + String(v).replace(/'/g, "''") + "'";
}

function insertBlock(table, cols, rows) {
  if (!rows.length) return '';
  return rows
    .map((r) => `INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map((c) => render(r[c])).join(',')});`)
    .join('\n') + '\n';
}

export function generateImportSql({ donors, applications, members, employers }) {
  return (
    insertBlock('donors', DONOR_COLS, donors || []) +
    insertBlock('applications', APP_COLS, applications || []) +
    insertBlock('household_members', MEMBER_COLS, members || []) +
    insertBlock('employers', EMPLOYER_COLS, employers || [])
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test -- scripts/migrate/sql.test.mjs`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/migrate/sql.mjs scripts/migrate/sql.test.mjs
git commit -m "feat: import SQL generator (quote-escaping, NULL/number rendering, table order)"
```

---

### Task 5: CLI runner (`run.mjs`) + gitignore

**Files:**
- Create: `scripts/migrate/run.mjs`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `parseRows` (T1), `transformDonors` (T2), `transformApplicants` (T3), `generateImportSql` (T4).
- Produces:
  - `buildImport(dumpText: string): { sql: string, report: { counts, donorFlags, appFlags } }` — the pure pipeline (used by the e2e test in T6).
  - A CLI: `node scripts/migrate/run.mjs <dump.sql>` writes `import.sql` (cwd) and prints the report.

- [ ] **Step 1: Add git-ignore entries** — append to `.gitignore`

```
# Local-only data migration working files — contain real PII, never commit
/dump.sql
/import.sql
*.dump.sql
```

- [ ] **Step 2: Write the implementation** — `scripts/migrate/run.mjs`

```js
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseRows } from './parse.mjs';
import { transformDonors } from './transform-donors.mjs';
import { transformApplicants } from './transform-applicants.mjs';
import { generateImportSql } from './sql.mjs';

// Pure pipeline: dump text -> { sql, report }. Exported so tests can exercise it.
export function buildImport(dumpText) {
  const { donors, flagged: donorFlags } = transformDonors(parseRows(dumpText, 'donor'));
  const { applications, members, employers, flagged: appFlags } = transformApplicants({
    applicants: parseRows(dumpText, 'applicants'),
    appEmp: parseRows(dumpText, 'appEmp'),
    benefits: parseRows(dumpText, 'benefits'),
    children: parseRows(dumpText, 'children'),
    goodDeed: parseRows(dumpText, 'goodDeed'),
  });
  const sql = generateImportSql({ donors, applications, members, employers });
  const report = {
    counts: { donors: donors.length, applications: applications.length, members: members.length, employers: employers.length },
    donorFlags,
    appFlags,
  };
  return { sql, report };
}

function printReport(report) {
  const c = report.counts;
  console.log('Migration report');
  console.log(`  donors:       ${c.donors}`);
  console.log(`  applications: ${c.applications}`);
  console.log(`  members:      ${c.members}`);
  console.log(`  employers:    ${c.employers}`);
  if (report.donorFlags.length) {
    console.log(`\n  Likely-junk donors to review/delete in the admin (${report.donorFlags.length}):`);
    for (const n of report.donorFlags) console.log(`    - ${n}`);
  }
  const synth = report.appFlags.filter((f) => f.type === 'synth-member').map((f) => f.appID);
  const w2 = report.appFlags.filter((f) => f.type === 'w2-fold').map((f) => f.appID);
  if (synth.length) console.log(`\n  Applications given a placeholder "self" member (no children in old data): ${synth.join(', ')}`);
  if (w2.length) console.log(`  Applications whose W-2 amount was folded into "other income": ${w2.join(', ')}`);
}

function main() {
  const dumpPath = process.argv[2];
  if (!dumpPath) {
    console.error('Usage: node scripts/migrate/run.mjs <path-to-dump.sql>');
    process.exit(1);
  }
  const dumpText = readFileSync(dumpPath, 'utf8');
  const { sql, report } = buildImport(dumpText);
  writeFileSync('import.sql', sql);
  printReport(report);
  console.log('\nWrote import.sql — review it, then load with: wrangler d1 execute <DB> --file=import.sql --remote');
}

// Run main only when invoked directly (not when imported by a test).
const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : '';
if (import.meta.url === invokedPath) main();
```

- [ ] **Step 3: Verify the CLI runs and stays out of git**

Run (smoke test — create a tiny dump with a single-quoted heredoc so backticks stay literal, run the CLI, confirm output and git-ignore, then clean up):
```bash
cat > "$CLAUDE_JOB_DIR/tmp/smoke.sql" <<'EOF'
CREATE TABLE `donor` (
  `donID` int, `donName` varchar(50), `donContact` varchar(50), `address` varchar(50),
  `city` varchar(50), `state` char(2), `zip` char(5), `phone` varchar(20), `email` varchar(50)
) ENGINE=MyISAM;
INSERT INTO `donor` VALUES (1,'Acme','Sue','1 St','Lancaster','WI','53813','555','a@x.co');
EOF
node scripts/migrate/run.mjs "$CLAUDE_JOB_DIR/tmp/smoke.sql"
git status --porcelain import.sql
rm -f import.sql "$CLAUDE_JOB_DIR/tmp/smoke.sql"
```
Expected: prints a report with `donors: 1`; writes `import.sql`; `git status --porcelain import.sql` prints nothing (git-ignored); cleanup removes both files. (If `$CLAUDE_JOB_DIR` is unset, use any writable temp path.)

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate/run.mjs .gitignore
git commit -m "feat: migration CLI (buildImport pipeline + report) and git-ignore local data files"
```

---

### Task 6: End-to-end load test (`e2e.test.mjs`)

**Files:**
- Create: `scripts/migrate/e2e.test.mjs`

**Interfaces:**
- Consumes: `buildImport` (T5); `getTestDb` from `tests/helpers/d1`.
- Produces: nothing (test only). Proves the generated `import.sql` loads into the real schema (FKs, NOT-NULL, CHECK) with preserved ids.

- [ ] **Step 1: Write the test** — `scripts/migrate/e2e.test.mjs`

Note: the synthetic dump uses `cityID` 13 (the town `getTestDb` seeds) and contains no `;` inside any value, so the naive `split(';')` loader (same approach as `getTestDb`) is safe here. Real loads use `wrangler d1 execute --file`, which parses properly.

```js
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from '../../tests/helpers/d1';
import { buildImport } from './run.mjs';

const DUMP = `
CREATE TABLE \`donor\` (
  \`donID\` int, \`donName\` varchar(50), \`donContact\` varchar(50), \`address\` varchar(50),
  \`city\` varchar(50), \`state\` char(2), \`zip\` char(5), \`phone\` varchar(20), \`email\` varchar(50)
) ENGINE=MyISAM;
INSERT INTO \`donor\` VALUES (1,'Acme','Sue','1 St','Lancaster','WI','53813','555','a@x.co');

CREATE TABLE \`applicants\` (
  \`appID\` int, \`fName\` varchar(50), \`lName\` varchar(50), \`address\` varchar(100), \`cityID\` int,
  \`tree\` tinyint, \`diabetic\` tinyint, \`phone\` varchar(20), \`email\` varchar(50), \`date\` varchar(10),
  \`approved\` varchar(11), \`reviewed\` varchar(11), \`bedType\` varchar(10), \`bedSize\` varchar(10)
) ENGINE=MyISAM;
INSERT INTO \`applicants\` VALUES (10,'Sue','ONeil','1 Elm',13,1,0,'555','s@x.co','2025/8/15','1','1','blanket','queen'),(11,'Ann','Roe','2 Oak',13,0,1,'556','a@x.co','2025/10/1','0','0','sheet','');

CREATE TABLE \`appEmp\` (
  \`appEmpID\` int, \`appID\` int, \`employer1\` varchar(50), \`wage1\` decimal(6,2), \`hrsPerWk1\` int,
  \`employer2\` varchar(50), \`wage2\` decimal(6,2), \`hrsPerWk2\` int, \`employer3\` varchar(50), \`wage3\` decimal(6,2), \`hrsPerWk3\` int,
  \`employer4\` varchar(50), \`wage4\` decimal(6,2), \`hrsPerWk4\` int
) ENGINE=MyISAM;
INSERT INTO \`appEmp\` VALUES (1,10,'Acme',15.00,40,'',NULL,NULL,'',NULL,NULL,'',NULL,NULL);

CREATE TABLE \`benefits\` (
  \`benID\` int, \`appID\` int, \`fsAmount\` decimal(8,2), \`ssiAmount\` decimal(8,2), \`w2Amount\` decimal(8,2),
  \`csAmount\` decimal(8,2), \`omAmount\` decimal(8,2), \`socAmount\` decimal(8,2)
) ENGINE=MyISAM;
INSERT INTO \`benefits\` VALUES (1,10,200.00,NULL,500.00,120.00,30.00,NULL);

CREATE TABLE \`children\` (
  \`childID\` int, \`appID\` int, \`name\` varchar(50), \`sex\` char(1), \`age\` int,
  \`pantSize\` varchar(10), \`shirtSize\` varchar(10), \`undSize\` varchar(10), \`sockSize\` varchar(10), \`diaperSize\` varchar(10), \`gift\` varchar(255)
) ENGINE=MyISAM;
INSERT INTO \`children\` VALUES (4,10,'Kid A','F',10,'10','L','10','L','','books'),(5,10,'Kid B','M',8,'8','M','8','M','','lego');

CREATE TABLE \`goodDeed\` (\`appID\` int, \`deedText\` varchar(100)) ENGINE=MyISAM;
INSERT INTO \`goodDeed\` VALUES (10,'Helped a neighbor');
`;

describe('migration end-to-end', () => {
  let db; let dispose;
  beforeAll(async () => { ({ db, dispose } = await getTestDb()); });
  afterAll(async () => { await dispose(); });

  it('loads generated import.sql into D1 with preserved ids and correct children/employers', async () => {
    const { sql, report } = buildImport(DUMP);
    expect(report.counts).toEqual({ donors: 1, applications: 2, members: 3, employers: 1 });
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await db.prepare(stmt).run();
    }
    const app = await db.prepare('SELECT id, first_name, status, share_with_sponsor, other_income_amount FROM applications WHERE id = 10').first();
    expect(app.id).toBe(10);                 // preserved appID
    expect(app.status).toBe('approved');
    expect(app.share_with_sponsor).toBe(1);
    expect(app.other_income_amount).toBe(530);

    const kids = await db.prepare('SELECT name FROM household_members WHERE application_id = 10 ORDER BY position').all();
    expect(kids.results.map((r) => r.name)).toEqual(['Kid A', 'Kid B']);

    const synth = await db.prepare('SELECT relationship, age FROM household_members WHERE application_id = 11').all();
    expect(synth.results).toEqual([{ relationship: 'self', age: 0 }]); // childless -> synthesized member

    const emps = await db.prepare('SELECT employer_name, worker_name FROM employers WHERE application_id = 10').all();
    expect(emps.results).toEqual([{ employer_name: 'Acme', worker_name: 'Sue ONeil' }]);

    const donors = await db.prepare('SELECT name FROM donors').all();
    expect(donors.results.map((r) => r.name)).toEqual(['Acme']);
  });
});
```

- [ ] **Step 2: Run test to verify it passes**

Run: `npm run test -- scripts/migrate/e2e.test.mjs`
Expected: PASS (1 test). (If it fails on a constraint, the generated SQL or a transform default violates the schema — fix the transform, not the test.)

- [ ] **Step 3: Run the whole migration suite + app checks**

Run: `npm run test -- scripts/migrate/` then `npx tsc --noEmit` then `npm run build`
Expected: all migration specs pass; tsc clean (scripts/ is outside tsconfig); build Complete!.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate/e2e.test.mjs
git commit -m "test: end-to-end migration load into D1 (preserved ids, members, employers, donors)"
```

---

### Task 7: Go-live runbook (`docs/go-live-runbook.md`)

**Files:**
- Create: `docs/go-live-runbook.md`

**Interfaces:** none (documentation). References `scripts/migrate/run.mjs` and the migrations.

- [ ] **Step 1: Write `docs/go-live-runbook.md`**

Write the file with the exact content below.

````markdown
# Go-Live Runbook — Grant County Holiday Project

Ordered checklist to migrate data and cut over to the new site. The old PHP site stays live and
untouched until the final cutover step. Do the steps in order. Values in `<angle brackets>` are
yours to fill in; never paste secrets into this file or any commit.

## 0. Before you start
- [ ] Confirm `main` builds and tests pass locally: `npm run test`, `npm run build`.
- [ ] Have a Cloudflare account with the domain available, and the old site's database access.

## 1. Export the old database
- [ ] In the old host's phpMyAdmin (or cPanel), export the `grantco3_holidayProject` database as a
      single **SQL** file (Export → Custom → SQL, "structure and data"). Save it as `dump.sql` in the
      project root. It is git-ignored — do not commit it.
- [ ] Only that database is needed; ignore `grantco3_hproject` and `grantco3_testing`.

## 2. Build the import file (offline, safe to repeat)
- [ ] Run: `node scripts/migrate/run.mjs dump.sql`
- [ ] Read the printed **migration report**: donor/application/member/employer counts (sanity-check
      against the old site), the likely-junk donors to delete later, the applications given a
      placeholder "self" member, and any W-2 amounts folded into "other income".
- [ ] Open the generated `import.sql` and skim it. It is git-ignored — do not commit it.

## 3. Provision production Cloudflare resources
- [ ] Create the production D1 database: `wrangler d1 create <DB_NAME>` and put its binding/id in
      `wrangler.toml` (production environment).
- [ ] Create the R2 bucket for the paper application PDF and bind it (`FILES`).
- [ ] Set secrets (never commit them): `wrangler pages secret put CSRF_SECRET` (use a fresh 64-hex
      random value), `wrangler pages secret put RESEND_API_KEY`.
- [ ] Apply the schema + seed to production:
      `wrangler d1 execute <DB_NAME> --file=migrations/0001_init.sql --remote` then
      `wrangler d1 execute <DB_NAME> --file=migrations/0002_seed.sql --remote`.
- [ ] Confirm the `admin_emails` seed lists the correct operator + owner addresses (edit
      `migrations/0002_seed.sql` before applying if not).

## 4. Load the migrated data
- [ ] `wrangler d1 execute <DB_NAME> --file=import.sql --remote`
- [ ] Spot-check counts: `wrangler d1 execute <DB_NAME> --command "SELECT (SELECT COUNT(*) FROM donors) AS donors, (SELECT COUNT(*) FROM applications) AS apps, (SELECT COUNT(*) FROM household_members) AS members, (SELECT COUNT(*) FROM employers) AS employers" --remote` and compare to the migration report.

## 5. Deploy the app (not yet the live domain)
- [ ] Connect the GitHub repo to Cloudflare Pages; set the production branch to `main` and
      `NODE_VERSION=22` in the Pages build settings. Deploy.
- [ ] Upload the current paper-application PDF via the admin (`/admin/paper-application`) on the
      Pages preview URL, or put it in R2 as `application.pdf`.

## 6. Verify on the Pages URL — BEFORE touching DNS
- [ ] Sign in to `/admin` via the magic link (confirm the email arrives and the link works).
- [ ] Spot-check a few migrated donors and applications in the admin; open one application detail.
- [ ] Delete the flagged-junk donors listed in the migration report (admin → Donors → Delete).
- [ ] Submit a **real test application** through the public form; confirm it appears in the admin and
      the confirmation email arrives. (Delete it afterward.)
- [ ] Check the public pages at 360px width (home, apply, donate, pickup, contact).

## 7. DNS cutover
- [ ] In Cloudflare Pages, add the custom domain and follow the prompts to point DNS at Pages.
- [ ] The old PHP site stays live as a fallback until you confirm the new site is stable. Do not take
      it down yet.
- [ ] Watch the new site for a few days across a real apply + a real admin login.

## 8. Post-cutover cleanup
- [ ] Rotate the old **admin password** and the old **MySQL password** (both were exposed in the
      original repo and chat).
- [ ] Remove or redact `legacy/public_html/adminPanel/upload/gchpManual.pdf` on the old host (it
      prints a stale 2014 admin username/password and is publicly downloadable).
- [ ] Once the new site is confirmed stable, decommission the old PHP site.
- [ ] Delete the local `dump.sql` and `import.sql` (they hold real PII).
````

- [ ] **Step 2: Verify the doc renders and links are valid**

Run: `npm run build`
Expected: build Complete! (the doc is not part of the build; this just confirms nothing broke).

- [ ] **Step 3: Commit**

```bash
git add docs/go-live-runbook.md
git commit -m "docs: go-live runbook (export, provision, import, verify, DNS cutover, cleanup)"
```

---

## Self-Review

**1. Spec coverage:**
- Dependency-free `.mjs` tooling in `scripts/migrate/`, Vitest via include glob → T1 (glob) + all tasks. ✓
- Parser maps by column name from `CREATE TABLE`, handles escaped quotes/commas/NULL → T1. ✓
- Donor transform + junk flag (keep all) → T2. ✓
- Applicant transform per the full field table (preserve appID, tree→share, approved→status, date→ISO+season_year, w2 fold+flag, synth head member, employer slot expansion, no_employment derivation, defaults) → T3. ✓
- SQL generator (escaping, NULL/number, table order) → T4. ✓
- CLI `buildImport` + report + git-ignore dump/import → T5. ✓
- End-to-end load into a fresh D1 with preserved-id round-trip → T6. ✓
- Go-live runbook (export → provision → import → verify-before-cutover → DNS → rotate passwords/remove PDF/decommission) → T7. ✓
- No app/public/admin change; synthetic-only tests, no PII committed → all tasks (nothing under src/public touched; dump/import git-ignored). ✓

**2. Placeholder scan:** No TBD/TODO; every code and doc step is complete and literal.

**3. Type consistency:** `parseRows` (T1) feeds `transformDonors`/`transformApplicants` (T2/T3) via `run.mjs` (T5); the application objects' keys exactly match `APP_COLS` in `sql.mjs` (T4) — both list the same 33 columns in the same order; `buildImport` (T5) is consumed by the e2e test (T6). `getTestDb` import path from `scripts/migrate/` is `../../tests/helpers/d1`. All aligned.

**Note for the executor:** the e2e test's naive `split(';')` loader works only because the synthetic dump has no `;` inside any value; keep it that way. The real production load uses `wrangler d1 execute --file`, which parses SQL properly, so real data containing `;` is fine.
