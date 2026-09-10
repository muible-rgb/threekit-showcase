"""
Regenerates every benchmark table from long_game_benchmarks.py.

    python3 tools/benchmarks/build.py

Writes to tools/benchmarks/out/ (gitignored):
    long_game_benchmarks_v{V}.csv / .xlsx   anchor table, 15 percentiles
    long_game_discrete_cdf_v{V}.csv         full CDFs for the discrete events
    long_game_validation_reference_v{V}.csv spot-check values
    long_game_parameters_v{V}.json          every knot and constant
    long_game_lookup_v{V}.json              THE TABLE THE APP SHIPS

The lookup is written to out/ rather than straight into data/benchmarks so a
regeneration can never silently change a shipped version. To publish: bump
VERSION in long_game_benchmarks.py, run this, diff against the previous
version, copy the lookup into data/benchmarks/, register it in
src/lib/benchmarks/registry.ts, and add a changelog entry listing the cells
that moved by more than two points. Shipped tables are immutable.

Needs numpy, scipy, pandas, openpyxl.
"""
import json, sys
from pathlib import Path
import numpy as np
import pandas as pd

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import long_game_benchmarks as lg
from long_game_benchmarks import EVENTS, AGES, PCTS, SEXES, VERSION, grade_of

OUT = HERE / "out"
OUT.mkdir(exist_ok=True)

# ---------------------------------------------------------------- anchors
rows = []
for ev in EVENTS:
    for sex in SEXES:
        for age in AGES:
            lab = ev.label(sex, int(age))
            for p in PCTS:
                raw = ev.quantile(sex, int(age), p)
                if ev.discrete:
                    raw_out = raw
                elif ev.unit == "seconds":
                    raw_out = round(float(raw), 1)
                else:
                    raw_out = round(float(raw), 1)
                rows.append(dict(event=ev.key, sex=sex, age=int(age), percentile=p,
                                 raw_result=raw_out, unit=ev.unit,
                                 evidence_grade=grade_of(ev, sex), derivation_type=lab,
                                 benchmark_version=VERSION))
anchors = pd.DataFrame(rows)
anchors.to_csv(f"{OUT}/long_game_benchmarks_v{VERSION}.csv", index=False)

# ---------------------------------------------------------------- discrete CDF
crow = []
for ev in EVENTS:
    if not ev.discrete:
        continue
    grid = lg.SRT_SCORES if ev.key == "sit_to_rise" else list(range(0, ev.cap + 1))
    step = 0.5 if ev.key == "sit_to_rise" else 1
    for sex in SEXES:
        for age in AGES:
            for k in grid:
                below = ev.cdf(sex, int(age), k - step)
                at = ev.pmf(sex, int(age), k)
                if at < 1e-6 and below > 0.9999 and k > grid[0]:
                    break
                crow.append(dict(event=ev.key, sex=sex, age=int(age), raw_result=k, unit=ev.unit,
                                 p_below=round(below, 5), p_at=round(at, 5),
                                 p_at_or_below=round(below + at, 5),
                                 percentile_midrank=round(100 * (below + 0.5 * at), 2),
                                 percentile_strict=round(100 * below, 2),
                                 evidence_grade=grade_of(ev, sex), derivation_type=ev.label(sex, int(age)),
                                 benchmark_version=VERSION))
cdf = pd.DataFrame(crow)
cdf.to_csv(f"{OUT}/long_game_discrete_cdf_v{VERSION}.csv", index=False)

# ---------------------------------------------------------------- validation
report = {}
TEST_AGES = [25, 40, 55, 70, 85]

# 1. monotone in percentile
viol = []
for (e, s, a), g in anchors.groupby(["event", "sex", "age"]):
    ev = next(x for x in EVENTS if x.key == e)
    vals = g.sort_values("percentile")["raw_result"].to_numpy(dtype=float)
    d = np.diff(vals)
    bad = (d > 1e-9).any() if ev.lower_better else (d < -1e-9).any()
    if bad:
        viol.append((e, s, a))
report["monotonic_violations"] = viol

# 2. smoothness across age: year-over-year relative change at P10/P50/P90
smooth_flags = []
for ev in EVENTS:
    for sex in SEXES:
        for p in (10, 50, 90):
            sub = anchors[(anchors.event == ev.key) & (anchors.sex == sex) & (anchors.percentile == p)]
            v = sub.sort_values("age")["raw_result"].to_numpy(dtype=float)
            ref_scale = float(anchors[(anchors.event==ev.key)&(anchors.sex==sex)&(anchors.percentile==50)&(anchors.age==25)].raw_result.iloc[0])
            ages = sub.sort_values("age")["age"].to_numpy()
            with np.errstate(divide="ignore", invalid="ignore"):
                rel = np.abs(np.diff(v)) / np.maximum(np.abs(v[:-1]), 1e-9)
            for i, r in enumerate(rel):
                # discrete events: a 1-unit step is inherent; flag only >1 unit steps
                if ev.discrete:
                    if abs(v[i + 1] - v[i]) > (1.0 if ev.key != "sit_to_rise" else 0.5) + 1e-9:
                        smooth_flags.append((ev.key, sex, p, int(ages[i]), float(v[i]), float(v[i + 1])))
                else:
                    floorish = (v[i] in (0.0, lg.MILE_CAP_S, lg.AG_DNF, lg.BAL_CAP)) or \
                               (v[i + 1] in (0.0, lg.MILE_CAP_S, lg.AG_DNF, lg.BAL_CAP))
                    if r > 0.08 and abs(v[i+1]-v[i]) > 0.03*abs(ref_scale) and not floorish:
                        smooth_flags.append((ev.key, sex, p, int(ages[i]), float(v[i]), float(v[i + 1])))
report["smoothness_flags"] = smooth_flags

# 3. round-trip percentile(quantile(p)) at test ages
rt = []
for ev in EVENTS:
    for sex in SEXES:
        for age in TEST_AGES:
            for p in (10, 50, 90):
                raw = ev.quantile(sex, age, p)
                back = ev.percentile(sex, age, raw)
                rt.append(dict(event=ev.key, sex=sex, age=age, percentile=p, raw=raw, back=round(back, 1)))
rt = pd.DataFrame(rt)
report["roundtrip_max_abs_error_excluding_floor_ceiling"] = float(
    (rt[~rt.raw.isin([0.0, lg.MILE_CAP_S, lg.AG_DNF, lg.BAL_CAP, 10.0])]
       .assign(err=lambda d: (d.back - d.percentile).abs()).err.max()))

# 4. zero pull-up / push-up cases
zero = []
for ev in [e for e in EVENTS if e.key in ("pull_ups", "push_ups")]:
    for sex in SEXES:
        for age in TEST_AGES:
            p0 = ev.cdf(sex, age, 0)
            zero.append(dict(event=ev.key, sex=sex, age=age, share_zero=round(100 * p0, 1),
                             pct_for_0_midrank=round(ev.percentile(sex, age, 0), 1),
                             pct_for_1_midrank=round(ev.percentile(sex, age, 1), 1),
                             pct_for_1_strict=round(ev.percentile(sex, age, 1, "strict"), 1)))
zero = pd.DataFrame(zero)

# 5. reference values table (test ages)
ref = anchors[anchors.age.isin(TEST_AGES) & anchors.percentile.isin([5, 10, 25, 50, 75, 90, 95])]
ref = ref.pivot_table(index=["event", "unit", "sex", "age"], columns="percentile", values="raw_result").reset_index()
ref.columns = [str(c) if not isinstance(c, str) else c for c in ref.columns]
ref.to_csv(f"{OUT}/long_game_validation_reference_v{VERSION}.csv", index=False)

# 6. parameters json
params = dict(
    version=VERSION, generated="2026-09-10",
    age_smoothing="PCHIP (shape-preserving cubic Hermite) through knots; flat beyond end knots",
    events=dict(
        mile_run=dict(vo2_mu=lg.VO2_MU, vo2_sd_lo=lg.VO2_SD_LO, vo2_sd_hi=lg.VO2_SD_HI, low_tail_widening='sd_lo x (1+0.5*clip((age-60)/25,0,1))', pop_adj=lg.POP_ADJ_VO2, cap_s=lg.MILE_CAP_S,
                      conversion="ACSM running eq (0.2v+3.5); walking 0.1v+3.5+0.004*max(0,v-70)^2; f=clip(1.08-0.011*T_min,0.80,1.05)"),
        pull_ups=dict(pi0=lg.PULLUP_PI0, med_pos=lg.PULLUP_MED_POS, sig_pos=lg.PULLUP_SIG, cap=40),
        push_ups=dict(pi0=lg.PUSHUP_PI0, med_pos=lg.PUSHUP_MED_POS, sig_pos=lg.PUSHUP_SIG, cap=120),
        broad_jump=dict(pi0=lg.BJ_PI0, median=lg.BJ_MED, log_sd=lg.BJ_SIG),
        farmer_carry=dict(grip_median=lg.GRIP_MED, grip_sd=lg.GRIP_SD, speed_mps=lg.CARRY_SPEED,
                          load_kg_per_hand=lg.CARRY_LOAD_KG, handle_factor=lg.HANDLE_FACTOR,
                          dynamic_factor=lg.DYNAMIC_FACTOR, cap_s=lg.CARRY_CAP_S,
                          endurance="Rohmert: t_min = -1.5 + 2.1/f - 0.6/f^2 + 0.1/f^3, f = load/(handle_factor*grip)"),
        pro_agility_5_10_5=dict(pi0=lg.AG_PI0, median=lg.AG_MED, log_sd=lg.AG_SIG, dnf_value=lg.AG_DNF),
        single_leg_balance_ec=dict(median=lg.BAL_MED, log_sd=lg.BAL_SIG, cap_s=lg.BAL_CAP),
        sit_to_rise=dict(latent_mu=lg.SRT_MU, latent_sd=lg.SRT_SD, rounding="nearest 0.5, clamp 0-10"),
    ),
)
with open(f"{OUT}/long_game_parameters_v{VERSION}.json", "w") as f:
    json.dump(params, f, indent=1, default=lambda o: {str(k): v for k, v in o.items()} if isinstance(o, dict) else str(o))

# 7. xlsx (data workbook, no formulas)
with pd.ExcelWriter(f"{OUT}/long_game_benchmarks_v{VERSION}.xlsx", engine="openpyxl") as xw:
    readme = pd.DataFrame({"README": [
        f"The Long Game population benchmarks v{VERSION} (2026-09-10).",
        "Sheet 'anchors': raw result at percentile p for every event, sex, age 18-89. For time events (mile_run, pro_agility_5_10_5) higher percentile = faster.",
        "Sheet 'discrete_cdf': full integer/half-point distributions for pull_ups, push_ups, sit_to_rise. Use percentile_midrank = 100*(P(X<x)+0.5*P(X=x)) to score a result.",
        "Sheet 'validation_reference': spot-check values at ages 25/40/55/70/85.",
        "derivation_type: observed = age band and percentile range directly covered by the primary source (smoothed); interpolated = between source age bands; extrapolated = outside source age range; modeled = built from proxy evidence or a conversion chain.",
        "Evidence grades: A strong direct normative evidence; B good evidence with protocol/population mismatch; C substantial interpolation or proxy evidence; D highly provisional / model-based.",
        "Floors and ceilings: mile_run 1800 s = 30:00 cap or unable; pro_agility 30 s = unable/DNF; broad_jump/farmer_carry 0 = unable; single_leg_balance 60 s = cap; sit_to_rise 10 = max.",
        "Store benchmark_version with every user result. Never rescore historical results under a new version without telling the user.",
        "Generated by long_game_benchmarks.py; all parameters in long_game_parameters.json. See methodology report for sources.",
    ]})
    readme.to_excel(xw, sheet_name="README", index=False)
    anchors.to_excel(xw, sheet_name="anchors", index=False)
    cdf.to_excel(xw, sheet_name="discrete_cdf", index=False)
    ref.to_excel(xw, sheet_name="validation_reference", index=False)


# ---------------------------------------------------------------- lookup JSON (what the app ships)
# One quantile per integer percentile for the continuous events; a raw-value
# grid plus the CDF at each point for the discrete ones. Floors and ceilings
# are declared so the scorer can mid-rank the tied groups. Grades and
# derivation labels ride along so the UI never has to guess them.
ALL_PCTS = list(range(1, 100))
# Stored grid for the count events. Beyond it the scorer treats everyone as one
# tied group; the CDF is within 1e-5 of 1 by then for every age.
GRID_CAP = {"pull_ups": 30, "push_ups": 60}
FLOORS = {"mile_run": lg.MILE_CAP_S, "pro_agility_5_10_5": lg.AG_DNF, "broad_jump": 0.0, "farmer_carry": 0.0}
CEILINGS = {"single_leg_balance_ec": lg.BAL_CAP, "sit_to_rise": 10.0}

lookup = dict(
    version=VERSION, generated="2026-09-10", percentiles=ALL_PCTS,
    age_min=int(AGES[0]), age_max=int(AGES[-1]), convention="midrank", events={},
)
for ev in EVENTS:
    entry = dict(
        unit=ev.unit, lower_better=ev.lower_better, discrete=ev.discrete,
        grade={s: grade_of(ev, s) for s in SEXES},
        floor=FLOORS.get(ev.key), ceiling=CEILINGS.get(ev.key),
        derivation={s: {str(int(a)): ev.label(s, int(a)) for a in AGES} for s in SEXES},
    )
    if ev.discrete:
        grid = lg.SRT_SCORES if ev.key == "sit_to_rise" else list(range(0, GRID_CAP[ev.key] + 1))
        entry["grid"] = grid
        entry["cdf"] = {s: {str(int(a)): [round(float(ev.cdf(s, int(a), k)), 5) for k in grid] for a in AGES}
                        for s in SEXES}
    else:
        entry["q"] = {s: {str(int(a)): [round(float(ev.quantile(s, int(a), p)), 2) for p in ALL_PCTS] for a in AGES}
                      for s in SEXES}
    lookup["events"][ev.key] = entry
with open(OUT / f"long_game_lookup_v{VERSION}.json", "w") as f:
    json.dump(lookup, f)
print("lookup:", OUT / f"long_game_lookup_v{VERSION}.json")

pd.set_option("display.width", 200, "display.max_columns", 20, "display.max_rows", 500)
print("rows anchors:", len(anchors), "rows cdf:", len(cdf))
print("monotonic violations:", len(viol), viol[:10])
print("smoothness flags:", len(smooth_flags))
for f in smooth_flags[:40]:
    print("  ", f)
print("roundtrip max abs err:", report["roundtrip_max_abs_error_excluding_floor_ceiling"])
print("\nZERO CASES\n", zero.to_string(index=False))
print("\nREFERENCE VALUES\n", ref.to_string(index=False))
