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

  it('throws rather than silently dropping data when a row has more values than columns', () => {
    const DUMP2 = `
CREATE TABLE \`t\` (
  \`a\` int,
  \`b\` int
) ENGINE=MyISAM;
INSERT INTO \`t\` VALUES (1,2,3);
`;
    expect(() => parseRows(DUMP2, 't')).toThrow(/2 columns/);
  });
});
