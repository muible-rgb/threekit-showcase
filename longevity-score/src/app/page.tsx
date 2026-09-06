"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/row";
import { EntrySheet } from "@/components/entry-sheet";
import { Register } from "@/components/register";
import { DemoBanner } from "@/components/demo-banner";
import {
  BATTERY_TESTS,
  BATTERY_TEST_COUNT,
  CARRY_LOAD_TOLERANCE,
  SOLO_SESSION_ID,
  carryLoadDrift,
  type BatteryTest,
} from "@/lib/battery";
import { useResultsFor, useStore } from "@/lib/data/store-context";
import { currentCard, previousCard } from "@/lib/batteries";
import { retestDelta } from "@/lib/scoring/board";
import { ageAt } from "@/lib/scoring/cohort";
import { buildSharePayload, encodeShareToken } from "@/lib/share-token";
import {
  BAND_LABELS,
  EMPTY,
  ageBandLabel,
  betterThanSentence,
  formatDate,
  formatRaw,
  formatRawDelta,
  formatSigned,
  oneDecimal,
  rawImproved,
} from "@/lib/utils";
import type { BatteryScore, TestPercentile } from "@/lib/scoring/types";

/**
 * The scorecard. Eight rows, one per test.
 *
 * You see what you have and what you are missing, you tap a row, you type the
 * number you got outside. The accent appears exactly once - on the score.
 */
export default function ScorecardPage() {
  const { me, ready, store, refresh, db } = useStore();
  const results = useResultsFor(me?.id);
  const [editing, setEditing] = React.useState<BatteryTest | null>(null);

  const card = React.useMemo(() => (me ? currentCard(me, results) : null), [me, results]);
  const previous = React.useMemo(
    () => (me ? previousCard(me, results) : null),
    [me, results],
  );

  if (!ready) return null;
  if (!me) return <Register />;

  const score = card!.score;
  const complete = score.composite != null;
  const byTest = new Map<string, TestPercentile>(
    score.tests.map((t) => [t.testVariant, t]),
  );

  const age = ageAt(me.birthDate, card!.updatedAt ?? new Date().toISOString());
  const delta = complete && previous ? retestDelta(score, previous) : null;
  const bodyweight = bodyweightFor(db, me.id);

  async function save(test: BatteryTest, value: number, secondary: number | null) {
    await store.addResult({
      participantId: me!.id,
      sessionId: null,
      testVariant: test.slug,
      rawValue: value,
      secondaryValue: secondary,
      recordedAt: new Date().toISOString(),
      recordedByParticipantId: me!.id,
      witnessed: false,
    });
    refresh();
    setEditing(null);
  }

  return (
    <div>
      <header className="border-b border-rule-2 pb-5 pt-4">
        <p className="label">Longevity score</p>
        {complete ? (
          <>
            <div className="mt-2 flex items-baseline gap-3">
              <p className="figure text-accent text-[64px]">
                {oneDecimal(score.composite!)}
              </p>
              <p className="name text-name text-chalk-dim">
                {BAND_LABELS[score.band!]}
              </p>
              {delta?.compositeDelta != null && (
                <p className="num text-meta text-chalk-dim">
                  {formatSigned(delta.compositeDelta)}
                </p>
              )}
            </div>
            <p className="meta mt-2">{betterThanSentence(score.composite!, me.sex)}</p>
          </>
        ) : (
          <>
            <p className="figure mt-2 text-[64px] text-chalk-off">
              {score.testsCompleted}
              <span className="text-[36px]">/{BATTERY_TEST_COUNT}</span>
            </p>
            <p className="meta mt-2">
              No score until all {BATTERY_TEST_COUNT} are in
            </p>
          </>
        )}

        <div className="mt-4 flex gap-6">
          <Stat label="Fitness age" value={fitnessAgeText(score)} />
          <Stat label="Age" value={String(age)} />
          <Stat label="Cohort" value={ageBandLabel(age, me.sex)} />
        </div>
      </header>

      <SectionLabel>The eight</SectionLabel>
      <div>
        {BATTERY_TESTS.map((test) => (
          <TestRow
            key={test.slug}
            test={test}
            scored={byTest.get(test.slug)}
            entry={card!.entries.get(test.slug)}
            bodyweightLb={bodyweight}
            delta={delta?.tests.find((d) => d.testVariant === test.slug)}
            onTap={() => setEditing(test)}
          />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        {complete && (
          <ShareButton
            name={me.name}
            sex={me.sex}
            age={age}
            score={score}
            completedAt={card!.updatedAt ?? new Date().toISOString()}
          />
        )}
        <Link href="/you">
          <Button size="md">Break it down</Button>
        </Link>
      </div>

      <BodyweightRow current={bodyweight} />

      <p className="meta mt-6">
        {card!.updatedAt ? `Updated ${formatDate(card!.updatedAt)}` : "Nothing entered"}
      </p>

      <DemoBanner />

      {editing && (
        <EntrySheet
          test={editing}
          current={card!.entries.get(editing.slug)?.value ?? null}
          currentSecondary={card!.entries.get(editing.slug)?.secondaryValue ?? null}
          bodyweightLb={bodyweight}
          onSave={(v, secondary) => save(editing, v, secondary)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function fitnessAgeText(score: BatteryScore): string {
  const fa = score.fitnessAge;
  if (!fa) return EMPTY;
  const years = Math.round(fa.years);
  return fa.outOfRangeCount >= Math.ceil(score.tests.length / 2)
    ? `≤${years}`
    : String(years);
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="label">{label}</p>
      <p className="num mt-0.5 text-name">{value}</p>
    </div>
  );
}

function TestRow({
  test,
  scored,
  entry,
  bodyweightLb,
  delta,
  onTap,
}: {
  test: BatteryTest;
  scored?: TestPercentile;
  entry?: { value: number; secondaryValue: number | null };
  bodyweightLb: number | null;
  delta?: { delta: number; rawDelta: number };
  onTap: () => void;
}) {
  // The entry sheet promises an off-protocol load gets marked. This is the mark.
  const drift = test.secondary
    ? carryLoadDrift(entry?.secondaryValue, bodyweightLb)
    : null;
  const offProtocol = drift !== null && Math.abs(drift) > CARRY_LOAD_TOLERANCE;

  return (
    <button
      onClick={onTap}
      className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-gap border-b border-rule py-row text-left"
    >
      <div className="min-w-0">
        <p className="name text-name">{test.name}</p>
        <p className="meta mt-0.5 truncate">
          {entry ? (
            <>
              {formatRaw(entry.value, test.unit)}
              {entry.secondaryValue != null && ` @ ${Math.round(entry.secondaryValue)}lb`}
              {delta && delta.rawDelta !== 0 && (
                <span className={rawImproved(test.direction, delta.rawDelta) ? "text-chalk" : "text-chalk-off"}>
                  {" "}
                  {formatRawDelta(delta.rawDelta, test.unit)}
                </span>
              )}
              {offProtocol && <span className="text-chalk-off"> off-protocol</span>}
            </>
          ) : (
            <span className="text-chalk-off">{EMPTY}</span>
          )}
        </p>
      </div>

      <p className="label w-14 text-right">
        {scored ? BAND_LABELS[scored.band] : ""}
      </p>

      <p className="num w-9 text-right text-score">
        {scored ? scored.percentile.toFixed(0) : <span className="text-chalk-off">{EMPTY}</span>}
      </p>
    </button>
  );
}

/**
 * Read bodyweight back from the row it is written to. Matching "any row for
 * this participant" picked up whichever session happened to be first, which
 * for a returning user is an old weigh-in rather than what they are today.
 */
function bodyweightFor(
  db: ReturnType<typeof useStore>["db"],
  participantId: string,
): number | null {
  if (!db) return null;
  const rows = db.sessionParticipants.filter(
    (sp) => sp.participantId === participantId && sp.bodyweightKg != null,
  );
  const solo = rows.find((sp) => sp.sessionId === SOLO_SESSION_ID);
  if (solo) return solo.bodyweightKg;
  return (
    [...rows].sort((a, b) => Date.parse(b.joinedAt) - Date.parse(a.joinedAt))[0]
      ?.bodyweightKg ?? null
  );
}

function BodyweightRow({ current }: { current: number | null }) {
  const { me, store, refresh } = useStore();
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState(current === null ? "" : String(current));

  async function save(e?: React.FormEvent) {
    e?.preventDefault();
    const n = Number(text);
    if (!Number.isFinite(n) || n < 60 || n > 500 || !me) return;
    await store.joinSession(SOLO_SESSION_ID, me.id, n);
    refresh();
    setEditing(false);
  }

  return (
    <div className="mt-6 border-t border-rule-2 pt-4">
      {editing ? (
        <form className="flex items-center gap-2" onSubmit={save}>
          <input
            autoFocus
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ""))}
            aria-label="Bodyweight in pounds"
            className="num h-10 w-full min-w-0 flex-1 border border-rule-2 bg-board px-3 text-name text-chalk focus:border-chalk focus:outline-none"
          />
          <Button size="md" type="submit" className="shrink-0">
            Set
          </Button>
        </form>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="label">Bodyweight</span>
          <span className="num text-name">
            {current === null ? (
              <span className="text-chalk-off">{EMPTY}</span>
            ) : (
              `${Math.round(current)} lb`
            )}
          </span>
        </button>
      )}
      <p className="meta mt-1">Sets your carry load. Not scored.</p>
    </div>
  );
}

function ShareButton({
  name,
  sex,
  age,
  score,
  completedAt,
}: {
  name: string;
  sex: "M" | "F";
  age: number;
  score: BatteryScore;
  completedAt: string;
}) {
  const [copied, setCopied] = React.useState(false);
  const [fallbackUrl, setFallbackUrl] = React.useState<string | null>(null);

  const token = React.useMemo(() => {
    const payload = buildSharePayload({ name, sex, age, score, completedAt });
    return payload ? encodeShareToken(payload) : null;
  }, [name, sex, age, score, completedAt]);

  if (!token) return null;
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/s/${token}`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: "The Long Game", url });
        return;
      } catch {
        // Dismissed or unavailable. Fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setFallbackUrl(null);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      // Clipboard is blocked in iframes and in Safari without a gesture grant.
      setFallbackUrl(url);
    }
  }

  return (
    <>
      <Button size="md" onClick={share}>
        {copied ? "Copied" : "Share"}
      </Button>
      {fallbackUrl && (
        <div className="mt-2 w-full border border-rule-2 p-3">
          <p className="label">Copy this link</p>
          <input
            readOnly
            value={fallbackUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="num mt-1.5 w-full border border-rule bg-board px-2 py-1.5 text-meta text-chalk-dim"
          />
          <Link href={`/s/${token}`} className="label mt-2 inline-block text-chalk">
            Open it here instead
          </Link>
        </div>
      )}
    </>
  );
}
