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
  COMPOSITE_CAPTION,
  EMPTY,
  ageBandLabel,
  formatDate,
  formatRawDelta,
  formatResult,
  formatSigned,
  oneDecimal,
  rawImproved,
} from "@/lib/utils";
import type { BatteryScore, Sex, TestPercentile } from "@/lib/scoring/types";

/**
 * The scorecard. Eight rows, one per test.
 *
 * You see what you have and what you are missing, you tap a row, you type the
 * number you got outside. The accent appears exactly once - on the score.
 */
export default function ScorecardPage() {
  const { me, ready, store, refresh } = useStore();
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
            <p className="meta mt-2">{COMPOSITE_CAPTION}</p>
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
            sex={me.sex}
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

      <p className="meta mt-6">
        {card!.updatedAt ? `Updated ${formatDate(card!.updatedAt)}` : "Nothing entered"}
      </p>

      <DemoBanner />

      {editing && (
        <EntrySheet
          test={editing}
          current={card!.entries.get(editing.slug)?.value ?? null}
          currentSecondary={card!.entries.get(editing.slug)?.secondaryValue ?? null}
          sex={me.sex}
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
  sex,
  delta,
  onTap,
}: {
  test: BatteryTest;
  scored?: TestPercentile;
  entry?: { value: number; secondaryValue: number | null };
  sex: Sex;
  delta?: { delta: number; rawDelta: number };
  onTap: () => void;
}) {
  // The entry sheet promises an off-protocol load gets marked. This is the mark.
  const drift = test.secondary
    ? carryLoadDrift(entry?.secondaryValue, sex)
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
              {formatResult(test, entry.value)}
              {entry.secondaryValue != null && ` @ ${Math.round(entry.secondaryValue)}lb`}
              {scored?.atCeiling && <span className="text-chalk-off"> max</span>}
              {delta && delta.rawDelta !== 0 && (
                <span className={rawImproved(test.direction, delta.rawDelta) ? "text-chalk" : "text-chalk-off"}>
                  {" "}
                  {formatRawDelta(delta.rawDelta, test.unit)}
                </span>
              )}
              {offProtocol && <span className="text-chalk-off"> off-protocol</span>}
              {scored?.provisional && <span className="text-chalk-off"> provisional</span>}
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
