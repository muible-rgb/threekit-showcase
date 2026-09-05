-- Reference data for the "open-v1" battery.
-- A future 65+ battery is another block exactly like this one. No schema change.

insert into capacities (slug, name) values
  ('grip',              'Grip'),
  ('balance',           'Balance'),
  ('mobility',          'Mobility'),
  ('push_endurance',    'Push endurance'),
  ('leg_power',         'Leg power'),
  ('grip_endurance',    'Grip endurance'),
  ('loaded_carry',      'Loaded carry'),
  ('leg_isometric',     'Isometric leg endurance'),
  ('speed_endurance',   'Speed endurance'),
  ('aerobic_capacity',  'Aerobic capacity');

insert into test_variants
  (slug, capacity_id, name, unit, direction, norms_file, value_min, value_max, value_step, order_in_battery, protocol_md)
values
  ('grip_strength_dynamometer',
   (select id from capacities where slug = 'grip'),
   'Grip strength', 'kg', 'higher_better',
   'v1/grip_strength_dynamometer.json', 5, 120, 0.5, 1,
   'Hand dynamometer. Stand with your arm at your side, elbow at 90 degrees. Two attempts per hand. Record the best attempt on your dominant hand.'),

  ('single_leg_balance_eyes_closed',
   (select id from capacities where slug = 'balance'),
   'Single-leg eyes-closed balance', 's', 'higher_better',
   'v1/single_leg_balance_eyes_closed.json', 0, 60, 0.1, 2,
   'Hands on hips, eyes closed, stand on one leg. Two attempts per leg. Record the single best attempt. The clock stops when your foot touches down, your eyes open, or your hands leave your hips. Capped at 60 seconds.'),

  ('sit_rising_test',
   (select id from capacities where slug = 'mobility'),
   'Sit-rising test', 'points', 'higher_better',
   'v1/sit_rising_test.json', 0, 10, 0.5, 3,
   'Sit down to the floor and stand back up. Start at 5 points each way. Subtract 1 point for each hand, knee, forearm or side-of-leg used for support. Subtract 0.5 for a loss of balance. Sitting and rising are scored separately and added.'),

  ('push_ups',
   (select id from capacities where slug = 'push_endurance'),
   'Push-ups', 'reps', 'higher_better',
   'v1/push_ups.json', 0, 200, 1, 4,
   'Strict push-ups, chest to fist height, unbroken. The set ends at the first rest longer than 2 seconds at the top, or the first rep that does not reach depth.'),

  ('standing_broad_jump',
   (select id from capacities where slug = 'leg_power'),
   'Standing broad jump', 'cm', 'higher_better',
   'v1/standing_broad_jump.json', 30, 400, 1, 5,
   'Two-foot takeoff, two-foot landing. Two attempts, record the best. Measure from the start line to the rear heel on landing. A fall backwards voids the attempt.'),

  ('dead_hang',
   (select id from capacities where slug = 'grip_endurance'),
   'Dead hang', 's', 'higher_better',
   'v1/dead_hang.json', 0, 600, 0.1, 6,
   'Overhand grip on a pull-up bar, arms straight, feet off the ground. The clock stops when your feet touch the ground.'),

  ('farmer_carry_half_bw',
   (select id from capacities where slug = 'loaded_carry'),
   'Farmer carry', 'm', 'higher_better',
   'v1/farmer_carry_half_bw.json', 0, 2000, 1, 7,
   'Half your bodyweight in each hand. Walk until your grip fails. Record the distance covered. Load is set from the bodyweight recorded at the start of the session.'),

  ('wall_sit',
   (select id from capacities where slug = 'leg_isometric'),
   'Wall sit', 's', 'higher_better',
   'v1/wall_sit.json', 0, 900, 0.1, 8,
   'Back flat against the wall, knees and hips both at 90 degrees, hands off the thighs. The clock stops when your hips rise above your knees.'),

  ('run_400m',
   (select id from capacities where slug = 'speed_endurance'),
   '400m run', 's', 'lower_better',
   'v1/run_400m.json', 40, 400, 0.01, 9,
   'One lap of a track, or a measured flat 400m course. Standing start, timed from first movement.'),

  ('cooper_12min_run',
   (select id from capacities where slug = 'aerobic_capacity'),
   'Cooper 12-minute run', 'm', 'higher_better',
   'v1/cooper_12min_run.json', 500, 5000, 5, 10,
   'Cover as much distance as you can in 12 minutes. Always the last test in the battery - it compromises everything measured after it.');

insert into battery_versions (slug, name, description) values
  ('open-v1', 'Open battery v1',
   'The ten-test open-division battery. Built for trained adults roughly 30-55. Fixed order; the Cooper run is always last.');

insert into battery_version_tests (battery_version_id, test_variant_id, position)
select (select id from battery_versions where slug = 'open-v1'),
       tv.id,
       tv.order_in_battery
  from test_variants tv;
