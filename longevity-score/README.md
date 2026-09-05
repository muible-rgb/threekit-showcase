# Longevity Score v1

Ten physical tests, one score, graded against people your own age and sex. Test
with a crew, compare on a shared board.

The thing to protect: **scoring is cohort-relative**. A 78-year-old woman can
outscore a 30-year-old man, because both are measured against their own sex and
five-year age band. Every number a user sees is a percentile first; raw values
are shown next to it, never instead of it.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
```

No configuration needed. With no Supabase project configured the app runs
entirely on local storage, seeded with a demo crew of eight across two
quarterly sessions, so every screen renders on a fresh checkout.

```bash
npm test             # 153 unit tests, scoring engine + norms + seed
npm run typecheck
npm run lint
npm run norms:validate      # structural check on every norms file
npm run norms:generate      # regenerate the provisional norms curves
```

To point it at Postgres, copy `.env.example` to `.env.local`, fill in the
Supabase URL and anon key, and apply `supabase/migrations/*.sql` in order.

To put it on the web, see `DEPLOY.md`. Short version: import the repo on
Netlify or Vercel and set the base/root directory to `longevity-score`. No
environment variables needed - it deploys and runs on the seeded demo data.

## How it fits together

```
data/norms/v1/*.json          the numbers. no norm lives in TypeScript.
src/lib/scoring/              pure engine. no I/O. takes norms as an argument.
src/lib/norms/                loads and validates the JSON
src/lib/battery.ts            open-v1 definition, mirrors migration 0002
src/lib/data/                 DataStore: LocalStore + SupabaseStore
src/app/                      five screens, public score page, share card
supabase/migrations/          schema, RLS, reference data
```

### The engine takes norms as an argument

`src/lib/scoring` never imports a norms file. It takes a `NormsRegistry`, which
is what lets the whole engine be tested against literal fixtures - a change to a
published norm cannot turn an engine test red, and a bug in the engine cannot
hide behind real data.

Three layers: raw result → cohort percentile → composite.

- Mean/SD cohorts go through the normal CDF, which gives smooth curves. A one
  kilo improvement always moves the number.
- Cut-point cohorts interpolate linearly between published points, and
  **extrapolate** past the top and bottom rather than flattening. Flattening
  would put every elite result on exactly 90.0, destroying ordering at the top
  of the board - the one place a crew cares about ordering. Extrapolated results
  are flagged.
- Floor 1, cap 99. Nobody scores 0 and nobody scores 100.
- The composite is the unweighted mean of ten percentiles, to one decimal, and
  it is **null until all ten are there**. Enforced in the engine, not the UI, so
  no surface can leak a partial one.

### Local-first storage

Every write lands in local storage first and synchronously, then drains to
Supabase through an ordered outbox. Airplane mode is not a special case - it is
a flush that fails and gets retried. `SupabaseStore` composes `LocalStore`
rather than reimplementing it, so there is one read path and one write path
instead of two of each.

Verified by driving a real browser: a full ten-test battery entered start to
finish in airplane mode, score on screen 18 seconds after the first entry, still
offline, and a reload while still offline loses nothing.

### Results are immutable

`results` rows are append-only, enforced by a Postgres trigger rather than by
convention. A correction is a new row pointing at the one it replaces; the
engine takes the newest row per test. Percentiles are derived and recomputable,
so re-norming is a background job rather than a data migration.

### The battery is versioned on day one

`battery_versions` → `battery_version_tests` → `test_variants` → `capacities`.
A 65+ battery that swaps wall sit for chair stand and 400m for a six-minute walk
is an INSERT, not a migration. A trigger enforces one test per capacity per
battery version, which is what keeps composites comparable: every battery is
always the mean of the same ten capacities.

## Norms honesty

Two separate claims are tracked per file, and they are not the same thing:

- **`provisional`** - the approach is uncertain. Either no adequate published
  norm exists, or a documented adjustment was applied. A file is only
  non-provisional when **both** the central tendency and the dispersion come
  from the cited source.
- **`transcription_verified`** - whether a human has proofread the digits
  against the source document. Currently `false` on all ten. See
  `VERIFY_NORMS.md`.

Two files are sourced (grip, Cooper); eight are provisional. The provisional
curves come from `scripts/generate-provisional-norms.ts`, so the anchor, the
decline rate and the coefficient of variation are all readable and arguable
rather than hand-waved. `TODO_RENORM.md` has the re-fit plan and the priority
order.

Every provisional percentile carries a tag in the UI that links to
`/methodology`, which is generated from the norms files themselves so a citation
cannot drift from the numbers actually in use.

## Known limits in v1

**Fitness age saturates for this app's own audience.** Published norms describe
the general population. A trained adult one standard deviation above that median
is often 20-40% above it in raw terms, which maps to an age below the youngest
band the norms cover. The engine flags those tests as out of range and the UI
shows a floor ("28 or under") plus an `approx` tag rather than a false
precision, but the number carries less signal for fit users than the concept
implies. Fixing it properly needs a fitter reference population, not a code
change.

**Female push-up norms are the weakest number on a woman's score card.** The
published source uses the modified knee push-up, which is not this battery's
protocol. The values are converted at 0.62 and the file is marked provisional.
First thing to re-fit after dead hang.

**Balance and sit-rising are compressed at the ceiling.** Both are capped
scales (60 seconds, 10 points) with right-skewed distributions, and a normal
model misbehaves at the top. Anyone capping out lands at the 99th percentile.

**The Supabase adapter is unexercised.** It is written against the schema in
`supabase/migrations`, but there was no project to run it against, so it has not
been executed. The local path is fully tested and is what all the verification
above ran on.

## Demo data

A fresh install seeds eight people over two quarterly sessions with a
deterministic PRNG, built so the awkward states are on screen rather than only
the happy path: one participant walks off after seven tests (null composite,
"7/10 incomplete"), one misses the first session (first-timer on the
most-improved board, which is not the same as finishing last), the oldest member
outranks most of the crew on cohort, and two participants are guests with no
account so the claim flow has something to claim.

It is labelled as demo data on the home screen and clears in one tap.

There is deliberately **no SQL seed migration**. Writing eight fake people plus
`auth.users` rows into a real Postgres with RLS is a worse idea than it looks,
and the requirement - every screen renders with data on first run - is met by
the local seed, which is what actually runs on a fresh checkout. A Supabase
install starts empty on purpose.

## Not in v1

Global leaderboard, training plans, wearables, social feed, payments, native
wrapper, weighted composite. `/admin/norms` is the only admin surface.
