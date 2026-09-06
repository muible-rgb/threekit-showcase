"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { BandBadge } from "@/components/ui/badge";
import { CapacityRadar } from "@/components/capacity-radar";
import { Register } from "@/components/register";
import { useResultsFor, useStore } from "@/lib/data/store-context";
import { currentCard, historyFor, previousCard } from "@/lib/batteries";
import {
  BATTERY_TESTS,
  BATTERY_TEST_COUNT,
  CARRY_LOAD_TOLERANCE,
  SOLO_SESSION_ID,
  carryLoadDrift,
  testBySlug,
} from "@/lib/battery";
import { retestDelta } from "@/lib/scoring/board";
import { ageAt } from "@/lib/scoring/cohort";
import {
  BAND_STYLES,
  ageBandLabel,
  formatDate,
  formatRaw,
  formatRawDelta,
  formatSigned,
  oneDecimal,
  rawImproved,
} from "@/lib/utils";
import type { BatteryScore, TestPercentile } from "@/lib/scoring/types";

/**
 * The deep dive.
 *
 * The scorecard answers "what is my number". This answers "what is that number
 * made of, and what should I do about it" - the shape of your eight capacities,
 * what is carrying you, what is dragging, what has moved, and what the score
 * is actually claiming.
 */
export default function DeepDivePage() {
  const { me, ready, db } = useStore();
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

  if (!ready) return <div className="h-96 animate-pulse rounded-2xl bg-ink-raised" />;
  if (!me) return <Register />;

  const score = card!.score;
  const age = ageAt(me.birthDate, card!.updatedAt ?? new Date().toISOString());
  const bodyweight =
    db?.sessionParticipants.find(
      (sp) => sp.participantId === me.id && sp.sessionId === SOLO_SESSION_ID,
    )?.bodyweightKg ??
    db?.sessionParticipants.find(
      (sp) => sp.participantId === me.id && sp.bodyweightKg != null,
    )?.bodyweightKg ??
    null;

  if (score.testsCompleted === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">You</h1>
        <Card>
          <CardBody className="pt-5">
            <p className="text-sm text-paper-dim">
              Nothing to dig into yet. Put a result on the scorecard.
            </p>
            <Link href="/" className="mt-3 inline-block text-sm font-semibold text-signal">
              Go to the scorecard
            </Link>
          </CardBody>
        </Card>
      </div>
    );
  }

  const sorted = [...score.tests].sort((a, b) => b.percentile - a.percentile);
  const strongest = sorted.slice(0, 2);
  const weakest = sorted.slice(-2).reverse();
  const delta = score.composite !== null && previous ? retestDelta(score, previous) : null;
  const spread =
    sorted.length > 1 ? sorted[0].percentile - sorted[sorted.length - 1].percentile : 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">You</h1>
        <p className="mt-1 text-sm text-paper-dim">
          {ageBandLabel(age, me.sex)}
          {card!.updatedAt ? ` - updated ${formatDate(card!.updatedAt)}` : ""}
        </p>
      </div>

      {score.composite !== null && (
        <Card>
          <CardBody className="pt-5">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-paper-faint">
                  Longevity Score
                </p>
                <p className="score-hero mt-1 text-[56px]">
                  {oneDecimal(score.composite)}
                </p>
              </div>
              <BandBadge band={score.band!} className="mb-2" />
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Your shape</CardTitle>
        </CardHeader>
        <CardBody>
          <CapacityRadar tests={score.tests} previous={previous?.tests} />
          <p className="text-center text-xs text-paper-faint">
            {spread >= 40
              ? `A ${Math.round(spread)}-point spread between your best and worst. Lopsided.`
              : spread >= 20
                ? `A ${Math.round(spread)}-point spread. Fairly even.`
                : "Unusually even across all eight."}
          </p>
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <Highlight title="Carrying you" tests={strongest} tone="up" />
        <Highlight title="Dragging" tests={weakest} tone="down" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Every capacity</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {sorted.map((t) => {
            const meta = testBySlug(t.testVariant);
            const entry = card!.entries.get(t.testVariant);
            const d = delta?.tests.find((x) => x.testVariant === t.testVariant);
            return (
              <div key={t.testVariant}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">
                    {meta?.capacityName ?? t.capacity}
                    <span className="ml-1.5 text-xs text-paper-faint">
                      {meta?.name}
                    </span>
                  </span>
                  <span className="tnum shrink-0 text-sm font-bold">
                    {t.percentile.toFixed(0)}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-ink">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${t.percentile}%`,
                      backgroundColor: BAND_STYLES[t.band].hex,
                    }}
                  />
                </div>
                <p className="tnum mt-1 text-xs text-paper-faint">
                  {entry ? formatRaw(entry.value, t.unit) : "-"}
                  {d && d.rawDelta !== 0 && (
                    <span
                      className={
                        rawImproved(meta?.direction ?? "higher_better", d.rawDelta)
                          ? "text-up"
                          : "text-down"
                      }
                    >
                      {" "}
                      {formatRawDelta(d.rawDelta, t.unit)}
                    </span>
                  )}
                  {t.extrapolated && " - outside the norms range"}
                  {(() => {
                    const meta2 = testBySlug(t.testVariant);
                    if (!meta2?.secondary || !entry) return null;
                    const drift = carryLoadDrift(entry.secondaryValue, bodyweight);
                    if (drift === null) return null;
                    return (
                      <span
                        className={
                          Math.abs(drift) > CARRY_LOAD_TOLERANCE ? "text-below" : ""
                        }
                      >
                        {" "}
                        at {Math.round(entry.secondaryValue!)} lb
                        {Math.abs(drift) > CARRY_LOAD_TOLERANCE && " - off-protocol"}
                      </span>
                    );
                  })()}
                </p>
              </div>
            );
          })}
          {score.missing.length > 0 && (
            <p className="border-t border-ink-line-soft pt-3 text-xs text-paper-faint">
              Not entered:{" "}
              {score.missing
                .map((slug) => testBySlug(slug)?.name ?? slug)
                .join(", ")}
              .
            </p>
          )}
        </CardBody>
      </Card>

      {score.fitnessAge && <FitnessAgeCard score={score} actualAge={age} />}

      {delta && <MovementCard delta={delta} />}

      {history && history.attempts.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Over time</CardTitle>
          </CardHeader>
          <CardBody className="space-y-0">
            {history.attempts
              .filter((a) => a.score.composite !== null)
              .slice(0, 6)
              .map((a) => (
                <div
                  key={a.key}
                  className="flex items-center justify-between border-t border-ink-line-soft py-2.5 first:border-t-0 first:pt-0"
                >
                  <span className="text-sm text-paper-dim">
                    {formatDate(a.completedAt)}
                  </span>
                  <div className="flex items-center gap-2.5">
                    <span className="tnum text-base font-bold">
                      {oneDecimal(a.score.composite!)}
                    </span>
                    <BandBadge band={a.score.band!} size="sm" />
                  </div>
                </div>
              ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>What this score claims</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3 text-sm leading-relaxed text-paper-dim">
          <p>
            Each test is a percentile against published norms for your sex and
            five-year age band. Your score is the mean of all {BATTERY_TEST_COUNT}.
            Nothing is weighted.
          </p>
          <p>
            All {BATTERY_TEST_COUNT} currently use provisional norms, and none
            have been proofread against their source documents yet. Every
            citation and every caveat is written down.
          </p>
          <Link
            href="/methodology"
            className="inline-flex items-center gap-1 text-sm font-semibold text-signal"
          >
            Read the methodology <ArrowUpRight size={14} />
          </Link>
        </CardBody>
      </Card>
    </div>
  );
}

function Highlight({
  title,
  tests,
  tone,
}: {
  title: string;
  tests: TestPercentile[];
  tone: "up" | "down";
}) {
  const Icon = tone === "up" ? TrendingUp : TrendingDown;
  return (
    <div className="rounded-2xl bg-ink-raised p-4 ring-1 ring-ink-line">
      <p
        className={`flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${
          tone === "up" ? "text-up" : "text-down"
        }`}
      >
        <Icon size={13} /> {title}
      </p>
      <ul className="mt-2 space-y-2">
        {tests.map((t) => (
          <li key={t.testVariant}>
            <p className="text-sm font-semibold">
              {testBySlug(t.testVariant)?.name ?? t.capacity}
            </p>
            <p className="tnum text-xs text-paper-faint">
              {t.percentile.toFixed(0)} percentile
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FitnessAgeCard({
  score,
  actualAge,
}: {
  score: BatteryScore;
  actualAge: number;
}) {
  const fa = score.fitnessAge!;
  const years = Math.round(fa.years);
  const floored = fa.outOfRangeCount >= Math.ceil(score.tests.length / 2);
  const diff = actualAge - years;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fitness age</CardTitle>
      </CardHeader>
      <CardBody>
        <div className="flex items-end gap-6">
          <div>
            <p className="tnum text-4xl font-bold">
              {floored ? `≤${years}` : years}
            </p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wider text-paper-faint">
              Fitness
            </p>
          </div>
          <div>
            <p className="tnum text-4xl font-bold text-paper-dim">{actualAge}</p>
            <p className="mt-0.5 text-[11px] uppercase tracking-wider text-paper-faint">
              Actual
            </p>
          </div>
        </div>
        <p className="mt-3 text-sm text-paper-dim">
          {diff > 0
            ? `Your results are typical of someone ${diff} year${diff === 1 ? "" : "s"} younger.`
            : diff === 0
              ? "Your results are typical for your age."
              : `Your results are typical of someone ${-diff} year${diff === -1 ? "" : "s"} older.`}
        </p>
        {(fa.approx || floored) && (
          <p className="mt-2 text-xs leading-relaxed text-paper-faint">
            {fa.outOfRangeCount} of {score.tests.length} results are better than
            the youngest cohort the norms cover, so this is a floor rather than
            an estimate. Published norms describe the general population, and a
            trained adult often clears the median {years}-year-old.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

function MovementCard({ delta }: { delta: NonNullable<ReturnType<typeof retestDelta>> }) {
  const moved = delta.tests
    .filter((t) => t.delta !== 0)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
  if (moved.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>What moved</CardTitle>
      </CardHeader>
      <CardBody className="space-y-0">
        {delta.compositeDelta != null && (
          <p className="pb-3 text-sm text-paper-dim">
            Score{" "}
            <span
              className={
                delta.compositeDelta >= 0
                  ? "tnum font-semibold text-up"
                  : "tnum font-semibold text-down"
              }
            >
              {formatSigned(delta.compositeDelta)}
            </span>{" "}
            since your last numbers.
            {delta.bandChanged && ` ${delta.previousBand} to ${delta.currentBand}.`}
          </p>
        )}
        {moved.slice(0, 5).map((t) => {
          const meta = BATTERY_TESTS.find((x) => x.slug === t.testVariant);
          return (
            <div
              key={t.testVariant}
              className="flex items-center justify-between border-t border-ink-line-soft py-2.5"
            >
              <span className="text-sm">{meta?.name ?? t.testVariant}</span>
              <span
                className={
                  t.delta >= 0
                    ? "tnum text-sm font-semibold text-up"
                    : "tnum text-sm font-semibold text-down"
                }
              >
                {formatSigned(t.delta)}
              </span>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}
