import { BATTERY_TEST_SLUGS } from "@/lib/battery";
import { normsRegistry } from "@/lib/norms/registry";
import type { Participant, Result } from "@/lib/data/types";
import { scoreBattery } from "@/lib/scoring/composite";
import type { BatteryScore } from "@/lib/scoring/types";

/**
 * Grouping raw results into battery attempts.
 *
 * A session is the obvious grouping and covers the crew case. Solo entries
 * have no session, so they group into an attempt that stays open until a test
 * repeats (you tested that one again) or 36 hours pass. This is what history
 * and crew boards are built on.
 *
 * It is NOT what the scorecard shows - see currentCard below. Entering one new
 * pull-up number should not blank out the eight you already have.
 */
const SOLO_ATTEMPT_GAP_MS = 36 * 60 * 60 * 1000;

export interface BatteryAttempt {
  key: string;
  sessionId: string | null;
  startedAt: string;
  completedAt: string;
  results: Result[];
  score: BatteryScore;
}

export function groupAttempts(participant: Participant, results: Result[]): Array<{
  key: string;
  sessionId: string | null;
  results: Result[];
}> {
  const sorted = [...results].sort(
    (a, b) => Date.parse(a.recordedAt) - Date.parse(b.recordedAt),
  );

  const bySession = new Map<string, Result[]>();
  const solo: Array<{ key: string; results: Result[] }> = [];

  let openSolo: { key: string; results: Result[]; seen: Set<string>; lastAt: number } | null =
    null;
  let soloCounter = 0;

  for (const r of sorted) {
    if (r.sessionId) {
      const list = bySession.get(r.sessionId) ?? [];
      list.push(r);
      bySession.set(r.sessionId, list);
      continue;
    }

    const at = Date.parse(r.recordedAt);
    const repeats = openSolo?.seen.has(r.testVariant) ?? false;
    const stale = openSolo ? at - openSolo.lastAt > SOLO_ATTEMPT_GAP_MS : false;

    if (!openSolo || repeats || stale) {
      openSolo = {
        key: `solo_${soloCounter++}`,
        results: [],
        seen: new Set(),
        lastAt: at,
      };
      solo.push({ key: openSolo.key, results: openSolo.results });
    }
    openSolo.results.push(r);
    openSolo.seen.add(r.testVariant);
    openSolo.lastAt = at;
  }

  return [
    ...[...bySession.entries()].map(([sessionId, rs]) => ({
      key: sessionId,
      sessionId,
      results: rs,
    })),
    ...solo.map((s) => ({ key: s.key, sessionId: null, results: s.results })),
  ];
}

export function scoreAttempt(
  participant: Participant,
  results: Result[],
): BatteryScore {
  return scoreBattery({
    sex: participant.sex,
    birthDate: participant.birthDate,
    batteryTests: BATTERY_TEST_SLUGS,
    results: results.map((r) => ({
      testVariant: r.testVariant,
      value: r.rawValue,
      recordedAt: r.recordedAt,
    })),
    norms: normsRegistry,
  });
}

/** Every attempt this participant has made, newest first. */
export function attemptsFor(
  participant: Participant,
  results: Result[],
): BatteryAttempt[] {
  return groupAttempts(participant, results)
    .map((group) => {
      const times = group.results.map((r) => Date.parse(r.recordedAt));
      return {
        key: group.key,
        sessionId: group.sessionId,
        startedAt: new Date(Math.min(...times)).toISOString(),
        completedAt: new Date(Math.max(...times)).toISOString(),
        results: group.results,
        score: scoreAttempt(participant, group.results),
      };
    })
    .sort((a, b) => Date.parse(b.completedAt) - Date.parse(a.completedAt));
}

export interface ParticipantHistory {
  attempts: BatteryAttempt[];
  /** Newest attempt with all ten tests. This is "your Longevity Score". */
  latestComplete: BatteryAttempt | null;
  /** The one before it, for retest deltas. */
  previousComplete: BatteryAttempt | null;
  /** Newest attempt of any kind, complete or not, for "resume where you left off". */
  inProgress: BatteryAttempt | null;
}

export function historyFor(
  participant: Participant,
  results: Result[],
): ParticipantHistory {
  const attempts = attemptsFor(participant, results);
  const complete = attempts.filter((a) => a.score.composite !== null);
  const newest = attempts[0] ?? null;

  return {
    attempts,
    latestComplete: complete[0] ?? null,
    previousComplete: complete[1] ?? null,
    inProgress:
      newest && newest.score.composite === null && newest.score.testsCompleted > 0
        ? newest
        : null,
  };
}

/**
 * The score for one participant within one specific session. Used by the crew
 * board, where "their latest battery" is not the question - "what they did
 * here, today" is.
 */
export function sessionScoreFor(
  participant: Participant,
  results: Result[],
  sessionId: string,
): BatteryScore {
  return scoreAttempt(
    participant,
    results.filter((r) => r.sessionId === sessionId),
  );
}

/** The most recent completed battery before a given session started. */
export function priorCompleteBefore(
  participant: Participant,
  results: Result[],
  beforeIso: string,
): BatteryScore | null {
  const cutoff = Date.parse(beforeIso);
  const earlier = attemptsFor(participant, results).filter(
    (a) => Date.parse(a.completedAt) < cutoff && a.score.composite !== null,
  );
  return earlier[0]?.score ?? null;
}



export interface CardEntry {
  testVariant: string;
  /** The value that counts. */
  value: number;
  recordedAt: string;
  /** What this test read before, if it has been entered more than once. */
  previousValue: number | null;
}

export interface Scorecard {
  score: BatteryScore;
  entries: Map<string, CardEntry>;
  /** Newest entry across the whole card. */
  updatedAt: string | null;
}

/**
 * The scorecard: your latest number for each test, whenever you set it.
 *
 * Deliberately not "your newest attempt". People do not run a battery in one
 * sitting - they do the mile on Tuesday and the jump on Saturday, and they
 * retest one thing at a time. Grouping by attempt means entering a single new
 * result drops you from a complete card back to 1/8, which is both wrong and
 * infuriating. Latest-per-test is what a scorecard actually means.
 */
export function currentCard(
  participant: Participant,
  results: Result[],
): Scorecard {
  const entries = new Map<string, CardEntry>();

  for (const slug of BATTERY_TEST_SLUGS) {
    const forTest = results
      .filter((r) => r.testVariant === slug)
      .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
    if (forTest.length === 0) continue;
    entries.set(slug, {
      testVariant: slug,
      value: forTest[0].rawValue,
      recordedAt: forTest[0].recordedAt,
      previousValue: forTest[1]?.rawValue ?? null,
    });
  }

  const score = scoreBattery({
    sex: participant.sex,
    birthDate: participant.birthDate,
    batteryTests: BATTERY_TEST_SLUGS,
    results: [...entries.values()].map((e) => ({
      testVariant: e.testVariant,
      value: e.value,
      recordedAt: e.recordedAt,
    })),
    norms: normsRegistry,
  });

  const updatedAt =
    [...entries.values()].map((e) => e.recordedAt).sort().pop() ?? null;

  return { score, entries, updatedAt };
}

/**
 * The same card as it stood before the most recent change to each test - the
 * honest way to answer "how much did I move". A test entered only once
 * contributes its current value, so it neither helps nor hurts the delta.
 */
export function previousCard(
  participant: Participant,
  results: Result[],
): BatteryScore | null {
  const card = currentCard(participant, results);
  if (card.score.composite === null) return null;
  const anyPrior = [...card.entries.values()].some((e) => e.previousValue !== null);
  if (!anyPrior) return null;

  return scoreBattery({
    sex: participant.sex,
    birthDate: participant.birthDate,
    batteryTests: BATTERY_TEST_SLUGS,
    results: [...card.entries.values()].map((e) => ({
      testVariant: e.testVariant,
      value: e.previousValue ?? e.value,
      recordedAt: e.recordedAt,
    })),
    norms: normsRegistry,
  });
}
