import { describe, expect, it } from "vitest";
import { buildSeedDatabase } from "./seed";
import { LocalStore } from "./local-store";
import { BATTERY_BINDINGS, BATTERY_TEST_SLUGS, testBySlug } from "@/lib/battery";
import { currentBenchmark } from "@/lib/benchmarks/registry";
import { mostImproved, rankBoard } from "@/lib/scoring/board";
import { scoreBattery } from "@/lib/scoring/composite";

/**
 * The acceptance criterion is "demo seed data renders every screen on a fresh
 * install". These tests assert the data actually reaches the states each
 * screen needs, so a regression in the seed shows up here rather than as a
 * blank panel in the app.
 */

const db = buildSeedDatabase();

function scoreFor(participantId: string, sessionId: string) {
  const p = db.participants.find((x) => x.id === participantId)!;
  return scoreBattery({
    sex: p.sex,
    birthDate: p.birthDate,
    tests: BATTERY_BINDINGS,
    results: db.results
      .filter((r) => r.participantId === participantId && r.sessionId === sessionId)
      .map((r) => ({
        testVariant: r.testVariant,
        value: r.rawValue,
        recordedAt: r.recordedAt,
      })),
    lookup: currentBenchmark,
  });
}

describe("seed shape", () => {
  it("has eight people and two sessions", () => {
    expect(db.participants).toHaveLength(8);
    expect(db.sessions).toHaveLength(2);
  });

  it("is deterministic across builds", () => {
    const again = buildSeedDatabase();
    expect(again.results.map((r) => r.rawValue)).toEqual(
      db.results.map((r) => r.rawValue),
    );
  });

  it("includes two guests with no user account, for the claim flow", () => {
    const guests = db.participants.filter((p) => p.userId === null);
    expect(guests.map((g) => g.name)).toEqual(["Ines V.", "Ola S."]);
  });

  it("has a current user set", () => {
    expect(db.meId).toBe("p_you");
    expect(db.participants.some((p) => p.id === db.meId)).toBe(true);
  });

  it("records every result as witnessed and inside a session", () => {
    expect(db.results.every((r) => r.witnessed && r.sessionId !== null)).toBe(true);
  });

});

describe("seed produces the states each screen needs", () => {
  it("gives the current user two completed batteries, so Home has a delta", () => {
    const q1 = scoreFor("p_you", "s_q1");
    const q2 = scoreFor("p_you", "s_q2");
    expect(q1.composite).not.toBeNull();
    expect(q2.composite).not.toBeNull();
    expect(q2.composite).not.toBe(q1.composite);
  });

  it("gives the current user a fitness age", () => {
    expect(scoreFor("p_you", "s_q2").fitnessAge).not.toBeNull();
  });

  it("has one incomplete battery, so the partial state is on screen", () => {
    const tomas = scoreFor("p_tomas", "s_q2");
    expect(tomas.composite).toBeNull();
    expect(tomas.testsCompleted).toBe(6);
    expect(tomas.testsRequired).toBe(BATTERY_TEST_SLUGS.length);
  });

  it("has one first-timer, so most-improved shows that path", () => {
    const q2Participants = db.sessionParticipants
      .filter((sp) => sp.sessionId === "s_q2")
      .map((sp) => sp.participantId);

    const result = mostImproved(
      q2Participants.map((id) => {
        const prior = db.sessionParticipants.some(
          (sp) => sp.sessionId === "s_q1" && sp.participantId === id,
        );
        return {
          participantId: id,
          displayName: db.participants.find((p) => p.id === id)!.name,
          current: scoreFor(id, "s_q2"),
          previous: prior ? scoreFor(id, "s_q1") : null,
        };
      }),
    );

    expect(result.firstTimers.map((f) => f.displayName)).toEqual(["Ola S."]);
    expect(result.ineligible.map((f) => f.displayName)).toEqual(["Tomas B."]);
    expect(result.ranked.length).toBeGreaterThan(3);
  });

  it("produces a spread of scores rather than everyone at 50", () => {
    const composites = db.sessionParticipants
      .filter((sp) => sp.sessionId === "s_q2")
      .map((sp) => scoreFor(sp.participantId, "s_q2").composite)
      .filter((c): c is number => c !== null);

    expect(Math.max(...composites) - Math.min(...composites)).toBeGreaterThan(20);
  });

  it("lets the 61-year-old beat some of the forty-somethings, on cohort", () => {
    // Priya is the oldest in the crew and one of the strongest relative to her
    // own cohort. If this ever fails, the cohort-relative claim is broken.
    const board = rankBoard(
      db.sessionParticipants
        .filter((sp) => sp.sessionId === "s_q2")
        .map((sp) => ({
          participantId: sp.participantId,
          displayName: db.participants.find((p) => p.id === sp.participantId)!.name,
          score: scoreFor(sp.participantId, "s_q2"),
        })),
    );
    const priyaRank = board.findIndex((e) => e.participantId === "p_priya");
    expect(priyaRank).toBeLessThan(3);
  });

  it("keeps every raw result inside its test's input bounds", () => {
    for (const r of db.results) {
      const test = testBySlug(r.testVariant);
      expect(test, r.testVariant).toBeDefined();
      expect(Number.isFinite(r.rawValue)).toBe(true);
      expect(r.rawValue, r.testVariant).toBeGreaterThanOrEqual(test!.min);
      expect(r.rawValue, r.testVariant).toBeLessThanOrEqual(test!.max);
    }
  });

  it("stamps every seeded result with the benchmark version it was scored under", () => {
    expect(db.results.every((r) => r.benchmarkVersion === currentBenchmark.version)).toBe(true);
  });

  it("asks for no bodyweight anywhere", () => {
    // The carry runs at a fixed load, so nothing in the app needs a weigh-in.
    for (const sp of db.sessionParticipants) {
      expect(Object.keys(sp)).not.toContain("bodyweightKg");
    }
  });
});

describe("LocalStore durability", () => {
  /** No window in the node test environment, so this exercises the in-memory path. */
  it("keeps a result the moment it is written, with no network involved", async () => {
    const store = new LocalStore();
    const before = (await store.listResults("p_you")).length;

    await store.addResult({
      participantId: "p_you",
      sessionId: null,
      testVariant: "push_ups",
      rawValue: 42,
      recordedAt: new Date().toISOString(),
      recordedByParticipantId: "p_you",
      witnessed: false,
    });

    const after = await store.listResults("p_you");
    expect(after).toHaveLength(before + 1);
    expect(after.at(-1)!.rawValue).toBe(42);
  });

  it("queues every write for sync rather than dropping it", async () => {
    const store = new LocalStore();
    const before = store.pendingWrites().length;
    await store.addResult({
      participantId: "p_you",
      sessionId: null,
      testVariant: "balance_eyes_closed",
      rawValue: 90,
      recordedAt: new Date().toISOString(),
      recordedByParticipantId: "p_you",
      witnessed: false,
    });
    expect(store.pendingWrites()).toHaveLength(before + 1);
    expect(store.pendingWrites().at(-1)!.write.kind).toBe("result");
  });

  it("supersedes an entry with a new row instead of editing the old one", async () => {
    const store = new LocalStore();
    const at = new Date().toISOString();
    const first = await store.addResult({
      participantId: "p_you",
      sessionId: null,
      testVariant: "broad_jump",
      rawValue: 10,
      recordedAt: at,
      recordedByParticipantId: "p_you",
      witnessed: false,
    });
    await store.addResult({
      participantId: "p_you",
      sessionId: null,
      testVariant: "broad_jump",
      rawValue: 52,
      recordedAt: new Date(Date.parse(at) + 1000).toISOString(),
      recordedByParticipantId: "p_you",
      witnessed: false,
      supersedesResultId: first.id,
    });

    const rows = (await store.listResults("p_you")).filter(
      (r) => r.testVariant === "broad_jump",
    );
    // Both rows survive. The engine takes the newest.
    expect(rows.filter((r) => r.rawValue === 10)).toHaveLength(1);
    expect(rows.filter((r) => r.rawValue === 52)).toHaveLength(1);
  });

  it("generates unambiguous session codes", async () => {
    const store = new LocalStore();
    const s = await store.createSession({
      hostParticipantId: "p_you",
      batteryVersion: "open-v1",
      name: "Saturday",
      startsAt: new Date().toISOString(),
      locationText: "The park",
    });
    expect(s.code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/);
    expect(await store.getSessionByCode(s.code.toLowerCase())).toEqual(s);
  });
});
