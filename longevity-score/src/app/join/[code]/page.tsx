"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/data/store-context";
import { formatDate, cn } from "@/lib/utils";
import type { CrewSession } from "@/lib/data/types";
import type { Sex } from "@/lib/scoring/types";

/**
 * The link a host shares. Full-bleed, no app chrome, and it works for someone
 * who has never opened this app before: name, sex, birth date, in. An account
 * is a thing they can do afterwards, not a wall in front of the session.
 */
export default function JoinPage() {
  const params = useParams<{ code: string }>();
  const code = (params?.code ?? "").toUpperCase();
  const router = useRouter();
  const { store, me, ready, refresh } = useStore();

  const [session, setSession] = React.useState<CrewSession | null>(null);
  const [state, setState] = React.useState<"loading" | "found" | "missing">("loading");
  const [name, setName] = React.useState("");
  const [sex, setSex] = React.useState<Sex | null>(null);
  const [birthDate, setBirthDate] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void (async () => {
      const found = await store.getSessionByCode(code);
      if (cancelled) return;
      setSession(found);
      setState(found ? "found" : "missing");
      if (found && me) {
        setName(me.name);
        setSex(me.sex);
        setBirthDate(me.birthDate);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, store, code, me]);

  const valid =
    name.trim() !== "" && sex !== null && /^\d{4}-\d{2}-\d{2}$/.test(birthDate);

  async function join() {
    if (!session || !valid) return;
    setBusy(true);
    const participant = me
      ? await store.setMe({ name: name.trim(), sex: sex!, birthDate, userId: me.userId })
      : await store.setMe({ name: name.trim(), sex: sex!, birthDate, userId: null });
    await store.joinSession(session.id, participant.id);
    refresh();
    router.push(`/crew/${session.id}`);
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col justify-center px-5 py-10">
      <div className="mb-6 text-center">
        <span className="text-base font-bold tracking-tight">Longevity</span>{" "}
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-signal">
          Score
        </span>
      </div>

      {state === "loading" && (
        <div className="h-56 animate-pulse rounded-2xl bg-ink-raised" />
      )}

      {state === "missing" && (
        <Card>
          <CardBody className="pt-5 text-center">
            <p className="tnum font-mono text-2xl tracking-[0.3em] text-paper-faint">
              {code}
            </p>
            <p className="mt-3 text-sm text-paper-dim">
              No session with that code.
            </p>
          </CardBody>
        </Card>
      )}

      {state === "found" && session && (
        <Card>
          <CardHeader>
            <CardTitle>Joining</CardTitle>
          </CardHeader>
          <CardBody className="space-y-5">
            <div>
              <p className="text-xl font-bold">{session.name}</p>
              <p className="mt-0.5 text-xs text-paper-faint">
                {formatDate(session.startsAt ?? session.createdAt)}
                {session.locationText ? ` - ${session.locationText}` : ""}
              </p>
            </div>

            {session.status === "locked" ? (
              <p className="rounded-xl bg-ink px-4 py-3 text-sm text-paper-dim ring-1 ring-ink-line">
                Locked. The board is final.
              </p>
            ) : (
              <>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  className="h-12 w-full rounded-xl bg-ink px-4 ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
                />
                <div className="grid grid-cols-2 gap-3">
                  {(["F", "M"] as const).map((option) => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setSex(option)}
                      className={cn(
                        "h-12 rounded-xl font-semibold ring-1 transition-colors",
                        sex === option
                          ? "bg-signal text-ink ring-signal"
                          : "bg-ink text-paper-dim ring-ink-line",
                      )}
                    >
                      {option === "F" ? "Female" : "Male"}
                    </button>
                  ))}
                </div>
                <input
                  type="date"
                  value={birthDate}
                  max={new Date().toISOString().slice(0, 10)}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="h-12 w-full rounded-xl bg-ink px-4 ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
                />
                <p className="text-xs text-paper-faint">
                  Needed to score you against your own age and sex.
                </p>
                <Button
                  size="lg"
                  className="w-full"
                  disabled={!valid || busy}
                  onClick={join}
                >
                  {busy ? "Joining..." : "Join the session"}
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
