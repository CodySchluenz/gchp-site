# Application History (Audit Timeline) — Design

Date: 2026-07-24. Status: approved by owner in brainstorming.

## Why

The website is the program's official record, and the operator edits family-reported
data as she verifies it (income corrections, size fixes, phone-call additions). Today
every edit silently overwrites the family's original answers — nothing records what
changed, when, or what was first submitted. That is an integrity gap for a
county-audited program, and it leaves the operator unable to answer "what did they
originally tell us?" or show "we verified and corrected this on Nov 3."

Owner decision: track **everything** — a complete per-application timeline — plus an
as-first-submitted snapshot. Approach 1 (plain-sentence rows composed at save time)
chosen over JSON-snapshot-diff-at-render and structured diff columns: sentences are
trivially stable to display, readable in the raw table by a student maintainer, and
each save path already holds the old values it is about to overwrite.

## Non-negotiables (inherited)

- History is admin-only PII (it carries old values): never on a public route, never
  on packing slips, never in the applicant-facing flow; it lives and dies with its
  application (delete/purge together).
- History is read-only forever: no UI ever edits or deletes a history row.
- Plain English, straight apostrophes, ≥18px admin type; times shown in Central via
  the existing dates lib.
- Not surveillance: page views, downloads, and sign-ins are NOT recorded.
- Additive migration; standard migrate-first deploy order (runbook routine flow).

## Data model — migration `0012_application_history.sql`

```sql
-- Application history: one plain-English sentence per change, written by the
-- same code paths that save the change. Read-only; admin-only; purged with
-- its application. Sentences are composed at save time so display never
-- depends on schema archaeology.
CREATE TABLE application_history (
  id INTEGER PRIMARY KEY,
  application_id INTEGER NOT NULL,
  at TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  area TEXT NOT NULL,
  summary TEXT NOT NULL
);
CREATE INDEX idx_history_app ON application_history(application_id, id);
ALTER TABLE applications ADD COLUMN original_json TEXT;
```

- `at`: ISO timestamp (UTC storage, Central display — house pattern).
- `actor_email`: the signed-in admin's email; `''` for the family's own online
  submission (displayed as "the family").
- `area` values: `application` | `people` | `jobs` | `decision` | `number` |
  `bags` | `cards` | `notes` | `record`. `record` covers the record-level events:
  received (online/paper), deleted, restored. Edit-form field rows use
  `application`; approve/deny use `decision`.
- `original_json`: JSON of the application + members + employers exactly as first
  saved (online or paper). NULL for applications that predate this feature.
- Test harness applies 0012 after 0011.

## Write paths (all via one `addHistory` helper; multi-row saves use `db.batch`)

| Surface | Rows written |
|---|---|
| Online submission (`apply.astro`) | `original_json` stamped; "Application received online" (actor `''`). |
| Paper entry (`new.astro`) | `original_json` stamped; "Entered from a paper application" (actor = admin). |
| Edit application (`edit.astro`) | One row per changed field, old → new, friendly field names: "Address changed from 123 Oak St to 507 Pine St", "Social Security (monthly) changed from $800 to $650", "Diabetic changed from No to Yes". No rows when nothing changed. |
| Edit people (`members.astro`) | Per member: "Sue Smith: coat size changed from M to L", "Sue Smith: doll changed from No doll to Black doll", "Person added: Tim Smith", "Sue Smith removed", "Sue Smith restored". Name changes: "Person renamed from Sue Smith to Sue Jones". |
| Edit jobs (`employers.astro`) | "Job added: P at Acme ($15.00 x 40 hrs)", "Job at Acme: hours changed from 40 to 32", "Job at Acme removed", restores. |
| Approve / Deny (`[id].astro`) | "Approved; pickup number 1604 assigned" / "Approved (no number free in the block)" / "Denied" — with " — email sent" / " — email could not be sent" / "" (silent buttons) appended per the action taken. |
| Pickup number | "Pickup number changed from 1604 to 1610" / "set to 1610" / "cleared". |
| Straggler | "Marked as a straggler" / "Straggler mark removed". |
| Bags | "Bag count changed from 4 to 5" / "set to 5" / "cleared". |
| Cards given | One row per changed item: "Thanksgiving card marked given" / "unmarked"; "Food card marked given ($50)"; "Gift card amount changed from $25 to $40". |
| Notes | "Your notes were updated" (no old → new — private free text, visible right on the page). |
| Delete / Undo | "Application deleted" / "Application restored". |

Money renders like the rest of the admin (`$650`, `$15.00` where cents exist);
blank/None values render as "blank" ("Phone changed from blank to 608-555-0142").

## Pure lib — `src/lib/history.ts` (TDD)

Sentence composition is pure and unit-tested; routes only wire it up:
- `describeApplicationChanges(oldRow, newFields): string[]` — the edit-form diff.
- `describeMemberChange(kind, oldMember?, newMember?): string[]` — add/update/
  remove/restore.
- `describeEmployerChange(...)` — same for jobs.
- Small formatters shared by all: friendly field labels, money, yes/no, blank.
DB layer: `addHistory(db, applicationId, actorEmail, area, summary, at)` and
`listHistory(db, applicationId)` (ascending id; page renders newest first).

## Display

- **History section** at the bottom of the application detail page (below Cards
  given/Notes): read-only list, newest first —
  "Nov 3, 2:14 pm — Social Security (monthly) changed from $800 to $650 — skleinow@…".
  Actor shown as "the family" when `actor_email` is `''`.
  When the application predates the feature (no rows and no snapshot):
  "History began July 2026 — earlier changes weren't recorded."
- **"See the application as first submitted"** link (shown only when
  `original_json` exists) → a small admin-only, print-friendly read-only page
  (`[id]/original.astro`) rendering the snapshot in the detail page's plain style,
  clearly bannered "As first submitted on {date} — read-only".

## Testing

- `tests/history.test.ts` (pure): every composer — each field type, money and
  blank formatting, yes/no flags, doll labels, no-change → empty array, member
  add/remove/rename, job arms; straight-apostrophe scan of composed output.
- DB: `addHistory`/`listHistory` round-trip + ordering; history rows survive
  soft-delete/restore of the application; d1-schema test for the table, index,
  and `original_json` column.
- Route wiring: one D1-level test per representative surface (an edit-form save
  writes the expected sentences; approve writes the decision row; cards diff
  writes per-item rows). Original snapshot: insert → `original_json` parses back
  to the submitted values.
- Existing scan tests untouched: history never appears in `SlipCard.astro` or the
  export columns.

## Out of scope

- Donor / content / message history; querying or filtering the log; editing or
  deleting history entries (never); retroactive history or snapshots for
  pre-existing applications; recording views, downloads, or sign-ins.
