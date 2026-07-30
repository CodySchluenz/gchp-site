// CAUTION: running this submits 10 TEST applications to the LIVE site.
// Use only for pre-season practice data (owner + operator approved 2026-07-30),
// and wipe the Test* rows before the real season opens. See docs/decisions.md.
// Submits 10 labeled TEST applications through the live public forms.
// Owner-approved 2026-07-30 (Sherlyn approved; everything wiped before the season).
// Each scenario is described inside its good_deed text so Sherlyn sees it on the
// application. Rate limit is 10 valid submissions/hour/IP — this uses exactly 10.
const BASE = 'https://grantcountyholidayproject.org';
const mail = (tag) => `codydps+gchptest${tag}@gmail.com`;

// ---- helpers -------------------------------------------------------------
function fam(base) {
  // Family-form constants every scenario shares.
  return { full_time_residence: 'on', website: '', ...base };
}
function member(i, m) {
  const out = {};
  out[`member_name_${i}`] = m.name;
  if (m.rel !== undefined) out[`member_relationship_${i}`] = m.rel;
  if (m.relOther) out[`member_relationship_other_${i}`] = m.relOther;
  if (m.sex) out[`member_sex_${i}`] = m.sex;
  out[`member_age_${i}`] = String(m.age);
  for (const [k, field] of [['pants','pants'],['shirt','shirt'],['underwear','underwear'],['socks','socks'],['diapers','diapers'],['shoe','shoe'],['coat','coat']]) {
    if (m[k]) out[`member_${field}_${i}`] = m[k];
  }
  if (m.gifts) out[`member_gifts_${i}`] = m.gifts;
  if (m.doll) out[`member_doll_${i}`] = m.doll;
  if (m.disabled) out[`member_disabled_${i}`] = 'on';
  if (m.partTime) out[`member_part_time_${i}`] = 'on';
  return out;
}
function employers(list) {
  const out = { employer_count: String(Math.max(list.length, 1)) };
  list.forEach((e, idx) => {
    const i = idx + 1;
    out[`employer_name_${i}`] = e.employer;
    out[`worker_name_${i}`] = e.worker;
    out[`hourly_wage_${i}`] = e.wage;
    out[`hours_per_week_${i}`] = e.hours;
  });
  return out;
}
// benefits: pass overrides like { social_security: ['1450', 'Edna Testelder'] };
// every key not named gets its "we don't receive this" box checked.
function benefits(given = {}) {
  const keys = ['food_share', 'social_security', 'ssi', 'child_support', 'unemployment', 'other_income'];
  const out = {};
  for (const k of keys) {
    if (given[k]) {
      out[`${k}_amount`] = given[k][0];
      if (k !== 'food_share') out[`${k}_for`] = given[k][1];
    } else {
      out[`${k}_none`] = 'on';
    }
  }
  return out;
}
function withEmail(addr) {
  return addr === '' ? { email: '' } : { email: addr, email_confirm: addr };
}

// ---- the ten scenarios ---------------------------------------------------
const scenarios = [];

// #1 Typical family — Platteville
scenarios.push({ path: '/apply/family', label: '1 typical family', data: fam({
  first_name: 'Merry', last_name: 'Testhouse', address: '101 Candy Cane Ln', city_id: '19',
  phone: '608-555-0101', ...withEmail(mail(1)), years_received_help: '2', adopted_last_year: 'no',
  bed_choice: 'none', share_with_sponsor: 'on', member_count: '5',
  ...member(1, { name: 'Merry Testhouse', rel: 'self', sex: 'F', age: 34, pants: '12', shirt: 'L', underwear: 'M', socks: '9-11', shoe: '8', coat: 'L', gifts: 'warm blanket, cookbook' }),
  ...member(2, { name: 'Nick Testhouse', rel: 'other_parent', sex: 'M', age: 36, pants: '34x32', shirt: 'XL', underwear: 'L', socks: '10-13', shoe: '11', coat: 'XL', gifts: 'work gloves, thermos' }),
  ...member(3, { name: 'Holly Testhouse', rel: 'daughter', sex: 'F', age: 7, pants: '7', shirt: '7-8', underwear: '7', socks: 'S', shoe: '1Y', coat: '8', gifts: 'art set, doll clothes', doll: 'white' }),
  ...member(4, { name: 'Max Testhouse', rel: 'son', sex: 'M', age: 10, pants: '10', shirt: '10-12', underwear: '10', socks: 'M', shoe: '4Y', coat: '10-12', gifts: 'Legos, football' }),
  ...member(5, { name: 'Ivy Testhouse', rel: 'daughter', sex: 'F', age: 2, pants: '2T', shirt: '2T', underwear: '2T', socks: '2T', diapers: 'size 5', shoe: '6T', coat: '2T', gifts: 'stacking blocks, stuffed bear', doll: 'non_white' }),
  ...employers([{ employer: 'Piggly Wiggly', worker: 'Merry Testhouse', wage: '12.50', hours: '25' }]),
  ...benefits({ food_share: ['250'], child_support: ['300', 'Holly and Max'] }),
  good_deed: 'TEST APPLICATION 1 of 10 — A typical family household (Platteville): two parents, three kids with sizes, gifts, and two doll choices. Good one to start with: review it, Approve and email them, print its packing slip, and find it under Show town - Platteville. My good deed: I shoveled our elderly neighbor’s driveway all last winter.',
})});

// #2 Family that includes Grandpa, 72 — the 65+ finder — Lancaster
scenarios.push({ path: '/apply/family', label: '2 grandpa 65+', data: fam({
  first_name: 'Dawn', last_name: 'Testgramps', address: '18 Mistletoe Rd', city_id: '13',
  phone: '608-555-0102', ...withEmail(mail(2)), years_received_help: '0', adopted_last_year: 'no',
  bed_choice: 'none', share_with_sponsor: 'on', member_count: '4',
  ...member(1, { name: 'Dawn Testgramps', rel: 'self', sex: 'F', age: 40, pants: '10', shirt: 'M', underwear: 'M', socks: '9-11', shoe: '7.5', coat: 'M', gifts: 'slow cooker' }),
  ...member(2, { name: 'Eli Testgramps', rel: 'son', sex: 'M', age: 12, pants: '12', shirt: '12-14', underwear: '12', socks: 'M', shoe: '6Y', coat: '14', gifts: 'basketball, headphones' }),
  ...member(3, { name: 'Nora Testgramps', rel: 'daughter', sex: 'F', age: 9, pants: '8', shirt: '8-10', underwear: '8', socks: 'S', shoe: '2Y', coat: '10', gifts: 'craft kit, chapter books', doll: 'non_white' }),
  ...member(4, { name: 'Harold Testgramps', rel: 'other', relOther: 'My father', sex: 'M', age: 72, pants: '36x30', shirt: 'L', underwear: 'L', socks: '10-13', shoe: '10', coat: 'L', gifts: 'warm socks, large-print puzzle book' }),
  ...employers([{ employer: 'Lancaster Schools kitchen', worker: 'Dawn Testgramps', wage: '14.00', hours: '30' }]),
  ...benefits({ social_security: ['1150', 'Harold Testgramps (my father, 72)'] }),
  good_deed: 'TEST APPLICATION 2 of 10 — A family that includes Grandpa Harold, age 72 (Lancaster). Look for the gold “65+ in household” tag on the applications list, and the note above the decision buttons on this page. His Social Security is under Benefits, next to “Who receives it?”. If he should get his own Christmas card instead, remove him under Edit household members and enter a separate Elderly/Disabled application for him. My good deed: I drive my neighbor to church every Sunday.',
})});

// #3 Family that said NO to sponsor sharing — Cuba City
scenarios.push({ path: '/apply/family', label: '3 no sponsor consent', data: fam({
  first_name: 'Faith', last_name: 'Testnoshare', address: '7 Sleigh Bell Ct', city_id: '7',
  phone: '608-555-0103', ...withEmail(mail(3)), years_received_help: '1', adopted_last_year: 'no',
  bed_choice: 'none', member_count: '3', no_employment: 'on',
  ...member(1, { name: 'Faith Testnoshare', rel: 'self', sex: 'F', age: 29, pants: '8', shirt: 'M', underwear: 'M', socks: '9-11', shoe: '8', coat: 'M', gifts: 'winter boots' }),
  ...member(2, { name: 'Jax Testnoshare', rel: 'son', sex: 'M', age: 5, pants: '5T', shirt: '5T', underwear: '5', socks: 'S', shoe: '11T', coat: '5T', gifts: 'toy trucks, puzzles' }),
  ...member(3, { name: 'Lily Testnoshare', rel: 'daughter', sex: 'F', age: 3, pants: '3T', shirt: '3T', underwear: '3T', socks: '3T', shoe: '8T', coat: '3T', gifts: 'play kitchen food, doll', doll: 'white' }),
  ...employers([]),
  ...benefits({ food_share: ['300'], unemployment: ['180', 'Faith Testnoshare'] }),
  good_deed: 'TEST APPLICATION 3 of 10 — A family that said NO to sharing their information with a sponsor (Cuba City). After you approve them, scroll to the Adoption section: it will not let you mark them adopted — it shows a note instead. If a family later agrees, you change their answer under Edit details first. My good deed: I babysat for free so a friend could get to a job interview.',
})});

// #4 + #5 The duplicate pair — Fennimore, same last name + address
scenarios.push({ path: '/apply/family', label: '4 duplicate A', data: fam({
  first_name: 'Amy', last_name: 'Testtwice', address: '402 Cranberry Ct', city_id: '9',
  phone: '608-555-0104', ...withEmail(mail(4)), years_received_help: '3', adopted_last_year: 'no',
  bed_choice: 'none', share_with_sponsor: 'on', member_count: '2',
  ...member(1, { name: 'Amy Testtwice', rel: 'self', sex: 'F', age: 31, pants: '10', shirt: 'M', underwear: 'M', socks: '9-11', shoe: '7', coat: 'M', gifts: 'crock pot' }),
  ...member(2, { name: 'Ben Testtwice', rel: 'son', sex: 'M', age: 6, pants: '6', shirt: '6-7', underwear: '6', socks: 'S', shoe: '13T', coat: '7', gifts: 'dinosaurs, picture books' }),
  ...employers([{ employer: 'Dollar General', worker: 'Amy Testtwice', wage: '11.50', hours: '28' }]),
  ...benefits({}),
  good_deed: 'TEST APPLICATION 4 of 10 — Duplicate pair, part 1 of 2 (Fennimore). Amy and Aaron Testtwice each sent an application from 402 Cranberry Ct without telling each other. The list shows a “possible duplicate” tag on both, and each one names the other above the decision buttons with a link to compare. Keep one and delete the other — Undo is right there if you change your mind. My good deed: I return shopping carts for folks with canes at the grocery store.',
})});
scenarios.push({ path: '/apply/family', label: '5 duplicate B', data: fam({
  first_name: 'Aaron', last_name: 'Testtwice', address: '402 Cranberry Ct', city_id: '9',
  phone: '608-555-0105', ...withEmail(mail(5)), years_received_help: '3', adopted_last_year: 'no',
  bed_choice: 'none', share_with_sponsor: 'on', member_count: '2',
  ...member(1, { name: 'Aaron Testtwice', rel: 'self', sex: 'M', age: 33, pants: '32x32', shirt: 'L', underwear: 'M', socks: '10-13', shoe: '10', coat: 'L', gifts: 'tool set' }),
  ...member(2, { name: 'Ben Testtwice', rel: 'son', sex: 'M', age: 6, pants: '6', shirt: '6-7', underwear: '6', socks: 'S', shoe: '13T', coat: '7', gifts: 'dinosaurs, picture books' }),
  ...employers([{ employer: 'John Deere Dubuque Works', worker: 'Aaron Testtwice', wage: '22.00', hours: '40' }]),
  ...benefits({}),
  good_deed: 'TEST APPLICATION 5 of 10 — Duplicate pair, part 2 of 2 (Fennimore). This is the second application from 402 Cranberry Ct — see test application 4. My good deed: I plowed three driveways on our road after the big January storm.',
})});

// #6 The everything-at-once family — Boscobel
scenarios.push({ path: '/apply/family', label: '6 edge flags', data: fam({
  first_name: 'Grace', last_name: 'Testedge', address: '9 Evergreen Terrace', city_id: '5',
  phone: '608-555-0106', ...withEmail(mail(6)), years_received_help: '4', adopted_last_year: 'yes',
  bed_choice: 'sheets', bed_size: 'full', share_with_sponsor: 'on', diabetic: 'on', member_count: '4',
  parentage_note: 'TEST — Rosa is our foster placement through Grant County; the papers are available. (This box is your private parentage note: only you see it.)',
  ...member(1, { name: 'Grace Testedge', rel: 'self', sex: 'F', age: 45, pants: '14', shirt: 'L', underwear: 'L', socks: '9-11', shoe: '8.5', coat: 'L', gifts: 'sugar-free candy, warm robe' }),
  ...member(2, { name: 'Rosa Testedge', rel: 'court', sex: 'F', age: 8, disabled: true, pants: '8', shirt: '8-10', underwear: '8', socks: 'S', shoe: '2Y', coat: '10', gifts: 'sensory toys, craft kit', doll: 'non_white' }),
  ...member(3, { name: 'Sky Testedge', rel: 'daughter', sex: 'F', age: 16, partTime: true, pants: '5', shirt: 'S', underwear: 'S', socks: '9-11', shoe: '8', coat: 'M', gifts: 'earbuds, hoodie' }),
  ...member(4, { name: 'Leo Testedge', rel: 'not_related', sex: 'M', age: 24, pants: '30x32', shirt: 'M', underwear: 'M', socks: '10-13', shoe: '9', coat: 'M', gifts: 'gloves' }),
  ...employers([
    { employer: 'Boscobel Care Center', worker: 'Grace Testedge', wage: '15.75', hours: '36' },
    { employer: "McDonald's Boscobel", worker: 'Sky Testedge (age 16, part-time)', wage: '9.75', hours: '12' },
  ]),
  ...benefits({ food_share: ['400'], ssi: ['600', 'Rosa Testedge (foster daughter)'] }),
  good_deed: 'TEST APPLICATION 6 of 10 — The everything-at-once family (Boscobel): a court-appointed foster child who is disabled and receives SSI, a working teen, an unrelated adult in the home, a diabetic applicant, a sheets request (full), and they were adopted out last year. IMPORTANT: because a household member is marked disabled, the website sorted this family into the Elderly/Disabled mailed group — children live here, so you would likely set Household type back to Family under Edit details, and watch the pickup number move blocks. Also a good place to try the Packing note box. My good deed: I read to residents at the care center on my breaks.',
})});

// #7 Elderly, lives alone, has email — Potosi
scenarios.push({ path: '/apply/elderly', label: '7 elderly single', data: {
  website: '', first_name: 'Edna', last_name: 'Testelder', address: '3 Holly Berry Way', city_id: '20',
  phone: '608-555-0107', ...withEmail(mail(7)), household_kind: 'elderly',
  member_count: '1', member_name_1: 'Edna Testelder', member_age_1: '73',
  no_employment: 'on', employer_count: '1',
  ...benefits({ food_share: ['120'], social_security: ['1450', 'Edna Testelder'] }),
  years_received_help: '5',
  good_deed: 'TEST APPLICATION 7 of 10 — An elderly household: Edna, 73, lives alone, gave an email address (Potosi). Approve her and she gets the next 2500 number and the Christmas-card email, on their own. Then find her under Show town - Elderly & disabled (mailed) and press Print mailing labels. My good deed: I crochet mittens for the school’s lost-and-found box every fall.',
}});

// #8 Elderly couple with NO email — Bagley
scenarios.push({ path: '/apply/elderly', label: '8 elderly couple no email', data: {
  website: '', first_name: 'Walter', last_name: 'Testcouple', address: '22 Frost Hollow Rd', city_id: '1',
  phone: '608-555-0108', ...withEmail(''), household_kind: 'elderly',
  member_count: '2', member_name_1: 'Walter Testcouple', member_age_1: '78',
  member_name_2: 'June Testcouple', member_age_2: '75',
  no_employment: 'on', employer_count: '1',
  ...benefits({ social_security: ['2100', 'Walter and June Testcouple'] }),
  years_received_help: '6',
  good_deed: 'TEST APPLICATION 8 of 10 — An elderly couple with NO email address (Bagley). On their Decision buttons, only “Approve without email” and “Deny without email” appear, with a note that there is nothing to email — the approval wording you can copy into a mailed note is written out in your guide. They still get a mailing label like everyone on the mailed list. Our good deed: we call three shut-ins every week just to visit.',
}});

// #9 Sherlyn's example: applicant 58, wife + permanently disabled adult son — Hazel Green
scenarios.push({ path: '/apply/elderly', label: '9 disabled household', data: {
  website: '', first_name: 'Ray', last_name: 'Testcare', address: '15 Winterberry St', city_id: '11',
  phone: '608-555-0109', ...withEmail(mail(9)), household_kind: 'disabled',
  member_count: '3', member_name_1: 'Ray Testcare', member_age_1: '58',
  member_name_2: 'Lena Testcare', member_age_2: '55',
  member_name_3: 'Danny Testcare', member_age_3: '30',
  employer_count: '1',
  employer_name_1: 'Farm & Fleet', worker_name_1: 'Ray Testcare', hourly_wage_1: '13.25', hours_per_week_1: '20',
  ...benefits({ social_security: ['900', 'Lena Testcare (wife)'], ssi: ['943', 'Danny Testcare (adult son, permanently disabled)'] }),
  years_received_help: '0',
  good_deed: 'TEST APPLICATION 9 of 10 — Your own example (Hazel Green): Ray is 58, so he does not qualify by age — but his wife and his permanently disabled adult son live with him, and their Social Security and SSI are listed under Benefits next to “Who receives it?”. That is the place where added persons’ SSA and SSI appear, and it is what shows this household qualifies as Disabled. My good deed: I mow two neighbors’ lawns all summer.',
}});

// #10 Elderly, still working, no benefits at all — Muscoda
scenarios.push({ path: '/apply/elderly', label: '10 elderly working', data: {
  website: '', first_name: 'Pearl', last_name: 'Testworks', address: '6 Garland Ave', city_id: '17',
  phone: '608-555-0110', ...withEmail(mail(10)), household_kind: 'elderly',
  member_count: '1', member_name_1: 'Pearl Testworks', member_age_1: '67',
  employer_count: '1',
  employer_name_1: 'Kwik Trip', worker_name_1: 'Pearl Testworks', hourly_wage_1: '11.00', hours_per_week_1: '16',
  ...benefits({}),
  years_received_help: '8',
  good_deed: 'TEST APPLICATION 10 of 10 — Pearl is 67 and still works part-time, and receives no benefits at all — every “we don’t receive this” box is checked (Muscoda). A good one to practice Deny and email them on, to read the kind denial note — you can approve her afterward, and the History section at the bottom of this page keeps the whole story. My good deed: I keep the bird feeders filled at the senior center.',
}});

// ---- submit --------------------------------------------------------------
const results = [];
for (const s of scenarios) {
  const getRes = await fetch(BASE + s.path, { headers: { 'user-agent': 'gchp-test-setup' } });
  const setCookie = getRes.headers.get('set-cookie') ?? '';
  const cookie = (setCookie.match(/csrf=([0-9a-f]{64})/) ?? [])[0] ?? '';
  const html = await getRes.text();
  const token = (html.match(/name="csrf_token" value="([^"]+)"/) ?? [])[1] ?? '';
  if (!cookie || !token) { results.push(`${s.label}: FAILED to get csrf (cookie=${!!cookie} token=${!!token})`); continue; }

  const body = new URLSearchParams({ csrf_token: token, ...s.data });
  const postRes = await fetch(BASE + s.path, {
    method: 'POST', redirect: 'manual',
    headers: { 'content-type': 'application/x-www-form-urlencoded', cookie, 'user-agent': 'gchp-test-setup', origin: BASE, referer: BASE + s.path },
    body,
  });
  if (postRes.status === 303 && (postRes.headers.get('location') ?? '').includes('thank-you')) {
    results.push(`${s.label}: OK`);
  } else {
    const page = await postRes.text();
    const errs = [...page.matchAll(/<li><a href="#[^"]*"[^>]*>([^<]+)<\/a>/g)].map((m) => m[1]);
    const rate = page.includes('paused it briefly') ? ' RATE-LIMITED' : '';
    results.push(`${s.label}: status ${postRes.status}${rate} errors: ${errs.join(' | ') || '(none parsed)'}`);
  }
  await new Promise((r) => setTimeout(r, 1500));
}
console.log(results.join('\n'));
