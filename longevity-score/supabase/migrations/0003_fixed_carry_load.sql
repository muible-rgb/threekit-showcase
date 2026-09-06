-- The carry runs at a fixed 50 lb per hand, not half your bodyweight.
--
-- Every other test in the battery is absolute, and the cohort norms are what
-- make results comparable. Scaling one test to bodyweight made it the odd one
-- out and forced the app to ask for a number people would rather not give.
-- Nothing reads bodyweight any more, so the column goes with it.

alter table session_participants drop column if exists bodyweight_kg;

update test_variants
   set protocol = '50 lb in each hand, same weight both sides. Walk a flat, marked course until your grip fails. Record the load and the distance.'
 where slug = 'farmer_carry';
