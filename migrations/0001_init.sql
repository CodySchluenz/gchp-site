CREATE TABLE cities (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  zip TEXT NOT NULL
);

CREATE TABLE settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  applications_open INTEGER NOT NULL DEFAULT 0,
  pickup_title TEXT NOT NULL DEFAULT '',
  pickup_intro TEXT NOT NULL DEFAULT '',
  pickup_footer TEXT NOT NULL DEFAULT '',
  pdf_uploaded_at TEXT
);

CREATE TABLE content_blocks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT
);

CREATE TABLE pickup_days (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  date_text TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  deleted_at TEXT
);

CREATE TABLE applications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  season_year INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','approved','denied')),
  submitted_at TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  address TEXT NOT NULL,
  city_id INTEGER NOT NULL REFERENCES cities(id),
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  diabetic INTEGER NOT NULL DEFAULT 0,
  share_with_sponsor INTEGER NOT NULL DEFAULT 0,
  permanently_disabled INTEGER NOT NULL DEFAULT 0,
  bed_choice TEXT NOT NULL DEFAULT 'none' CHECK (bed_choice IN ('sheets','blanket','none')),
  bed_size TEXT CHECK (bed_size IN ('twin','full','queen','king')),
  full_time_residence_confirmed INTEGER NOT NULL DEFAULT 0,
  years_received_help INTEGER NOT NULL DEFAULT 0,
  adopted_last_year INTEGER NOT NULL DEFAULT 0,
  household_type TEXT NOT NULL DEFAULT 'family' CHECK (household_type IN ('family','elderly','disabled')),
  no_employment_confirmed INTEGER NOT NULL DEFAULT 0,
  food_share_amount REAL,
  social_security_amount REAL,
  social_security_for TEXT,
  ssi_amount REAL,
  ssi_for TEXT,
  child_support_amount REAL,
  child_support_for TEXT,
  unemployment_weekly_amount REAL,
  unemployment_for TEXT,
  other_income_amount REAL,
  other_income_for TEXT,
  good_deed TEXT NOT NULL DEFAULT '',
  may_not_be_eligible INTEGER NOT NULL DEFAULT 0,
  pu_number INTEGER,
  bags_count INTEGER,
  deleted_at TEXT
);
CREATE INDEX idx_applications_season ON applications(season_year, status);

CREATE TABLE household_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id),
  position INTEGER NOT NULL,
  name TEXT NOT NULL,
  relationship TEXT NOT NULL,
  sex TEXT NOT NULL,
  age INTEGER NOT NULL,
  pants TEXT NOT NULL DEFAULT '',
  shirt_top TEXT NOT NULL DEFAULT '',
  underwear TEXT NOT NULL DEFAULT '',
  socks TEXT NOT NULL DEFAULT '',
  diapers TEXT NOT NULL DEFAULT '',
  gifts TEXT NOT NULL DEFAULT ''
);
CREATE INDEX idx_members_app ON household_members(application_id);

CREATE TABLE employers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  application_id INTEGER NOT NULL REFERENCES applications(id),
  employer_name TEXT NOT NULL,
  worker_name TEXT NOT NULL,
  hourly_wage REAL NOT NULL,
  hours_per_week REAL NOT NULL
);
CREATE INDEX idx_employers_app ON employers(application_id);

CREATE TABLE donors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  contact_person TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  zip TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  deleted_at TEXT
);

CREATE TABLE donations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donor_id INTEGER NOT NULL REFERENCES donors(id),
  date TEXT NOT NULL,
  item_description TEXT NOT NULL DEFAULT '',
  amount REAL,
  deleted_at TEXT
);

CREATE TABLE contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  received_at TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  read_at TEXT
);

CREATE TABLE admin_emails (
  email TEXT PRIMARY KEY
);

CREATE TABLE login_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

CREATE TABLE sessions (
  session_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  window_start INTEGER NOT NULL,
  count INTEGER NOT NULL
);
