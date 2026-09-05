-- Reference data for the eight-test battery, "open-v2". Imperial units.
--
-- A future cohort battery is another block exactly like this one. The schema
-- does not change and neither does the scoring engine: a battery is always one
-- test per capacity, and the composite is always the mean of those percentiles.

insert into capacities (slug, name) values
  ('aerobic_capacity', 'Aerobic'),
  ('pull_strength',    'Pull'),
  ('push_endurance',   'Push'),
  ('leg_power',        'Power'),
  ('loaded_carry',     'Carry'),
  ('agility',          'Agility'),
  ('balance',          'Balance'),
  ('mobility',         'Mobility');

insert into test_variants
  (slug, capacity_id, name, unit, direction, norms_file, value_min, value_max, value_step, order_in_battery, protocol_md)
values
  ('mile_run', (select id from capacities where slug = 'aerobic_capacity'),
   'Mile', 's', 'lower_better', 'v2/mile_run.json', 240, 1800, 1, 1,
   'One mile on a track or a measured flat course. Four laps of a standard 400m track is 1600m, near enough. Standing start, timed to the finish.'),

  ('pull_ups', (select id from capacities where slug = 'pull_strength'),
   'Pull-ups', 'reps', 'higher_better', 'v2/pull_ups.json', 0, 100, 1, 2,
   'Start from a full dead hang, arms straight. Chin clears the bar, then back to straight arms. No kipping, no swinging.'),

  ('push_ups', (select id from capacities where slug = 'push_endurance'),
   'Push-ups', 'reps', 'higher_better', 'v2/push_ups.json', 0, 200, 1, 3,
   'Strict push-ups, body in a straight line, chest to fist height. The set ends at the first rest longer than two seconds at the top.'),

  ('broad_jump', (select id from capacities where slug = 'leg_power'),
   'Broad jump', 'in', 'higher_better', 'v2/broad_jump.json', 12, 160, 1, 4,
   'Two-foot takeoff, two-foot landing. Measure from the start line to the rear heel. Best of three.'),

  ('farmer_carry', (select id from capacities where slug = 'loaded_carry'),
   'Carry', 'ft', 'higher_better', 'v2/farmer_carry.json', 0, 3000, 5, 5,
   'Half your bodyweight in each hand. Walk a flat, marked course until your grip fails. Record the distance.'),

  ('agility_5_10_5', (select id from capacities where slug = 'agility'),
   'Agility', 's', 'lower_better', 'v2/agility_5_10_5.json', 3, 20, 0.01, 6,
   'The 5-10-5 pro agility shuttle. Straddle the middle line, sprint 5 yards and touch, 10 yards back the other way and touch, then 5 yards through the middle. Best of two.'),

  ('balance_eyes_closed', (select id from capacities where slug = 'balance'),
   'Balance', 's', 'higher_better', 'v2/balance_eyes_closed.json', 0, 60, 0.5, 7,
   'Hands on hips, eyes closed, stand on one leg. The clock stops when your foot touches down, your eyes open, or your hands leave your hips. Capped at 60 seconds.'),

  ('sit_to_rise', (select id from capacities where slug = 'mobility'),
   'Sit-to-rise', 'points', 'higher_better', 'v2/sit_to_rise.json', 0, 10, 0.5, 8,
   'Sit down to the floor and stand back up without support. Start at 5 points each way. Subtract 1 for each hand, knee, forearm or side of leg used. Subtract 0.5 for a wobble.');

insert into battery_versions (slug, name, description) values
  ('open-v2', 'Open battery',
   'Eight tests, imperial units. No fixed order - enter results as you get them.');

insert into battery_version_tests (battery_version_id, test_variant_id, position)
select (select id from battery_versions where slug = 'open-v2'),
       tv.id,
       tv.order_in_battery
  from test_variants tv;
