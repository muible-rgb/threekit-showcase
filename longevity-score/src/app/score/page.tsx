"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronDown, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { BandBadge, Chip, ProvisionalTag } from "@/components/ui/badge";
import { CapacityRadar } from "@/components/capacity-radar";
import { ProfileGate } from "@/components/profile-gate";
import {
  useResultsFor,
  useStore,
  useUnscoredFor,
} from "@/lib/data/store-context";
import { historyFor } from "@/lib/batteries";
import { testBySlug, UNSCORED_MEASUREMENTS } from "@/lib/battery";
import { retestDelta } from "@/lib/scoring/board";
import { ageAt } from "@/lib/scoring/cohort";
import {
  ageBandLabel,
  betterThanSentence,
  formatDate,
  formatRaw,
  formatSigned,
  oneDecimal,
  rawImproved,
} from "@/lib/utils";
import { buildSharePayload, encodeShareToken } from "@/lib/share-token";
import type { BatteryAttempt } from "@/lib/batteries";

export default function ScorePage() {
  const { me, ready } = useStore();
  const results = useResultsFor(me?.id);
  const unscored = useUnscoredFor(me?.id);

  const history = React.useMemo(
    () => (me ? historyFor(me, results) : null),
    [me, results],
  );

  if (!ready) return <div className="h-96 animate-pulse rounded-2xl bg-ink-raised" />;
  if (!me) return <ProfileGate />;

  const latest = history?.latestComplete ?? null;
  const previous = history?.previousComplete ?? null;

  if (!latest) {
    return <NoScoreYet inProgress={history?.inProgress ?? null} />;
  }

  const delta = previous ? retestDelta(latest.score, previous.score) : null;
  const age = ageAt(me.birthDate, latest.completedAt);
  const sessionUnscored = unscored.filter((m) => m.sessionId === latest.sessionId);

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-paper-faint">
            Longevity Score
          </p>
          <div className="mt-2 flex items-start justify-between gap-4">
            <p className="score-hero text-[80px]">{oneDecimal(latest.score.composite!)}</p>
            <BandBadge band={latest.score.band!} className="mt-3 shrink-0" />
          </div>

          <p className="mt-3 text-sm text-paper-dim">
            {betterThanSentence(latest.score.composite!, me.sex)}
          </p>

          {delta?.compositeDelta != null && (
            <p
              className={
                delta.compositeDelta >= 0
                  ? "tnum mt-1 text-sm font-semibold text-up"
                  : "tnum mt-1 text-sm font-semibold text-down"
              }
            >
              {formatSigned(delta.compositeDelta)} since {formatDate(previous!.completedAt)}
            </p>
          )}

          {delta?.bandChanged && (
            <p className="mt-3 rounded-xl bg-signal/10 px-3 py-2 text-sm font-medium text-signal ring-1 ring-signal/25">
              {delta.previousBand} to {delta.currentBand}.
            </p>
          )}

          <div className="mt-5 flex flex-wrap gap-2 border-t border-ink-line-soft pt-4">
            <Chip>{ageBandLabel(age, me.sex)}</Chip>
            <Chip>{formatDate(latest.completedAt)}</Chip>
            <Chip>{latest.sessionId ? "Crew session" : "Solo"}</Chip>
            <Chip>Norms {latest.score.normsVersion}</Chip>
          </div>
        </CardBody>
      </Card>

      <FitnessAgeCard attempt={latest} actualAge={age} />

      <Card>
        <CardHeader>
          <CardTitle>Ten capacities</CardTitle>
        </CardHeader>
        <CardBody>
          <CapacityRadar
            tests={latest.score.tests}
            previous={previous?.score.tests}
          />
          <p className="text-center text-xs text-paper-faint">
            Every axis is a percentile against {me.sex === "M" ? "men" : "women"} aged{" "}
            {Math.floor(age / 5) * 5}-{Math.floor(age / 5) * 5 + 4}.
            {previous && " Dashed line is your last battery."}
          </p>
        </CardBody>
      </Card>

      <TestBreakdown attempt={latest} delta={delta} />

      {sessionUnscored.length > 0 && <UnscoredSection measurements={sessionUnscored} />}

      <ShareCard
        name={me.name}
        sex={me.sex}
        age={age}
        attempt={latest}
      />

      <p className="pb-4 text-center text-xs leading-relaxed text-paper-faint">
        Percentiles come from published norms where they exist and from clearly
        labelled provisional curves where they do not.{" "}
        <Link href="/methodology" className="text-paper-dim underline underline-offset-2">
          Every source is listed here
        </Link>
        .
      </p>
    </div>
  );
}

function FitnessAgeCard({
  attempt,
  actualAge,
}: {
  attempt: BatteryAttempt;
  actualAge: number;
}) {
  const fa = attempt.score.fitnessAge;
  if (!fa) return null;

  const years = Math.round(fa.years);
  const younger = actualAge - years;
  // When most tests clamped, the number is a floor rather than an estimate,
  // and saying "22" flat would be overclaiming.
  const floored = fa.outOfRangeCount >= 5;

  return (
    <Card>
      <CardBody className="flex items-center justify-between pt-5">
        <div>
          <p className="text-[11px] uppercase tracking-wider text-paper-faint">
            Fitness age
          </p>
          <p className="tnum mt-1 text-4xl font-bold">
            {floored ? `${years} or under` : years}
          </p>
          <p className="mt-1 text-xs text-paper-dim">
            {younger > 0
              ? `${younger} year${younger === 1 ? "" : "s"} under your actual age of ${actualAge}.`
              : younger === 0
                ? `Level with your actual age of ${actualAge}.`
                : `${-younger} year${younger === -1 ? "" : "s"} over your actual age of ${actualAge}.`}
          </p>
        </div>
        {fa.approx && (
          <span className="rounded-lg bg-below/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-below ring-1 ring-below/30">
            approx
          </span>
        )}
      </CardBody>
      {(fa.approx || floored) && (
        <CardBody className="pt-0">
          <p className="text-xs leading-relaxed text-paper-faint">
            {fa.outOfRangeCount} of your {attempt.score.tests.length} results are
            better than the youngest cohort the norms cover, so this is a floor
            rather than an estimate. Published norms describe the general
            population, and a trained adult often clears the median{" "}
            {years}-year-old.
          </p>
        </CardBody>
      )}
    </Card>
  );
}

function TestBreakdown({
  attempt,
  delta,
}: {
  attempt: BatteryAttempt;
  delta: ReturnType<typeof retestDelta>;
}) {
  const deltaBySlug = new Map((delta?.tests ?? []).map((t) => [t.testVariant, t]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Test by test</CardTitle>
      </CardHeader>
      <CardBody className="space-y-0">
        {attempt.score.tests.map((t) => {
          const meta = testBySlug(t.testVariant);
          const d = deltaBySlug.get(t.testVariant);
          const improved =
            d === undefined
              ? null
              : rawImproved(meta?.direction ?? "higher_better", d.rawDelta);

          return (
            <div
              key={t.testVariant}
              className="flex items-center gap-2 border-t border-ink-line-soft py-3 first:border-t-0 first:pt-0"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                  <span className="text-sm font-semibold">{meta?.name ?? t.testVariant}</span>
                  {t.provisional && <ProvisionalTag slug={t.testVariant} />}
                </div>
                <p className="tnum mt-0.5 text-xs text-paper-dim">
                  {formatRaw(t.raw, t.unit)}
                  {d && d.rawDelta !== 0 && (
                    <span className={improved ? "text-up" : "text-down"}>
                      {" "}
                      ({formatSigned(d.rawDelta, t.unit === "reps" ? 0 : 1)})
                    </span>
                  )}
                  {t.extrapolated && (
                    <span className="text-paper-faint"> - outside the norms range</span>
                  )}
                </p>
              </div>

              {d && (
                <span
                  className={
                    d.delta >= 0
                      ? "tnum w-11 shrink-0 text-right text-xs font-semibold text-up"
                      : "tnum w-11 shrink-0 text-right text-xs font-semibold text-down"
                  }
                >
                  {formatSigned(d.delta)}
                </span>
              )}

              <div className="w-[74px] shrink-0 text-right">
                <span className="tnum block text-lg font-bold leading-none">
                  {t.percentile.toFixed(0)}
                </span>
                <BandBadge band={t.band} size="sm" className="mt-1 max-w-full" />
              </div>
            </div>
          );
        })}
      </CardBody>
    </Card>
  );
}

function UnscoredSection({
  measurements,
}: {
  measurements: Array<{ kind: string; value: number }>;
}) {
  const byKind = new Map(measurements.map((m) => [m.kind, m.value]));
  const hrFinish = byKind.get("hr_finish");
  const hr1min = byKind.get("hr_1min");
  const recovery =
    hrFinish !== undefined && hr1min !== undefined ? hrFinish - hr1min : null;

  return (
    <details className="group">
      <summary className="flex cursor-pointer items-center justify-between rounded-2xl bg-ink-raised px-5 py-4 ring-1 ring-ink-line">
        <span className="text-sm font-semibold uppercase tracking-widest text-paper-faint">
          Measured, not scored
        </span>
        <ChevronDown
          size={18}
          className="text-paper-faint transition-transform group-open:rotate-180"
        />
      </summary>
      <div className="mt-2 rounded-2xl bg-ink-raised px-5 py-4 ring-1 ring-ink-line">
        <p className="text-xs leading-relaxed text-paper-faint">
          Kept out of the composite on purpose. Useful to track, not gradeable
          against norms we would stand behind.
        </p>
        <dl className="mt-4 space-y-3">
          {UNSCORED_MEASUREMENTS.map((field) => {
            const value = byKind.get(field.kind);
            if (value === undefined) return null;
            return (
              <div key={field.kind} className="flex items-baseline justify-between">
                <dt className="text-sm text-paper-dim">{field.name}</dt>
                <dd className="tnum text-base font-semibold">
                  {value} {field.unit}
                </dd>
              </div>
            );
          })}
          {recovery !== null && (
            <div className="flex items-baseline justify-between border-t border-ink-line-soft pt-3">
              <dt className="text-sm font-medium">One-minute HR recovery</dt>
              <dd className="tnum text-base font-bold text-signal">{recovery} bpm</dd>
            </div>
          )}
        </dl>
      </div>
    </details>
  );
}

function ShareCard({
  name,
  sex,
  age,
  attempt,
}: {
  name: string;
  sex: "M" | "F";
  age: number;
  attempt: BatteryAttempt;
}) {
  const [copied, setCopied] = React.useState(false);

  const token = React.useMemo(() => {
    const payload = buildSharePayload({
      name,
      sex,
      age,
      score: attempt.score,
      completedAt: attempt.completedAt,
    });
    return payload ? encodeShareToken(payload) : null;
  }, [name, sex, age, attempt]);

  if (!token) return null;
  const url = typeof window === "undefined" ? "" : `${window.location.origin}/s/${token}`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "My Longevity Score",
          text: `${oneDecimal(attempt.score.composite!)} - ${attempt.score.band}`,
          url,
        });
        return;
      } catch {
        // Share sheet dismissed. Fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Button size="lg" variant="secondary" className="w-full" onClick={share}>
        {copied ? (
          <>
            <Check size={18} /> Link copied
          </>
        ) : (
          <>
            <Share2 size={18} /> Share your score card
          </>
        )}
      </Button>
      <Link href={`/s/${token}`} className="text-center text-xs text-paper-faint underline underline-offset-2">
        Preview the public page
      </Link>
    </div>
  );
}

function NoScoreYet({ inProgress }: { inProgress: BatteryAttempt | null }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No score yet</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        {inProgress ? (
          <>
            <p className="text-sm leading-relaxed text-paper-dim">
              You are {inProgress.score.testsCompleted} of{" "}
              {inProgress.score.testsRequired} tests in. There is no composite
              until all ten are recorded - a partial score would just let people
              skip the test they are worst at.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {inProgress.score.missing.map((slug) => (
                <Chip key={slug}>{testBySlug(slug)?.shortName ?? slug}</Chip>
              ))}
            </div>
            <Link href="/test">
              <Button className="w-full">Finish the battery</Button>
            </Link>
          </>
        ) : (
          <>
            <p className="text-sm leading-relaxed text-paper-dim">
              Run the ten-test battery and your score shows up here.
            </p>
            <Link href="/test">
              <Button className="w-full">Start a test</Button>
            </Link>
          </>
        )}
      </CardBody>
    </Card>
  );
}
