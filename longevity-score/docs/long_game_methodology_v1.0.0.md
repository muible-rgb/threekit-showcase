# The Long Game - Population Benchmark Methodology
**Benchmark version 1.1.0 - 2026-09-10**

Scope: eight events, men and women, ages 18-89, percentiles 1-99, scored against the general population of the same age and sex (not athletes, military or gym members).

This report is updated in place as the benchmarks are recalibrated; section 8 is the changelog. Everything below describes the current (1.1.0) table except where a section says otherwise. Filenames below carry whichever version generated them - `long_game_lookup_v1.0.0.json` still ships alongside `..._v1.1.0.json` so results scored under 1.0.0 keep scoring against it (section 7).

Deliverables in this package:

- `long_game_methodology_v1.0.0.md` - this report (filename is the original release; content tracks the current version)
- `long_game_benchmarks_v{VERSION}.csv` / `.xlsx` - anchor table: raw result at 15 percentiles x 72 ages x 2 sexes x 8 events (17,280 rows)
- `long_game_discrete_cdf_v{VERSION}.csv` - full integer / half-point distributions for pull-ups, push-ups and sit-to-rise (needed to score discrete results correctly)
- `long_game_validation_reference_v{VERSION}.csv` - spot-check values at ages 25/40/55/70/85
- `long_game_parameters_v{VERSION}.json` - every knot and constant in the model
- `long_game_benchmarks.py` - the model and scoring API; `build.py` regenerates all files

---

## 1. Summary

| # | Event | Grade | Basis | Derivation (bulk of ages) |
|---|---|---|---|---|
| 1 | 1-mile run | C | FRIEND VO2max registry converted to mile time | modeled |
| 2 | Pull-ups | D | No adult population norms; triangulated hurdle model | modeled |
| 3 | Push-ups (2 min) | B men / C women | Canada Fitness Survey (CSEP) norms; women converted from modified push-up | observed/interpolated to 69, extrapolated 70+ (men); modeled (women) |
| 4 | Standing broad jump | C | Korea National Physical Fitness Survey 2017 (20-59) | observed/interpolated to 59, extrapolated 60+ |
| 5 | Farmer carry | D | Grip-strength centiles (Dodds 2014) + static endurance curve + gait speed. Provisional. | modeled |
| 6 | 5-10-5 pro agility | D | Assumed young-adult anchors; age shape from Korean 10-m shuttle and TUG norms | modeled |
| 7 | Eyes-closed single-leg balance | B | Bohannon 1984, Springer 2007 | observed/interpolated 20-79, extrapolated 80+ |
| 8 | Sit-to-rise | B | Araújo 2020 reference scores (n=6,141), Brito 2014 | observed/interpolated |

Three events (pull-ups, farmer carry, agility) have no general-population norms at all. They are honest models, not measurements. Treat them as version 1 placeholders to be recalibrated with app data.

---

## 2. Common methods

### 2.1 Population target
Every distribution is meant to describe all community-dwelling adults of a given age and sex, including people who cannot complete the test. Where a source population is fitter than that (lab volunteers, gym members, recruits), an explicit adjustment is applied and documented.

### 2.2 Age curves
Each distribution parameter (median, spread, share unable) is a function of age built from knots. Knots come from the source data at the midpoints of the reported age bands. Between knots the curve is a shape-preserving piecewise cubic Hermite interpolant (PCHIP, `scipy.interpolate.PchipInterpolator`). PCHIP is monotone between knots and cannot overshoot, so it introduces no bumps that are not in the data. Beyond the last data-backed knot, extrapolation knots are set by hand from stated decline assumptions (per event below) and labelled `extrapolated`. The curve is flat outside the outermost knots (18 and 89).

Why not a polynomial or spline fit: with 5-8 band midpoints per source, a free spline wiggles and a polynomial tail explodes. Hand-placed extrapolation knots keep the tail conservative and reviewable.

### 2.3 Distribution families
- **Continuous, positive, right-skewed** (jump, carry, balance, agility): log-normal, `Q(p) = median * exp(z_p * sigma)`. Sigma is roughly the coefficient of variation.
- **VO2max** (mile input): two-piece normal, separate spread below and above the median, so published P5 / P50 / P95 are matched directly.
- **Counts with excess zeros** (pull-ups, push-ups): hurdle model. `P(X=0) = pi0(age)`; conditional on X>0, `X = max(1, round(LogNormal))`. Nothing is assumed normal.
- **Bounded ordinal** (sit-to-rise 0-10 in 0.5 steps): latent normal capability, rounded to 0.5 and clamped. The pile-up at 10 falls out of the rounding rather than being imposed.
- **Unable to perform** (jump, agility, carry at older ages; mile beyond 30:00): a share `pi0(age)` of the population sits at the floor value (0 cm, DNF, 0 m, 1800 s). Floor and ceiling cases are scored mid-rank within the tied group (section 2.5).

### 2.4 Percentile anchors
For continuous events the anchor table gives the quantile at each percentile. For time events (mile, agility) a higher percentile means a faster time. For discrete events the anchor is the smallest score whose cumulative probability reaches the percentile; that table is fine for display ("P75 for men age 40 is 24 push-ups") but should not be used to score a result. Use the discrete CDF file.

### 2.5 Scoring a result (implementation rule)
- Continuous, higher is better: `score = 100 * F(x)`.
- Continuous, lower is better: `score = 100 * (1 - F(x))`.
- Discrete: `score = 100 * (P(X < x) + 0.5 * P(X = x))` (mid-rank). This guarantees the requirement that one repetition ranks above everyone who scored zero. Example: men age 55, 58% score zero pull-ups; one pull-up scores 59.3 (mid-rank) and zero scores 28.9. The strict alternative `100 * P(X < x)` (zero reps = 0) is also in the CDF file as `percentile_strict`. Pick one and keep it across versions.
- Floor/ceiling (DNF, 0 m, 60 s cap, 10/10): mid-rank within the tied group. A 25-year-old holding 60 s eyes-closed scores about 93, because 14% of peers also reach the cap.

The Python `score_result(event, sex, age, raw)` implements all of this. A JavaScript port needs only: the parameter JSON, a PCHIP evaluator, a normal CDF/quantile, and the eight small formulas in `long_game_benchmarks.py`. Alternatively, ship the anchor CSV and interpolate linearly between adjacent percentiles for continuous events, and the discrete CDF CSV for the three discrete events.

### 2.6 Derivation labels
- `observed` - age is a source band midpoint and the percentile range is directly reported by the source (values still smoothed).
- `interpolated` - inside the source's age range, between band midpoints.
- `extrapolated` - outside the source's age range.
- `modeled` - the raw measure itself is derived from a proxy or conversion chain (mile, pull-ups, women's push-ups, carry, agility). Everything in those events is modeled regardless of age.

---

## 3. Events

### 3.1 One-mile run - Grade C

**Protocol.** Flat, measured course or track. Run, jog or walk, no pause in timing. Report time; 30:00 cap; unable to complete = DNF. DNF and times over 30:00 share the floor.

**Primary sources.**
- Kaminsky LA, Arena R, Myers J. *Reference standards for cardiorespiratory fitness measured with cardiopulmonary exercise testing: data from FRIEND.* Mayo Clin Proc 2015;90:1515-23. 7,783 maximal treadmill tests, US, ages 20-79, no CVD. Decade percentiles by sex. Median VO2max men 48.0 (20s) to 24.4 (70s); women 37.6 to 18.3; about 10% decline per decade.
- Kaminsky LA et al. *Global reference standards (FRIEND international).* Mayo Clin Proc 2020. Confirms the shape; somewhat higher medians internationally.
- NHANES 1999-2004 submaximal treadmill estimates (Wang CY et al. 2010, MSSE), ages 12-49: general-population values run roughly 5-10% below FRIEND.
- ACSM metabolic equations for running and walking (ACSM Guidelines, 11th ed.).

**Why no direct norms.** Adult 1-mile run norms exist only for youth (FitnessGram), military (2-mile, 1.5-mile) and fitness participants (Cooper Institute 1.5-mile). None represent a general population that includes non-runners.

**Transformation chain.**
1. VO2max two-piece normal by age and sex (P5/P50/P95 per decade transcribed from Kaminsky 2015 Table; verify against the source before release).
2. Population adjustment x0.95 (FRIEND is lab-tested volunteers).
3. Lower-tail widening: below-median spread multiplied by 1.0 at age 60 rising linearly to 1.5 at 85+, because FRIEND excludes anyone who cannot complete a maximal treadmill test.
4. Fraction of VO2max sustainable for the event: `f = clip(1.08 - 0.011 * T_min, 0.80, 1.05)`, iterated with T. All-out 5-min efforts run slightly above VO2max; 20-min efforts near 86%.
5. Speed from available VO2: running `VO2 = 0.2v + 3.5`; walking `VO2 = 0.1v + 3.5 + 0.004 * max(0, v - 70)^2` (the quadratic term makes fast walking expensive so walk/run cross over near 120 m/min). The faster gait is used.
6. Time = 1609.3 m / v; if v < 40 m/min the person is treated as unable (DNF).

**Extrapolation.** 80-89: median VO2 continues down to 19.5 (men) / 15.2 (women) at 85 and 17.8 / 14.0 at 89, about 2% per year, consistent with BLSA accelerated decline (Fleg 2005). Resulting DNF share: men 5% at 80, 11% at 85, 15% at 89; women 11%, 21%, 29%.

**Limitations.** Running economy varies about 10-15% between people; that spread is not modeled, so the mile tails are too tight relative to VO2max tails. Upper tail is optimistic (P95 men age 25 = 5:41; P99 near 4:50 is probably closer to P99.5 in reality). The walk/run transition creates a visible plateau of times around 13-17 min in middle age; real mile-time distributions are bimodal (runners vs walkers), so this is directionally right but the exact location of the plateau is uncertain. DNF shares at 85+ are likely underestimates for the full population (about 40% of US adults 85+ report difficulty walking a quarter mile), but reasonable for people who would attempt the test.

**Grade C.** Strong underlying evidence (VO2max) but a two-step conversion with unmodeled economy variance and a fitter-than-population source.

---

### 3.2 Maximum strict pull-ups - Grade D

**Protocol.** Dead hang, pronated grip, full elbow extension at the bottom, chin clearly over the bar, no kip or leg drive. Count strict reps. Zero is a valid result.

**Evidence.** No adult general-population pull-up norms exist. Adjacent evidence used to set the model:
- National Children and Youth Fitness Study / 1985 School Population Fitness Survey (Presidential Fitness Test norms): at 17, boys' 50th percentile about 7-8 pull-ups, 85th about 13; girls' 50th percentile 0, 85th 1. Roughly 60-70% of adolescent girls score zero.
- US Marine Corps PFT data (recruits, fitter than population): men typically 10-20; the 3-pull-up minimum for women was suspended in 2014 after more than half of female recruits failed it.
- Crowd-sourced training logs (Strength Level; gym population): average logged male 14, female 6. Treated only as an upper bound on where the 75th-90th percentiles of the general population could sit.
- Relative upper-body strength falls and body mass rises through adulthood (grip centiles, NHANES weight trends), which drives the zero share up with age.

**Model (hurdle).** Share scoring zero: men 30% at 20, 36% at 30, 44% at 40, 53% at 50, 63% at 60, 76% at 70, 88% at 80, 94% at 89. Women 80% at 20, 83%, 87%, 91%, 95%, 97.5%, 99%, 99.5%. Among those who can do at least one: men median 6 at 20 falling to 2 at 89, log-SD 0.65 (so 90th percentile of the able group at 20 is about 14); women median 2.5 falling to 1.3, log-SD 0.60. Ceiling 40.

Resulting whole-population values, men: age 25 P50 = 4, P75 = 7, P90 = 11, P95 = 15; age 55 P50 = 0, P75 = 3, P90 = 6. Women: age 25 P90 = 2, P95 = 3; age 55 P95 = 1.

**Zero handling.** Men age 25: 33% score zero. Zero scores 16.6 (mid-rank); one rep scores 33.8. Women age 70: 97.5% score zero; zero scores 48.8 and one rep 98.1. See section 2.5 on the display question this raises.

**Limitations.** Every number is an assumption. The male zero share at ages 20-45 is the least trustworthy parameter in the whole framework; plausible range 25-45%, which moves the score for "1 pull-up, man age 30" by about +/-8 points. Women's positive-part distribution rests on almost nothing. Body mass is the dominant predictor and is not modeled.

**Grade D.** Recalibrate from app data as the first order of business once a few thousand results exist (with the caveat that app users are fitter than the population; see section 6).

---

### 3.3 Maximum strict push-ups in 2 minutes - Grade B (men) / C (women)

**Protocol.** Hands shoulder-width, body rigid, chest to fist-height or a 4-inch marker, full elbow extension at top. Resting in the up position allowed; knees, hips or belly touching ends the test. 2-minute cap. Same standard for men and women (no modified push-up).

**Primary sources.**
- Canada Fitness Survey 1981 (about 15,000 participants, ages 15-69, nationally sampled households). Norms published in the CSEP CPAFLA / CSEP-PATH manuals and reproduced in ACSM's Guidelines. Push-ups to fatigue without a time limit; men full push-ups, women modified (knee) push-ups.
- Men category cut-points used as percentile anchors (Needs Improvement < P20, Fair P20-40, Good P40-60, Very Good P60-80, Excellent > P80): 20-29: 17/22/29/36; 30-39: 12/17/22/30; 40-49: 10/13/17/25; 50-59: 7/10/13/21; 60-69: 5/8/11/18.
- Women (modified) cut-points: 20-29: 10/15/21/30; 30-39: 8/13/20/27; 40-49: 5/11/15/24; 50-59: 2/7/11/21; 60-69: 2/5/12/17.
- US Army APFT 2-minute push-up standards (soldiers; used as a check that 2-minute counts track "to fatigue" counts for all but the top few percent).
- Yang J et al. *Association between push-up exercise capacity and future cardiovascular events.* JAMA Netw Open 2019 (firefighters; supports push-ups as a health marker, not used for norms).

**Transformation (men).** Conditional (X>0) log-normal fitted to the four cut-points per decade: median 25.5 (20s), 19.5, 14.8, 11.3, 9.2 (60s); log-SD 0.46 rising to 0.78. Added zero share 2% at 25 rising to 9% at 65 (CSEP reports counts, not the zero frequency; the small added zero share reflects people who cannot complete one strict rep).

**Transformation (women).** Modified-to-strict conversion: strict push-ups load about 65-70% of body mass versus about 55% for the modified position (Suprak 2011; Ebben 2011). Published comparisons in women give strict counts about 40-50% of modified counts. Factor 0.45 applied to the conditional medians. Added zero share for strict push-ups: 20% at 25, 25% at 35, 32% at 45, 45% at 55, 58% at 65. This is the weakest link and is why women are Grade C and labelled `modeled`.

**Extrapolation 70-89.** Conditional medians continue down (men 6.5 at 75, 4.5 at 85, 3.5 at 89; women 3.5, 3.0, 2.5). Zero share rises to men 18% at 75, 35% at 85, 45% at 89; women 75%, 90%, 93%.

**Protocol differences.** 2-minute cap vs to-fatigue: irrelevant below about 50 reps; above that the cap truncates. Cap 120. Canadian 1981 population was leaner than the US 2026 population; expect the true US distribution to sit a few reps lower in the middle.

**Grade B (men).** Large national household sample, right test, right age span to 69. **Grade C (women).** Conversion from a different exercise plus assumed zero share.

---

### 3.4 Standing broad jump - Grade C

**Protocol.** Two-foot take-off from a line, arm swing allowed, land on both feet, measure to the rear heel. Best of 2-3. Recorded 0 if unable or unsafe to attempt.

**Primary source.**
- Korea Institute of Sport Science / KSPO, 2017 Survey of National Physical Fitness (nationally representative). Analysis of public-use data by Kang & Ryu (arXiv 2002.04160) reports SLJ means and SDs in 2-year age lumps for 1,902 men and 1,861 women aged 20-59. Men: 224 cm at 20.5 declining near-linearly to 175 cm at 58.5 (about 1.2 cm/yr; SD 22-28). Women: 158 to 124 cm (0.8 cm/yr; SD 17-30).

**Supporting evidence for the older-age shape.**
- Canadian Health Measures Survey cycle 5 (2016-17): force-plate vertical jump, ages 20-69, nationally representative. Jump height falls 4-5 cm per decade from about 45 cm (men); decline steepens after 60.
- He et al. 2023, China National Health Survey (n=19,269, ages 8-80): vertical jump centiles; the 5th percentile reaches 0 cm by 70-80 in both sexes, i.e. a measurable share can no longer jump.
- Youth norms (Tomkinson 2018 European values; NFL Combine data) confirm the young-adult level but are not used.

**Transformation.** Log-normal with median from the Korean lumps (smoothed) and log-SD 0.12 (men) / 0.15 (women), the observed CV. The Korean analysis trimmed extreme values (men 61-280 cm, women 50-223), which slightly thins the tails; log-SD was not inflated to compensate, so the tails are conservative. No height or body-mass adjustment applied for the US: Korean adults are shorter (lower jump) and leaner (higher jump); the two roughly offset, uncertainty about +/-5%.

**Extrapolation 60-89.** Median men 160 cm at 65, 143 at 70, 125 at 75, 105 at 80, 88 at 85, 78 at 89; women 112, 100, 87, 73, 60, 53. Log-SD rises to 0.26 / 0.28 at 89. Share unable to attempt: 3% at 65, 6% at 70, 12% at 75, 20% at 80, 32% at 85, 42% at 89 (women 4/8/15/25/38/48%).

**Limitations.** Asian-population source; no adult data past 59; older extrapolation is a judgment call informed by jump-power decline. Injury risk means many older adults will decline the test, which is fine for scoring (recorded 0 shares the floor) but means older-age results in the app will be self-selected.

**Grade C.** Direct test, representative sample, but a different population and 30 years of extrapolation.

---

### 3.5 Farmer carry - Grade D (provisional)

**Protocol.** Two implements, 50 lb each (men) / 35 lb each (women), lifted from the floor, carried continuously on a marked course with turns every 20-25 m. Test ends when either implement touches the ground or at 3:00. Record distance in meters. Unable to lift both implements = 0.

**Evidence chain.** No loaded-carry norms exist for any general population. The model is built from:
- Dodds RM et al. *Grip strength across the life course: normative data from twelve British studies.* PLoS ONE 2014;9:e113637. 49,964 participants, ages 4-90, general population. Peak mean grip 51.9 kg (SD 9.9) men and 31.4 kg (SD 6.1) women at 32; plateau to mid-40s then decline; 23% of men and 27% of women below T-score -2.5 by 80.
- NHANES 2011-2014 grip strength (Bohannon 2019 review) - consistent US values.
- Rohmert static endurance curve (Rohmert 1960; Frey-Law & Avin 2010 meta-analysis for grip): endurance time in minutes = -1.5 + 2.1/f - 0.6/f^2 + 0.1/f^3, f = fraction of maximal voluntary contraction.
- Fast gait speed norms (Bohannon 1997; Bohannon & Williams Andrews 2011) for the walking-speed curve.
- Loaded-carry literature (Knapik 1996 load carriage review; strongman farmer's-walk studies) only to sanity-check that holding capacity on a handle exceeds dynamometer MVC.

**Model.** Grip strength ~ Normal(median(age), SD(age)) from Dodds. Relative load `f = load / (handle_factor * grip)`. Hold time = Rohmert(f) x 0.80 (dynamic factor: walking, swinging and re-gripping shorten static endurance). Distance = age-specific loaded walking speed (men 1.70 m/s at 18 to 0.95 at 89; women 1.60 to 0.85) x min(hold time, 180 s). f >= 1 means the implement cannot be held: distance 0.

**handle_factor = 1.00 (was 1.30 in v1.0.0).** The original 1.30 assumed people can hold a dumbbell handle at roughly 1.3x their dynamometer MVC - a bonus over the grip strength Dodds actually measured, with no source cited for the multiplier itself. Every median in the table carried that bonus. v1.1.0 drops it: load is scored against grip exactly as measured, no bonus assumed. That one change moved every farmer-carry median down by 30-35%; see the v1.1.0 changelog entry for before/after numbers.

Resulting medians (v1.1.0): men 104 m at 25, 85 at 55, 53 at 70, 20 at 85; women 79, 61, 36, 8. Share unable to lift the load: women 10% at 70, 27% at 80, 41% at 85, 53% at 89; men 5% at 70, 14% at 80, 24% at 85, 36% at 89 - all higher than v1.0.0's, because removing the handle bonus also means fewer people clear the load at all. The 3-minute walking cap (about 300 m for young men) is effectively never reached under this model any more - under v1.0.0 the top ~2% of men under 40 hit it; the recalibrated grip-vs-load ratio means grip fails well before the clock does for essentially everyone.

**Limitations.** Two constants remain assumptions with real plausible ranges: the 0.80 dynamic factor and the loaded-walking-speed curve (set at 70-75% of unloaded fast gait). A rough sensitivity check - dynamic factor +/-0.15, the speed fraction +/-5 points - moves the median carry distance by roughly +/-20%. Between-person variation in walking speed and grip endurance is still not modeled (only grip MVC varies), so tails are still too tight. If app data show a cluster of results well above or below what this table expects, that is the signal to revisit these two constants next, the same way the handle factor was revisited for v1.1.0.

**Grade D.** Label the carry score "provisional" in the UI until recalibrated against real app data.

---

### 3.6 5-10-5 pro agility shuttle - Grade D

**Protocol.** Three cones 5 yd apart. Start straddling the middle line, sprint 5 yd, touch line, 15 yd back, touch, 5 yd through the start. Hand-timed to 0.1 s (add 0.2-0.3 s vs electronic timing if comparing to combine data). Best of 2. Unable / DNF recorded as 30 s.

**Evidence.** Published 5-10-5 norms are athlete norms (NFL Combine 4.0-4.6 s; college athletes 4.4-5.0). No general-population data. Adjacent evidence:
- Recreationally active college students on the pro agility test: men about 4.9-5.1 s, women 5.6-5.9 s (studies of the T-test and pro agility in PE and kinesiology students). A general population of the same age is heavier and less active; medians set 0.1-0.2 s slower: men 5.05 s, women 5.75 s.
- Korea National Physical Fitness Survey 2017 10-m shuttle run (same source as broad jump, ages 20-59): men 10.3 s at 20.5 to 12.9 s at 58.5 (+25%); women 12.9 to 15.1 s (+17%). This is the only general-population change-of-direction data across adulthood and sets the 20-60 shape.
- Timed Up and Go norms (Bohannon 2006 meta-analysis: 8.1 s at 60-69, 9.2 s at 70-79, 11.3 s at 80-99) set the relative decline past 60.
- Masters sprint records (Korhonen 2003) show about 0.6-0.7% per year loss of sprint speed to 70, faster after.

**Model.** Log-normal; median men 5.05 (20), 5.45 (40), 5.82 (50), 6.35 (60), 7.30 (70), 9.0 (80), 11.6 (89); women 5.75, 6.15, 6.55, 7.15, 8.20, 10.1, 12.9. Log-SD 0.09 at 20 rising to 0.24 at 89. Share unable/DNF: 2% at 65, 5% at 70, 10% at 75, 18% at 80, 30% at 85, 40% at 89 (women slightly higher).

**Limitations.** Absolute level at every age is assumed. Hand timing adds noise of about 0.2 s, which is 4% of a young adult's time and one full percentile band. Turf and shoe conditions matter.

**Grade D.**

---

### 3.7 Eyes-closed single-leg balance - Grade B

**Protocol.** Barefoot or flat shoes, stand on preferred leg, other foot lifted clear and not touching the stance leg, hands free (not on a support), close eyes. Timing stops when the free foot touches down, the stance foot hops or shifts, a hand touches anything, or eyes open. 60-s cap. Best of 2.

**Primary sources.**
- Bohannon RW et al. *Decrease in timed balance test scores with aging.* Phys Ther 1984;64:1067-70. n=184 healthy adults 20-79. Eyes-closed single-limb stance, 30-s cap, lenient criteria: decade means 28.8, 27.8, 24.2, 21.0, 10.2, 4.3 s.
- Springer BA et al. *Normative values for the unipedal stance test with eyes open and closed.* J Geriatr Phys Ther 2007;30:8-15. n=549 healthy adults 18-99, 45-s cap, arms crossed on chest, strict criteria; best-of-3 eyes-closed means women/men: 13.1/16.9 (18-39), 13.5/12.0 (40-49), 7.9/8.6 (50-59), 3.6/5.1 (60-69), 3.7/2.6 (70-79), 2.1/1.8 (80+). No sex effect.
- Vereeck L et al. 2008 (Int J Audiol; n=318, 20-79) - consistent with Bohannon.
- Araújo CG et al. *Successful 10-second one-legged stance performance predicts survival.* Br J Sports Med 2022 (eyes open; supports the test as a health marker, not used for norms).

**Protocol differences and how they were handled.** Strictness changes results about 2x (Springer vs Bohannon). The Long Game protocol (hands free, free foot may not touch, no arm-cross rule) is closer to Bohannon, so medians lean toward Bohannon: 28 s at 25, 23.5 at 40, 17.5 at 50, 10 at 60, 5.5 at 70, 3.2 at 80. Springer values are the strict lower bound. Bohannon's 30-s cap censors the young (means near 30 imply medians at or above the cap), so the young median is set at 28 s uncensored and the 60-s cap handled explicitly.

**Distribution.** Log-normal, log-SD 0.70 (young) to 0.65 (old). Young adults: P75 = 45 s, P90 = 60 s (cap); 14% of 25-year-olds reach the cap and tie at a mid-rank score of 93. No sex difference modeled (both sources).

**Extrapolation 80-89.** Median 3.2 at 80, 2.5 at 85, 2.0 at 89, following Springer's 80+ group.

**Limitations.** Protocol sensitivity is the main risk: if app users self-administer leniently, scores inflate. The 60-s ceiling limits discrimination above about the 88th percentile under age 40. Sample sizes are modest (n=184 and 549). Both samples excluded people with neurological or vestibular conditions, so the general-population lower tail is thinner than modeled here would imply; log-SD was set wide (0.70) partly to compensate.

**Grade B.**

---

### 3.8 Sit-to-rise - Grade B

**Protocol.** Araújo's Sitting-Rising Test. Standing, lower to a cross-legged seated position on the floor and return to standing. Each of the two movements starts at 5 points; subtract 1 for each hand, forearm, knee or hand-on-knee used as support and 0.5 for visible instability. Score 0-10 in 0.5 steps; best of up to 3 attempts. Standard protocol: bare feet, no aids.

**Primary sources.**
- Araújo CGS, Castro CLB, Franca JFC, Araújo DSMS. *Sitting-rising test: sex- and age-reference scores derived from 6141 adults.* Eur J Prev Cardiol 2020;27:888-90. Exercise-medicine clinic (CLINIMEX, Rio de Janeiro). Fewer than 8% of adults over 55 score a perfect 10; scores decline steadily with age.
- Brito LBB et al. *Ability to sit and rise from the floor as a predictor of all-cause mortality.* Eur J Prev Cardiol 2014;21:892-8. n=2,002, ages 51-80. Score distribution by category and 6.3-year mortality.
- Araújo CGS et al. 2025, Eur J Prev Cardiol (n=4,282, ages 46-75; SRT predicts natural and cardiovascular deaths) - consistent distribution.

**Model.** Latent normal capability, mean 9.65 at 25, 9.1 at 40, 8.5 at 50, 7.6 at 60, 6.3 at 70, 4.6 at 80, 3.0 at 89 (women 0.1-0.3 lower from 40 on); SD 1.0 at 20 rising to 2.2 at 85. Rounded to 0.5 and clamped to [0,10]. Calibrated so that about 45% of 25-year-olds score 10, about 30% at 40, and 7-10% at 60-65, matching the "under 8% over 55" statistic.

**Percentile output.** Men age 25: P10 = 8.5, P50 = 9.5, P75+ = 10. Age 55: P10 = 6, P50 = 8, P90 = 10. Age 70: P10 = 3.5, P50 = 6.5, P90 = 9. Age 85: P10 = 1, P50 = 3.5, P90 = 6.5.

**Limitations.** Source is a private clinic population in Brazil (higher socioeconomic status, many referred for exercise programs), so the general US population likely scores somewhat lower in mid-life. Scoring is observer-dependent; self-scoring in an app will be more generous. Ceiling: at ages under 40, scores of 10 tie across the top 40-50% and are scored mid-rank (about 73-78), which is the correct population percentile but will feel low to fit young users.

**Grade B.** Direct test, large sample, full adult age span; population mismatch keeps it from A.

---

## 4. Overall Longevity Score

**MVP rule.** Overall = arithmetic mean of the eight event percentile scores. Keep it.

**Is equal weighting reasonable?** Yes for the stated goal (broad physical capability). Objections and why they do not justify changing weights now:

- *Upper-body pulling and pushing are overrepresented* (pull-ups, push-ups, and grip-limited carry: three of eight). Lower-body power and speed get two (jump, agility), cardiorespiratory fitness one, balance one, mobility/integration one. If the goal were mortality prediction, cardiorespiratory fitness would deserve 30-40% of the weight (it is the strongest single predictor) and pull-ups near zero. That is not the goal.
- *The mean of percentiles is not a percentile.* Percentiles are uniform (SD 28.9). Averaging eight moderately correlated uniforms (r about 0.4) gives SD about 20. An overall of 90 is roughly the top 2-3% of people, not the top 10%. Display it as "average percentile" or "Longevity Score", never as "you are in the Xth percentile overall". Re-normalizing the overall against app data is a v2 item.
- *Ceilings compress the top.* Balance (60 s), sit-to-rise (10) and, for young men, the carry (3:00) cap at about the 88th-93rd percentile. A superb 28-year-old will average lower than expected. Acceptable for MVP; note it in the UI.
- *Floors and zero-inflation.* Older users and most women will score around 45-50 on pull-ups by scoring zero (mid-rank). That is mathematically right and keeps the overall stable, but it means pull-ups barely discriminate for those groups. Consider a dead-hang or inverted-row substitute in v2 for users who cannot do one rep; do not change the weight.
- *Grades D events carry the same weight as Grade B events.* A weighting by evidence quality would be defensible but changes meaning every time evidence improves. Better to fix the evidence.

Recommendation: equal weights, unchanged, until app data allow an empirical re-normalization of the overall score.

---

## 5. Validation results

Run by `build.py` on the generated tables.

- **Monotonicity.** For all 1,152 (event, sex, age) cells, a better raw result never produces a lower percentile. 0 violations.
- **Smoothness.** Year-over-year change at P10/P50/P90 checked for every event and sex. No relative jump above 8% except where a percentile approaches a floor value (carry and jump distances near 0 at 80+, agility near DNF, mile near 30:00), where relative change is large because the absolute value is small. Absolute changes there are 1-3 units per year. One inherent integer step of 2 reps at P90 men age 36 (push-ups) from the change in spread between decades. No discontinuities.
- **Round-trip.** `percentile(quantile(p)) = p` within 0.1 for all continuous events at ages 25/40/55/70/85 and p = 10/50/90 (excluding floor/ceiling cells). Discrete events differ by construction (quantile returns an integer, mid-rank scoring returns the centre of that integer's probability mass).
- **Zero cases.** Pull-ups: men age 25 zero share 33% (0 reps scores 16.6, 1 rep 33.8); age 55 58% (28.9 / 59.3); age 85 92%. Women age 25 82% (40.9 / 83.7); age 70 97.5%. Push-ups: men 2% at 25, 13% at 70, 35% at 85; women 20% at 25, 45% at 55, 66% at 70, 90% at 85. One rep always outranks every zero.
- **Reference values at test ages** (P10 / P25 / P50 / P75 / P90):

**mile_run** (min:sec; DNF = over 30:00 or unable)

| sex | age | P10 | P25 | P50 | P75 | P90 |
|---|---|---|---|---|---|---|
| F | 25 | 14:17 | 12:58 | 10:23 | 8:16 | 7:00 |
| F | 40 | 15:59 | 14:36 | 13:31 | 11:36 | 9:32 |
| F | 55 | 17:19 | 15:54 | 14:48 | 13:28 | 12:16 |
| F | 70 | 21:59 | 18:19 | 16:28 | 15:13 | 14:22 |
| F | 85 | DNF | 27:38 | 19:20 | 17:35 | 16:31 |
| M | 25 | 12:16 | 9:33 | 7:41 | 6:29 | 5:41 |
| M | 40 | 13:23 | 11:45 | 9:35 | 7:49 | 6:43 |
| M | 55 | 14:46 | 13:38 | 12:32 | 9:36 | 7:56 |
| M | 70 | 17:26 | 15:24 | 13:59 | 12:35 | 10:14 |
| M | 85 | DNF | 19:17 | 16:18 | 14:27 | 13:21 |

**pull_ups** (reps)

| sex | age | P10 | P25 | P50 | P75 | P90 |
|---|---|---|---|---|---|---|
| F | 25 | 0 | 0 | 0 | 0 | 2 |
| F | 40 | 0 | 0 | 0 | 0 | 1 |
| F | 55 | 0 | 0 | 0 | 0 | 0 |
| F | 70 | 0 | 0 | 0 | 0 | 0 |
| F | 85 | 0 | 0 | 0 | 0 | 0 |
| M | 25 | 0 | 0 | 4 | 7 | 11 |
| M | 40 | 0 | 0 | 2 | 5 | 9 |
| M | 55 | 0 | 0 | 0 | 3 | 6 |
| M | 70 | 0 | 0 | 0 | 0 | 3 |
| M | 85 | 0 | 0 | 0 | 0 | 0 |

**push_ups** (reps, 2 min)

| sex | age | P10 | P25 | P50 | P75 | P90 |
|---|---|---|---|---|---|---|
| F | 25 | 0 | 3 | 7 | 12 | 18 |
| F | 40 | 0 | 0 | 5 | 10 | 15 |
| F | 55 | 0 | 0 | 2 | 5 | 10 |
| F | 70 | 0 | 0 | 0 | 2 | 6 |
| F | 85 | 0 | 0 | 0 | 0 | 0 |
| M | 25 | 13 | 18 | 25 | 35 | 46 |
| M | 40 | 7 | 11 | 17 | 24 | 34 |
| M | 55 | 4 | 6 | 11 | 17 | 26 |
| M | 70 | 0 | 3 | 7 | 12 | 20 |
| M | 85 | 0 | 0 | 2 | 6 | 10 |

**broad_jump** (cm)

| sex | age | P10 | P25 | P50 | P75 | P90 |
|---|---|---|---|---|---|---|
| F | 25 | 126 | 138 | 153 | 169 | 185 |
| F | 40 | 120 | 131 | 145 | 160 | 176 |
| F | 55 | 106 | 117 | 130 | 144 | 159 |
| F | 70 | 68 | 84 | 98 | 112 | 126 |
| F | 85 | 0 | 0 | 48 | 64 | 78 |
| M | 25 | 185 | 199 | 216 | 234 | 252 |
| M | 40 | 172 | 185 | 201 | 218 | 234 |
| M | 55 | 154 | 166 | 181 | 197 | 213 |
| M | 70 | 107 | 124 | 141 | 159 | 177 |
| M | 85 | 0 | 0 | 76 | 96 | 114 |

**farmer_carry** (m) - v1.1.0, after removing the 1.30 handle-factor bonus (see 3.5)

| sex | age | P10 | P25 | P50 | P75 | P90 |
|---|---|---|---|---|---|---|
| F | 25 | 43 | 60 | 78 | 96 | 113 |
| F | 40 | 45 | 61 | 79 | 96 | 112 |
| F | 55 | 27 | 44 | 61 | 77 | 92 |
| F | 70 | 0 | 21 | 36 | 50 | 62 |
| F | 85 | 0 | 0 | 8 | 19 | 28 |
| M | 25 | 63 | 83 | 104 | 127 | 148 |
| M | 40 | 65 | 84 | 105 | 127 | 149 |
| M | 55 | 47 | 66 | 85 | 105 | 124 |
| M | 70 | 19 | 36 | 53 | 70 | 84 |
| M | 85 | 0 | 6 | 20 | 32 | 43 |

(v1.0.0's table, before the handle-factor fix, had every cell 30-35% higher - e.g. M 40 P50 was 159 m, not 105.)

**pro_agility_5_10_5** (s)

| sex | age | P10 | P25 | P50 | P75 | P90 |
|---|---|---|---|---|---|---|
| F | 25 | 6.5 | 6.2 | 5.8 | 5.5 | 5.2 |
| F | 40 | 7.0 | 6.6 | 6.2 | 5.7 | 5.4 |
| F | 55 | 7.9 | 7.4 | 6.8 | 6.3 | 5.8 |
| F | 70 | 10.8 | 9.4 | 8.3 | 7.4 | 6.7 |
| F | 85 | DNF | DNF | 13.5 | 10.8 | 9.2 |
| M | 25 | 5.7 | 5.4 | 5.1 | 4.8 | 4.5 |
| M | 40 | 6.2 | 5.8 | 5.5 | 5.1 | 4.8 |
| M | 55 | 7.0 | 6.6 | 6.0 | 5.6 | 5.2 |
| M | 70 | 9.5 | 8.3 | 7.4 | 6.6 | 6.0 |
| M | 85 | DNF | DNF | 11.7 | 9.5 | 8.1 |

**single_leg_balance_ec** (s, cap 60; identical for men and women)

| age | P10 | P25 | P50 | P75 | P90 |
|---|---|---|---|---|---|
| 25 | 11 | 18 | 28 | 45 | 60 |
| 40 | 10 | 15 | 24 | 38 | 58 |
| 55 | 6 | 8 | 14 | 22 | 33 |
| 70 | 2 | 4 | 6 | 9 | 13 |
| 85 | 1 | 2 | 2 | 4 | 6 |

**sit_to_rise** (0-10)

| sex | age | P10 | P25 | P50 | P75 | P90 |
|---|---|---|---|---|---|---|
| F | 25 | 8.5 | 9.0 | 9.5 | 10.0 | 10.0 |
| F | 40 | 7.5 | 8.0 | 9.0 | 10.0 | 10.0 |
| F | 55 | 6.0 | 7.0 | 8.0 | 9.0 | 10.0 |
| F | 70 | 3.5 | 5.0 | 6.0 | 7.5 | 8.5 |
| F | 85 | 0.5 | 2.0 | 3.5 | 5.0 | 6.5 |
| M | 25 | 8.5 | 9.0 | 9.5 | 10.0 | 10.0 |
| M | 40 | 7.5 | 8.0 | 9.0 | 10.0 | 10.0 |
| M | 55 | 6.0 | 7.0 | 8.0 | 9.0 | 10.0 |
| M | 70 | 3.5 | 5.0 | 6.5 | 7.5 | 9.0 |
| M | 85 | 1.0 | 2.0 | 3.5 | 5.0 | 6.5 |

**Worked example** (from `long_game_benchmarks.py`, v1.1.0): woman, 74, mile 17:00, 0 pull-ups, 3 push-ups, 95 cm jump, 70 m carry, 8.9 s shuttle, 6.0 s balance, SRT 7.0 → event scores 46.6 / 49.1 / 84.2 / 66.1 / 98.6 / 53.4 / 67.4 / 76.8; overall 67.8. Display: "Estimated 84th percentile among women age 74" for the push-ups. (Under v1.0.0 the carry scored 78.7 and the overall was 65.3 - the same 70 m now ranks much higher because the recalibrated table no longer assumes a handle-grip bonus nobody could source.)

---

## 6. Least trustworthy estimates (in order)

1. **Pull-ups, all ages, both sexes** - the male zero share at 20-45 and the women's positive-part distribution most of all.
2. **Farmer carry** - two assumed physical constants remain (dynamic factor, loaded-speed curve); distances could still be off by roughly 20%. (A third, the handle factor, was an unsourced bonus and was removed in v1.1.0 - see 3.5.)
3. **Agility** - absolute level at every age is assumed.
4. **Mile run at 80+** - DNF share and the lower tail depend on the tail-widening assumption; the upper tail under 30 (P95+) is too fast.
5. **Women's push-ups** - modified-to-strict conversion and zero share.
6. **Broad jump 65+** - 30 years of extrapolation past the Korean data.
7. **Everything at 85-89** - no event has direct data here except grip and, thinly, balance and SRT.

Also flag: app users will be fitter than the population. When you recalibrate from app data, you must model that selection (e.g. anchor to the population sources for the middle and lower percentiles and let app data refine only the upper tail and the age slopes), or the benchmarks will drift toward "percentile among people who use fitness apps", which is exactly what the framework is meant to avoid.

---

## 7. Versioning

- Semantic versioning on the benchmark set: `MAJOR.MINOR.PATCH`. PATCH = typo/documentation only, scores unchanged. MINOR = recalibration that changes scores for some cells (new evidence, app-data update). MAJOR = protocol change or new scoring convention (e.g. switching mid-rank to strict).
- Store `benchmark_version` on every stored result at the time it was scored, alongside the raw result, sex, age at test date, and protocol version. Never overwrite.
- Compute percentiles on read, from the raw result plus the stored version. Historical results stay on the version they were scored under by default; offer "rescore under current benchmarks" as an explicit user action, shown side by side.
- Ship every version as immutable files (`long_game_benchmarks_vX.Y.Z.csv`, `..._discrete_cdf_...`, `..._parameters_....json`) with a changelog listing which event/sex/age cells moved by more than 2 percentile points.
- Leaderboards should pin one version per season so rankings do not shift mid-competition.
- Keep the raw-result units fixed forever (seconds, reps, cm, m, s, 0-10). Convert for display only.

---

## 8. Changelog

**1.1.0 (2026-09-10)** - recalibrated farmer_carry only; every other event is byte-identical to 1.0.0. Removed `HANDLE_FACTOR` (was 1.30, an assumed bonus for holding a handle over a dynamometer MVC with no cited source - see 3.5). Every farmer_carry cell moved down 30-35% at every age and sex: e.g. men P50 at 40 was 159 m, is now 105 m; women P50 at 40 was 119 m, is now 79 m. Share unable to lift the load rose correspondingly (e.g. men at 89 was 16%, is now 36%), and the 3-minute walking cap - reachable by the top ~2% of men under 40 in v1.0.0 - is no longer reached under this model. Reported user-facing symptom: a 250 ft carry at the prescribed load was scoring around the 3rd percentile for a man in his 30s-40s; under 1.1.0 the same result scores around the 17th-18th. Results already stored with `benchmarkVersion: "1.0.0"` keep scoring against the 1.0.0 table (section 7); nothing already recorded moves.

**1.0.0 (2026-09-06)** - initial release. Eight events, ages 18-89, both sexes. Mid-rank convention for discrete and floor/ceiling cases. Farmer carry, pull-ups and agility provisional (Grade D).
