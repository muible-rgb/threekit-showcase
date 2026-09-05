# Changelog

All notable changes to Longevity Score.

## [Unreleased] - v1

### Data model

- **Schema** (`supabase/migrations/0001_init.sql`). Versioned battery tables,
  guest-capable participants, append-only `results` enforced by trigger,
  recomputable `battery_completions`, RLS throughout, security-definer RPCs for
  the two public read paths (share link, session board). A trigger enforces one
  test per capacity per battery version, which is what keeps composites
  comparable across battery versions.
- **`open-v1` reference data** (`0002_battery_open_v1.sql`). Ten capacities, ten
  test variants with protocols, one battery version. A second battery is an
  INSERT, not a migration.

### Norms

- Ten files in `/data/norms/v1/`, 26 cohorts each, ages 20-84, both sexes.
- Two sourced (grip strength, Cooper run), eight provisional. Every file carries
  a citation, a population statement, and an honest `notes` field.
- Provisional curves are produced by a committed, parameterised generator so the
  anchor, decline rate and coefficient of variation are auditable.
- `provisional` and `transcription_verified` are tracked separately - one is
  about the approach, the other about whether anyone has proofread the digits.
- Validator (`npm run norms:validate`) catching malformed cohorts, mixed
  formats, and cut-point tables that run against their own direction flag.
- `TODO_RENORM.md` (re-fit policy and priority order) and `VERIFY_NORMS.md`
  (what unverified means and how to clear it).

### Scoring engine

- Pure TypeScript, no I/O, takes a `NormsRegistry` as an argument.
- Normal CDF and probit with no dependency.
- Both norms formats, both directions, 1-99 clamp, one decimal.
- Cut-point files extrapolate past their published range rather than flattening,
  so ordering survives at the top of the board. Extrapolated results are flagged.
- Composite: unweighted mean of ten, null until all ten are present, enforced in
  the engine rather than the UI.
- Plain-language bands, fitness age (reading the median-vs-age curve from its
  peak downwards, because the curve is not monotone), crew ranking with a full
  tie-break vector, retest deltas, most-improved with first-timers separated out.
- 153 unit tests, including integration tests against the real shipped norms.

### App

- Five screens: home, test mode, score, crew session, methodology. Plus the
  public score page, the share card, and `/admin/norms`.
- Local-first `DataStore` with two adapters. Writes land locally and
  synchronously, then drain through an ordered outbox.
- Test mode: one input per unit, protocol and demo collapsed so the input is
  always above the fold, wall-clock timers that survive a sleeping phone, rest
  timers between tests, resumable partial batteries.
- Crew: six-character join codes on an unambiguous alphabet, guest
  participants, live board on a running average that is deliberately not called
  a composite, final board with tie-break, most-improved board, guest claim flow.
- Methodology page generated from the norms files, so a citation cannot drift
  from the numbers in use.
- Share links carry a validated payload in the URL rather than a database
  lookup, so a link works for a score that only exists in one phone's local
  storage.
- PWA: manifest, icons, offline shell.

### Fixed during the build

- Fitness-age lookup picked the wrong crossing on non-monotone curves (grip
  strength peaks in the late twenties).
- Service worker registered on `load` from inside an effect, which never fires
  when the effect runs after load has already happened.
- Service worker ignored Next's RSC fetches, so in-app navigation failed
  offline.
- Raw deltas on the 400m were coloured by sign alone, painting every personal
  best on the only lower-is-better test red.
