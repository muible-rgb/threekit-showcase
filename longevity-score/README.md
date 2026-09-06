# The Long Game

Eight physical tests, one score, graded against people your own age and sex.
Imperial units. Test with a crew, compare on a shared board.

**Mile - Pull-ups - Push-ups - Broad jump - Carry - Agility - Balance -
Sit-to-rise.**

It is a scorecard, not a coach. There is no guided mode, no fixed order, no
stopwatch and no rest timer: you do the tests outside and tap a row to type in
what you got.

Three tabs. **Score** is the eight rows. **Board** ranks everyone on how far
they sit above their own cohort. **You** breaks your score apart - shape,
strengths, gaps, what moved, and what the number is actually claiming.

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
npm test             # unit tests: scorer against the shipped table, engine, seed, formatting
npm run typecheck
npm run lint
npm run benchmarks:build    # regenerate the benchmark tables (python: numpy, scipy, pandas)
```

To point it at Postgres, copy `.env.example` to `.env.local`, fill in the
Supabase URL and anon key, and apply `supabase/migrations/*.sql` in order.

To put it on the web, see `DEPLOY.md`. Short version: import the repo on
Netlify or Vercel and set the base/root directory to `longevity-score`. No
environment variables needed - it deploys and runs on the seeded demo data.

## Design

All UI follows `DESIGN.md` - gym whiteboard: near-black board, chalk type, one
acid accent. Tokens live in `src/app/globals.css` and are exposed as Tailwind
utilities (`bg-board`, `text-chalk`, `border-rule`, `font-num`), so components
name the token and never the value.

**One thing the design system cost, worth knowing:** score bands used to be
five colours. DESIGN.md rules out blue and teal outright and reserves the
accent for your own result, so a five-colour scale cannot exist. Bands are now
words - ELITE, STRONG, SOLID, BELOW, AT RISK - sitting next to the percentile
that already carries the ranking. It reads cleaner and you lose the
at-a-glance colour cue.

The radar chart went with it. A radar is a shape you decode; eight bars sorted
best to worst is the same data read in one pass, and it obeys the rule that if
an element is not a number, a label or a rule, it gets cut. Recharts is no
longer a dependency, which took 320 kB off the bundle.

## How it fits together

```
data/benchmarks/*.json        the table: 99 quantiles per sex per year of age, per event
src/lib/scoring/benchmark.ts  the scorer. lookup, interpolation, ties. no statistics.
src/lib/scoring/              pure engine. no I/O. takes the table as an argument.
src/lib/benchmarks/           registry of table versions, notes for /methodology
src/lib/battery.ts            the eight tests, bound to table events with unit factors
tools/benchmarks/             the Python model that generates the table
docs/                         the methodology report, every source and assumption
src/app/board/                the leaderboard
src/app/you/                  the deep dive
src/lib/data/                 DataStore: LocalStore + SupabaseStore
supabase/migrations/          schema, RLS, reference data
```

### The engine takes the table as an argument

`src/lib/scoring` never imports the benchmark file. It takes a `BenchmarkLookup`,
which is what lets the whole engine be tested against literal fixtures - a
change to a shipped table cannot turn an engine test red, and a bug in the
engine cannot hide behind real data. A second test file runs the scorer against
the real table and checks the fourteen reference values from the handoff to the
decimal.

Three layers: raw result → percentile among people of your sex and exact age →
composite.

- **The table does the statistics.** Every event was modelled once in Python
  (`tools/benchmarks/long_game_benchmarks.py`): smooth age curves through
  source knots, a distribution family chosen for the measure's shape, explicit
  shares who cannot do the test at all. The output is a table with a column for
  every year of age from 18 to 89. The app ships the table and only looks up.
- **Continuous events interpolate** between the two percentile anchors that
  bracket the result. Past the 1st or 99th anchor the score is 0.5 or 99.5,
  which says "off the end" without inventing precision.
- **Discrete events score mid-rank**: `100 × (P(X < x) + ½ P(X = x))`. This is
  what makes zero reps a real score and one rep always better than zero: a man
  of 55 who does no pull-ups scores 28.9, because 58% of his peers also score
  zero, and one rep takes him to 59.3.
- **Floors and ceilings tie.** A DNF on the mile, a 0 on the jump, 60 s on the
  balance, 10/10 on sit-to-rise: each is scored in the middle of the group that
  got the same. The UI says DNF or max rather than showing a number that looks
  like a bad one.
- The composite is the unweighted mean of eight percentiles, to one decimal,
  and it is **null until all eight are there**. It is a mean, not a percentile,
  so to place it against the population its spread is modelled: eight uniforms
  with pairwise correlation 0.4 give a mean with SD 19.9, near normal. That
  turns 70 into the 84th percentile, 80 into the 93rd, 90 into the 98th. It
  is shown as an **estimated** percentile and will be replaced by the observed
  distribution once there is enough app data.
- **On the app** ranks you against everyone with a complete card. It is fair
  across a 28-year-old and a 71-year-old because every composite is already
  relative to its owner's age and sex.

Units: the app stores what people say out loud (feet, inches, seconds, reps)
and converts to the table's unit at the scoring boundary (`benchmark.factor`
on each test). The stored raw never changes meaning.

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

## Benchmark honesty

Every event carries an **evidence grade** in the table itself, read by the UI
rather than written into it:

- **A** strong direct norms for this test and population. None yet.
- **B** good evidence with a protocol or population mismatch: balance,
  sit-to-rise, men's push-ups.
- **C** a proxy or conversion chain: the mile (from VO2max), the broad jump
  (Korean survey, extrapolated past 59), women's push-ups (converted from the
  modified push-up).
- **D** provisional, no general-population norm exists: pull-ups, the carry,
  agility. These are models built from adjacent evidence. They render a
  `provisional` tag wherever their percentile appears.

Every cell also carries a **derivation** label - observed, interpolated,
extrapolated, or modeled - and the deep dive marks extrapolated cells. The
full account of sources, assumptions and the seven least trustworthy estimates
is `docs/long_game_methodology_v1.0.0.md`. `/methodology` in the app is a
condensed version, with grades and coverage read live from the table.

**Versions.** Tables are semver'd and immutable. Every result is stamped with
the version it was entered under (`benchmark_version`) and scored against that
version on read, so shipping a recalibrated table moves nobody's history.
`tools/benchmarks/README.md` has the publishing steps. The shipped v1.0.0 table
regenerates byte-for-byte from the committed model.

## Known limits in v1

**Fitness age saturates for this app's own audience.** The table describes the
general population. A trained adult often beats the median 18-year-old on
several tests, and there is no younger column to read. The engine flags those
tests as out of range and the UI shows a floor ("18 or under") plus an `approx`
tag rather than a false precision, but the number carries less signal for fit
users than the concept implies. Fixing it properly needs a fitter reference
population, not a code change.

**Pull-ups are the hardest test to benchmark honestly.** No adult population
norms exist and most women past 40 cannot do one. The table uses a hurdle model
- a share who score zero, a count among the rest - and scores zero mid-rank in
the zero group. The male zero share at 20-45 is the least trustworthy parameter
in the whole framework; it moves the score for one pull-up at 30 by about 8
points either way.

**Women's push-ups are converted from a different exercise.** The published
source uses the modified knee push-up; strict counts are taken at 0.45 of that
with an added zero share. Grade C, and the weakest link after the Grade D
events.

**The mile passes through a conversion chain.** VO2max percentiles → sustainable
speed → mile time, walk or run. Each step is a documented equation and each
adds error. Percentile ordering survives because every step is monotone, so the
ranking is sounder than the absolute time. The top end under 30 is optimistic.

**A prescribed carry load bunches older cohorts near zero.** 100 lb total is a
moderate carry at 35 and close to a maximal one at 80, so a good share of the
oldest bands will record very short distances or none at all. That is real
rather than a modelling artefact, and it is the same shape the pull-up file
has: the cohort norms still rank within the band. The decline per decade in the
carry file is set at 0.22 rather than 0.15 to reflect it.

**Balance and sit-to-rise are compressed at the ceiling.** 14% of 25-year-olds
reach 60 s and tie at about 93; under 40, a perfect 10 on sit-to-rise ties with
the top 40-50% and scores in the mid-70s. That is the correct population
percentile and it will feel low to a fit young user. The UI marks the cap.

**The table adds about 180 kB (gzipped) to the first load.** It is imported
statically so the browser, the server and the share card all score identically
and offline works from the first visit. Splitting it per event or loading it
lazily is the fix if that ever matters.

**The Supabase adapter is unexercised.** It is written against the schema in
`supabase/migrations`, but there was no project to run it against, so it has not
been executed. The local path is fully tested and is what all the verification
above ran on.

## Demo data

A fresh install seeds eight people over two quarterly sessions with a
deterministic PRNG, built so the awkward states are on screen rather than only
the happy path: one participant is missing two tests (null composite,
"6/8"), one misses the first session (first-timer on the
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
wrapper, weighted composite. `/admin/benchmarks` is the only admin surface.

## Registration

Name, sex and date of birth. The last two are the denominator, not a
preference: without a cohort there is no percentile, so they cannot be skipped
and the screen says why.

Email is genuinely optional and buys exactly two things, both stated on screen:
your results follow you to another phone, and you appear on the board. Without
it everything still works, on that device only. There is no password - a magic
link signs you in, which needs the Supabase wiring in `DEPLOY.md`.

## The carry records two numbers, and neither is your bodyweight

Distance alone is not a result. 300 feet at 40 lb a hand and 300 feet at 90 lb
are different tests. So the entry sheet captures load and distance, prefills
the load at the prescribed **50 lb per hand for men, 35 for women**, and marks
the result off-protocol on the card when what you actually held is more than
15% away. It does not quietly score it as if it matched.

The load used to be half your bodyweight. It is prescribed now, and **the app
never asks what you weigh.** Scaling it to bodyweight made this the only test
that needed a weigh-in and put the load at 90 lb a hand for a big man, which is
not a dumbbell most gyms own.

The prescription is by sex rather than one number for everyone. 35 against 50
is close to the published female/male ratio for grip and carrying strength, so
the test keeps measuring grip endurance instead of who can lift the things off
the floor at all - and it does that without bringing bodyweight back.
