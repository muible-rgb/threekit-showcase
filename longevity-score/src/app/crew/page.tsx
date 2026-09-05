"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Lock, MapPin, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { Chip } from "@/components/ui/badge";
import { ProfileGate } from "@/components/profile-gate";
import {
  useDb,
  useSessions,
  useStore,
} from "@/lib/data/store-context";
import { BATTERY_SLUG } from "@/lib/battery";
import { formatDate } from "@/lib/utils";

export default function CrewPage() {
  const { me, ready, store, refresh } = useStore();
  const sessions = useSessions();
  const db = useDb();
  const router = useRouter();

  const [mode, setMode] = React.useState<"idle" | "create" | "join">("idle");

  if (!ready) return <div className="h-64 animate-pulse rounded-2xl bg-ink-raised" />;
  if (!me) return <ProfileGate />;

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Crew</h1>

      {mode === "idle" && (
        <div className="grid gap-3">
          <Button size="lg" className="w-full justify-between" onClick={() => setMode("create")}>
            <span className="flex items-center gap-2">
              <Plus size={20} /> Host a session
            </span>
            <ArrowRight size={18} />
          </Button>
          <Button
            size="lg"
            variant="secondary"
            className="w-full justify-between"
            onClick={() => setMode("join")}
          >
            <span className="flex items-center gap-2">
              <Users size={20} /> Join with a code
            </span>
            <ArrowRight size={18} />
          </Button>
        </div>
      )}

      {mode === "create" && (
        <CreateSessionForm
          onCancel={() => setMode("idle")}
          onCreate={async (input) => {
            const session = await store.createSession({
              hostParticipantId: me.id,
              batteryVersion: BATTERY_SLUG,
              name: input.name,
              startsAt: input.startsAt,
              locationText: input.locationText,
            });
            await store.joinSession(session.id, me.id);
            refresh();
            router.push(`/crew/${session.id}`);
          }}
        />
      )}

      {mode === "join" && (
        <JoinByCodeForm
          onCancel={() => setMode("idle")}
          onFound={(id) => router.push(`/crew/${id}`)}
        />
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your sessions</CardTitle>
        </CardHeader>
        <CardBody className="space-y-0">
          {sessions.length === 0 && (
            <p className="py-2 text-sm text-paper-faint">Nothing yet.</p>
          )}
          {sessions.map((s) => {
            const count =
              db?.sessionParticipants.filter((sp) => sp.sessionId === s.id).length ?? 0;
            return (
              <Link
                key={s.id}
                href={`/crew/${s.id}`}
                className="flex items-center justify-between gap-3 border-t border-ink-line-soft py-3.5 first:border-t-0 first:pt-0"
              >
                <div className="min-w-0">
                  <p className="flex items-center gap-2 text-sm font-semibold">
                    {s.name}
                    {s.status === "locked" && (
                      <Lock size={12} className="text-paper-faint" />
                    )}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-paper-faint">
                    <span>{s.startsAt ? formatDate(s.startsAt) : "No date"}</span>
                    {s.locationText && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={10} />
                        {s.locationText}
                      </span>
                    )}
                    <span>
                      {count} {count === 1 ? "person" : "people"}
                    </span>
                  </p>
                </div>
                <Chip className="tnum shrink-0 font-mono tracking-widest">{s.code}</Chip>
              </Link>
            );
          })}
        </CardBody>
      </Card>
    </div>
  );
}

function CreateSessionForm({
  onCreate,
  onCancel,
}: {
  onCreate: (input: {
    name: string;
    startsAt: string | null;
    locationText: string | null;
  }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Host a session</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <Field label="Name">
          <input
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            placeholder="Saturday morning"
            className="h-12 w-full rounded-xl bg-ink px-4 ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
          />
        </Field>
        <Field label="Date">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-12 w-full rounded-xl bg-ink px-4 ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
          />
        </Field>
        <Field label="Where">
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="The park, by the pull-up bars"
            className="h-12 w-full rounded-xl bg-ink px-4 ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
          />
        </Field>
        <div className="flex gap-3 pt-1">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={name.trim() === "" || busy}
            onClick={async () => {
              setBusy(true);
              await onCreate({
                name: name.trim(),
                startsAt: date ? new Date(`${date}T09:00:00`).toISOString() : null,
                locationText: location.trim() || null,
              });
            }}
          >
            {busy ? "Creating..." : "Create"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function JoinByCodeForm({
  onFound,
  onCancel,
}: {
  onFound: (sessionId: string) => void;
  onCancel: () => void;
}) {
  const { store, me, refresh } = useStore();
  const [code, setCode] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  async function submit() {
    setBusy(true);
    setError(null);
    const session = await store.getSessionByCode(code);
    if (!session) {
      setError("No session with that code. Check it with whoever is hosting.");
      setBusy(false);
      return;
    }
    if (me) await store.joinSession(session.id, me.id);
    refresh();
    onFound(session.id);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join with a code</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <input
          value={code}
          autoFocus
          autoCapitalize="characters"
          maxLength={6}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
          placeholder="ABC234"
          className="tnum h-16 w-full rounded-xl bg-ink text-center font-mono text-3xl tracking-[0.4em] ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
        />
        {error && <p className="text-sm text-risk">{error}</p>}
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button className="flex-1" disabled={code.length !== 6 || busy} onClick={submit}>
            {busy ? "Looking..." : "Join"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-paper-faint">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
