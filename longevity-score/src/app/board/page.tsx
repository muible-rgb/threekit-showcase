"use client";

import * as React from "react";
import { Register } from "@/components/register";
import { SectionLabel } from "@/components/ui/row";
import { DemoBanner } from "@/components/demo-banner";
import { useDb, useStore } from "@/lib/data/store-context";
import { currentCard } from "@/lib/batteries";
import { rankBoard, type BoardEntry } from "@/lib/scoring/board";
import { ageAt } from "@/lib/scoring/cohort";
import { BATTERY_TEST_COUNT } from "@/lib/battery";
import { BAND_LABELS, EMPTY, ageBandLabel, cn, oneDecimal } from "@/lib/utils";

type Filter = "all" | "cohort";

/**
 * The board.
 *
 * Ranked on composite, which is already cohort-relative - a 60-year-old woman
 * and a 30-year-old man are compared on how far each sits above their own
 * population, not on raw output. That is the only reason this ranking means
 * anything.
 *
 * The accent appears once: your row.
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

  if (!ready) return null;
  if (!me) return <Register />;

  const myAge = ageAt(me.birthDate, new Date().toISOString());
  const myBandMin = Math.floor(myAge / 5) * 5;

  const filtered =
    filter === "all"
      ? rows
      : rows.filter(
          (r) => r.participant.sex === me.sex && Math.floor(r.age / 5) * 5 === myBandMin,
        );

  const entries: BoardEntry[] = filtered.map((r) => ({
    participantId: r.participant.id,
    displayName: r.participant.name,
    score: r.card.score,
  }));
  const board = rankBoard(entries);
  const mine = board.find((b) => b.participantId === me.id);
  const scored = board.filter((b) => b.score.composite !== null).length;

  return (
    <div>
      <header className="border-b border-rule-2 pb-4 pt-4">
        <h1 className="name text-[22px]">Board</h1>
        {mine && mine.score.composite !== null && (
          <p className="meta mt-2">
            You are {mine.rank} of {scored} · top {Math.round((100 * mine.rank) / scored)}%
          </p>
        )}
      </header>

      <div className="mt-4 flex">
        {(
          [
            ["all", "Everyone"],
            ["cohort", ageBandLabel(myAge, me.sex)],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={cn(
              "label flex-1 border py-2.5",
              filter === key
                ? "border-chalk text-chalk"
                : "border-rule-2 text-chalk-off",
              key === "cohort" && "-ml-px",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <SectionLabel>
        {filter === "all" ? "All comers" : "Your cohort"}
      </SectionLabel>

      <div>
        {board.length === 0 && (
          <p className="meta py-row">Nobody here has posted a result.</p>
        )}
        {board.map((row) => {
          const meta = filtered.find((r) => r.participant.id === row.participantId)!;
          const isMe = row.participantId === me.id;
          const composite = row.score.composite;

          return (
            <div
              key={row.participantId}
              className={cn(
                "grid grid-cols-[26px_1fr_auto] items-center gap-gap border-b border-rule py-row",
                isMe && "-mx-pad border-l-[3px] border-l-accent bg-board-2 px-pad",
              )}
            >
              <span className="meta">{composite === null ? EMPTY : row.rank}</span>

              <div className="min-w-0">
                <p className="name truncate text-name">{row.displayName}</p>
                <p className="meta mt-0.5">
                  {ageBandLabel(meta.age, meta.participant.sex)}
                  {composite === null &&
                    ` · ${row.score.testsCompleted}/${BATTERY_TEST_COUNT}`}
                  {row.tieBroken && " · tie"}
                </p>
              </div>

              <div className="text-right">
                <p
                  className={cn(
                    "num text-score font-500",
                    isMe && "text-accent",
                    composite === null && "text-chalk-off",
                  )}
                >
                  {composite === null ? EMPTY : oneDecimal(composite)}
                </p>
                {composite !== null && (
                  <p className="label mt-0.5">{BAND_LABELS[row.score.band!]}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="meta mt-5">
        Incomplete cards rank below every scored one. Eight of eight or you are
        not ranked.
      </p>

      <DemoBanner />
    </div>
  );
}
