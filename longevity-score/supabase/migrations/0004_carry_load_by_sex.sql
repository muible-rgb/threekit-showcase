-- The prescribed carry load is 50 lb per hand for men, 35 for women.
--
-- One load for everyone made the test measure who could pick the things up at
-- all rather than grip endurance. 35 against 50 is close to the published
-- female/male ratio for carrying strength, so it keeps the protocol comparable
-- without reintroducing bodyweight.

update test_variants
   set protocol = '50 lb in each hand for men, 35 for women, same weight both sides. Walk a flat, marked course until your grip fails. Record the load and the distance.'
 where slug = 'farmer_carry';
