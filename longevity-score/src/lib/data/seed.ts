import { BATTERY_SLUG, BATTERY_TESTS } from "@/lib/battery";
import { normsRegistry } from "@/lib/norms/registry";
import { ageAt } from "@/lib/scoring/cohort";
import type { NormCohort } from "@/lib/scoring/types";
import type { Database, Participant, Result, CrewSession } from "./types";

/**
 * Demo dataset: eight people, two quarterly sessions.
 *
 * Built so that every screen has something real to render on a fresh install,
 * and specifically so the awkward states are represented rather than only the
 * happy path:
 *
 *  - Ola misses the first session, so she is a first-timer on the
 *    most-improved board rather than last place.
 *  - Tomas walks off after seven tests in Q2, so the "7/10, incomplete" state
 *    and the null composite are on screen without anyone having to fake it.
 *  - Priya is 61 and Ines is 34, against a crew mostly in their forties, so
 *    the cohort-relative claim is visible on the board rather than asserted.
 *  - Two guests (Ines, Ola) have no user account, so the claim flow has
 *    something to claim.
 */

/** Deterministic PRNG so the demo data is identical on every install. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Standard normal from a uniform stream, Box-Muller. */
function gauss(rand: () => number): number {
  const u = Math.max(rand(), 1e-9);
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

interface SeedPerson {
  key: string;
  name: string;
  sex: "M" | "F";
  birthDate: string;
  isUser: boolean;
  /** How many SDs above their cohort mean this person sits, on average. */
  ability: number;
  /** Change in ability between session 1 and session 2. */
  drift: number;
  /** Skipped session 1 entirely. */
  q1Absent?: boolean;
  /** Stopped after N tests in session 2. */
  q2StopsAfter?: number;
}

const PEOPLE: SeedPerson[] = [
  // Ability is in cohort SDs above the mean. Spread deliberately from just
  // below average to strong, so the demo shows a real board rather than eight
  // variations on "elite" - and so the fitness-age floor (see below) is
  // visible on some rows and not others.
  { key: "you", name: "Alex T.", sex: "M", birthDate: "1983-04-12", isUser: true, ability: 0.2, drift: 0.3 },
  { key: "dan", name: "Dan R.", sex: "M", birthDate: "1980-09-02", isUser: true, ability: 0.75, drift: -0.12 },
  { key: "marisa", name: "Marisa K.", sex: "F", birthDate: "1982-01-25", isUser: true, ability: 0.5, drift: 0.4 },
  { key: "tomas", name: "Tomas B.", sex: "M", birthDate: "1978-11-30", isUser: true, ability: -0.25, drift: 0.2, q2StopsAfter: 6 },
  { key: "priya", name: "Priya N.", sex: "F", birthDate: "1965-06-18", isUser: true, ability: 0.95, drift: 0.1 },
  { key: "ines", name: "Ines V.", sex: "F", birthDate: "1992-02-08", isUser: false, ability: -0.15, drift: 0.55 },
  { key: "jonah", name: "Jonah A.", sex: "M", birthDate: "1986-07-21", isUser: true, ability: -0.7, drift: 0.45 },
  { key: "ola", name: "Ola S.", sex: "F", birthDate: "1987-03-14", isUser: false, ability: 0.3, drift: 0, q1Absent: true },
];

const SESSION_1_AT = "2026-03-14T09:30:00.000Z";
const SESSION_2_AT = "2026-06-13T09:30:00.000Z";

function cohortFor(slug: string, sex: "M" | "F", age: number): NormCohort {
  const file = normsRegistry.get(slug)!;
  const forSex = file.cohorts.filter((c) => c.sex === sex);
  return (
    forSex.find((c) => age >= c.age_min && age <= c.age_max) ??
    forSex[forSex.length - 1]
  );
}

/**
 * Turn "this person is 1.05 SDs above their cohort" into a plausible raw
 * result, respecting each test's direction, units and step size.
 */
function rawFor(
  slug: string,
  sex: "M" | "F",
  age: number,
  z: number,
): number {
  const file = normsRegistry.get(slug)!;
  const test = BATTERY_TESTS.find((t) => t.slug === slug)!;
  const cohort = cohortFor(slug, sex, age);

  let value: number;
  if (cohort.mean !== undefined && cohort.sd !== undefined) {
    const signed = file.direction === "higher_better" ? z : -z;
    value = cohort.mean + signed * cohort.sd;
  } else {
    // Cut-point file: walk the published points and interpolate on z.
    const pts = Object.entries(cohort.percentiles!)
      .map(([p, v]) => ({ p: Number(p), v }))
      .sort((a, b) => a.p - b.p);
    // Approximate percentile for this z, then interpolate the value.
    const pct = Math.min(97, Math.max(3, 50 + z * 34));
    const lo = [...pts].reverse().find((x) => x.p <= pct) ?? pts[0];
    const hi = pts.find((x) => x.p >= pct) ?? pts[pts.length - 1];
    value =
      lo.p === hi.p ? lo.v : lo.v + ((pct - lo.p) / (hi.p - lo.p)) * (hi.v - lo.v);
  }

  const clamped = Math.min(test.max, Math.max(test.min, value));
  const stepped = Math.round(clamped / test.step) * test.step;
  return Math.round(stepped * 100) / 100;
}

function id(prefix: string, n: number | string): string {
  return `${prefix}_${n}`;
}

export function buildSeedDatabase(): Database {
  const rand = mulberry32(20260905);

  const participants: Participant[] = PEOPLE.map((p, i) => ({
    id: id("p", p.key),
    userId: p.isUser ? id("u", p.key) : null,
    name: p.name,
    sex: p.sex,
    birthDate: p.birthDate,
    claimEmail: null,
    claimedAt: null,
    createdAt: new Date(Date.parse(SESSION_1_AT) - (i + 1) * 86400000).toISOString(),
  }));

  const hostId = id("p", "dan");

  const sessions: CrewSession[] = [
    {
      id: "s_q1",
      hostParticipantId: hostId,
      batteryVersion: BATTERY_SLUG,
      name: "Q1 crew test",
      code: "MARCH6",
      status: "locked",
      startsAt: SESSION_1_AT,
      locationText: "Vasaparken, north field",
      lockedAt: "2026-03-14T12:10:00.000Z",
      createdAt: "2026-03-01T08:00:00.000Z",
    },
    {
      id: "s_q2",
      hostParticipantId: hostId,
      batteryVersion: BATTERY_SLUG,
      name: "Q2 crew test",
      code: "JUNE13",
      status: "locked",
      startsAt: SESSION_2_AT,
      locationText: "Vasaparken, north field",
      lockedAt: "2026-06-13T12:25:00.000Z",
      createdAt: "2026-06-01T08:00:00.000Z",
    },
  ];

  const sessionParticipants: Database["sessionParticipants"] = [];
  const results: Result[] = [];
  const unscored: Database["unscored"] = [];

  let resultCounter = 0;

  for (const session of sessions) {
    const isQ1 = session.id === "s_q1";
    const startedAt = Date.parse(session.startsAt!);

    for (const person of PEOPLE) {
      if (isQ1 && person.q1Absent) continue;

      const participantId = id("p", person.key);
      const age = ageAt(person.birthDate, session.startsAt!);
      sessionParticipants.push({
        sessionId: session.id,
        participantId,
        joinedAt: new Date(startedAt - 900000).toISOString(),
      });

      const ability = person.ability + (isQ1 ? 0 : person.drift);
      const stopAfter = !isQ1 && person.q2StopsAfter ? person.q2StopsAfter : BATTERY_TESTS.length;

      BATTERY_TESTS.forEach((test, index) => {
        if (index >= stopAfter) return;

        // Per-test noise: nobody is uniformly good at everything.
        const z = ability + gauss(rand) * 0.55;
        const recordedAt = new Date(startedAt + index * 11 * 60000).toISOString();

        results.push({
          id: id("r", resultCounter++),
          participantId,
          sessionId: session.id,
          testVariant: test.slug,
          rawValue: rawFor(test.slug, person.sex, age, z),
          recordedAt,
          recordedByParticipantId: hostId,
          witnessed: true,
        });
      });

    }
  }

  return {
    version: 1,
    isDemo: true,
    meId: id("p", "you"),
    participants,
    sessions,
    sessionParticipants,
    results,
    unscored,
  };
}

export const SEED_SESSION_CODES = ["MARCH6", "JUNE13"];
