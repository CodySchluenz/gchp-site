INSERT INTO cities (id, name, zip) VALUES
  (1,'Bagley','53801'),(2,'Beetown','53802'),(3,'Bloomington','53804'),
  (4,'Blue River','53518'),(5,'Boscobel','53805'),(6,'Cassville','53806'),
  (7,'Cuba City','53807'),(8,'Dickeyville','53808'),(9,'Fennimore','53809'),
  (10,'Glen Haven','53810'),(11,'Hazel Green','53811'),(12,'Kieler','53812'),
  (13,'Lancaster','53813'),(14,'Livingston','53554'),(15,'Montfort','53569'),
  (16,'Mount Hope','53816'),(17,'Muscoda','53573'),(18,'Patch Grove','53817'),
  (19,'Platteville','53818'),(20,'Potosi','53820'),(22,'Stitzer','53824'),
  (23,'Woodman','53827'),(24,'Prairie du Chien','53821');

INSERT INTO settings (id, applications_open, pickup_title, pickup_intro, pickup_footer) VALUES
  (1, 0,
   '2025 Pickup Schedule — one-day pickups. Pickup time 11 AM–2:30 PM, except Boscobel and Platteville 11 AM–3:30 PM.',
   'You can only pick up your items if you have received a pickup slip by mail or email. Please bring your pickup slip. Your items will be available on your pickup date — not before. If you can''t make it on your date, you can pick up on the next scheduled date below, or send someone else with your slip.',
   'Items not picked up by the last date will be placed back in inventory and become unavailable.');

INSERT INTO admin_emails (email) VALUES
  ('skleinow@co.grant.wi.gov'),
  ('codydps@gmail.com');

INSERT INTO content_blocks (title, subtitle, body, sort_order) VALUES
  ('2025 Info', 'Pickup times',
   'Our site and mailing address is 235 W. Elm St., Lancaster WI 53813. Again this year there will be one-day pickup for all towns, except Boscobel and Platteville which have two days. Dates are listed on pickup slips. You must have your pickup slip to receive items. Pay It Forward is still required for program eligibility — you will receive a form to list your good deeds. Kindness is needed year-round.',
   1),
  ('Special Gifts List', 'No guarantee you will receive',
   'Silverware, hair dryer, drawing kit, smart watch, wireless speaker, turbo scrubber, 12-cup coffee maker, 30-pc marker set, frying pan set, baking pan set, 4-slice toaster, electric griddle, 2 red sofa pillows, bed pillows, fishing pole in carrier, crockpot, cookware set, screwdriver set, hand mixer, air fryer.',
   2),
  ('Applications', 'Applications open October 1 of each project year',
   'You can apply online, or call 608-723-2136 ext 1194 to request a paper application. Speak slowly and leave your name, address, and whether you are a family or elderly household. This is a message-only line. Please return your application as soon as possible.',
   3);

INSERT INTO pickup_days (sort_order, date_text, description) VALUES
  (1, 'Tuesday Dec 2nd',   'Pickup for: Lancaster, Beetown, Prairie du Chien, Glen Haven, Mt. Hope, Patch Grove, Bloomington, Potosi, and Cassville. Pickup time 11 AM–2:30 PM.'),
  (2, 'Wednesday Dec 3rd', 'Pickup for: Woodman, Stitzer, Montfort, Blue River, Fennimore, Livingston, Muscoda, and Bagley. Pickup time 11 AM–2:30 PM.'),
  (3, 'Monday Dec 8th',    'Pickup for: Platteville, Hazel Green, Cuba City, Dickeyville, and Kieler. Pickup time 11 AM–3:30 PM.'),
  (4, 'Tuesday Dec 9th',   'Pickup for: Platteville, Hazel Green, Cuba City, Dickeyville, and Kieler. Pickup time 11 AM–3:30 PM.'),
  (5, 'Wednesday Dec 10th','Pickup for: Boscobel. Pickup time 11 AM–3:30 PM.'),
  (6, 'Thursday Dec 11th', 'Pickup for: Boscobel. Pickup time 11 AM–3:30 PM.'),
  (7, 'Monday Dec 15th',   'Stragglers: anyone who has not picked up yet or applied late. Pickup time 11 AM–2:30 PM.'),
  (8, 'Tuesday Dec 16th',  'Stragglers: anyone who has not picked up yet or applied late. Pickup time 11 AM–2:30 PM.');
