import type { BandLabel, BatteryScore, TestPercentile } from "./types";
import { bandFor, runningAverage } from "./composite";

/**
 * Crew rank is the second denominator, and it is never blended with the first.
 * A Longevity Score answers "how do I compare to the population". A crew rank
 * answers "who won on Saturday". Mixing them would quietly turn the health
 * claim into a game score.
 */

export interface BoardEntry {
  participantId: string;
  displayName: string;
  score: BatteryScore;
}

export interface RankedEntry extends BoardEntry {
  rank: number;
  /** Set when this entry's placing was decided by the tie-break, not the composite. */
  tieBroken: boolean;
}

/**
 * Tie-break: highest single-test percentile, then second-highest, and so on
 * down all ten. Comparing the full descending vector rather than stopping at
 * two means a genuine dead heat stays a dead heat instead of being settled by
 * participant id.
 */
export function tieBreakVector(tests: TestPercentile[]): number[] {
  return tests.map((t) => t.percentile).sort((a, b) => b - a);
}

function compareVectors(a: number[], b: number[]): number {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const av = a[i] ?? -Infinity;
    const bv = b[i] ?? -Infinity;
    if (av !== bv) return bv - av;
  }
  return 0;
}

/**
 * Final board. Only completed batteries carry a composite, so incomplete
 * participants sort below everyone complete, ordered by how far they got.
 */
export function rankBoard(entries: BoardEntry[]): RankedEntry[] {
  const sorted = [...entries].sort((a, b) => {
    const ac = a.score.composite;
    const bc = b.score.composite;

    if (ac !== null && bc !== null) {
      if (ac !== bc) return bc - ac;
      return compareVectors(
        tieBreakVector(a.score.tests),
        tieBreakVector(b.score.tests),
      );
    }
    if (ac !== null) return -1;
    if (bc !== null) return 1;

    // Both incomplete: more tests done ranks higher, then running average.
    if (a.score.testsCompleted !== b.score.testsCompleted) {
      return b.score.testsCompleted - a.score.testsCompleted;
    }
    return (
      (runningAverage(b.score.tests) ?? 0) - (runningAverage(a.score.tests) ?? 0)
    );
  });

  return sorted.map((entry, i) => {
    const prev = i > 0 ? sorted[i - 1] : null;
    const tieBroken =
      prev !== null &&
      prev.score.composite !== null &&
      entry.score.composite !== null &&
      prev.score.composite === entry.score.composite;

    return { ...entry, rank: i + 1, tieBroken };
  });
}

export interface LiveBoardEntry extends BoardEntry {
  rank: number;
  /**
   * Deliberately not called a composite. This is the mean of the tests done so
   * far and it is not a Longevity Score. The UI must label it as such.
   */
  runningAverage: number | null;
  testsCompleted: number;
}

/** Mid-session board. Sorts by progress first, then by running average. */
export function liveBoard(entries: BoardEntry[]): LiveBoardEntry[] {
  const withAvg = entries.map((e) => ({
    ...e,
    runningAverage: runningAverage(e.score.tests),
    testsCompleted: e.score.testsCompleted,
  }));

  withAvg.sort((a, b) => {
    if (a.testsCompleted !== b.testsCompleted) {
      return b.testsCompleted - a.testsCompleted;
    }
    return (b.runningAverage ?? -1) - (a.runningAverage ?? -1);
  });

  return withAvg.map((e, i) => ({ ...e, rank: i + 1 }));
}

// ---------------------------------------------------------------------------
// Retest deltas
// ---------------------------------------------------------------------------

export interface TestDelta {
  testVariant: string;
  capacity: string;
  previousPercentile: number;
  currentPercentile: number;
  delta: number;
  previousRaw: number;
  currentRaw: number;
  rawDelta: number;
}

export interface RetestDelta {
  compositeDelta: number | null;
  previousComposite: number | null;
  currentComposite: number | null;
  bandChanged: boolean;
  previousBand: BandLabel | null;
  currentBand: BandLabel | null;
  tests: TestDelta[];
  /** Tests present now that were not in the prior battery, or vice versa. */
  unmatched: string[];
}

/**
 * Compare a battery against the previous completed one. Both composites and
 * every matched test percentile.
 */
export function retestDelta(
  current: BatteryScore,
  previous: BatteryScore | null,
): RetestDelta | null {
  if (!previous) return null;

  const prevByTest = new Map(previous.tests.map((t) => [t.testVariant, t]));
  const tests: TestDelta[] = [];
  const unmatched: string[] = [];

  for (const t of current.tests) {
    const p = prevByTest.get(t.testVariant);
    if (!p) {
      unmatched.push(t.testVariant);
      continue;
    }
    tests.push({
      testVariant: t.testVariant,
      capacity: t.capacity,
      previousPercentile: p.percentile,
      currentPercentile: t.percentile,
      delta: Math.round((t.percentile - p.percentile) * 10) / 10,
      previousRaw: p.raw,
      currentRaw: t.raw,
      rawDelta: Math.round((t.raw - p.raw) * 100) / 100,
    });
    prevByTest.delete(t.testVariant);
  }
  for (const leftover of prevByTest.keys()) unmatched.push(leftover);

  const compositeDelta =
    current.composite !== null && previous.composite !== null
      ? Math.round((current.composite - previous.composite) * 10) / 10
      : null;

  const previousBand =
    previous.composite === null ? null : bandFor(previous.composite);
  const currentBand =
    current.composite === null ? null : bandFor(current.composite);

  return {
    compositeDelta,
    previousComposite: previous.composite,
    currentComposite: current.composite,
    bandChanged:
      previousBand !== null && currentBand !== null && previousBand !== currentBand,
    previousBand,
    currentBand,
    tests,
    unmatched,
  };
}

// ---------------------------------------------------------------------------
// Most improved
// ---------------------------------------------------------------------------

export interface ImprovementInput {
  participantId: string;
  displayName: string;
  current: BatteryScore;
  previous: BatteryScore | null;
}

export interface ImprovementEntry {
  participantId: string;
  displayName: string;
  delta: number;
  previousComposite: number;
  currentComposite: number;
  rank: number;
}

export interface MostImprovedResult {
  ranked: ImprovementEntry[];
  /**
   * People with no prior completed battery. Not "last place" - they are simply
   * not in this competition yet, and the UI shows them as first-timers.
   */
  firstTimers: Array<{ participantId: string; displayName: string }>;
  /** Completed this time but their prior battery was incomplete, or vice versa. */
  ineligible: Array<{ participantId: string; displayName: string; reason: string }>;
}

export function mostImproved(entries: ImprovementInput[]): MostImprovedResult {
  const ranked: Omit<ImprovementEntry, "rank">[] = [];
  const firstTimers: MostImprovedResult["firstTimers"] = [];
  const ineligible: MostImprovedResult["ineligible"] = [];

  for (const e of entries) {
    if (e.previous === null) {
      firstTimers.push({
        participantId: e.participantId,
        displayName: e.displayName,
      });
      continue;
    }
    if (e.current.composite === null) {
      ineligible.push({
        participantId: e.participantId,
        displayName: e.displayName,
        reason: `incomplete this session (${e.current.testsCompleted}/${e.current.testsRequired})`,
      });
      continue;
    }
    if (e.previous.composite === null) {
      ineligible.push({
        participantId: e.participantId,
        displayName: e.displayName,
        reason: "no completed prior battery to compare against",
      });
      continue;
    }

    ranked.push({
      participantId: e.participantId,
      displayName: e.displayName,
      delta: Math.round((e.current.composite - e.previous.composite) * 10) / 10,
      previousComposite: e.previous.composite,
      currentComposite: e.current.composite,
    });
  }

  ranked.sort((a, b) => {
    if (b.delta !== a.delta) return b.delta - a.delta;
    // Equal improvement: the higher current composite takes it.
    return b.currentComposite - a.currentComposite;
  });

  return {
    ranked: ranked.map((r, i) => ({ ...r, rank: i + 1 })),
    firstTimers,
    ineligible,
  };
}
