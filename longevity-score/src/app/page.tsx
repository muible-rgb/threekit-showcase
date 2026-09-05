"use client";

import Link from "next/link";
import * as React from "react";
import { ArrowRight, PlayCircle, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { BandBadge } from "@/components/ui/badge";
import { useResultsFor, useStore } from "@/lib/data/store-context";
import { historyFor } from "@/lib/batteries";
import { ageAt } from "@/lib/scoring/cohort";
import { retestDelta } from "@/lib/scoring/board";
import { betterThanSentence, formatDate, formatSigned, oneDecimal } from "@/lib/utils";
import { ProfileGate } from "@/components/profile-gate";
import { DemoBanner } from "@/components/demo-banner";

export default function HomePage() {
  const { me, ready } = useStore();
  const results = useResultsFor(me?.id);

  const history = React.useMemo(
    () => (me ? historyFor(me, results) : null),
    [me, results],
  );

  if (!ready) return <LoadingHome />;
  if (!me) return <ProfileGate />;

  const latest = history?.latestComplete ?? null;
  const previous = history?.previousComplete ?? null;
  const inProgress = history?.inProgress ?? null;

  return (
    <div className="space-y-5">
      {latest ? (
        <ScoreHeroCard
          composite={latest.score.composite!}
          band={latest.score.band!}
          sex={me.sex}
          age={ageAt(me.birthDate, latest.completedAt)}
          fitnessAge={latest.score.fitnessAge}
          delta={previous ? retestDelta(latest.score, previous.score) : null}
        />
      ) : (
        <FirstRunCard />
      )}

      {inProgress && (
        <Card className="ring-signal/40">
          <CardBody className="flex items-center justify-between gap-4 pt-5">
            <div>
              <p className="text-sm font-semibold">Battery in progress</p>
              <p className="mt-0.5 text-xs text-paper-dim">
                {inProgress.score.testsCompleted} of {inProgress.score.testsRequired} done.
              </p>
            </div>
            <Link href="/test">
              <Button size="sm">Resume</Button>
            </Link>
          </CardBody>
        </Card>
      )}

      <div className="grid gap-3">
        <Link href="/test" className="block">
          <Button size="lg" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <PlayCircle size={20} /> Start a test
            </span>
            <ArrowRight size={18} />
          </Button>
        </Link>
        <Link href="/crew" className="block">
          <Button size="lg" variant="secondary" className="w-full justify-between">
            <span className="flex items-center gap-2">
              <Users size={20} /> Join a crew session
            </span>
            <ArrowRight size={18} />
          </Button>
        </Link>
      </div>

      {latest && <RecentHistory history={history!} />}

      <DemoBanner />

    </div>
  );
}

function ScoreHeroCard({
  composite,
  band,
  sex,
  age,
  fitnessAge,
  delta,
}: {
  composite: number;
  band: "Elite" | "Strong" | "Solid" | "Below average" | "At risk";
  sex: "M" | "F";
  age: number;
  fitnessAge: { years: number; approx: boolean; outOfRangeCount: number } | null;
  delta: ReturnType<typeof retestDelta>;
}) {
  return (
    <Link href="/score" className="block">
      <Card className="overflow-hidden">
        <CardBody className="pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-paper-faint">
            Longevity Score
          </p>
          <div className="mt-2 flex items-start justify-between gap-4">
            <p className="score-hero text-[72px]">{oneDecimal(composite)}</p>
            <BandBadge band={band} className="mt-2 shrink-0" />
          </div>

          <p className="mt-3 text-sm text-paper-dim">
            {betterThanSentence(composite, sex)}
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

          <div className="mt-5 flex items-end justify-between border-t border-ink-line-soft pt-4">
            <div className="flex items-end gap-6">
              <div>
                <p className="text-[11px] uppercase tracking-wider text-paper-faint">
                  Fitness age
                </p>
                <p className="tnum mt-0.5 text-2xl font-bold">
                  {fitnessAge
                    ? `${fitnessAge.outOfRangeCount >= 5 ? "\u2264" : ""}${Math.round(fitnessAge.years)}`
                    : "-"}
                  {fitnessAge?.approx && (
                    <span className="ml-1 align-middle text-[10px] font-semibold uppercase tracking-wider text-below">
                      approx
                    </span>
                  )}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-paper-faint">
                  Actual
                </p>
                <p className="tnum mt-0.5 text-2xl font-bold text-paper-dim">{age}</p>
              </div>
            </div>
            <p className="inline-flex items-center gap-1 pb-1 text-xs font-semibold text-signal">
              Breakdown <ArrowRight size={13} />
            </p>
          </div>
        </CardBody>
      </Card>
    </Link>
  );
}

function FirstRunCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>No score yet</CardTitle>
      </CardHeader>
      <CardBody className="space-y-2 text-sm text-paper-dim">
        <p>Ten tests, fixed order, ending with a 12-minute run.</p>
        <p>Each one graded against people your age and sex.</p>
        <p>About 90 minutes. Bring someone to count.</p>
      </CardBody>
    </Card>
  );
}

function RecentHistory({ history }: { history: ReturnType<typeof historyFor> }) {
  const rows = history.attempts.slice(0, 4);
  if (rows.length < 2) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>History</CardTitle>
      </CardHeader>
      <CardBody className="space-y-0">
        {rows.map((a) => (
          <div
            key={a.key}
            className="flex items-center justify-between border-t border-ink-line-soft py-3 first:border-t-0 first:pt-0"
          >
            <div>
              <p className="text-sm font-medium">{formatDate(a.completedAt)}</p>
              <p className="text-xs text-paper-faint">
                {a.sessionId ? "Crew session" : "Solo"}
                {a.score.composite === null &&
                  ` - ${a.score.testsCompleted}/${a.score.testsRequired}`}
              </p>
            </div>
            {a.score.composite !== null ? (
              <div className="flex shrink-0 items-center gap-2.5">
                <span className="tnum text-xl font-bold">
                  {oneDecimal(a.score.composite)}
                </span>
                <BandBadge band={a.score.band!} size="sm" />
              </div>
            ) : (
              <span className="text-xs font-medium text-paper-faint">No score</span>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function LoadingHome() {
  return (
    <div className="space-y-5">
      <div className="h-4 w-24 animate-pulse rounded bg-ink-raised" />
      <div className="h-64 animate-pulse rounded-2xl bg-ink-raised" />
      <div className="h-14 animate-pulse rounded-xl bg-ink-raised" />
      <div className="h-14 animate-pulse rounded-xl bg-ink-raised" />
    </div>
  );
}
