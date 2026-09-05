# Norms verification checklist

Every norms file currently carries `"transcription_verified": false`. This
file says exactly what that means and what has to happen before launch.

## What `transcription_verified: false` means

The numbers were entered against the cited source, and the shape of each
curve - where it peaks, how fast it declines, the size of the sex gap - matches
what the source reports. They have **not** been checked line by line against
the source PDF by a human holding the paper.

That distinction matters and it is not the same as `provisional`:

- `provisional: true` → the *approach* is uncertain. There is no adequate
  published norm, or a documented adjustment was applied.
- `transcription_verified: false` → the approach is fine, but nobody has
  proofread the digits.

A file can be non-provisional and unverified. Grip strength is exactly that.

## Before launch

For each file, one person with the source document open:

1. Open the cited paper or table.
2. Check every cohort row against the published value.
3. Confirm the protocol in `test_variants.protocol_md` matches the protocol the
   source used. A grip norm measured with the elbow extended does not transfer
   to one measured at 90 degrees.
4. Confirm the population statement is accurate and not flattering.
5. Set `"transcription_verified": true` and add your initials and the date to
   `notes`.

`npm run norms:validate` warns on every unverified file, so the warning count
is the to-do count. It is 10 today.

## Known protocol mismatches, already flagged

- **Push-ups, female**: source uses the knee push-up, this battery does not.
  Converted at 0.62. Flagged provisional.
- **Cooper**: source is a lab VO2max, converted with the 1968 Cooper
  regression. Individual standard error around 250m.
- **Single-leg balance**: source allowed multiple trials and reports means
  without usable SDs.

## The one thing not to do

Do not set `transcription_verified: true` in bulk to clear the warnings. The
warning is the only thing standing between "we cited a paper" and "we read it".
