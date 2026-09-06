# The Long Game - scoring handoff for Claude Code
**Benchmark v1.0.0 · 2026-09-06**

## What to add to the repo

```
/benchmarks/long_game_lookup_v1.0.0.json    # the benchmark table (570 KB)
/src/lib/scoring.js                         # scorer, zero dependencies
/docs/long_game_methodology_v1.0.0.md       # sources, grades, limitations
```

Ship the JSON as a static asset and cache it in the service worker. It never changes within a version.

Do NOT reimplement the statistics. Everything (age curves, zero-inflation, floors, ceilings) is already baked into the table.

## Usage

```js
import { createScorer, EVENT_KEYS } from "./lib/scoring.js";

const lookup = await fetch("/benchmarks/long_game_lookup_v1.0.0.json").then(r => r.json());
const scorer = createScorer(lookup);

scorer.scoreEvent("mile_run", "M", 39, 402);
// { score: 89.6, evidenceGrade: "C", derivation: "modeled", provisional: false, ... }

scorer.scoreBattery("M", 39, {
  mile_run: 402, pull_ups: 8, push_ups: 37, broad_jump: 210,
  farmer_carry: 165, pro_agility_5_10_5: 5.4,
  single_leg_balance_ec: 24, sit_to_rise: 9.5,
});
// { overall: 71.4, complete: true, events: {...} }

scorer.benchmarkAt("push_ups", "M", 40, 75);  // -> 24  (for "P75 is 24 reps")
```

## Raw units - fix these forever, convert only for display

| event key | unit | notes |
|---|---|---|
| `mile_run` | seconds | 1800 = DNF or over 30:00 |
| `pull_ups` | reps | integer, 0 valid |
| `push_ups` | reps | integer, 0 valid, 2-min cap |
| `broad_jump` | cm | 0 = unable |
| `farmer_carry` | meters | 0 = unable to lift |
| `pro_agility_5_10_5` | seconds | 30 = DNF |
| `single_leg_balance_ec` | seconds | 60 = cap |
| `sit_to_rise` | 0-10 | 0.5 steps |

## Data model

Store the raw result and the version. Compute percentiles on read, never store them as the source of truth.

```
results
  id
  user_id
  event_key            text
  raw_result           numeric      -- in the unit above, always
  sex_at_test          char(1)      -- 'M' | 'F'
  age_at_test          int          -- age on the test date, not current age
  tested_on            date
  benchmark_version    text         -- '1.0.0', stamped at entry
  protocol_version     text         -- '1.0', bump if the test protocol changes
  self_reported        boolean
  notes                text
```

Score on read using the version stored on the row. A user's history must not shift when you ship new benchmarks. Offer "rescore under current benchmarks" as an explicit action showing old and new side by side.

## Display rules (these matter)

1. **Event scores are real percentiles.** "Estimated 87th percentile among women age 74" is correct phrasing.
2. **Overall is a mean of percentiles, NOT a percentile.** Call it "Longevity Score". Never "you are in the Xth percentile overall". Rough read: 70 strong, 80 top ~10%, 90 top ~2-3%.
3. **Show the evidence grade.** `provisional: true` (grade D: pull-ups, farmer carry, agility) should render a badge - "provisional benchmark". Users will trust the number more, not less, if you flag it.
4. **Zero reps is not a zero score.** A man of 55 who does zero pull-ups scores 28.9, because 58% of his peers also score zero. One rep jumps him to 59.3. Do not "fix" this - it's the point of the mid-rank convention.
5. **Ceilings compress the top.** 60 s balance caps at ~93, sit-to-rise 10/10 caps at ~77 for a 25-year-old. Show the cap explicitly ("maxed - 60 s cap") so a fit young user doesn't read it as a low score.
6. **DNF and 0 are valid results, not missing data.** They score in the low tail. Distinguish them in the UI from "not yet tested".

## Leaderboard

Pin one benchmark version per season, in the season record. Rank on event percentile or overall score, never on raw results (raw across ages and sexes is meaningless). Seasons that span a version bump keep their pinned version to the end.

## Validation to port into tests

These are the exact numbers the scorer must return:

| event | sex | age | raw | expected score |
|---|---|---|---|---|
| mile_run | M | 39 | 402 | 89.6 |
| push_ups | M | 39 | 37 | 91.3 |
| mile_run | F | 42 | 480 | 97.9 |
| push_ups | F | 42 | 7 | 64.8 |
| pull_ups | M | 25 | 0 | 16.6 |
| pull_ups | M | 25 | 1 | 33.8 |
| pull_ups | F | 70 | 0 | 48.8 |
| pull_ups | F | 70 | 1 | 98.1 |
| single_leg_balance_ec | M | 25 | 60 | 93.4 |
| sit_to_rise | M | 25 | 10 | 76.9 |
| broad_jump | F | 85 | 0 | 19.2 |
| pro_agility_5_10_5 | M | 85 | 30 | 15.2 |
| farmer_carry | M | 40 | 159 | 49.9 |
| mile_run | M | 85 | 1800 | 5.1 |

Plus these invariants, as property tests:

- A better raw result never yields a lower score, for every event, sex and age.
- Score is always in [0, 100].
- 1 rep always scores above 0 reps, at every age and both sexes.
- Age 17 clamps to 18; age 95 clamps to 89.
- Scores move smoothly across adjacent ages: no jump above 6 points for the same raw result between age N and N+1.

## Reference implementation

`long_game_benchmarks.py` is the source of truth for the model; `build.py` regenerates every table including the lookup JSON. Keep both in the repo under `/tools/benchmarks/` so v1.1 can be regenerated rather than hand-edited.

## Known gaps to leave as TODOs

- Pull-ups, farmer carry and agility have no general-population norms behind them. Recalibrate once you have real data, and model app-user selection bias when you do, or the benchmarks drift into "percentile among fitness-app users".
- Consider a dead-hang or inverted-row alternative for users who cannot do one pull-up. Add it as a separate event; do not reweight the overall.
- The FRIEND VO2max percentile values behind the mile model were transcribed from memory of Kaminsky 2015 Table 1. Verify against the paper before public launch.
