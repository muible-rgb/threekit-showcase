import { describe, expect, it } from "vitest";
import { liveBoard, mostImproved, rankBoard, retestDelta, tieBreakVector } from "./board";
import { bandFor } from "./composite";
import type { BatteryScore, TestPercentile } from "./types";

function test(slug: string, percentile: number, raw = percentile): TestPercentile {
  return {
    testVariant: slug,
    capacity: slug,
    unit: "u",
    raw,
    percentile,
    band: bandFor(percentile),
    evidenceGrade: "B",
    derivation: "observed",
    provisional: false,
    atFloor: false,
    atCeiling: false,
  };
}

function score(percentiles: number[], required = 10): BatteryScore {
  const tests = percentiles.map((p, i) => test(`t${i}`, p));
  const complete = tests.length === required;
  const composite = complete
    ? Math.round((percentiles.reduce((a, b) => a + b, 0) / percentiles.length) * 10) / 10
    : null;
  return {
    composite,
    band: composite === null ? null : bandFor(composite),
    testsCompleted: tests.length,
    testsRequired: required,
    tests,
    missing: Array.from({ length: required - tests.length }, (_, i) => `m${i}`),
    fitnessAge: null,
    benchmarkVersion: "test",
    anyProvisional: false,
  };
}

const ten = (v: number) => Array(10).fill(v);

describe("rankBoard", () => {
  it("sorts by composite, highest first", () => {
    const board = rankBoard([
      { participantId: "a", displayName: "A", score: score(ten(50)) },
      { participantId: "b", displayName: "B", score: score(ten(80)) },
      { participantId: "c", displayName: "C", score: score(ten(65)) },
    ]);
    expect(board.map((e) => e.participantId)).toEqual(["b", "c", "a"]);
    expect(board.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it("breaks a tie on the highest single-test percentile", () => {
    // Both average 50. A has a 95; B's best is 60.
    const a = score([95, 45, 45, 45, 45, 45, 45, 45, 45, 45]);
    const b = score([60, 60, 60, 60, 60, 40, 40, 40, 40, 40]);
    expect(a.composite).toBe(b.composite);

    const board = rankBoard([
      { participantId: "b", displayName: "B", score: b },
      { participantId: "a", displayName: "A", score: a },
    ]);
    expect(board[0].participantId).toBe("a");
    expect(board[0].rank).toBe(1);
    expect(board[1].tieBroken).toBe(true);
  });

  it("falls through to the second-highest when the best is equal", () => {
    const a = score([90, 80, 46, 46, 46, 46, 46, 46, 46, 44]);
    const b = score([90, 70, 50, 50, 50, 50, 50, 46, 44, 36]);
    expect(a.composite).toBe(b.composite);
    expect(tieBreakVector(a.tests)[0]).toBe(tieBreakVector(b.tests)[0]);

    const board = rankBoard([
      { participantId: "b", displayName: "B", score: b },
      { participantId: "a", displayName: "A", score: a },
    ]);
    expect(board[0].participantId).toBe("a"); // 80 beats 70
  });

  it("leaves a genuine dead heat in input order rather than inventing a winner", () => {
    const a = score(ten(60));
    const b = score(ten(60));
    const board = rankBoard([
      { participantId: "a", displayName: "A", score: a },
      { participantId: "b", displayName: "B", score: b },
    ]);
    expect(board.map((e) => e.participantId)).toEqual(["a", "b"]);
    expect(board[1].tieBroken).toBe(true);
  });

  it("ranks every completed battery above every incomplete one", () => {
    const board = rankBoard([
      { participantId: "partial", displayName: "P", score: score(Array(9).fill(99)) },
      { participantId: "complete", displayName: "C", score: score(ten(20)) },
    ]);
    // 9 elite tests still lose to 10 poor ones. That is the point of the rule.
    expect(board[0].participantId).toBe("complete");
    expect(board[1].score.composite).toBeNull();
  });

  it("orders incomplete participants by how far they got", () => {
    const board = rankBoard([
      { participantId: "three", displayName: "3", score: score([90, 90, 90]) },
      { participantId: "seven", displayName: "7", score: score(Array(7).fill(30)) },
    ]);
    expect(board[0].participantId).toBe("seven");
  });

  it("never marks the first row as tie-broken", () => {
    const board = rankBoard([
      { participantId: "a", displayName: "A", score: score(ten(60)) },
    ]);
    expect(board[0].tieBroken).toBe(false);
  });
});

describe("liveBoard", () => {
  it("sorts by progress first, then running average", () => {
    const board = liveBoard([
      { participantId: "ahead", displayName: "A", score: score([40, 40, 40, 40, 40]) },
      { participantId: "better", displayName: "B", score: score([99, 99, 99]) },
    ]);
    expect(board[0].participantId).toBe("ahead");
    expect(board[0].runningAverage).toBe(40);
  });

  it("exposes a running average, never a composite, mid-session", () => {
    const board = liveBoard([
      { participantId: "a", displayName: "A", score: score([80, 60, 40]) },
    ]);
    expect(board[0].runningAverage).toBe(60);
    expect(board[0].score.composite).toBeNull();
  });

  it("puts a participant with nothing recorded last", () => {
    const board = liveBoard([
      { participantId: "none", displayName: "N", score: score([]) },
      { participantId: "some", displayName: "S", score: score([10]) },
    ]);
    expect(board[0].participantId).toBe("some");
    expect(board[1].runningAverage).toBeNull();
  });
});

describe("retestDelta", () => {
  it("is null with no prior battery", () => {
    expect(retestDelta(score(ten(60)), null)).toBeNull();
  });

  it("reports the composite delta and per-test deltas", () => {
    const previous = score(ten(50));
    const current = score([60, 50, 50, 50, 50, 50, 50, 50, 50, 40]);
    const d = retestDelta(current, previous)!;
    expect(d.compositeDelta).toBe(0);
    expect(d.tests.find((t) => t.testVariant === "t0")!.delta).toBe(10);
    expect(d.tests.find((t) => t.testVariant === "t9")!.delta).toBe(-10);
    expect(d.tests).toHaveLength(10);
  });

  it("reports a raw delta alongside the percentile delta", () => {
    const previous = score(ten(50));
    const current = score(ten(60));
    const d = retestDelta(current, previous)!;
    expect(d.tests[0].previousRaw).toBe(50);
    expect(d.tests[0].currentRaw).toBe(60);
    expect(d.tests[0].rawDelta).toBe(10);
  });

  it("notices a band change", () => {
    const d = retestDelta(score(ten(78)), score(ten(60)))!;
    expect(d.previousBand).toBe("Solid");
    expect(d.currentBand).toBe("Strong");
    expect(d.bandChanged).toBe(true);
  });

  it("does not claim a band change when the band held", () => {
    const d = retestDelta(score(ten(70)), score(ten(60)))!;
    expect(d.bandChanged).toBe(false);
  });

  it("has a null composite delta when either battery is incomplete", () => {
    const d = retestDelta(score(Array(9).fill(60)), score(ten(50)))!;
    expect(d.compositeDelta).toBeNull();
    expect(d.currentComposite).toBeNull();
    expect(d.previousComposite).toBe(50);
  });

  it("lists tests that appear on only one side", () => {
    const previous = score(ten(50));
    const current = {
      ...score(ten(60)),
      tests: [...score(ten(60)).tests.slice(0, 9), test("t_new", 70)],
    };
    const d = retestDelta(current, previous)!;
    expect(d.unmatched.sort()).toEqual(["t9", "t_new"]);
    expect(d.tests).toHaveLength(9);
  });
});

describe("mostImproved", () => {
  it("ranks by composite delta, not by composite", () => {
    const r = mostImproved([
      {
        participantId: "steady",
        displayName: "Steady",
        current: score(ten(90)),
        previous: score(ten(89)),
      },
      {
        participantId: "climber",
        displayName: "Climber",
        current: score(ten(55)),
        previous: score(ten(40)),
      },
    ]);
    expect(r.ranked[0].participantId).toBe("climber");
    expect(r.ranked[0].delta).toBe(15);
    expect(r.ranked[1].delta).toBe(1);
  });

  it("keeps a negative delta on the board rather than hiding it", () => {
    const r = mostImproved([
      {
        participantId: "down",
        displayName: "Down",
        current: score(ten(40)),
        previous: score(ten(60)),
      },
    ]);
    expect(r.ranked[0].delta).toBe(-20);
  });

  it("excludes first-timers and lists them separately", () => {
    const r = mostImproved([
      {
        participantId: "new",
        displayName: "New",
        current: score(ten(80)),
        previous: null,
      },
      {
        participantId: "returning",
        displayName: "Returning",
        current: score(ten(60)),
        previous: score(ten(50)),
      },
    ]);
    expect(r.ranked).toHaveLength(1);
    expect(r.ranked[0].participantId).toBe("returning");
    expect(r.firstTimers).toEqual([{ participantId: "new", displayName: "New" }]);
  });

  it("does not rank someone whose current battery is incomplete", () => {
    const r = mostImproved([
      {
        participantId: "dnf",
        displayName: "DNF",
        current: score(Array(8).fill(90)),
        previous: score(ten(50)),
      },
    ]);
    expect(r.ranked).toHaveLength(0);
    expect(r.ineligible[0].reason).toMatch(/incomplete this session \(8\/10\)/);
  });

  it("does not rank someone whose prior battery was incomplete", () => {
    const r = mostImproved([
      {
        participantId: "half",
        displayName: "Half",
        current: score(ten(70)),
        previous: score(Array(6).fill(50)),
      },
    ]);
    expect(r.ranked).toHaveLength(0);
    expect(r.ineligible[0].reason).toMatch(/no completed prior battery/);
  });

  it("breaks an equal improvement on the higher current composite", () => {
    const r = mostImproved([
      {
        participantId: "low",
        displayName: "Low",
        current: score(ten(30)),
        previous: score(ten(20)),
      },
      {
        participantId: "high",
        displayName: "High",
        current: score(ten(80)),
        previous: score(ten(70)),
      },
    ]);
    expect(r.ranked[0].participantId).toBe("high");
  });

  it("handles a whole session of first-timers", () => {
    const r = mostImproved([
      { participantId: "a", displayName: "A", current: score(ten(60)), previous: null },
      { participantId: "b", displayName: "B", current: score(ten(70)), previous: null },
    ]);
    expect(r.ranked).toHaveLength(0);
    expect(r.firstTimers).toHaveLength(2);
    expect(r.ineligible).toHaveLength(0);
  });
});
