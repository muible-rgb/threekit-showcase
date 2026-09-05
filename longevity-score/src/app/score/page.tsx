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
    <div className="space-y-4">
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
            {delta?.compositeDelta != null && (
              <span
                className={
                  delta.compositeDelta >= 0
                    ? "tnum font-semibold text-up"
                    : "tnum font-semibold text-down"
                }
              >
                {"  "}
                {formatSigned(delta.compositeDelta)}
              </span>
            )}
          </p>

          <FitnessAgeRow attempt={latest} actualAge={age} />

          <p className="mt-3 text-xs text-paper-faint">
            {ageBandLabel(age, me.sex)} - {formatDate(latest.completedAt)}
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody className="pt-5">
          <CapacityRadar
            tests={latest.score.tests}
            previous={previous?.score.tests}
          />
        </CardBody>
      </Card>

      <TestBreakdown attempt={latest} delta={delta} />

      {sessionUnscored.length > 0 && <UnscoredSection measurements={sessionUnscored} />}

      <ShareCard name={me.name} sex={me.sex} age={age} attempt={latest} />
    </div>
  );
}

function FitnessAgeRow({
  attempt,
  actualAge,
}: {
  attempt: BatteryAttempt;
  actualAge: number;
}) {
  const fa = attempt.score.fitnessAge;
  if (!fa) return null;

  const years = Math.round(fa.years);
  // Most tests clamped: the number is a floor, not an estimate. Saying "28"
  // flat would be overclaiming. The reason lives on /methodology.
  const floored = fa.outOfRangeCount >= 5;

  return (
    <div className="mt-5 flex items-end gap-6 border-t border-ink-line-soft pt-4">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-paper-faint">
          Fitness age
        </p>
        <p className="tnum mt-0.5 text-3xl font-bold">
          {floored ? `\u2264${years}` : years}
          {fa.approx && (
            <Link
              href="/methodology#fitness-age"
              title="More than three tests fall outside the norms range"
              className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-below"
            >
              approx
            </Link>
          )}
        </p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-paper-faint">
          Actual
        </p>
        <p className="tnum mt-0.5 text-3xl font-bold text-paper-dim">{actualAge}</p>
      </div>
    </div>
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
        <dl className="space-y-3">
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
  // Clipboard access is blocked in plenty of real places - an iframe, Safari
  // without a user-gesture grant, a locked-down browser. Failing silently
  // leaves someone tapping a dead button, so the link gets shown instead.
  const [fallbackUrl, setFallbackUrl] = React.useState<string | null>(null);

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
        // Share sheet dismissed or unavailable. Fall through to copying.
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setFallbackUrl(null);
      setTimeout(() => setCopied(false), 2200);
    } catch {
      setFallbackUrl(url);
    }
  }

  return (
    <div className="space-y-2">
      <Button size="lg" variant="secondary" className="w-full" onClick={share}>
        {copied ? (
          <>
            <Check size={18} /> Link copied
          </>
        ) : (
          <>
            <Share2 size={18} /> Share
          </>
        )}
      </Button>

      {fallbackUrl && (
        <div className="rounded-xl bg-ink-raised p-3 ring-1 ring-ink-line">
          <p className="text-xs text-paper-faint">Copy this link</p>
          <input
            readOnly
            value={fallbackUrl}
            onFocus={(e) => e.currentTarget.select()}
            className="mt-1.5 w-full rounded-lg bg-ink px-3 py-2 text-xs text-paper-dim ring-1 ring-ink-line-soft"
          />
          <Link
            href={`/s/${token}`}
            className="mt-2 inline-block text-xs font-semibold text-signal"
          >
            Open it here instead
          </Link>
        </div>
      )}
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
            <p className="text-sm text-paper-dim">
              {inProgress.score.testsCompleted} of{" "}
              {inProgress.score.testsRequired} done. No score until all ten are in.
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
            <p className="text-sm text-paper-dim">
              Run the battery and your score lands here.
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
