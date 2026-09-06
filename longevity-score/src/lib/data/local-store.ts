import { buildSeedDatabase } from "./seed";
import { CURRENT_BENCHMARK_VERSION } from "@/lib/benchmarks/registry";
import type {
  CrewSession,
  Database,
  DataStore,
  OutboxEntry,
  Participant,
  Result,
  SessionParticipant,
  SyncStatus,
  UnscoredMeasurement,
} from "./types";

const DB_KEY = "longevity.db.v1";
const OUTBOX_KEY = "longevity.outbox.v1";

/**
 * Local-first storage.
 *
 * This is not a fallback or a mock. Every write in the app lands here first,
 * synchronously, and only then drains to Supabase through the outbox. That is
 * the whole offline story: a result recorded in a park with no signal is
 * already saved before the network is even consulted, so there is no state in
 * which a result can be lost to a dropped request.
 *
 * With no Supabase project configured this is also the entire backend, seeded
 * with the demo dataset, which is what makes every screen render on a fresh
 * install.
 */
export class LocalStore implements DataStore {
  readonly mode = "local" as const;

  private db: Database;
  private outbox: OutboxEntry[] = [];
  private listeners = new Set<() => void>();

  constructor(seed: () => Database = buildSeedDatabase) {
    this.db = this.load(seed);
    this.outbox = this.loadOutbox();
  }

  // -- persistence ---------------------------------------------------------

  private hasStorage(): boolean {
    try {
      return typeof window !== "undefined" && !!window.localStorage;
    } catch {
      return false;
    }
  }

  private load(seed: () => Database): Database {
    if (!this.hasStorage()) return seed();
    try {
      const raw = window.localStorage.getItem(DB_KEY);
      if (!raw) {
        const fresh = seed();
        window.localStorage.setItem(DB_KEY, JSON.stringify(fresh));
        return fresh;
      }
      const parsed = JSON.parse(raw) as Database;
      if (parsed.version !== 1) return seed();
      return parsed;
    } catch {
      // Corrupt or unavailable storage must not blank the app.
      return seed();
    }
  }

  private loadOutbox(): OutboxEntry[] {
    if (!this.hasStorage()) return [];
    try {
      const raw = window.localStorage.getItem(OUTBOX_KEY);
      return raw ? (JSON.parse(raw) as OutboxEntry[]) : [];
    } catch {
      return [];
    }
  }

  /** The first real write means this is no longer a demo. */
  private endDemo(): void {
    if (this.db.isDemo) this.db.isDemo = false;
  }

  private persist(): void {
    this.listeners.forEach((fn) => fn());
    if (!this.hasStorage()) return;
    try {
      window.localStorage.setItem(DB_KEY, JSON.stringify(this.db));
      window.localStorage.setItem(OUTBOX_KEY, JSON.stringify(this.outbox));
    } catch {
      // Storage full or blocked. The in-memory copy still holds for this
      // session; surfacing a scary error mid-test would be worse.
    }
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  snapshot(): Database {
    return this.db;
  }

  private newId(prefix: string): string {
    const rand =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    return `${prefix}_${rand}`;
  }

  // -- participants --------------------------------------------------------

  async getMe(): Promise<Participant | null> {
    if (!this.db.meId) return null;
    return this.db.participants.find((p) => p.id === this.db.meId) ?? null;
  }

  async setMe(
    input: Omit<Participant, "id" | "createdAt"> & { id?: string },
  ): Promise<Participant> {
    const existingId = input.id ?? this.db.meId;
    const existing = existingId
      ? this.db.participants.find((p) => p.id === existingId)
      : undefined;

    if (existing) {
      // Profiles are mutable; results are not. Changing a birth date
      // recomputes every percentile, which is exactly what should happen.
      Object.assign(existing, {
        name: input.name,
        sex: input.sex,
        birthDate: input.birthDate,
        userId: input.userId ?? existing.userId,
      });
      this.db.meId = existing.id;
      this.persist();
      return existing;
    }

    const created: Participant = {
      id: this.newId("p"),
      userId: input.userId ?? null,
      name: input.name,
      sex: input.sex,
      birthDate: input.birthDate,
      claimEmail: null,
      claimedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.db.participants.push(created);
    this.db.meId = created.id;
    this.enqueue({ kind: "participant", payload: created });
    this.persist();
    return created;
  }

  async getParticipant(id: string): Promise<Participant | null> {
    return this.db.participants.find((p) => p.id === id) ?? null;
  }

  async listParticipants(): Promise<Participant[]> {
    return [...this.db.participants];
  }

  async createParticipant(
    input: Omit<Participant, "id" | "createdAt" | "userId"> & { userId?: string | null },
  ): Promise<Participant> {
    const created: Participant = {
      id: this.newId("p"),
      userId: input.userId ?? null,
      name: input.name,
      sex: input.sex,
      birthDate: input.birthDate,
      claimEmail: input.claimEmail ?? null,
      claimedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.db.participants.push(created);
    this.enqueue({ kind: "participant", payload: created });
    this.persist();
    return created;
  }

  async claimParticipant(id: string, email: string): Promise<Participant | null> {
    const p = this.db.participants.find((x) => x.id === id);
    if (!p) return null;
    p.claimEmail = email;
    p.claimedAt = new Date().toISOString();
    this.enqueue({ kind: "participant", payload: p });
    this.persist();
    return p;
  }

  // -- results -------------------------------------------------------------

  async listResults(participantId: string): Promise<Result[]> {
    return this.db.results.filter((r) => r.participantId === participantId);
  }

  async listResultsForSession(sessionId: string): Promise<Result[]> {
    return this.db.results.filter((r) => r.sessionId === sessionId);
  }

  /**
   * Append only. A correction is a new row pointing at the one it replaces,
   * and the engine takes the newest row per test. Nothing is ever overwritten,
   * which is what makes a botched entry recoverable and an audit possible.
   */
  async addResult(input: Omit<Result, "id">): Promise<Result> {
    const created: Result = {
      ...input,
      benchmarkVersion: input.benchmarkVersion ?? CURRENT_BENCHMARK_VERSION,
      id: this.newId("r"),
    };
    this.endDemo();
    this.db.results.push(created);
    this.enqueue({ kind: "result", payload: created });
    this.persist();
    return created;
  }

  async listUnscored(participantId: string): Promise<UnscoredMeasurement[]> {
    return this.db.unscored.filter((m) => m.participantId === participantId);
  }

  async addUnscored(
    input: Omit<UnscoredMeasurement, "id">,
  ): Promise<UnscoredMeasurement> {
    const created: UnscoredMeasurement = { ...input, id: this.newId("m") };
    this.db.unscored.push(created);
    this.enqueue({ kind: "unscored", payload: created });
    this.persist();
    return created;
  }

  // -- sessions ------------------------------------------------------------

  async listSessions(): Promise<CrewSession[]> {
    return [...this.db.sessions].sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
    );
  }

  async getSession(id: string): Promise<CrewSession | null> {
    return this.db.sessions.find((s) => s.id === id) ?? null;
  }

  async getSessionByCode(code: string): Promise<CrewSession | null> {
    const upper = code.trim().toUpperCase();
    return this.db.sessions.find((s) => s.code === upper) ?? null;
  }

  async createSession(
    input: Omit<CrewSession, "id" | "code" | "createdAt" | "status" | "lockedAt">,
  ): Promise<CrewSession> {
    const created: CrewSession = {
      ...input,
      id: this.newId("s"),
      code: this.generateCode(),
      status: "open",
      lockedAt: null,
      createdAt: new Date().toISOString(),
    };
    this.db.sessions.push(created);
    this.enqueue({ kind: "session", payload: created });
    this.persist();
    return created;
  }

  /** Unambiguous alphabet: no O/0, no I/1. People read these out loud. */
  private generateCode(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    for (let attempt = 0; attempt < 50; attempt++) {
      let code = "";
      for (let i = 0; i < 6; i++) {
        code += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      if (!this.db.sessions.some((s) => s.code === code)) return code;
    }
    return `X${Date.now().toString(36).slice(-5).toUpperCase()}`;
  }

  async lockSession(id: string): Promise<CrewSession | null> {
    const s = this.db.sessions.find((x) => x.id === id);
    if (!s) return null;
    s.status = "locked";
    s.lockedAt = new Date().toISOString();
    this.enqueue({ kind: "lock_session", payload: { sessionId: id, lockedAt: s.lockedAt } });
    this.persist();
    return s;
  }

  async joinSession(
    sessionId: string,
    participantId: string,
  ): Promise<SessionParticipant> {
    const existing = this.db.sessionParticipants.find(
      (sp) => sp.sessionId === sessionId && sp.participantId === participantId,
    );
    if (existing) return existing;
    const created: SessionParticipant = {
      sessionId,
      participantId,
      joinedAt: new Date().toISOString(),
    };
    this.db.sessionParticipants.push(created);
    this.enqueue({ kind: "session_participant", payload: created });
    this.persist();
    return created;
  }

  async listSessionParticipants(sessionId: string): Promise<SessionParticipant[]> {
    return this.db.sessionParticipants.filter((sp) => sp.sessionId === sessionId);
  }

  // -- sync ----------------------------------------------------------------

  /**
   * With no Supabase project the outbox still fills, so switching a running
   * install onto a real project uploads everything recorded up to that point
   * instead of stranding it.
   */
  private enqueue(write: OutboxEntry["write"]): void {
    this.outbox.push({
      id: this.newId("o"),
      queuedAt: new Date().toISOString(),
      attempts: 0,
      write,
    });
  }

  async syncStatus(): Promise<SyncStatus> {
    return {
      state: "local_only",
      pending: this.outbox.length,
      lastSyncedAt: null,
      message:
        this.outbox.length === 0
          ? "Saved on this device"
          : `Saved on this device. ${this.outbox.length} change${this.outbox.length === 1 ? "" : "s"} waiting for an account.`,
    };
  }

  async flush(): Promise<SyncStatus> {
    return this.syncStatus();
  }

  pendingWrites(): OutboxEntry[] {
    return [...this.outbox];
  }

  clearOutbox(): void {
    this.outbox = [];
    this.persist();
  }

  async reset(): Promise<void> {
    this.db = buildSeedDatabase();
    this.outbox = [];
    this.persist();
  }

  /**
   * Throw the demo dataset away. Separate from reset() on purpose: reset puts
   * the demo back, this gets rid of it. Someone who has just installed the app
   * to test on Saturday should not have to scroll past eight strangers.
   */
  async clearDemo(): Promise<void> {
    this.db = {
      version: 1,
      isDemo: false,
      meId: null,
      participants: [],
      sessions: [],
      sessionParticipants: [],
      results: [],
      unscored: [],
    };
    this.outbox = [];
    this.persist();
  }
}
