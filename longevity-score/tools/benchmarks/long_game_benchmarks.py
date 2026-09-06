"""
The Long Game - population benchmark model, v1.0.0 (2026-09-06)

Generates age- and sex-specific percentile benchmarks for eight events,
ages 18-89, men and women. Every event is built from (a) smooth age curves
for distribution parameters, fitted through knots taken from the sources
listed in the methodology report, and (b) a distribution family chosen for
the shape of the raw measure.

Age smoothing: shape-preserving piecewise cubic Hermite interpolation
(PCHIP) through the knots. PCHIP is monotone between knots and does not
overshoot, so no age-related bumps are introduced that were not in the
knots. Beyond the last data-backed knot, extrapolation knots are placed by
hand using declared decline assumptions (documented per event), so the
extrapolation is explicit, conservative and reviewable rather than a
polynomial tail.

Derivation labels are assigned per (event, sex, age) from the source age
range of each event, not from the percentile, except where stated.
"""
from __future__ import annotations

import numpy as np
from scipy.interpolate import PchipInterpolator
from scipy.stats import norm

VERSION = "1.0.0"
AGES = np.arange(18, 90)
PCTS = [1, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 99]
SEXES = ["M", "F"]

# ----------------------------------------------------------------------
# helpers
# ----------------------------------------------------------------------

def curve(knots: dict[int, float]):
    """PCHIP through {age: value}; flat beyond the first/last knot."""
    xs = np.array(sorted(knots))
    ys = np.array([knots[x] for x in xs], dtype=float)
    f = PchipInterpolator(xs, ys, extrapolate=False)

    def g(age):
        a = np.clip(np.asarray(age, dtype=float), xs[0], xs[-1])
        return float(f(a)) if np.ndim(a) == 0 else f(a)

    return g


def label_by_age(age: int, observed: tuple[int, int] | None, modeled_all: bool = False,
                 observed_points: tuple[int, ...] = ()):
    """observed / interpolated / extrapolated / modeled per age."""
    if modeled_all:
        return "modeled"
    if observed is None:
        return "modeled"
    lo, hi = observed
    if age in observed_points:
        return "observed"
    if lo <= age <= hi:
        return "interpolated"
    return "extrapolated"


# ======================================================================
# EVENT 1: 1-mile run (seconds, lower is better)
# ======================================================================
# VO2max reference distribution: FRIEND registry (Kaminsky et al. 2015,
# Mayo Clin Proc; treadmill CPX, US, 20-79 y). Decade medians published:
# men 48.0 -> 24.4, women 37.6 -> 18.3 (20s -> 70s). Intermediate decade
# values and spreads follow the published tables (see report). FRIEND
# participants are lab-tested volunteers without CVD; a population
# adjustment factor of 0.93 is applied to shift toward the general
# population (NHANES 1999-2004 estimated VO2max ran roughly 5-10% below).
POP_ADJ_VO2 = 0.95

# Two-piece normal on VO2max: separate spread below (sd_lo) and above (sd_hi)
# the median, so published P5 / P50 / P95 are matched directly rather than
# forced into a symmetric shape. Values transcribed from Kaminsky et al. 2015
# Table (verify against the source before release). 80+ extrapolated.
VO2_MU = {
    "M": {18: 48.0, 25: 48.0, 35: 42.4, 45: 37.8, 55: 32.6, 65: 28.2, 75: 24.4, 85: 19.5, 89: 17.8},
    "F": {18: 37.6, 25: 37.6, 35: 30.2, 45: 26.7, 55: 23.4, 65: 20.0, 75: 18.3, 85: 15.2, 89: 14.0},
}
VO2_SD_LO = {  # (P50-P5)/1.645
    "M": {18: 11.6, 25: 11.6, 35: 9.2, 45: 8.3, 55: 7.1, 65: 6.6, 75: 4.9, 85: 4.2, 89: 4.0},
    "F": {18: 9.7, 25: 9.7, 35: 6.8, 45: 5.9, 55: 4.5, 65: 4.0, 75: 3.2, 85: 2.9, 89: 2.8},
}
VO2_SD_HI = {  # (P95-P50)/1.645
    "M": {18: 11.1, 25: 11.1, 35: 10.6, 45: 10.8, 55: 11.0, 65: 9.0, 75: 9.3, 85: 7.5, 89: 7.0},
    "F": {18: 11.2, 25: 11.2, 35: 9.5, 45: 9.1, 55: 7.6, 65: 5.7, 75: 3.5, 85: 3.0, 89: 2.8},
}


def low_tail_widening(age: float) -> float:
    """FRIEND excludes people unable to complete a maximal treadmill test, so its
    lower tail is too thin for a general population at older ages. sd_lo is
    inflated linearly from x1.0 at 60 to x1.5 at 85+."""
    return 1.0 + 0.5 * float(np.clip((age - 60.0) / 25.0, 0.0, 1.0))


MILE_M = 1609.344
MILE_CAP_S = 1800.0  # 30:00 cap; slower or unable = floor (censored)


def _speed_from_vo2(vo2_avail: float) -> float:
    """Sustainable speed (m/min) from available VO2 (ml/kg/min).

    Running: ACSM  VO2 = 0.2 v + 3.5.
    Walking: ACSM  VO2 = 0.1 v + 3.5 plus a quadratic penalty above 70 m/min
             (0.004 (v-70)^2) so fast walking costs more than the linear
             equation implies; this makes walk/run cross over near 120 m/min.
    The person is assumed to use whichever gait is faster.
    """
    v_run = max(0.0, (vo2_avail - 3.5) / 0.2)
    # walking: solve 0.1 v + 3.5 + 0.004 max(0, v-70)^2 = vo2 by bisection
    lo, hi = 0.0, 200.0
    for _ in range(60):
        mid = 0.5 * (lo + hi)
        cost = 0.1 * mid + 3.5 + 0.004 * max(0.0, mid - 70.0) ** 2
        if cost < vo2_avail:
            lo = mid
        else:
            hi = mid
    v_walk = lo
    return max(v_run, v_walk)


def mile_time_from_vo2(vo2max: float) -> float:
    """1-mile time (s) from VO2max; iterates on the fraction of VO2max
    sustainable for the event duration: f = clip(1.08 - 0.011*T_min, 0.80, 1.05)."""
    f = 0.95
    t_min = 8.0
    for _ in range(12):
        v = _speed_from_vo2(f * vo2max)
        if v < 40.0:  # below ~2.4 km/h: treated as unable to complete
            return MILE_CAP_S
        t_min = MILE_M / v  # v in m/min -> minutes
        f = float(np.clip(1.08 - 0.011 * t_min, 0.80, 1.05))
    return min(MILE_CAP_S, t_min * 60.0)


class MileRun:
    key, unit, lower_better, discrete = "mile_run", "seconds", True, False
    grade = "C"
    observed_range = None  # proxy chain -> modeled at every age

    def __init__(self):
        self.mu = {s: curve(VO2_MU[s]) for s in SEXES}
        self.sd_lo = {s: curve(VO2_SD_LO[s]) for s in SEXES}
        self.sd_hi = {s: curve(VO2_SD_HI[s]) for s in SEXES}

    def vo2_quantile(self, sex, age, p):
        z = norm.ppf(p)
        sd = self.sd_lo[sex](age) * low_tail_widening(age) if z < 0 else self.sd_hi[sex](age)
        return POP_ADJ_VO2 * (self.mu[sex](age) + z * sd)

    def quantile(self, sex, age, p):
        """raw result at population percentile p (0-100). Higher p = faster."""
        vo2 = self.vo2_quantile(sex, age, p / 100.0)
        return mile_time_from_vo2(max(vo2, 1.0))

    def percentile(self, sex, age, raw):
        """percentile (0-100) for a time in seconds; DNF -> raw >= cap."""
        if raw >= MILE_CAP_S:
            # share of population at/beyond the cap, mid-rank convention
            p_cap = self._p_cap(sex, age)
            return 100.0 * 0.5 * p_cap
        # invert monotone mapping by bisection on percentile
        lo, hi = 0.0, 100.0
        for _ in range(50):
            mid = 0.5 * (lo + hi)
            if self.quantile(sex, age, mid) > raw:
                lo = mid
            else:
                hi = mid
        return 0.5 * (lo + hi)

    def _p_cap(self, sex, age):
        lo, hi = 0.0, 100.0
        for _ in range(50):
            mid = 0.5 * (lo + hi)
            if self.quantile(sex, age, mid) >= MILE_CAP_S:
                lo = mid
            else:
                hi = mid
        return 0.5 * (lo + hi) / 100.0

    def label(self, sex, age):
        return "modeled"


# ======================================================================
# Hurdle (zero-inflated) count model shared by pull-ups and push-ups
# ======================================================================

class HurdleCount:
    """P(X=0) = pi0(age); X | X>0 = max(1, round(LogNormal(mu(age), sigma(age)))).

    CDF(k) = pi0 + (1-pi0) * P(Y < k + 0.5), k >= 1.
    """
    discrete = True
    lower_better = False

    def __init__(self, pi0, med_pos, sig_pos, cap):
        self.pi0 = {s: curve(pi0[s]) for s in SEXES}
        self.med = {s: curve(med_pos[s]) for s in SEXES}
        self.sig = {s: curve(sig_pos[s]) for s in SEXES}
        self.cap = cap

    def cdf(self, sex, age, k):
        """P(X <= k)"""
        k = int(k)
        if k < 0:
            return 0.0
        p0 = self.pi0[sex](age)
        if k == 0:
            return p0
        if k >= self.cap:
            return 1.0
        mu, sg = np.log(self.med[sex](age)), self.sig[sex](age)
        return p0 + (1 - p0) * norm.cdf((np.log(k + 0.5) - mu) / sg)

    def pmf(self, sex, age, k):
        return self.cdf(sex, age, k) - self.cdf(sex, age, k - 1)

    def quantile(self, sex, age, p):
        """smallest integer k with CDF(k) >= p/100"""
        target = p / 100.0
        for k in range(0, self.cap + 1):
            if self.cdf(sex, age, k) >= target - 1e-12:
                return k
        return self.cap

    def percentile(self, sex, age, raw, convention="midrank"):
        k = int(raw)
        below = self.cdf(sex, age, k - 1)
        at = self.pmf(sex, age, k)
        if convention == "midrank":
            return 100.0 * (below + 0.5 * at)
        if convention == "strict":
            return 100.0 * below
        return 100.0 * (below + at)  # "weak"


# --- Pull-ups ---------------------------------------------------------
# No adult general-population norms exist. Anchors are triangulated from
# (i) NCYFS / Presidential Fitness Test school norms at age 17 (boys median
# ~7-8, girls median 0 with ~60-70% zeros), (ii) military entry data (fitter
# than population), (iii) crowd-sourced training logs (Strength Level,
# far fitter than population), and (iv) the fall in relative upper-body
# strength and rise in body mass through adulthood. All values are
# assumptions; see report. Least trustworthy: male pi0 at ages 20-45.
PULLUP_PI0 = {
    "M": {18: 0.28, 20: 0.30, 30: 0.36, 40: 0.44, 50: 0.53, 60: 0.63, 70: 0.76, 80: 0.88, 89: 0.94},
    "F": {18: 0.78, 20: 0.80, 30: 0.83, 40: 0.87, 50: 0.91, 60: 0.95, 70: 0.975, 80: 0.99, 89: 0.995},
}
PULLUP_MED_POS = {  # median reps among those who can do >= 1
    "M": {18: 6.0, 20: 6.0, 30: 5.5, 40: 5.0, 50: 4.2, 60: 3.5, 70: 3.0, 80: 2.5, 89: 2.0},
    "F": {18: 2.5, 20: 2.5, 30: 2.3, 40: 2.0, 50: 1.8, 60: 1.6, 70: 1.5, 80: 1.4, 89: 1.3},
}
PULLUP_SIG = {"M": {18: 0.65, 89: 0.65}, "F": {18: 0.60, 89: 0.60}}


class PullUps(HurdleCount):
    key, unit, grade = "pull_ups", "reps", "D"

    def __init__(self):
        super().__init__(PULLUP_PI0, PULLUP_MED_POS, PULLUP_SIG, cap=40)

    def label(self, sex, age):
        return "modeled"


# --- Push-ups (2 min, strict) -----------------------------------------
# Men: CSEP/CPAFLA norms from the Canada Fitness Survey (1981, n~15,000,
# ages 15-69; push-ups to exhaustion, no time limit). Category cut-points
# (needs improvement / fair / good / very good / excellent) sit at ~P20,
# P40, P60, P80. Conditional (X>0) medians and log-SDs derived from those
# cut-points; a small zero share added (CSEP reports counts, not zero
# frequency). 70+ extrapolated. Women: CSEP women's norms are for the
# modified (knee) push-up; converted to strict using a 0.45 rep ratio and an
# added zero share (see report) -> labelled modeled.
PUSHUP_PI0 = {
    "M": {18: 0.02, 25: 0.02, 35: 0.03, 45: 0.04, 55: 0.06, 65: 0.09, 75: 0.18, 85: 0.35, 89: 0.45},
    "F": {18: 0.20, 25: 0.20, 35: 0.25, 45: 0.32, 55: 0.45, 65: 0.58, 75: 0.75, 85: 0.90, 89: 0.93},
}
PUSHUP_MED_POS = {
    "M": {18: 26.0, 25: 25.5, 35: 19.5, 45: 14.8, 55: 11.3, 65: 9.2, 75: 6.5, 85: 4.5, 89: 3.5},
    "F": {18: 9.5, 25: 9.0, 35: 8.0, 45: 6.5, 55: 5.0, 65: 4.5, 75: 3.5, 85: 3.0, 89: 2.5},
}
PUSHUP_SIG = {
    "M": {18: 0.46, 25: 0.46, 35: 0.56, 45: 0.56, 55: 0.68, 65: 0.78, 75: 0.80, 89: 0.80},
    "F": {18: 0.62, 25: 0.62, 35: 0.66, 45: 0.72, 55: 0.78, 65: 0.80, 75: 0.80, 89: 0.80},
}


class PushUps(HurdleCount):
    key, unit = "push_ups", "reps"
    grade = "B"  # men B, women C (see grade_for)

    def __init__(self):
        super().__init__(PUSHUP_PI0, PUSHUP_MED_POS, PUSHUP_SIG, cap=120)

    def grade_for(self, sex):
        return "B" if sex == "M" else "C"

    def label(self, sex, age):
        if sex == "F":
            return "modeled"
        return label_by_age(age, (18, 69), observed_points=(25, 35, 45, 55, 65))


# ======================================================================
# Hurdle + lognormal continuous model (broad jump, agility)
# ======================================================================

class HurdleLogNormal:
    """P(result = floor) = pi0(age)  (unable to perform);
    otherwise LogNormal(log median(age), sigma(age))."""
    discrete = False

    def __init__(self, pi0, med, sig, lower_better, floor_value, cap=None):
        self.pi0 = {s: curve(pi0[s]) for s in SEXES}
        self.med = {s: curve(med[s]) for s in SEXES}
        self.sig = {s: curve(sig[s]) for s in SEXES}
        self.lower_better = lower_better
        self.floor_value = floor_value
        self.cap = cap

    def quantile(self, sex, age, p):
        """raw result at population percentile p (higher p = better)."""
        q = p / 100.0
        p0 = self.pi0[sex](age)
        if q <= p0:
            return self.floor_value
        qq = (q - p0) / (1 - p0)  # quantile within the able group
        z = norm.ppf(qq)
        if self.lower_better:
            z = -z
        val = self.med[sex](age) * np.exp(z * self.sig[sex](age))
        if self.cap is not None:
            val = min(val, self.cap) if not self.lower_better else max(val, self.cap)
        return float(val)

    def percentile(self, sex, age, raw):
        p0 = self.pi0[sex](age)
        if raw == self.floor_value or (self.lower_better and raw >= self.floor_value) \
           or (not self.lower_better and raw <= 0):
            return 100.0 * 0.5 * p0
        z = (np.log(raw) - np.log(self.med[sex](age))) / self.sig[sex](age)
        if self.lower_better:
            z = -z
        return 100.0 * (p0 + (1 - p0) * norm.cdf(z))


# --- Standing broad jump (cm) -----------------------------------------
# Korea National Physical Fitness Survey 2017 (KSPO; nationally
# representative; n=3,763 aged 20-59; SLJ means by 2-year age lumps).
# Means: men 224 cm at 20.5 -> 175 at 58.5 (SD ~22-28); women 158 -> 124
# (SD ~17-30). No adult broad-jump norms exist beyond ~60; 60-89
# extrapolated with an accelerating decline consistent with force-plate
# jump-power decline (CHMS vertical jump 20-69; China National Health Survey
# vertical jump 8-80, where the 5th percentile reaches 0 by 70-80) and a
# growing share unable/unsafe to jump.
BJ_MED = {
    "M": {18: 225, 20: 224, 25: 216, 30: 213, 35: 205, 40: 201, 45: 197, 50: 189, 55: 181, 59: 175,
          65: 160, 70: 143, 75: 125, 80: 105, 85: 88, 89: 78},
    "F": {18: 158, 20: 158, 25: 153, 30: 150, 35: 147, 40: 145, 45: 142, 50: 136, 55: 130, 59: 124,
          65: 112, 70: 100, 75: 87, 80: 73, 85: 60, 89: 53},
}
BJ_SIG = {  # log-SD ~ CV; Korean SDs give CV 0.11-0.13 (men), 0.14-0.17 (women)
    "M": {18: 0.12, 40: 0.12, 59: 0.13, 70: 0.17, 80: 0.22, 89: 0.26},
    "F": {18: 0.15, 40: 0.15, 59: 0.16, 70: 0.19, 80: 0.24, 89: 0.28},
}
BJ_PI0 = {  # unable / unsafe to attempt -> recorded 0
    "M": {18: 0.0, 60: 0.0, 65: 0.03, 70: 0.06, 75: 0.12, 80: 0.20, 85: 0.32, 89: 0.42},
    "F": {18: 0.0, 60: 0.0, 65: 0.04, 70: 0.08, 75: 0.15, 80: 0.25, 85: 0.38, 89: 0.48},
}


class BroadJump(HurdleLogNormal):
    key, unit, grade = "broad_jump", "cm", "C"

    def __init__(self):
        super().__init__(BJ_PI0, BJ_MED, BJ_SIG, lower_better=False, floor_value=0.0)

    def label(self, sex, age):
        return label_by_age(age, (20, 59), observed_points=tuple(range(20, 60, 2)))


# --- 5-10-5 pro agility (s) -------------------------------------------
# No general-population norms. Young-adult anchors assumed from
# recreationally active college samples (men ~4.9-5.1 s, women ~5.6-5.9 s),
# shifted ~0.1-0.2 s slower for a general population. Age shape follows the
# Korean 10-m shuttle run (same survey as above: men +12% by 40, +17% by 50,
# +25% by 58; women +9%, +14%, +17%) and, past 60, Timed-Up-and-Go norms
# (Bohannon 2006 meta: 8.1 s at 60-69, 9.2 s at 70-79, 11.3 s at 80-99).
AG_MED = {
    "M": {18: 5.05, 20: 5.05, 25: 5.10, 30: 5.20, 35: 5.32, 40: 5.45, 45: 5.62, 50: 5.82, 55: 6.05,
          60: 6.35, 65: 6.75, 70: 7.30, 75: 8.00, 80: 9.00, 85: 10.3, 89: 11.6},
    "F": {18: 5.75, 20: 5.75, 25: 5.80, 30: 5.90, 35: 6.02, 40: 6.15, 45: 6.32, 50: 6.55, 55: 6.80,
          60: 7.15, 65: 7.60, 70: 8.20, 75: 9.00, 80: 10.1, 85: 11.5, 89: 12.9},
}
AG_SIG = {"M": {18: 0.09, 50: 0.11, 70: 0.16, 85: 0.22, 89: 0.24},
          "F": {18: 0.09, 50: 0.11, 70: 0.16, 85: 0.22, 89: 0.24}}
AG_PI0 = {"M": {18: 0.0, 60: 0.0, 65: 0.02, 70: 0.05, 75: 0.10, 80: 0.18, 85: 0.30, 89: 0.40},
          "F": {18: 0.0, 60: 0.0, 65: 0.03, 70: 0.06, 75: 0.12, 80: 0.22, 85: 0.35, 89: 0.45}}
AG_DNF = 30.0  # recorded value for unable / did not finish


class Agility(HurdleLogNormal):
    key, unit, grade = "pro_agility_5_10_5", "seconds", "D"

    def __init__(self):
        super().__init__(AG_PI0, AG_MED, AG_SIG, lower_better=True, floor_value=AG_DNF)

    def label(self, sex, age):
        return "modeled"


# ======================================================================
# EVENT 5: Farmer carry (m) - provisional grip-strength-based model
# ======================================================================
# Grip strength centiles: Dodds et al. 2014 (PLOS ONE; 12 British general-
# population studies, n=49,964, ages 4-90). Peak mean 51.9 (SD 9.9) kg men,
# 31.4 (SD 6.1) kg women at ~32 y; median plateau to ~45 then decline; ~23-27%
# below T-score -2.5 by age 80. NHANES 2011-14 US grip data are consistent.
GRIP_MED = {
    "M": {18: 46.0, 20: 47.0, 25: 50.0, 30: 51.0, 35: 51.0, 40: 51.0, 45: 50.0, 50: 48.0, 55: 46.0,
          60: 44.0, 65: 41.0, 70: 38.0, 75: 35.0, 80: 32.0, 85: 28.5, 89: 25.5},
    "F": {18: 28.5, 20: 29.0, 25: 30.5, 30: 31.0, 35: 31.0, 40: 31.0, 45: 30.0, 50: 29.0, 55: 27.5,
          60: 26.0, 65: 24.5, 70: 23.0, 75: 21.0, 80: 19.0, 85: 17.0, 89: 15.5},
}
GRIP_SD = {"M": {18: 9.5, 30: 9.9, 60: 9.5, 80: 8.5, 89: 8.0},
           "F": {18: 6.0, 30: 6.1, 60: 6.0, 80: 5.2, 89: 5.0}}
# Loaded fast-walk speed (m/s) assumed by age (deterministic; between-person
# variance enters through grip only). Anchored to fast-gait norms (Bohannon
# 1997: fast gait ~2.2-2.5 m/s young men unloaded; loaded carry ~70-75% of
# that) and the steep decline in fast gait after 70.
CARRY_SPEED = {"M": {18: 1.70, 40: 1.65, 55: 1.58, 65: 1.45, 75: 1.30, 85: 1.05, 89: 0.95},
               "F": {18: 1.60, 40: 1.55, 55: 1.48, 65: 1.35, 75: 1.20, 85: 0.95, 89: 0.85}}
CARRY_LOAD_KG = {"M": 22.68, "F": 15.88}  # per hand (50 lb / 35 lb)
HANDLE_FACTOR = 1.30   # holding capacity on a handle vs dynamometer MVC (assumption)
DYNAMIC_FACTOR = 0.80  # static endurance -> walking carry endurance (assumption)
CARRY_CAP_S = 180.0


def rohmert_minutes(f: float) -> float:
    """Rohmert static endurance curve, minutes, f = fraction of MVC (0.15-1)."""
    if f >= 1.0:
        return 0.0
    f = max(f, 0.15)
    return max(0.0, -1.5 + 2.1 / f - 0.6 / f**2 + 0.1 / f**3)


class FarmerCarry:
    key, unit, lower_better, discrete, grade = "farmer_carry", "meters", False, False, "D"

    def __init__(self):
        self.gmed = {s: curve(GRIP_MED[s]) for s in SEXES}
        self.gsd = {s: curve(GRIP_SD[s]) for s in SEXES}
        self.speed = {s: curve(CARRY_SPEED[s]) for s in SEXES}

    def grip_quantile(self, sex, age, q):
        return max(1.0, self.gmed[sex](age) + norm.ppf(q) * self.gsd[sex](age))

    def distance_from_grip(self, sex, age, grip_kg):
        f = CARRY_LOAD_KG[sex] / (HANDLE_FACTOR * grip_kg)
        if f >= 1.0:
            return 0.0
        hold_s = rohmert_minutes(f) * 60.0 * DYNAMIC_FACTOR
        return self.speed[sex](age) * min(hold_s, CARRY_CAP_S)

    def quantile(self, sex, age, p):
        return self.distance_from_grip(sex, age, self.grip_quantile(sex, age, p / 100.0))

    def percentile(self, sex, age, raw):
        # invert monotone distance(grip) by bisection on percentile
        if raw <= 0:
            p0 = self._p_zero(sex, age)
            return 100.0 * 0.5 * p0
        lo, hi = 0.0, 100.0
        for _ in range(50):
            mid = 0.5 * (lo + hi)
            if self.quantile(sex, age, mid) < raw:
                lo = mid
            else:
                hi = mid
        return 0.5 * (lo + hi)

    def _p_zero(self, sex, age):
        lo, hi = 0.0, 100.0
        for _ in range(50):
            mid = 0.5 * (lo + hi)
            if self.quantile(sex, age, mid) <= 0:
                lo = mid
            else:
                hi = mid
        return 0.5 * (lo + hi) / 100.0

    def label(self, sex, age):
        return "modeled"


# ======================================================================
# EVENT 7: Eyes-closed single-leg balance (s, cap 60)
# ======================================================================
# Bohannon et al. 1984 (Phys Ther; n=184, 20-79; eyes closed, 30-s cap,
# lenient failure criteria): decade means 28.8, 27.8, 24.2, 21.0, 10.2,
# 4.3 s. Springer et al. 2007 (J Geriatr Phys Ther; n=549, 18-99; 45-s cap,
# arms crossed, strict criteria): 13.1/16.9 (F/M) at 18-39, 13.5/12.0 at
# 40-49, 7.9/8.6 at 50-59, 3.6/5.1 at 60-69, 3.7/2.6 at 70-79, 2.1/1.8 at
# 80+. Protocol strictness changes results ~2x. The Long Game protocol
# (hands free, feet may not touch, 60-s cap, best of 2) is closer to
# Bohannon, so medians lean toward Bohannon with Springer as the strict
# bound. No sex effect in either study.
BAL_MED = {s: {18: 28, 25: 28, 30: 27, 35: 25.5, 40: 23.5, 45: 21, 50: 17.5, 55: 13.5, 60: 10,
               65: 7.5, 70: 5.5, 75: 4.2, 80: 3.2, 85: 2.5, 89: 2.0} for s in SEXES}
BAL_SIG = {s: {18: 0.70, 50: 0.70, 70: 0.68, 89: 0.65} for s in SEXES}
BAL_CAP = 60.0


class Balance:
    key, unit, lower_better, discrete, grade = "single_leg_balance_ec", "seconds", False, False, "B"

    def __init__(self):
        self.med = {s: curve(BAL_MED[s]) for s in SEXES}
        self.sig = {s: curve(BAL_SIG[s]) for s in SEXES}

    def quantile(self, sex, age, p):
        z = norm.ppf(p / 100.0)
        return float(min(BAL_CAP, self.med[sex](age) * np.exp(z * self.sig[sex](age))))

    def percentile(self, sex, age, raw):
        if raw >= BAL_CAP:
            p_cap = 1 - norm.cdf((np.log(BAL_CAP) - np.log(self.med[sex](age))) / self.sig[sex](age))
            return 100.0 * (1 - p_cap + 0.5 * p_cap)  # mid-rank within the ceiling group
        raw = max(raw, 0.3)
        return 100.0 * norm.cdf((np.log(raw) - np.log(self.med[sex](age))) / self.sig[sex](age))

    def label(self, sex, age):
        return label_by_age(age, (20, 79), observed_points=(25, 35, 45, 55, 65, 75))


# ======================================================================
# EVENT 8: Sit-to-rise (0-10, 0.5 steps)
# ======================================================================
# Araujo et al. 2020 (Eur J Prev Cardiol; n=6,141 adults, CLINIMEX Rio de
# Janeiro): sex- and age-reference scores; <8% of adults over 55 score a
# perfect 10. Brito et al. 2014 (n=2,002, 51-80). Latent normal capability
# rounded to 0.5 and clamped to [0,10]; ceiling mass at 10 arises naturally.
SRT_MU = {
    "M": {18: 9.7, 25: 9.65, 30: 9.5, 40: 9.1, 50: 8.5, 55: 8.1, 60: 7.6, 65: 7.0, 70: 6.3, 75: 5.5,
          80: 4.6, 85: 3.7, 89: 3.0},
    "F": {18: 9.7, 25: 9.65, 30: 9.5, 40: 9.0, 50: 8.3, 55: 7.9, 60: 7.4, 65: 6.8, 70: 6.1, 75: 5.3,
          80: 4.4, 85: 3.5, 89: 2.8},
}
SRT_SD = {s: {18: 1.0, 25: 1.05, 40: 1.3, 50: 1.5, 60: 1.7, 70: 2.0, 85: 2.2, 89: 2.2} for s in SEXES}
SRT_SCORES = [i / 2 for i in range(0, 21)]


class SitToRise:
    key, unit, lower_better, discrete, grade = "sit_to_rise", "score_0_10", False, True, "B"

    def __init__(self):
        self.mu = {s: curve(SRT_MU[s]) for s in SEXES}
        self.sd = {s: curve(SRT_SD[s]) for s in SEXES}

    def cdf(self, sex, age, score):
        """P(S <= score), score on 0.5 grid"""
        if score >= 10:
            return 1.0
        if score < 0:
            return 0.0
        return float(norm.cdf((score + 0.25 - self.mu[sex](age)) / self.sd[sex](age)))

    def pmf(self, sex, age, score):
        return self.cdf(sex, age, score) - self.cdf(sex, age, score - 0.5)

    def quantile(self, sex, age, p):
        target = p / 100.0
        for s in SRT_SCORES:
            if self.cdf(sex, age, s) >= target - 1e-12:
                return s
        return 10.0

    def percentile(self, sex, age, raw, convention="midrank"):
        s = round(raw * 2) / 2
        below = self.cdf(sex, age, s - 0.5)
        at = self.pmf(sex, age, s)
        if convention == "midrank":
            return 100.0 * (below + 0.5 * at)
        if convention == "strict":
            return 100.0 * below
        return 100.0 * (below + at)

    def label(self, sex, age):
        return label_by_age(age, (18, 89), observed_points=tuple(range(20, 90, 10)))


EVENTS = [MileRun(), PullUps(), PushUps(), BroadJump(), FarmerCarry(), Agility(), Balance(), SitToRise()]


def grade_of(ev, sex):
    return ev.grade_for(sex) if hasattr(ev, "grade_for") else ev.grade


# ======================================================================
# Scoring API
# ======================================================================
_EVENT_BY_KEY = {e.key: e for e in EVENTS}


def score_result(event_key: str, sex: str, age: int, raw: float, convention: str = "midrank") -> float:
    """Age- and sex-adjusted percentile score (0-100) for one raw result.

    Continuous events: 100 * F(raw) (time events use 1 - F, so faster = higher).
    Discrete events (pull_ups, push_ups, sit_to_rise): mid-rank by default,
    100 * (P(X < raw) + 0.5 * P(X = raw)). 'strict' gives 100 * P(X < raw).
    Floors/ceilings (DNF, 0 m, 60 s cap, 10/10) are scored mid-rank within the
    tied group.
    """
    age = int(np.clip(age, 18, 89))
    ev = _EVENT_BY_KEY[event_key]
    if ev.discrete:
        return float(np.clip(ev.percentile(sex, age, raw, convention), 0.0, 100.0))
    return float(np.clip(ev.percentile(sex, age, raw), 0.0, 100.0))


def overall_score(scores: dict[str, float]) -> float:
    """MVP Overall Longevity Score: arithmetic mean of the 8 event percentiles."""
    assert len(scores) == 8, "all eight events required"
    return float(np.mean(list(scores.values())))


if __name__ == "__main__":
    # worked example: woman age 74
    ex = dict(mile_run=1020, pull_ups=0, push_ups=3, broad_jump=95, farmer_carry=70,
              pro_agility_5_10_5=8.9, single_leg_balance_ec=6.0, sit_to_rise=7.0)
    sc = {k: round(score_result(k, "F", 74, v), 1) for k, v in ex.items()}
    print(sc, "overall", round(overall_score(sc), 1))
