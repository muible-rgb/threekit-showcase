"use client";

import * as React from "react";
import Link from "next/link";
import { Check, ChevronRight, Plus, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { BandBadge } from "@/components/ui/badge";
import { CapacityRadar } from "@/components/capacity-radar";
import { EntrySheet } from "@/components/entry-sheet";
import { ProfileGate } from "@/components/profile-gate";
import { DemoBanner } from "@/components/demo-banner";
import { BATTERY_TESTS, BATTERY_TEST_COUNT, type BatteryTest } from "@/lib/battery";
import { useResultsFor, useStore } from "@/lib/data/store-context";
import { currentCard, historyFor, previousCard } from "@/lib/batteries";
import { retestDelta } from "@/lib/scoring/board";
import { ageAt } from "@/lib/scoring/cohort";
import { buildSharePayload, encodeShareToken } from "@/lib/share-token";
import {
  ageBandLabel,
  betterThanSentence,
  formatDate,
  formatRaw,
  formatRawDelta,
  formatSigned,
  oneDecimal,
  rawImproved,
} from "@/lib/utils";
import type { TestPercentile } from "@/lib/scoring/types";

/**
 * The scorecard. Eight rows, one per test.
 *
 * This is the whole app: you see what you have and what you are missing, you
 * tap a row, you type a number. There is no guided mode and no fixed order,
 * because the testing happens outside and the phone's only job is to hold the
 * results and tell you what they mean.
 */
export default function ScorecardPage() {
  const { me, ready, store, refresh, db } = useStore();
  const results = useResultsFor(me?.id);
  const [editing, setEditing] = React.useState<BatteryTest | null>(null);

  const card = React.useMemo(
    () => (me ? currentCard(me, results) : null),
    [me, results],
  );
  const previous = React.useMemo(
    () => (me ? previousCard(me, results) : null),
    [me, results],
  );
  const history = React.useMemo(
    () => (me ? historyFor(me, results) : null),
    [me, results],
  );

  if (!ready) return <Skeleton />;
  if (!me) return <ProfileGate />;

  const score = card!.score;
  const complete = score.composite != null;

  const byTest = new Map<string, TestPercentile>(
    score.tests.map((t) => [t.testVariant, t]),
  );

  const age = ageAt(me.birthDate, card!.updatedAt ?? new Date().toISOString());
  const delta = complete && previous ? retestDelta(score, previous) : null;
  const bodyweight =
    db?.sessionParticipants.find((sp) => sp.participantId === me.id)?.bodyweightKg ??
    null;

  async function save(test: BatteryTest, value: number) {
    await store.addResult({
      participantId: me!.id,
      sessionId: null,
      testVariant: test.slug,
      rawValue: value,
      recordedAt: new Date().toISOString(),
      recordedByParticipantId: me!.id,
      witnessed: false,
    });
    refresh();
    setEditing(null);
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="pt-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-paper-faint">
            Longevity Score
          </p>

          {complete ? (
            <>
              <div className="mt-2 flex items-start justify-between gap-4">
                <p className="score-hero text-[80px]">{oneDecimal(score.composite!)}</p>
                <BandBadge band={score.band!} className="mt-3 shrink-0" />
              </div>
              <p className="mt-3 text-sm text-paper-dim">
                {betterThanSentence(score.composite!, me.sex)}
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
              <FitnessAgeRow score={score} actualAge={age} />
            </>
          ) : (
            <>
              <div className="mt-2 flex items-end gap-3">
                <p className="score-hero text-[72px] text-paper-faint">
                  {score.testsCompleted}
                  <span className="text-[40px]">/{BATTERY_TEST_COUNT}</span>
                </p>
              </div>
              <p className="mt-2 text-sm text-paper-dim">
                No score until all {BATTERY_TEST_COUNT} are in.
              </p>
            </>
          )}

          <p className="mt-3 text-xs text-paper-faint">
            {ageBandLabel(age, me.sex)}
            {card!.updatedAt ? ` - updated ${formatDate(card!.updatedAt)}` : ""}
          </p>
        </CardBody>
      </Card>

      <div className="overflow-hidden rounded-2xl bg-ink-raised ring-1 ring-ink-line">
        {BATTERY_TESTS.map((test) => (
          <TestRow
            key={test.slug}
            test={test}
            scored={byTest.get(test.slug)}
            entry={card!.entries.get(test.slug)}
            delta={delta?.tests.find((d) => d.testVariant === test.slug)}
            onTap={() => setEditing(test)}
          />
        ))}
      </div>

      <ProvisionalNote tests={score.tests} />

      {complete && (
        <>
          <Card>
            <CardBody className="pt-5">
              <CapacityRadar tests={score.tests} previous={previous?.tests} />
            </CardBody>
          </Card>

          <ShareButton
            name={me.name}
            sex={me.sex}
            age={age}
            score={score}
            completedAt={card!.updatedAt ?? new Date().toISOString()}
          />
        </>
      )}

      <BodyweightRow current={bodyweight} />

      {history && history.attempts.length > 1 && <History history={history} />}

      <DemoBanner />

      {editing && (
        <EntrySheet
          test={editing}
          current={card!.entries.get(editing.slug)?.value ?? null}
          bodyweightLb={bodyweight}
          onSave={(v) => save(editing, v)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

/**
 * A tag on every single row is not a warning, it is wallpaper. One line under
 * the list says the same thing and keeps the rows readable.
 */
function ProvisionalNote({ tests }: { tests: TestPercentile[] }) {
  const n = tests.filter((t) => t.provisional).length;
  if (n === 0) return null;
  const all = n === BATTERY_TEST_COUNT;
  return (
    <p className="px-1 text-xs text-paper-faint">
      {all ? "All" : n} of these use provisional norms.{" "}
      <Link href="/methodology" className="text-below underline underline-offset-2">
        What that means
      </Link>
    </p>
  );
}

function TestRow({
  test,
  scored,
  entry,
  delta,
  onTap,
}: {
  test: BatteryTest;
  scored?: TestPercentile;
  entry?: { value: number };
  delta?: { delta: number; rawDelta: number };
  onTap: () => void;
}) {
  const done = entry !== undefined;

  return (
    <button
      onClick={onTap}
      className="flex w-full items-center gap-3 border-t border-ink-line-soft px-4 py-3.5 text-left first:border-t-0 active:bg-ink-line/40"
    >
      <div className="min-w-0 flex-1">
        <span className="text-sm font-semibold">{test.name}</span>
        <p className="tnum mt-0.5 text-xs text-paper-faint">
          {done ? (
            <>
              <span className="text-paper-dim">{formatRaw(entry!.value, test.unit)}</span>
              {delta && delta.rawDelta !== 0 && (
                <span
                  className={
                    rawImproved(test.direction, delta.rawDelta) ? "text-up" : "text-down"
                  }
                >
                  {" "}
                  {formatRawDelta(delta.rawDelta, test.unit)}
                </span>
              )}
            </>
          ) : (
            test.standard
          )}
        </p>
      </div>

      {scored ? (
        <div className="flex shrink-0 items-center gap-2.5">
          {delta && (
            <span
              className={
                delta.delta >= 0
                  ? "tnum text-xs font-semibold text-up"
                  : "tnum text-xs font-semibold text-down"
              }
            >
              {formatSigned(delta.delta)}
            </span>
          )}
          <div className="w-[68px] text-right">
            <span className="tnum block text-lg font-bold leading-none">
              {scored.percentile.toFixed(0)}
            </span>
            <BandBadge band={scored.band} size="sm" className="mt-1" />
          </div>
        </div>
      ) : (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-signal/10 px-3 py-1.5 text-xs font-semibold text-signal ring-1 ring-signal/25">
          <Plus size={13} /> Enter
        </span>
      )}
      <ChevronRight size={16} className="shrink-0 text-paper-faint" />
    </button>
  );
}

function FitnessAgeRow({
  score,
  actualAge,
}: {
  score: NonNullable<ReturnType<typeof historyFor>["latestComplete"]>["score"];
  actualAge: number;
}) {
  const fa = score.fitnessAge;
  if (!fa) return null;
  const years = Math.round(fa.years);
  const floored = fa.outOfRangeCount >= Math.ceil(score.tests.length / 2);

  return (
    <div className="mt-5 flex items-end gap-6 border-t border-ink-line-soft pt-4">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-paper-faint">
          Fitness age
        </p>
        <p className="tnum mt-0.5 text-3xl font-bold">
          {floored ? `≤${years}` : years}
          {fa.approx && (
            <Link
              href="/methodology#fitness-age"
              className="ml-1.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-below"
            >
              approx
            </Link>
          )}
        </p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-wider text-paper-faint">Actual</p>
        <p className="tnum mt-0.5 text-3xl font-bold text-paper-dim">{actualAge}</p>
      </div>
    </div>
  );
}

/** Not scored. It is here because the carry load comes out of it. */
function BodyweightRow({ current }: { current: number | null }) {
  const { me, store, refresh } = useStore();
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState(current === null ? "" : String(current));

  async function save() {
    const n = Number(text);
    if (!Number.isFinite(n) || n < 60 || n > 500 || !me) return;
    // Bodyweight rides on a lightweight solo session row so the carry load
    // survives a reload without inventing a second storage concept.
    await store.joinSession("solo", me.id, n);
    refresh();
    setEditing(false);
  }

  return (
    <div className="rounded-2xl bg-ink-raised px-4 py-3 ring-1 ring-ink-line">
      {editing ? (
        <div className="flex items-center gap-2">
          <input
            autoFocus
            inputMode="numeric"
            value={text}
            onChange={(e) => setText(e.target.value.replace(/[^\d.]/g, ""))}
            placeholder="lb"
            className="tnum h-11 flex-1 rounded-xl bg-ink px-3 text-lg ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
          />
          <Button size="sm" className="h-11" onClick={save}>
            <Check size={15} />
          </Button>
        </div>
      ) : (
        <button
          onClick={() => setEditing(true)}
          className="flex w-full items-center justify-between text-left"
        >
          <span className="text-sm text-paper-dim">Bodyweight</span>
          <span className="tnum text-sm font-semibold">
            {current === null ? (
              <span className="text-signal">Set it</span>
            ) : (
              `${Math.round(current)} lb`
            )}
          </span>
        </button>
      )}
      <p className="mt-1 text-[11px] text-paper-faint">
        Sets your carry load. Not scored.
      </p>
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
  score: NonNullable<ReturnType<typeof historyFor>["latestComplete"]>["score"];
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
        await navigator.share({ title: "My Longevity Score", url });
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
      // Clipboard is blocked in iframes and in Safari without a gesture
      // grant. Show the link rather than leaving a dead button.
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

function History({ history }: { history: ReturnType<typeof historyFor> }) {
  const rows = history.attempts.slice(1, 5).filter((a) => a.score.composite !== null);
  if (rows.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Before</CardTitle>
      </CardHeader>
      <CardBody className="space-y-0">
        {rows.map((a) => (
          <div
            key={a.key}
            className="flex items-center justify-between border-t border-ink-line-soft py-3 first:border-t-0 first:pt-0"
          >
            <p className="text-sm">{formatDate(a.completedAt)}</p>
            <div className="flex shrink-0 items-center gap-2.5">
              <span className="tnum text-lg font-bold">
                {oneDecimal(a.score.composite!)}
              </span>
              <BandBadge band={a.score.band!} size="sm" />
            </div>
          </div>
        ))}
      </CardBody>
    </Card>
  );
}

function Skeleton() {
  return (
    <div className="space-y-4">
      <div className="h-52 animate-pulse rounded-2xl bg-ink-raised" />
      <div className="h-96 animate-pulse rounded-2xl bg-ink-raised" />
    </div>
  );
}
