# Changelog

All notable changes to Longevity Score.

## [Unreleased]

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
