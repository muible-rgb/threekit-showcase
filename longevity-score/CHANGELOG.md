# Changelog

All notable changes to The Long Game.

## [Unreleased]

### Changed - the carry runs at a prescribed load, and nothing asks your weight

- **Carry load is 50 lb per hand for men and 35 for women**, not half your
  bodyweight (`CARRY_LOAD_LB`, keyed by sex; `carryLoadDrift` takes the sex).
  35 against 50 is close to the published female/male ratio for carrying
  strength, so the test measures grip endurance rather than who can lift the
  things off the floor (`0004_carry_load_by_sex.sql`). Every other test in the battery is absolute and the cohort
  norms are what make results comparable; scaling one test to bodyweight made
  it the odd one out, put the load at 90 lb a hand for a big man, and forced
  the app to ask for a number people would rather not give. `carryLoadDrift`
  now takes one argument and measures drift from 50.
- **Bodyweight is gone from the app entirely** - the scorecard row, the entry
  sheet prefill, the deep dive, the seed, `SessionParticipant.bodyweightKg`,
  `setBodyweight`, and the `session_participants.bodyweight_kg` column
  (`0003_fixed_carry_load.sql`). `joinSession` takes two arguments.
- **Carry norms re-fit** for the prescribed loads: anchors at 42 move to 550 ft
  (M) / 460 ft (F), and decline per decade goes 0.15 → 0.22, because a
  prescribed load does not shrink with the athlete. Still provisional.

### Added - Phase 1-3: data model, norms, scoring engine

- **Supabase schema** (`supabase/migrations/0001_init.sql`). Versioned battery
  tables, guest-capable participants, append-only results enforced by trigger,
  recomputable `battery_completions`, RLS throughout, security-definer RPCs for
  the two public read paths (share link, session board).
- **`open-v1` reference data** (`0002_battery_open_v1.sql`). Ten capacities, ten
  test variants with protocols, one battery version. A second battery is an
  INSERT.
- **Norms data set** (`/data/norms/v1/`, 10 files, 26 cohorts each, ages 20-84,
  both sexes). Two sourced, eight provisional, every one carrying a citation and
  an honest `notes` field. Provisional curves are produced by a committed,
  parameterised generator so the assumptions are auditable.
- **Norms validator** (`npm run norms:validate`) catching malformed cohorts,
  mixed formats, and cut-point tables that run against the file's own direction.
- **Scoring engine** (`src/lib/scoring/`). Pure, no I/O, takes norms as an
  argument. Normal CDF and probit with no dependency, cohort resolution, both
  norms formats, both directions, 1-99 clamp, composite with the all-or-nothing
  rule, plain-language bands, fitness age, crew ranking with a full tie-break
  vector, retest deltas, most-improved with first-timers separated out.
- **123 unit tests**, including integration tests that run the engine against
  the real shipped norms files.
