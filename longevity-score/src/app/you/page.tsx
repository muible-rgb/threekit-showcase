"use client";

import * as React from "react";
import Link from "next/link";
import { Register } from "@/components/register";
import { SectionLabel } from "@/components/ui/row";
import { useResultsFor, useStore } from "@/lib/data/store-context";
import { currentCard, historyFor, previousCard } from "@/lib/batteries";
import {
  BATTERY_TEST_COUNT,
  CARRY_LOAD_TOLERANCE,
  carryLoadDrift,
  testBySlug,
} from "@/lib/battery";
import { retestDelta } from "@/lib/scoring/board";
import { ageAt } from "@/lib/scoring/cohort";
import {
  BAND_LABELS,
  EMPTY,
  ageBandLabel,
  cn,
  formatDate,
  formatResult,
  formatRawDelta,
  formatSigned,
  oneDecimal,
  rawImproved,
} from "@/lib/utils";

/**
 * The deep dive.
 *
 * The scorecard answers "what is my number". This answers what it is made of:
 * every capacity ranked, what is carrying you, what is dragging, what moved.
 *
 * The radar chart is gone. A radar is a shape you have to decode; eight bars
 * sorted best to worst is the same data, read in one pass, and it obeys the
 * rule that if an element is not a number, a label or a rule, it is cut.
 */
export default function DeepDivePage() {
  const { me, ready } = useStore();
  const results = useResultsFor(me?.id);

  const card = React.useMemo(() => (me ? currentCard(me, results) : null), [me, results]);
  const previous = React.useMemo(
    () => (me ? previousCard(me, results) : null),
    [me, results],
  );
  const history = React.useMemo(
    () => (me ? historyFor(me, results) : null),
    [me, results],
  );

  if (!ready) return null;
  if (!me) return <Register />;

  const score = card!.score;
  const age = ageAt(me.birthDate, card!.updatedAt ?? new Date().toISOString());

  if (score.testsCompleted === 0) {
    return (
      <div>
        <header className="border-b border-rule-2 pb-4 pt-4">
          <h1 className="name text-[22px]">You</h1>
        </header>
        <p className="meta mt-4">Nothing to break down yet.</p>
        <Link href="/" className="label mt-3 inline-block text-chalk">
          Go to the scorecard
        </Link>
      </div>
    );
  }

  const sorted = [...score.tests].sort((a, b) => b.percentile - a.percentile);
  const delta = score.composite !== null && previous ? retestDelta(score, previous) : null;
  const spread =
    sorted.length > 1 ? sorted[0].percentile - sorted[sorted.length - 1].percentile : 0;
  const fa = score.fitnessAge;
  const floored = fa ? fa.outOfRangeCount >= Math.ceil(score.tests.length / 2) : false;

  return (
    <div>
      <header className="border-b border-rule-2 pb-4 pt-4">
        <h1 className="name text-[22px]">You</h1>
        <p className="meta mt-1">
          {ageBandLabel(age, me.sex)}
          {card!.updatedAt ? ` · ${formatDate(card!.updatedAt)}` : ""}
        </p>
      </header>

      {score.composite !== null && (
        <div className="flex items-baseline gap-3 border-b border-rule py-4">
          <p className="figure text-accent text-[44px]">
            {oneDecimal(score.composite)}
          </p>
          <p className="name text-name text-chalk-dim">{BAND_LABELS[score.band!]}</p>
        </div>
      )}

      <SectionLabel>Every capacity</SectionLabel>
      <div>
        {sorted.map((t) => {
          const meta = testBySlug(t.testVariant);
          const entry = card!.entries.get(t.testVariant);
          const d = delta?.tests.find((x) => x.testVariant === t.testVariant);
          const drift = meta?.secondary
            ? carryLoadDrift(entry?.secondaryValue, me.sex)
            : null;
          const offProtocol = drift !== null && Math.abs(drift) > CARRY_LOAD_TOLERANCE;

          return (
            <div key={t.testVariant} className="border-b border-rule py-row">
              <div className="flex items-baseline justify-between gap-3">
                <p className="name text-name">{meta?.capacityName ?? t.capacity}</p>
                <p className="num text-score">{t.percentile.toFixed(0)}</p>
              </div>

              {/* A hairline bar: rule track, chalk fill. No colour scale. */}
              <div className="mt-2 h-[3px] w-full bg-rule">
                <div
                  className="h-full bg-chalk"
                  style={{ width: `${t.percentile}%` }}
                />
              </div>

              <p className="meta mt-1.5">
                {meta?.name} · {entry && meta ? formatResult(meta, entry.value) : EMPTY}
                {t.atCeiling && <span className="text-chalk-off"> · at the cap</span>}
                {d && d.rawDelta !== 0 && (
                  <span
                    className={
                      rawImproved(meta?.direction ?? "higher_better", d.rawDelta)
                        ? "text-chalk"
                        : "text-chalk-off"
                    }
                  >
                    {" "}
                    {formatRawDelta(d.rawDelta, t.unit)}
                  </span>
                )}
                {offProtocol && (
                  <span className="text-chalk-off"> · off-protocol load</span>
                )}
                {t.provisional && (
                  <span className="text-chalk-off"> · provisional benchmark</span>
                )}
                {t.derivation === "extrapolated" && (
                  <span className="text-chalk-off"> · extrapolated</span>
                )}
              </p>
            </div>
          );
        })}

        {score.missing.length > 0 && (
          <p className="meta py-row">
            Not entered:{" "}
            {score.missing.map((s) => testBySlug(s)?.name ?? s).join(", ")}
          </p>
        )}
      </div>

      <SectionLabel>Read</SectionLabel>
      <div className="hairline-grid grid-cols-2">
        <Cell
          label="Spread"
          value={`${Math.round(spread)}`}
          note={spread >= 40 ? "Lopsided" : spread >= 20 ? "Fairly even" : "Very even"}
        />
        <Cell
          label="Fitness age"
          value={fa ? `${floored ? "≤" : ""}${Math.round(fa.years)}` : EMPTY}
          note={fa ? `Actual ${age}` : ""}
        />
        <Cell
          label="Carrying you"
          value={testBySlug(sorted[0].testVariant)?.shortName ?? EMPTY}
          note={`${sorted[0].percentile.toFixed(0)} percentile`}
        />
        <Cell
          label="Dragging"
          value={
            testBySlug(sorted[sorted.length - 1].testVariant)?.shortName ?? EMPTY
          }
          note={`${sorted[sorted.length - 1].percentile.toFixed(0)} percentile`}
        />
      </div>

      {fa && (fa.approx || floored) && (
        <p className="meta mt-3">
          {fa.outOfRangeCount} of {score.tests.length} results beat the youngest
          cohort the norms cover, so fitness age is a floor, not an estimate.
        </p>
      )}

      {delta && <Moved delta={delta} />}

      {history && history.attempts.filter((a) => a.score.composite !== null).length > 1 && (
        <>
          <SectionLabel>Over time</SectionLabel>
          <div>
            {history.attempts
              .filter((a) => a.score.composite !== null)
              .slice(0, 6)
              .map((a) => (
                <div
                  key={a.key}
                  className="flex items-center justify-between border-b border-rule py-row"
                >
                  <span className="meta">{formatDate(a.completedAt)}</span>
                  <span className="num text-score">
                    {oneDecimal(a.score.composite!)}
                  </span>
                </div>
              ))}
          </div>
        </>
      )}

      <SectionLabel>What this claims</SectionLabel>
      <p className="mt-3 max-w-prose text-[13px] leading-relaxed text-chalk-dim">
        Each test is a percentile among people of your sex and exact age,
        from population benchmarks v{score.benchmarkVersion}. Your score is the
        mean of all {BATTERY_TEST_COUNT}, unweighted, and is not itself a
        percentile. Zero reps and a DNF are real results, scored with everyone
        else who got the same.
        {score.tests.some((t) => t.provisional) && (
          <>
            {" "}
            Provisional:{" "}
            {score.tests
              .filter((t) => t.provisional)
              .map((t) => testBySlug(t.testVariant)?.name ?? t.testVariant)
              .join(", ")}
            {" "}- no general-population norm exists for these yet.
          </>
        )}
      </p>
      <Link href="/methodology" className="label mt-3 inline-block text-chalk">
        Read the methodology
      </Link>
    </div>
  );
}

function Cell({
  label,
  value,
  note,
}: {
  label: string;
  value: string;
  note?: string;
}) {
  return (
    <div className="px-3 py-4">
      <p className="label">{label}</p>
      <p className={cn("mt-1 text-[24px]", /^[\d≤]/.test(value) ? "num" : "name")}>
        {value}
      </p>
      {note && <p className="meta mt-0.5">{note}</p>}
    </div>
  );
}

function Moved({ delta }: { delta: NonNullable<ReturnType<typeof retestDelta>> }) {
  const moved = delta.tests
    .filter((t) => t.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  if (moved.length === 0) return null;

  return (
    <>
      <SectionLabel>What moved</SectionLabel>
      {delta.compositeDelta != null && (
        <p className="meta py-row border-b border-rule">
          Score {formatSigned(delta.compositeDelta)}
          {delta.bandChanged &&
            ` · ${BAND_LABELS[delta.previousBand!]} to ${BAND_LABELS[delta.currentBand!]}`}
        </p>
      )}
      {moved.slice(0, 5).map((t) => (
        <div
          key={t.testVariant}
          className="flex items-center justify-between border-b border-rule py-row"
        >
          <span className="name text-name">
            {testBySlug(t.testVariant)?.name ?? t.testVariant}
          </span>
          <span className={cn("num text-score", t.delta < 0 && "text-chalk-off")}>
            {formatSigned(t.delta)}
          </span>
        </div>
      ))}
    </>
  );
}

