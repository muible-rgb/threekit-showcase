"use client";

import * as React from "react";
import { Card, CardBody } from "@/components/ui/card";
import { BandBadge } from "@/components/ui/badge";
import { Register } from "@/components/register";
import { useDb, useStore } from "@/lib/data/store-context";
import { currentCard } from "@/lib/batteries";
import { rankBoard, type BoardEntry } from "@/lib/scoring/board";
import { ageAt } from "@/lib/scoring/cohort";
import { BATTERY_TEST_COUNT } from "@/lib/battery";
import { ageBandLabel, cn, oneDecimal } from "@/lib/utils";

type Filter = "all" | "cohort";

/**
 * The leaderboard.
 *
 * Ranked on composite, which is already cohort-relative - so a 60-year-old
 * woman and a 30-year-old man on this board are being compared on how far
 * above their own population each of them sits, not on raw output. That is the
 * whole reason this ranking is worth anything.
 *
 * "My band" narrows it to your own sex and five-year band, which is the
 * strictly-like-for-like view. Both are honest; they answer different questions.
 */
export default function BoardPage() {
  const { me, ready } = useStore();
  const db = useDb();
  const [filter, setFilter] = React.useState<Filter>("all");

  const rows = React.useMemo(() => {
    if (!db) return [];
    return db.participants
      .map((p) => {
        const card = currentCard(
          p,
          db.results.filter((r) => r.participantId === p.id),
        );
        return {
          participant: p,
          card,
          age: ageAt(p.birthDate, card.updatedAt ?? new Date().toISOString()),
        };
      })
      .filter((r) => r.card.score.testsCompleted > 0);
  }, [db]);

  if (!ready) return <div className="h-96 animate-pulse rounded-2xl bg-ink-raised" />;
  if (!me) return <Register />;

  const myAge = ageAt(me.birthDate, new Date().toISOString());
  const myBandMin = Math.floor(myAge / 5) * 5;

  const filtered =
    filter === "all"
      ? rows
      : rows.filter(
          (r) =>
            r.participant.sex === me.sex &&
            Math.floor(r.age / 5) * 5 === myBandMin,
        );

  const entries: BoardEntry[] = filtered.map((r) => ({
    participantId: r.participant.id,
    displayName: r.participant.name,
    score: r.card.score,
  }));
  const board = rankBoard(entries);
  const mine = board.find((b) => b.participantId === me.id);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Board</h1>
        <p className="mt-1 text-sm text-paper-dim">
          Everyone is ranked on how far they sit above their own cohort.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-ink-raised p-1 ring-1 ring-ink-line">
        {(
          [
            ["all", "Everyone"],
            ["cohort", `My band (${ageBandLabel(myAge, me.sex)})`],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "h-10 rounded-lg text-xs font-semibold transition-colors",
              filter === key ? "bg-signal text-ink" : "text-paper-dim",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mine && mine.score.composite !== null && (
        <Card className="ring-signal/40">
          <CardBody className="flex items-center justify-between pt-5">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-paper-faint">
                You
              </p>
              <p className="tnum mt-0.5 text-3xl font-bold">
                {mine.rank}
                <span className="text-base font-medium text-paper-faint">
                  {" "}
                  of {board.filter((b) => b.score.composite !== null).length}
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <span className="tnum text-2xl font-bold">
                {oneDecimal(mine.score.composite)}
              </span>
              <BandBadge band={mine.score.band!} size="sm" />
            </div>
          </CardBody>
        </Card>
      )}

      <div className="overflow-hidden rounded-2xl bg-ink-raised ring-1 ring-ink-line">
        {board.length === 0 && (
          <p className="px-4 py-6 text-sm text-paper-faint">
            Nobody in this band has posted a result yet.
          </p>
        )}
        {board.map((row) => {
          const meta = filtered.find((r) => r.participant.id === row.participantId)!;
          const isMe = row.participantId === me.id;
          return (
            <div
              key={row.participantId}
              className={cn(
                "flex items-center gap-3 border-t border-ink-line-soft px-4 py-3 first:border-t-0",
                isMe && "bg-signal/5",
              )}
            >
              <span className="tnum w-6 text-base font-bold text-paper-faint">
                {row.score.composite === null ? "-" : row.rank}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {row.displayName}
                  {isMe && (
                    <span className="ml-1.5 text-[10px] uppercase tracking-wider text-signal">
                      you
                    </span>
                  )}
                </p>
                <p className="text-xs text-paper-faint">
                  {ageBandLabel(meta.age, meta.participant.sex)}
                  {row.score.composite === null &&
                    ` - ${row.score.testsCompleted}/${BATTERY_TEST_COUNT}`}
                  {row.tieBroken && " - tie, split on best test"}
                </p>
              </div>
              {row.score.composite !== null ? (
                <div className="flex shrink-0 items-center gap-2.5">
                  <span className="tnum text-lg font-bold">
                    {oneDecimal(row.score.composite)}
                  </span>
                  <BandBadge band={row.score.band!} size="sm" />
                </div>
              ) : (
                <span className="shrink-0 text-xs text-paper-faint">No score</span>
              )}
            </div>
          );
        })}
      </div>

      <p className="px-1 text-xs leading-relaxed text-paper-faint">
        Incomplete cards sit below everyone with a score. Eight of eight or you
        are not ranked.
      </p>
    </div>
  );
}
