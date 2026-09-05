import { OPEN_V1_TEST_SLUGS } from "@/lib/battery";
import { normsRegistry } from "@/lib/norms/registry";
import type { Participant, Result } from "@/lib/data/types";
import { scoreBattery } from "@/lib/scoring/composite";
import type { BatteryScore } from "@/lib/scoring/types";

/**
 * Grouping raw results into battery attempts.
 *
 * A session is the obvious grouping and covers the crew case. Solo testing has
 * no session, so results are grouped into an attempt that stays open until
 * either a test repeats (you started again) or more than 18 hours pass (you
 * did not come back). 18 hours because a battery is sometimes split across a
 * morning and an evening, but never across two days - the Cooper run has to be
 * in the same state of freshness as the rest.
 */
const SOLO_ATTEMPT_GAP_MS = 18 * 60 * 60 * 1000;

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
    batteryTests: OPEN_V1_TEST_SLUGS,
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

export const BATTERY_TEST_COUNT = OPEN_V1_TEST_SLUGS.length;
