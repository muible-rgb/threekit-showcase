"use client";

import * as React from "react";
import { getStore } from "./index";
import { LocalStore } from "./local-store";
import type {
  CrewSession,
  Database,
  DataStore,
  Participant,
  Result,
  SessionParticipant,
  SyncStatus,
  UnscoredMeasurement,
} from "./types";

interface StoreContextValue {
  store: DataStore;
  ready: boolean;
  /** Bumped on every write so screens re-read. */
  revision: number;
  db: Database | null;
  me: Participant | null;
  sync: SyncStatus;
  refresh: () => void;
}

const StoreContext = React.createContext<StoreContextValue | null>(null);

/**
 * The store is created lazily on the client. It reads localStorage in its
 * constructor, so it must not run during SSR - hence the mount guard rather
 * than a module-level singleton.
 */
export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [store] = React.useState<DataStore>(() => getStore());
  const [revision, setRevision] = React.useState(0);
  const [ready, setReady] = React.useState(false);
  const [db, setDb] = React.useState<Database | null>(null);
  const [me, setMe] = React.useState<Participant | null>(null);
  const [sync, setSync] = React.useState<SyncStatus>({
    state: "local_only",
    pending: 0,
    lastSyncedAt: null,
    message: "Saved on this device",
  });

  const refresh = React.useCallback(() => setRevision((r) => r + 1), []);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [meValue, syncValue] = await Promise.all([
        store.getMe(),
        store.syncStatus(),
      ]);
      if (cancelled) return;
      setMe(meValue);
      setSync(syncValue);
      setDb(snapshotOf(store));
      setReady(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [store, revision]);

  React.useEffect(() => {
    const sub = (store as unknown as { subscribe?: (fn: () => void) => () => void })
      .subscribe;
    if (!sub) return;
    return sub.call(store, refresh);
  }, [store, refresh]);

  // Connectivity changes the sync copy, so re-read it when it flips.
  React.useEffect(() => {
    const onChange = () => void store.syncStatus().then(setSync);
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    return () => {
      window.removeEventListener("online", onChange);
      window.removeEventListener("offline", onChange);
    };
  }, [store]);

  const value = React.useMemo(
    () => ({ store, ready, revision, db, me, sync, refresh }),
    [store, ready, revision, db, me, sync, refresh],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

function snapshotOf(store: DataStore): Database | null {
  const s = store as unknown as { snapshot?: () => Database };
  if (typeof s.snapshot === "function") return s.snapshot();
  return null;
}

export function useStore(): StoreContextValue {
  const ctx = React.useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside <StoreProvider>");
  return ctx;
}

/** Convenience readers. All synchronous against the in-memory snapshot. */
export function useDb(): Database | null {
  return useStore().db;
}

export function useParticipants(): Participant[] {
  return useDb()?.participants ?? [];
}

export function useSessions(): CrewSession[] {
  const db = useDb();
  if (!db) return [];
  return [...db.sessions].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

export function useResultsFor(participantId: string | null | undefined): Result[] {
  const db = useDb();
  if (!db || !participantId) return [];
  return db.results.filter((r) => r.participantId === participantId);
}

export function useSessionRoster(sessionId: string | null): SessionParticipant[] {
  const db = useDb();
  if (!db || !sessionId) return [];
  return db.sessionParticipants.filter((sp) => sp.sessionId === sessionId);
}

export function useUnscoredFor(
  participantId: string | null | undefined,
): UnscoredMeasurement[] {
  const db = useDb();
  if (!db || !participantId) return [];
  return db.unscored.filter((m) => m.participantId === participantId);
}

/** Exposed so the settings screen can reset the demo dataset. */
export function isLocalStore(store: DataStore): store is LocalStore {
  return store instanceof LocalStore;
}
