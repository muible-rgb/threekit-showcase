import type { Sex } from "@/lib/scoring/types";

export interface Participant {
  id: string;
  /** Null for guests until they claim their results. */
  userId: string | null;
  name: string;
  sex: Sex;
  birthDate: string; // YYYY-MM-DD
  claimEmail?: string | null;
  claimedAt?: string | null;
  createdAt: string;
}

export interface CrewSession {
  id: string;
  hostParticipantId: string;
  batteryVersion: string;
  name: string;
  code: string;
  status: "open" | "locked";
  startsAt: string | null;
  locationText: string | null;
  lockedAt: string | null;
  createdAt: string;
}

export interface SessionParticipant {
  sessionId: string;
  participantId: string;
  /** Pounds. Drives the carry load; never scored. */
  bodyweightKg: number | null;
  joinedAt: string;
}

export interface Result {
  id: string;
  participantId: string;
  sessionId: string | null;
  testVariant: string;
  rawValue: number;
  recordedAt: string;
  recordedByParticipantId: string | null;
  witnessed: boolean;
  notes?: string | null;
  supersedesResultId?: string | null;
}

export interface UnscoredMeasurement {
  id: string;
  participantId: string;
  sessionId: string | null;
  kind: string;
  value: number;
  recordedAt: string;
}

export interface Database {
  version: number;
  /**
   * True while the database is still the shipped demo dataset. Set at seed
   * time and cleared the moment someone starts their own data, so the app can
   * be honest on screen about whose numbers are on display.
   */
  isDemo?: boolean;
  meId: string | null;
  participants: Participant[];
  sessions: CrewSession[];
  sessionParticipants: SessionParticipant[];
  results: Result[];
  unscored: UnscoredMeasurement[];
}

export type PendingWrite =
  | { kind: "result"; payload: Result }
  | { kind: "unscored"; payload: UnscoredMeasurement }
  | { kind: "participant"; payload: Participant }
  | { kind: "session"; payload: CrewSession }
  | { kind: "session_participant"; payload: SessionParticipant }
  | { kind: "lock_session"; payload: { sessionId: string; lockedAt: string } };

export interface OutboxEntry {
  id: string;
  queuedAt: string;
  attempts: number;
  lastError?: string;
  write: PendingWrite;
}

export type SyncState = "local_only" | "synced" | "pending" | "offline" | "error";

export interface SyncStatus {
  state: SyncState;
  pending: number;
  lastSyncedAt: string | null;
  message: string;
}

/**
 * Everything the app does to storage goes through here.
 *
 * Both adapters write locally first and return immediately - that is what
 * makes a result survive airplane mode and what keeps test mode off the
 * critical path of a network round trip.
 */
export interface DataStore {
  readonly mode: "local" | "supabase";

  getMe(): Promise<Participant | null>;
  setMe(p: Omit<Participant, "id" | "createdAt"> & { id?: string }): Promise<Participant>;

  getParticipant(id: string): Promise<Participant | null>;
  listParticipants(): Promise<Participant[]>;
  createParticipant(
    p: Omit<Participant, "id" | "createdAt" | "userId"> & { userId?: string | null },
  ): Promise<Participant>;
  claimParticipant(id: string, email: string): Promise<Participant | null>;

  listResults(participantId: string): Promise<Result[]>;
  listResultsForSession(sessionId: string): Promise<Result[]>;
  addResult(r: Omit<Result, "id">): Promise<Result>;

  listUnscored(participantId: string): Promise<UnscoredMeasurement[]>;
  addUnscored(m: Omit<UnscoredMeasurement, "id">): Promise<UnscoredMeasurement>;

  listSessions(): Promise<CrewSession[]>;
  getSession(id: string): Promise<CrewSession | null>;
  getSessionByCode(code: string): Promise<CrewSession | null>;
  createSession(
    s: Omit<CrewSession, "id" | "code" | "createdAt" | "status" | "lockedAt">,
  ): Promise<CrewSession>;
  lockSession(id: string): Promise<CrewSession | null>;
  joinSession(
    sessionId: string,
    participantId: string,
    bodyweightKg?: number | null,
  ): Promise<SessionParticipant>;
  listSessionParticipants(sessionId: string): Promise<SessionParticipant[]>;
  setBodyweight(sessionId: string, participantId: string, kg: number): Promise<void>;

  syncStatus(): Promise<SyncStatus>;
  flush(): Promise<SyncStatus>;

  /** Wipe everything and re-seed the demo dataset. */
  reset(): Promise<void>;
  /** Throw the demo dataset away and start empty. */
  clearDemo(): Promise<void>;
}
