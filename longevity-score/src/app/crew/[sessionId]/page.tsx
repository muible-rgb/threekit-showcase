"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Check,
  Copy,
  Lock,
  MapPin,
  Plus,
  Trophy,
  UserPlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { BandBadge, Chip } from "@/components/ui/badge";
import { ProfileGate } from "@/components/profile-gate";
import { AddGuestForm } from "@/components/add-guest-form";
import { ClaimPrompt } from "@/components/claim-prompt";
import { useDb, useStore } from "@/lib/data/store-context";
import { BATTERY_TEST_COUNT } from "@/lib/battery";
import { priorCompleteBefore, sessionScoreFor } from "@/lib/batteries";
import { liveBoard, mostImproved, rankBoard } from "@/lib/scoring/board";
import { formatDate, oneDecimal } from "@/lib/utils";
import type { BoardEntry } from "@/lib/scoring/board";

export default function SessionPage() {
  const params = useParams<{ sessionId: string }>();
  const sessionId = params?.sessionId ?? "";
  const { me, ready, store, refresh } = useStore();
  const db = useDb();
  const [addingGuest, setAddingGuest] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  const session = db?.sessions.find((s) => s.id === sessionId) ?? null;

  const roster = React.useMemo(() => {
    if (!db || !session) return [];
    return db.sessionParticipants
      .filter((sp) => sp.sessionId === session.id)
      .map((sp) => {
        const participant = db.participants.find((p) => p.id === sp.participantId)!;
        const score = sessionScoreFor(
          participant,
          db.results.filter((r) => r.participantId === participant.id),
          session.id,
        );
        return { sp, participant, score };
      })
      .filter((row) => row.participant !== undefined);
  }, [db, session]);

  if (!ready) return <div className="h-64 animate-pulse rounded-2xl bg-ink-raised" />;
  if (!me) return <ProfileGate />;
  if (!session) {
    return (
      <Card>
        <CardBody className="pt-5">
          <p className="text-sm text-paper-dim">
            No session with that id on this device.
          </p>
          <Link href="/crew" className="mt-3 inline-block">
            <Button variant="secondary">Back to crew</Button>
          </Link>
        </CardBody>
      </Card>
    );
  }

  const isHost = session.hostParticipantId === me.id;
  const locked = session.status === "locked";
  const entries: BoardEntry[] = roster.map((r) => ({
    participantId: r.participant.id,
    displayName: r.participant.name,
    score: r.score,
  }));

  const board = locked ? rankBoard(entries) : null;
  const live = locked ? null : liveBoard(entries);

  const improved = locked
    ? mostImproved(
        roster.map((r) => ({
          participantId: r.participant.id,
          displayName: r.participant.name,
          current: r.score,
          previous: priorCompleteBefore(
            r.participant,
            db!.results.filter((x) => x.participantId === r.participant.id),
            session.startsAt ?? session.createdAt,
          ),
        })),
      )
    : null;

  const unclaimedGuests = roster.filter(
    (r) => r.participant.userId === null && !r.participant.claimedAt,
  );

  const shareUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/join/${session.code}`;

  return (
    <div className="space-y-5">
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">{session.name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-paper-faint">
              <span>{formatDate(session.startsAt ?? session.createdAt)}</span>
              {session.locationText && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={10} /> {session.locationText}
                </span>
              )}
              <span>{roster.length} in</span>
            </p>
          </div>
          {locked && (
            <span className="flex shrink-0 items-center gap-1 rounded-full bg-ink-line/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-paper-dim">
              <Lock size={10} /> Locked
            </span>
          )}
        </div>
      </div>

      {!locked && (
        <Card>
          <CardBody className="pt-5">
            <p className="text-[11px] uppercase tracking-wider text-paper-faint">
              Join code
            </p>
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="tnum font-mono text-4xl font-bold tracking-[0.25em]">
                {session.code}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareUrl);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  } catch {
                    setCopied(false);
                  }
                }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Share link"}
              </Button>
            </div>
          </CardBody>
        </Card>
      )}

      {!locked && (
        <div className="grid gap-3">
          <Link href="/">
            <Button size="lg" className="w-full justify-between">
              <span className="flex items-center gap-2">
                <Plus size={20} /> Enter my results
              </span>
            </Button>
          </Link>
          {isHost && (
            <Button
              size="lg"
              variant="secondary"
              className="w-full justify-between"
              onClick={() => setAddingGuest(true)}
            >
              <span className="flex items-center gap-2">
                <UserPlus size={20} /> Add someone
              </span>
            </Button>
          )}
        </div>
      )}

      {addingGuest && (
        <AddGuestForm
          onCancel={() => setAddingGuest(false)}
          onAdd={async (guest) => {
            const participant = await store.createParticipant(guest);
            await store.joinSession(session.id, participant.id);
            refresh();
            setAddingGuest(false);
          }}
        />
      )}

      {live && <LiveBoard rows={live} meId={me.id} />}

      {board && <FinalBoard rows={board} />}

      {improved && <MostImprovedBoard result={improved} />}

      {locked && unclaimedGuests.length > 0 && (
        <ClaimPrompt
          guests={unclaimedGuests.map((g) => ({
            id: g.participant.id,
            name: g.participant.name,
            composite: g.score.composite,
          }))}
        />
      )}

      {isHost && !locked && (
        <Card className="ring-ink-line">
          <CardBody className="pt-5">
            <p className="text-sm font-semibold">Lock the session</p>
            <p className="mt-1 text-xs text-paper-dim">
              Freezes the board. No score changes.
            </p>
            <Button
              variant="secondary"
              className="mt-3 w-full"
              onClick={async () => {
                await store.lockSession(session.id);
                refresh();
              }}
            >
              <Lock size={16} /> Lock and publish the board
            </Button>
          </CardBody>
        </Card>
      )}

    </div>
  );
}

function LiveBoard({
  rows,
  meId,
}: {
  rows: ReturnType<typeof liveBoard>;
  meId: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Live board</CardTitle>
        <p className="mt-1 text-[11px] text-paper-faint">
          Running average so far. Not a Longevity Score.
        </p>
      </CardHeader>
      <CardBody className="space-y-0">
        {rows.map((row) => (
          <div
            key={row.participantId}
            className="flex items-center gap-3 border-t border-ink-line-soft py-3"
          >
            <span className="tnum w-5 text-sm font-bold text-paper-faint">{row.rank}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {row.displayName}
                {row.participantId === meId && (
                  <span className="ml-1.5 text-[10px] uppercase tracking-wider text-signal">
                    you
                  </span>
                )}
              </p>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-1 w-20 overflow-hidden rounded-full bg-ink-line">
                  <div
                    className="h-full rounded-full bg-signal"
                    style={{
                      width: `${(row.testsCompleted / BATTERY_TEST_COUNT) * 100}%`,
                    }}
                  />
                </div>
                <span className="tnum text-[11px] text-paper-faint">
                  {row.testsCompleted}/{BATTERY_TEST_COUNT}
                </span>
              </div>
            </div>
            <div className="text-right">
              <span className="tnum block text-lg font-bold text-paper-dim">
                {row.runningAverage === null ? "-" : oneDecimal(row.runningAverage)}
              </span>
              <span className="text-[9px] uppercase tracking-wider text-paper-faint">
                running avg
              </span>
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function FinalBoard({ rows }: { rows: ReturnType<typeof rankBoard> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Final board</CardTitle>
      </CardHeader>
      <CardBody className="space-y-0">
        {rows.map((row) => (
          <div
            key={row.participantId}
            className="flex items-center gap-3 border-t border-ink-line-soft py-3 first:border-t-0 first:pt-0"
          >
            <span className="tnum w-7 text-lg font-bold text-paper-faint">
              {row.score.composite === null ? "-" : row.rank}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{row.displayName}</p>
              {row.score.composite === null && (
                <p className="text-xs text-paper-faint">
                  {row.score.testsCompleted}/{row.score.testsRequired} - no score
                </p>
              )}
              {row.tieBroken && (
                <p className="text-xs text-paper-faint">
                  Tie, split on best single test
                </p>
              )}
            </div>
            {row.score.composite !== null && (
              <div className="flex items-center gap-2.5">
                <span className="tnum text-xl font-bold">
                  {oneDecimal(row.score.composite)}
                </span>
                <BandBadge band={row.score.band!} size="sm" />
              </div>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function MostImprovedBoard({ result }: { result: ReturnType<typeof mostImproved> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy size={14} /> Most improved
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-0">
        {result.ranked.length === 0 && (
          <p className="pb-2 text-sm text-paper-faint">
            Nothing to compare against yet. Next quarter.
          </p>
        )}
        {result.ranked.map((row) => (
          <div
            key={row.participantId}
            className="flex items-center justify-between border-t border-ink-line-soft py-3 first:border-t-0 first:pt-0"
          >
            <div>
              <p className="text-sm font-semibold">{row.displayName}</p>
              <p className="tnum text-xs text-paper-faint">
                {oneDecimal(row.previousComposite)} to {oneDecimal(row.currentComposite)}
              </p>
            </div>
            <span
              className={
                row.delta >= 0
                  ? "tnum text-lg font-bold text-up"
                  : "tnum text-lg font-bold text-down"
              }
            >
              {row.delta > 0 ? "+" : ""}
              {oneDecimal(row.delta)}
            </span>
          </div>
        ))}

        {result.firstTimers.length > 0 && (
          <div className="mt-4 border-t border-ink-line-soft pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-paper-faint">
              First battery
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {result.firstTimers.map((f) => (
                <Chip key={f.participantId}>{f.displayName}</Chip>
              ))}
            </div>
          </div>
        )}

        {result.ineligible.length > 0 && (
          <div className="mt-4 border-t border-ink-line-soft pt-3">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-paper-faint">
              Not comparable
            </p>
            <ul className="mt-1.5 space-y-1">
              {result.ineligible.map((f) => (
                <li key={f.participantId} className="text-xs text-paper-dim">
                  <span className="font-medium text-paper">{f.displayName}</span> -{" "}
                  {f.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
