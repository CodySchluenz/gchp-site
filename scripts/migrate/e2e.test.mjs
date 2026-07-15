import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getTestDb } from '../../tests/helpers/d1';
import { buildImport } from './run.mjs';

// One column per line, closing `)` on its own line — the format real mysqldump emits
// and the only format the parser targets (see parse.mjs's CREATE-TABLE reader).
const DUMP = `
CREATE TABLE \`donor\` (
  \`donID\` int(11) NOT NULL,
  \`donName\` varchar(50) DEFAULT NULL,
  \`donContact\` varchar(50) DEFAULT NULL,
  \`address\` varchar(50) DEFAULT NULL,
  \`city\` varchar(50) DEFAULT NULL,
  \`state\` char(2) DEFAULT NULL,
  \`zip\` char(5) DEFAULT NULL,
  \`phone\` varchar(20) DEFAULT NULL,
  \`email\` varchar(50) DEFAULT NULL,
  PRIMARY KEY (\`donID\`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
INSERT INTO \`donor\` VALUES (1,'Acme','Sue','1 St','Lancaster','WI','53813','555','a@x.co');

CREATE TABLE \`applicants\` (
  \`appID\` int(11) NOT NULL,
  \`fName\` varchar(50) DEFAULT NULL,
  \`lName\` varchar(50) DEFAULT NULL,
  \`address\` varchar(100) DEFAULT NULL,
  \`cityID\` int(11) DEFAULT NULL,
  \`tree\` tinyint(4) DEFAULT NULL,
  \`diabetic\` tinyint(4) DEFAULT NULL,
  \`phone\` varchar(20) DEFAULT NULL,
  \`email\` varchar(50) DEFAULT NULL,
  \`date\` varchar(10) DEFAULT NULL,
  \`approved\` varchar(11) DEFAULT NULL,
  \`reviewed\` varchar(11) DEFAULT NULL,
  \`bedType\` varchar(10) DEFAULT NULL,
  \`bedSize\` varchar(10) DEFAULT NULL,
  PRIMARY KEY (\`appID\`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
INSERT INTO \`applicants\` VALUES (10,'Sue','ONeil','1 Elm',13,1,0,'555','s@x.co','2025/8/15','1','1','blanket','queen'),(11,'Ann','Roe','2 Oak',13,0,1,'556','a@x.co','2025/10/1','0','0','sheet','');

CREATE TABLE \`appEmp\` (
  \`appEmpID\` int(11) NOT NULL,
  \`appID\` int(11) DEFAULT NULL,
  \`employer1\` varchar(50) DEFAULT NULL,
  \`wage1\` decimal(6,2) DEFAULT NULL,
  \`hrsPerWk1\` int(11) DEFAULT NULL,
  \`employer2\` varchar(50) DEFAULT NULL,
  \`wage2\` decimal(6,2) DEFAULT NULL,
  \`hrsPerWk2\` int(11) DEFAULT NULL,
  \`employer3\` varchar(50) DEFAULT NULL,
  \`wage3\` decimal(6,2) DEFAULT NULL,
  \`hrsPerWk3\` int(11) DEFAULT NULL,
  \`employer4\` varchar(50) DEFAULT NULL,
  \`wage4\` decimal(6,2) DEFAULT NULL,
  \`hrsPerWk4\` int(11) DEFAULT NULL,
  PRIMARY KEY (\`appEmpID\`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
INSERT INTO \`appEmp\` VALUES (1,10,'Acme',15.00,40,'',NULL,NULL,'',NULL,NULL,'',NULL,NULL);

CREATE TABLE \`benefits\` (
  \`benID\` int(11) NOT NULL,
  \`appID\` int(11) DEFAULT NULL,
  \`fsAmount\` decimal(8,2) DEFAULT NULL,
  \`ssiAmount\` decimal(8,2) DEFAULT NULL,
  \`w2Amount\` decimal(8,2) DEFAULT NULL,
  \`csAmount\` decimal(8,2) DEFAULT NULL,
  \`omAmount\` decimal(8,2) DEFAULT NULL,
  \`socAmount\` decimal(8,2) DEFAULT NULL,
  PRIMARY KEY (\`benID\`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
INSERT INTO \`benefits\` VALUES (1,10,200.00,NULL,500.00,120.00,30.00,NULL);

CREATE TABLE \`children\` (
  \`childID\` int(11) NOT NULL,
  \`appID\` int(11) DEFAULT NULL,
  \`name\` varchar(50) DEFAULT NULL,
  \`sex\` char(1) DEFAULT NULL,
  \`age\` int(11) DEFAULT NULL,
  \`pantSize\` varchar(10) DEFAULT NULL,
  \`shirtSize\` varchar(10) DEFAULT NULL,
  \`undSize\` varchar(10) DEFAULT NULL,
  \`sockSize\` varchar(10) DEFAULT NULL,
  \`diaperSize\` varchar(10) DEFAULT NULL,
  \`gift\` varchar(255) DEFAULT NULL,
  PRIMARY KEY (\`childID\`)
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
INSERT INTO \`children\` VALUES (4,10,'Kid A','F',10,'10','L','10','L','','books'),(5,10,'Kid B','M',8,'8','M','8','M','','lego');

CREATE TABLE \`goodDeed\` (
  \`appID\` int(11) DEFAULT NULL,
  \`deedText\` varchar(100) DEFAULT NULL
) ENGINE=MyISAM DEFAULT CHARSET=latin1;
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
