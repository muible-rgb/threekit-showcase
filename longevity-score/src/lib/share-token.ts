import type { BandLabel, BatteryScore, Sex } from "@/lib/scoring/types";
import { bandFor } from "@/lib/scoring/composite";
import { testBySlug } from "@/lib/battery";

/**
 * A share link has to work for someone with no account, on a page the server
 * renders, for a score that may only exist in one phone's localStorage. So the
 * score travels in the URL rather than being looked up.
 *
 * The payload is deliberately tiny and carries no identifiers - a display name,
 * a cohort label, ten percentiles. It is signed by nothing and is not a secret:
 * anyone holding the link can read it, which is exactly what a share link is.
 * Nothing here can be used to reach the sender's account or their raw results.
 *
 * With Supabase configured the token can also be a `public_slug`, and the page
 * falls back to looking that up. Both shapes are handled by `parseShareToken`.
 */

export interface SharePayload {
  v: 1;
  /** Display name. */
  n: string;
  /** Sex. */
  s: Sex;
  /** Age band minimum, e.g. 40. */
  a: number;
  /** Composite, one decimal. A mean of percentiles, not a percentile. */
  c: number;
  /** Estimated population percentile of the composite, or null. */
  pp?: number | null;
  /** Fitness age, or null. */
  f: number | null;
  /** True when fitness age is approximate. */
  fa: boolean;
  /** Completed at, epoch seconds. */
  t: number;
  /** [testVariantSlug, percentile] pairs, in battery order. */
  p: Array<[string, number]>;
}

function toBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  const b64 = typeof btoa === "function" ? btoa(binary) : Buffer.from(input, "utf8").toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): string | null {
  try {
    const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    if (typeof atob === "function") {
      const binary = atob(padded);
      const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
      return new TextDecoder().decode(bytes);
    }
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

export function encodeShareToken(payload: SharePayload): string {
  return toBase64Url(JSON.stringify(payload));
}

export function buildSharePayload(input: {
  name: string;
  sex: Sex;
  age: number;
  score: BatteryScore;
  completedAt: string;
}): SharePayload | null {
  if (input.score.composite === null) return null;
  return {
    v: 1,
    n: input.name.slice(0, 40),
    s: input.sex,
    a: Math.floor(input.age / 5) * 5,
    c: input.score.composite,
    pp: input.score.populationPercentile,
    f: input.score.fitnessAge ? Math.round(input.score.fitnessAge.years) : null,
    fa: input.score.fitnessAge?.approx ?? false,
    t: Math.floor(Date.parse(input.completedAt) / 1000),
    p: input.score.tests.map((t) => [t.testVariant, t.percentile]),
  };
}

export interface DecodedShare {
  name: string;
  sex: Sex;
  ageBand: string;
  composite: number;
  populationPercentile: number | null;
  band: BandLabel;
  fitnessAge: number | null;
  fitnessAgeApprox: boolean;
  completedAt: string;
  tests: Array<{ slug: string; label: string; percentile: number; band: BandLabel }>;
}

export function parseShareToken(token: string): DecodedShare | null {
  const json = fromBase64Url(token);
  if (!json) return null;

  let payload: SharePayload;
  try {
    payload = JSON.parse(json) as SharePayload;
  } catch {
    return null;
  }

  // Validate rather than trust: this arrives from a URL a stranger may have
  // edited, and it drives a rendered image.
  if (payload?.v !== 1) return null;
  if (typeof payload.c !== "number" || payload.c < 0 || payload.c > 100) return null;
  if (payload.s !== "M" && payload.s !== "F") return null;
  if (!Array.isArray(payload.p) || payload.p.length === 0 || payload.p.length > 20) {
    return null;
  }

  const tests = payload.p
    .filter(
      (pair): pair is [string, number] =>
        Array.isArray(pair) &&
        typeof pair[0] === "string" &&
        typeof pair[1] === "number" &&
        pair[1] >= 0 &&
        pair[1] <= 100,
    )
    .map((pair) => ({
      slug: pair[0],
      label: testBySlug(pair[0])?.capacityName ?? pair[0],
      percentile: pair[1],
      band: bandFor(pair[1]),
    }));

  if (tests.length === 0) return null;

  const ageMin = Number.isFinite(payload.a) ? Math.max(0, Math.min(120, payload.a)) : 40;

  return {
    name: String(payload.n ?? "").slice(0, 40) || "Anonymous",
    sex: payload.s,
    ageBand: `${payload.s} ${ageMin}-${ageMin + 4}`,
    composite: payload.c,
    populationPercentile:
      typeof payload.pp === "number" && payload.pp >= 0 && payload.pp <= 100 ? payload.pp : null,
    band: bandFor(payload.c),
    fitnessAge:
      typeof payload.f === "number" && payload.f > 0 && payload.f < 120 ? payload.f : null,
    fitnessAgeApprox: Boolean(payload.fa),
    completedAt: new Date((payload.t ?? 0) * 1000).toISOString(),
    tests,
  };
}
