# Re-norming plan

## Why this file exists

Six of the ten tests in `open-v1` have no adequate published normative table
for the population this app targets. Their norms are constructed curves. They
are labelled `provisional: true`, they carry a `provisional` tag everywhere a
percentile from them appears in the UI, and they are listed as provisional on
`/methodology`.

That is honest, but it is not good enough for long. This is how they get fixed.

## Current status

| Test | Status | What is trusted | What is not |
|---|---|---|---|
| Grip strength | Sourced | Mean and SD, both published | Hand transcription (see below) |
| Cooper 12-min run | Sourced | Percentiles published; conversion is a published equation | Decade → 5-year band interpolation |
| Push-ups | Provisional | Male cut-points, published and protocol-matched | Female values: converted from knee push-ups at 0.62 |
| Single-leg balance | Provisional | Means, published | SD inferred at 0.75 × mean; normal model fits a capped, skewed variable badly |
| Sit-rising test | Provisional | The test's mortality validity | Age-and-sex norms for 30-55 |
| Standing broad jump | Provisional | Decline rate from jump-power literature | The absolute anchor |
| 400m run | Provisional | Decline shape from Masters age-grading | The absolute anchor |
| Wall sit | Provisional | Nothing normative | Everything |
| Farmer carry | Provisional | Nothing normative | Everything |
| Dead hang | Provisional | Nothing normative | Everything, and it is confounded by bodyweight |

## The rule for `provisional: false`

A file is non-provisional only when **both the central tendency and the
dispersion** come from the cited source. If an SD was inferred, the file is
provisional and says so in `notes`. This is why single-leg balance is
provisional despite having published means.

## Re-fit policy

Re-fit a cohort from app data once it holds **30+ results**, quarterly.

1. **Pull** completed, witnessed results for the cohort. Witnessed only -
   in-session entries are supervised and self-reported ones are not.
2. **Trim** the top and bottom 2% before fitting. Farmer carry and dead hang
   have heavy right tails and one heroic outlier moves an SD a long way.
3. **Fit** a mean and SD per sex × 5-year band. Do not fit cut-points from app
   data; with n≈30 the tails are noise.
4. **Smooth** the means across adjacent age bands (3-band moving average)
   before writing them. Unsmoothed bands produce a score that jumps on a
   birthday, which users notice and do not forgive.
5. **Write** to `/data/norms/v2/<test_variant>.json` with
   `"population": "Longevity Score users, n=<count>, <date range>"` and
   `provisional: false` only once n ≥ 200 for that cohort.
6. **Do not delete v1.** Bump `norms_version`, recompute
   `battery_completions`, and keep the old rows. Users must be able to see
   that their score moved because the norms moved, not because they did.

## The self-selection problem, stated plainly

App users are fitter than the general population. Re-fitting from app data
makes the denominator harder and everyone's percentile drops. That is a
different denominator, not a better one - and the Longevity Score is
explicitly the *general population* denominator, because that is what carries
the health claim.

So: **re-fit norms are for the tests where no published general-population norm
exists at all** (dead hang, wall sit, farmer carry). For those, an app-derived
norm is better than a made-up one. Where a published general-population norm
does exist, keep it, even when app data is bigger and cleaner.

If we ever want a "vs. other users" denominator across the whole app, that is
the crew-rank concept scaled up, and it stays a separate number with a separate
name. It never becomes the Longevity Score.

## Priority order

1. **Dead hang** - most made-up, and confounded by bodyweight. When re-fitting,
   fit against bodyweight as a covariate or switch the protocol to a
   bodyweight-relative variant.
2. **Push-ups, female** - the 0.62 knee-to-full conversion is the single
   largest known distortion in the set, and it hits half the user base.
3. **Wall sit and farmer carry** - no norm at all. The carry now runs at a
   prescribed 50 lb per hand for men and 35 for women, so a raw re-fit works
   and needs no bodyweight covariate. Watch the oldest bands: at a fixed load they are zero-inflated
   the way pull-ups are, and a mean/SD model will misbehave there. Cut-points
   are the likely answer when there is enough app data to fit them.
4. **Single-leg balance** - does not need a new mean, needs a distribution that
   respects the 60-second cap. Consider fitting a truncated or beta model
   instead of forcing a normal.
5. **Sit-rising** - same problem at the 10-point ceiling.
6. **Broad jump and 400m** - anchors only; the decline shapes are sound.
