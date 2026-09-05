import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { LocalStore } from "./local-store";
import type {
  CrewSession,
  DataStore,
  OutboxEntry,
  Participant,
  Result,
  SessionParticipant,
  SyncStatus,
  UnscoredMeasurement,
} from "./types";

/**
 * Supabase-backed store.
 *
 * Deliberately built as local-first plus a sync engine rather than as a second
 * full adapter. Reads come from the local cache so a screen never blocks on a
 * network call; writes land locally and immediately, then drain through the
 * outbox. Airplane mode is not a special case - it is just a flush that fails
 * and gets retried.
 *
 * The alternative (talk to Postgres directly, cache opportunistically) gives
 * two code paths for every operation and a class of bug where a result is on
 * screen but not on disk. This way there is one path.
 */
export class SupabaseStore implements DataStore {
  readonly mode = "supabase" as const;

  private local: LocalStore;
  private client: SupabaseClient;
  private lastSyncedAt: string | null = null;
  private lastError: string | null = null;
  private flushing = false;

  constructor(url: string, anonKey: string, local?: LocalStore) {
    this.client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
    });
    this.local =
      local ??
      new LocalStore(() => ({
        version: 1,
        meId: null,
        participants: [],
        sessions: [],
        sessionParticipants: [],
        results: [],
        unscored: [],
      }));

    if (typeof window !== "undefined") {
      window.addEventListener("online", () => void this.flush());
    }
  }

  // Reads: local cache, always. A screen never blocks on the network.
  getMe = () => this.local.getMe();
  getParticipant = (id: string) => this.local.getParticipant(id);
  listParticipants = () => this.local.listParticipants();
  listResults = (id: string) => this.local.listResults(id);
  listResultsForSession = (id: string) => this.local.listResultsForSession(id);
  listUnscored = (id: string) => this.local.listUnscored(id);
  listSessions = () => this.local.listSessions();
  getSession = (id: string) => this.local.getSession(id);
  listSessionParticipants = (id: string) => this.local.listSessionParticipants(id);
  subscribe = (fn: () => void) => this.local.subscribe(fn);

  // Writes: local first, then a best-effort flush.
  async setMe(...args: Parameters<DataStore["setMe"]>): Promise<Participant> {
    const p = await this.local.setMe(...args);
    void this.flush();
    return p;
  }

  async createParticipant(
    ...args: Parameters<DataStore["createParticipant"]>
  ): Promise<Participant> {
    const p = await this.local.createParticipant(...args);
    void this.flush();
    return p;
  }

  async claimParticipant(id: string, email: string): Promise<Participant | null> {
    const p = await this.local.claimParticipant(id, email);
    if (p && typeof window !== "undefined") {
      // The magic link is what actually links a guest to a user account. This
      // only records who asked; auth.users is written by Supabase, not by us.
      await this.client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/claim/${id}` },
      });
    }
    void this.flush();
    return p;
  }

  async addResult(input: Omit<Result, "id">): Promise<Result> {
    const r = await this.local.addResult(input);
    void this.flush();
    return r;
  }

  async addUnscored(
    input: Omit<UnscoredMeasurement, "id">,
  ): Promise<UnscoredMeasurement> {
    const m = await this.local.addUnscored(input);
    void this.flush();
    return m;
  }

  async createSession(
    ...args: Parameters<DataStore["createSession"]>
  ): Promise<CrewSession> {
    const s = await this.local.createSession(...args);
    void this.flush();
    return s;
  }

  async lockSession(id: string): Promise<CrewSession | null> {
    const s = await this.local.lockSession(id);
    void this.flush();
    return s;
  }

  async joinSession(
    sessionId: string,
    participantId: string,
    bodyweightKg?: number | null,
  ): Promise<SessionParticipant> {
    const sp = await this.local.joinSession(sessionId, participantId, bodyweightKg);
    void this.flush();
    return sp;
  }

  async setBodyweight(sessionId: string, participantId: string, kg: number) {
    await this.local.setBodyweight(sessionId, participantId, kg);
    void this.flush();
  }

  /**
   * Joining by code has to hit the network - the point is that the session was
   * created on somebody else's phone. Checks the local cache first so a host
   * can reopen their own session with no signal.
   */
  async getSessionByCode(code: string): Promise<CrewSession | null> {
    const cached = await this.local.getSessionByCode(code);
    if (cached) return cached;

    try {
      const { data, error } = await this.client
        .from("sessions")
        .select("*")
        .eq("code", code.trim().toUpperCase())
        .maybeSingle();
      if (error || !data) return null;
      return {
        id: data.id,
        hostParticipantId: data.host_user_id,
        batteryVersion: data.battery_version_id,
        name: data.name,
        code: data.code,
        status: data.status,
        startsAt: data.starts_at,
        locationText: data.location_text,
        lockedAt: data.locked_at,
        createdAt: data.created_at,
      };
    } catch {
      return null;
    }
  }

  // -- sync engine ---------------------------------------------------------

  private online(): boolean {
    return typeof navigator === "undefined" ? true : navigator.onLine !== false;
  }

  async syncStatus(): Promise<SyncStatus> {
    const pending = this.local.pendingWrites().length;
    if (!this.online()) {
      return {
        state: "offline",
        pending,
        lastSyncedAt: this.lastSyncedAt,
        message:
          pending === 0
            ? "Offline. Everything is saved here."
            : `Offline. ${pending} change${pending === 1 ? "" : "s"} saved here, will sync.`,
      };
    }
    if (this.lastError) {
      return {
        state: "error",
        pending,
        lastSyncedAt: this.lastSyncedAt,
        message: `Saved here. Sync failed: ${this.lastError}`,
      };
    }
    if (pending > 0) {
      return {
        state: "pending",
        pending,
        lastSyncedAt: this.lastSyncedAt,
        message: `Syncing ${pending}...`,
      };
    }
    return {
      state: "synced",
      pending: 0,
      lastSyncedAt: this.lastSyncedAt,
      message: "All synced",
    };
  }

  /**
   * Drain the outbox in order and stop at the first failure. Order matters: a
   * result references a participant and a session, so those have to land
   * first. That is why the outbox is a queue and not a set.
   */
  async flush(): Promise<SyncStatus> {
    if (this.flushing || !this.online()) return this.syncStatus();
    this.flushing = true;

    try {
      for (const entry of this.local.pendingWrites()) {
        const ok = await this.push(entry);
        if (!ok) break;
      }
      if (this.lastError === null) {
        this.local.clearOutbox();
        this.lastSyncedAt = new Date().toISOString();
      }
    } finally {
      this.flushing = false;
    }
    return this.syncStatus();
  }

  private async push(entry: OutboxEntry): Promise<boolean> {
    const w = entry.write;
    try {
      switch (w.kind) {
        case "participant": {
          const { error } = await this.client.from("participants").upsert({
            id: w.payload.id,
            user_id: w.payload.userId,
            guest_name: w.payload.userId ? null : w.payload.name,
            guest_sex: w.payload.userId ? null : w.payload.sex,
            guest_birth_date: w.payload.userId ? null : w.payload.birthDate,
            claim_email: w.payload.claimEmail ?? null,
            claimed_at: w.payload.claimedAt ?? null,
          });
          if (error) throw error;
          break;
        }
        case "result": {
          // results is append-only in Postgres, so this is an insert. A
          // duplicate id means the row already landed - not an error.
          const { error } = await this.client.from("results").insert({
            id: w.payload.id,
            participant_id: w.payload.participantId,
            session_id: w.payload.sessionId,
            test_variant_id: w.payload.testVariant,
            raw_value: w.payload.rawValue,
            recorded_at: w.payload.recordedAt,
            recorded_by_participant_id: w.payload.recordedByParticipantId,
            witnessed: w.payload.witnessed,
            notes: w.payload.notes ?? null,
            supersedes_result_id: w.payload.supersedesResultId ?? null,
          });
          if (error && error.code !== "23505") throw error;
          break;
        }
        case "unscored": {
          const { error } = await this.client.from("unscored_measurements").insert({
            id: w.payload.id,
            participant_id: w.payload.participantId,
            session_id: w.payload.sessionId,
            kind: w.payload.kind,
            value: w.payload.value,
            recorded_at: w.payload.recordedAt,
          });
          if (error && error.code !== "23505") throw error;
          break;
        }
        case "session": {
          const { error } = await this.client.from("sessions").upsert({
            id: w.payload.id,
            name: w.payload.name,
            code: w.payload.code,
            status: w.payload.status,
            starts_at: w.payload.startsAt,
            location_text: w.payload.locationText,
          });
          if (error) throw error;
          break;
        }
        case "session_participant": {
          const { error } = await this.client.from("session_participants").upsert({
            session_id: w.payload.sessionId,
            participant_id: w.payload.participantId,
            bodyweight_kg: w.payload.bodyweightKg,
            joined_at: w.payload.joinedAt,
          });
          if (error) throw error;
          break;
        }
        case "lock_session": {
          const { error } = await this.client
            .from("sessions")
            .update({ status: "locked", locked_at: w.payload.lockedAt })
            .eq("id", w.payload.sessionId);
          if (error) throw error;
          break;
        }
      }
      this.lastError = null;
      return true;
    } catch (e) {
      this.lastError = e instanceof Error ? e.message : String(e);
      entry.attempts += 1;
      entry.lastError = this.lastError;
      return false;
    }
  }

  async reset(): Promise<void> {
    await this.local.reset();
  }
}
