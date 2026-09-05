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
import {
  ageBandLabel,
  betterThanSentence,
  formatDate,
  formatSigned,
  oneDecimal,
} from "@/lib/utils";
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
      <p className="text-sm text-paper-dim">
        {latest ? `Hello ${me.name.split(" ")[0]}.` : `Welcome, ${me.name.split(" ")[0]}.`}
      </p>

      {latest ? (
        <ScoreHeroCard
          composite={latest.score.composite!}
          band={latest.score.band!}
          sex={me.sex}
          age={ageAt(me.birthDate, latest.completedAt)}
          completedAt={latest.completedAt}
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
                {inProgress.score.testsCompleted} of {inProgress.score.testsRequired}{" "}
                tests done. No composite until all ten are in.
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

      <p className="pt-2 text-center text-xs leading-relaxed text-paper-faint">
        Your score is graded against people your own age and sex.{" "}
        <Link href="/methodology" className="text-paper-dim underline underline-offset-2">
          How it works
        </Link>
      </p>
    </div>
  );
}

function ScoreHeroCard({
  composite,
  band,
  sex,
  age,
  completedAt,
  fitnessAge,
  delta,
}: {
  composite: number;
  band: "Elite" | "Strong" | "Solid" | "Below average" | "At risk";
  sex: "M" | "F";
  age: number;
  completedAt: string;
  fitnessAge: { years: number; approx: boolean } | null;
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
          </p>
          {delta?.compositeDelta != null && (
            <p
              className={
                delta.compositeDelta >= 0
                  ? "tnum mt-1 text-sm font-semibold text-up"
                  : "tnum mt-1 text-sm font-semibold text-down"
              }
            >
              {formatSigned(delta.compositeDelta)} since your last battery
            </p>
          )}

          <div className="mt-5 flex items-end justify-between border-t border-ink-line-soft pt-4">
            <div>
              <p className="text-[11px] uppercase tracking-wider text-paper-faint">
                Fitness age
              </p>
              <p className="tnum mt-0.5 text-2xl font-bold">
                {fitnessAge ? Math.round(fitnessAge.years) : "-"}
                {fitnessAge?.approx && (
                  <span className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-below">
                    approx
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-xs text-paper-faint">Actual {age}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wider text-paper-faint">
                {ageBandLabel(age, sex)}
              </p>
              <p className="mt-0.5 text-xs text-paper-dim">{formatDate(completedAt)}</p>
              <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-signal">
                Full breakdown <ArrowRight size={13} />
              </p>
            </div>
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
      <CardBody className="space-y-3 text-sm leading-relaxed text-paper-dim">
        <p>
          Ten tests, in a fixed order, ending with a 12-minute run. Grip, balance,
          mobility, push-ups, jump, hang, carry, wall sit, 400m, Cooper.
        </p>
        <p>
          Each result is graded against people of your age and sex, not against a
          flat standard. Your score is the average of those ten percentiles.
        </p>
        <p>
          Budget about 90 minutes and bring a friend to count for you. The whole
          thing works with no signal.
        </p>
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
                {a.sessionId ? "Crew session" : "Solo"} -{" "}
                {a.score.testsCompleted}/{a.score.testsRequired} tests
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
              <span className="text-xs font-medium text-paper-faint">
                Incomplete - no score
              </span>
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
