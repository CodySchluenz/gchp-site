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
