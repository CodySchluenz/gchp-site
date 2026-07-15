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
