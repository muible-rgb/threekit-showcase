/**
 * Standard normal CDF. Abramowitz & Stegun 7.1.26, absolute error under 1.5e-7,
 * which is three orders of magnitude finer than the one-decimal percentiles
 * this app shows. No dependency.
 *
 * Used for exactly one thing: turning the composite into an overall
 * percentile. Every per-test percentile comes from the benchmark table, which
 * already carries its own distributions.
 */
export function normalCdf(z: number): number {
  if (!Number.isFinite(z)) return z > 0 ? 1 : 0;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t +
      0.254829592) *
      t *
      Math.exp(-x * x));
  return 0.5 * (1 + sign * y);
}
