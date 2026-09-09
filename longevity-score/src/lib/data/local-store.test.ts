import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { LocalStore } from "./local-store";

/**
 * A real browser's first load - the case seed.test.ts's "LocalStore
 * durability" tests do not cover, because they run with no window at all and
 * so exercise LocalStore's no-storage fallback instead of the code path an
 * actual visitor hits.
 *
 * This is where the bug lived: a new person opened the link and landed on a
 * stranger's finished scorecard (the seed's own "you", fully scored) instead
 * of Register, and had to notice a small banner and tap it before they could
 * enter their own name. Fixed by never letting the seed sign anyone in - see
 * local-store.ts's load().
 */
class FakeLocalStorage implements Storage {
  private store = new Map<string, string>();
  get length() {
    return this.store.size;
  }
  clear(): void {
    this.store.clear();
  }
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  key(index: number): string | null {
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

let originalWindow: typeof globalThis extends { window: infer W } ? W : never;

beforeEach(() => {
  originalWindow = (globalThis as { window?: unknown }).window as never;
  (globalThis as { window?: unknown }).window = { localStorage: new FakeLocalStorage() };
});

afterEach(() => {
  (globalThis as { window?: unknown }).window = originalWindow;
});

describe("a real visitor's first load", () => {
  it("seeds the demo crew but signs nobody in", async () => {
    const store = new LocalStore();
    expect(await store.getMe()).toBeNull();
    const db = store.snapshot();
    expect(db.isDemo).toBe(true);
    expect(db.participants).toHaveLength(8);
    // Every board screen has something to show, and nobody has to clear a
    // stranger's card before they can register.
    expect(db.results.length).toBeGreaterThan(0);
  });

  it("registering does not disturb the seeded crew", async () => {
    const store = new LocalStore();
    const me = await store.setMe({ name: "Robin", sex: "F", birthDate: "1990-01-01", userId: null });
    expect(await store.getMe()).toEqual(me);
    const db = store.snapshot();
    expect(db.participants).toHaveLength(9); // eight seeded, plus Robin
    expect(db.isDemo).toBe(true); // the crew is still there until cleared
  });

  it("persists 'signed out' across a reload, not just the crew", async () => {
    new LocalStore(); // first visit: writes the seeded-but-signed-out db
    const reopened = new LocalStore(); // simulates the same browser tomorrow
    expect(await reopened.getMe()).toBeNull();
    expect(reopened.snapshot().participants).toHaveLength(8);
  });
});

describe("clearDemo", () => {
  it("drops the eight strangers but keeps a real registration", async () => {
    const store = new LocalStore();
    const me = await store.setMe({ name: "Robin", sex: "F", birthDate: "1990-01-01", userId: null });
    await store.addResult({
      participantId: me.id,
      sessionId: null,
      testVariant: "push_ups",
      rawValue: 20,
      recordedAt: new Date().toISOString(),
      recordedByParticipantId: me.id,
      witnessed: false,
    });

    await store.clearDemo();

    expect(await store.getMe()).toEqual(me);
    const db = store.snapshot();
    expect(db.participants).toEqual([me]);
    expect(db.isDemo).toBe(false);
    expect(db.results).toHaveLength(1);
    expect(db.results[0].participantId).toBe(me.id);
  });

  it("still works before anyone has registered", async () => {
    const store = new LocalStore();
    await store.clearDemo();
    expect(await store.getMe()).toBeNull();
    expect(store.snapshot().participants).toHaveLength(0);
  });
});

describe("reset", () => {
  it("brings back a fresh demo crew without deleting a signed-in account", async () => {
    const store = new LocalStore();
    const me = await store.setMe({ name: "Robin", sex: "F", birthDate: "1990-01-01", userId: null });
    await store.clearDemo();

    await store.reset();

    expect(await store.getMe()).toEqual(me);
    const db = store.snapshot();
    expect(db.participants).toHaveLength(9); // eight fresh demo, plus Robin
    expect(db.isDemo).toBe(true);
  });
});
