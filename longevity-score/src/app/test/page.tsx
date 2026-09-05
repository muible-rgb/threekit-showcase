"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  SkipForward,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProvisionalTag } from "@/components/ui/badge";
import { TestInput } from "@/components/inputs";
import { RestTimer } from "@/components/rest-timer";
import { BodyweightPrompt } from "@/components/bodyweight-prompt";
import { UnscoredPrompt } from "@/components/unscored-prompt";
import { SyncIndicator } from "@/components/sync-indicator";
import { ProfileGate } from "@/components/profile-gate";
import { OPEN_V1_TESTS } from "@/lib/battery";
import { normsRegistry } from "@/lib/norms/registry";
import { useResultsFor, useStore } from "@/lib/data/store-context";
import { historyFor } from "@/lib/batteries";
import { cn } from "@/lib/utils";

type Phase = "bodyweight" | "test" | "rest" | "unscored" | "done";

/**
 * useSearchParams forces this subtree to be client-rendered. Wrapping it keeps
 * the rest of the route static instead of opting the whole page out.
 */
export default function TestModePage() {
  return (
    <React.Suspense fallback={<div className="min-h-dvh bg-ink" />}>
      <TestMode />
    </React.Suspense>
  );
}

function TestMode() {
  const router = useRouter();
  const params = useSearchParams();
  const sessionId = params.get("session");
  const forParticipant = params.get("for");

  const { me, store, ready, refresh } = useStore();
  const participantId = forParticipant ?? me?.id ?? null;
  const results = useResultsFor(participantId);

  const [phase, setPhase] = React.useState<Phase>("bodyweight");
  const [index, setIndex] = React.useState(0);
  const [value, setValue] = React.useState<number | null>(null);
  const [bodyweight, setBodyweight] = React.useState<number | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Resume: jump to the first test with no result in the current attempt.
  const attempt = React.useMemo(() => {
    if (!me) return null;
    const history = historyFor(me, results);
    if (sessionId) {
      return history.attempts.find((a) => a.sessionId === sessionId) ?? null;
    }
    return history.inProgress;
  }, [me, results, sessionId]);

  const doneSlugs = React.useMemo(
    () => new Set(attempt?.results.map((r) => r.testVariant) ?? []),
    [attempt],
  );

  const initialised = React.useRef(false);
  React.useEffect(() => {
    if (!ready || initialised.current || !me) return;
    initialised.current = true;
    const firstUndone = OPEN_V1_TESTS.findIndex((t) => !doneSlugs.has(t.slug));
    if (doneSlugs.size > 0) {
      setPhase(firstUndone === -1 ? "unscored" : "test");
      setIndex(firstUndone === -1 ? OPEN_V1_TESTS.length - 1 : firstUndone);
    }
  }, [ready, me, doneSlugs]);

  if (!ready) {
    return <div className="min-h-dvh bg-ink" />;
  }
  if (!me) {
    return (
      <div className="mx-auto max-w-lg px-5 py-8">
        <ProfileGate />
      </div>
    );
  }

  const test = OPEN_V1_TESTS[index];
  const norms = normsRegistry.get(test.slug);
  const completed = doneSlugs.size;

  async function save() {
    if (value === null || saving) return;
    setSaving(true);
    // Local write, synchronous. The button is never waiting on a network call,
    // which is what keeps the 90-second-to-score promise honest.
    await store.addResult({
      participantId: participantId!,
      sessionId,
      testVariant: test.slug,
      rawValue: value,
      recordedAt: new Date().toISOString(),
      recordedByParticipantId: me!.id,
      witnessed: Boolean(sessionId),
    });
    refresh();
    setValue(null);
    setSaving(false);

    if (index === OPEN_V1_TESTS.length - 1) {
      setPhase("unscored");
    } else {
      setPhase("rest");
    }
  }

  function skip() {
    // Skipping is allowed and immediately honest about the cost.
    if (index === OPEN_V1_TESTS.length - 1) {
      setPhase("unscored");
      return;
    }
    setValue(null);
    setIndex((i) => i + 1);
  }

  if (phase === "bodyweight") {
    return (
      <BodyweightPrompt
        onSubmit={async (kg) => {
          setBodyweight(kg);
          if (sessionId) await store.setBodyweight(sessionId, participantId!, kg);
          setPhase("test");
        }}
        onSkip={() => setPhase("test")}
      />
    );
  }

  if (phase === "rest") {
    const next = OPEN_V1_TESTS[index + 1];
    return (
      <RestTimer
        seconds={test.restSeconds}
        justFinished={test}
        next={next}
        completed={completed + 1}
        total={OPEN_V1_TESTS.length}
        onContinue={() => {
          setIndex((i) => i + 1);
          setPhase("test");
        }}
      />
    );
  }

  if (phase === "unscored") {
    return (
      <UnscoredPrompt
        participantId={participantId!}
        sessionId={sessionId}
        onDone={() => router.push(sessionId ? `/crew/${sessionId}` : "/score")}
      />
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col">
      <header className="pt-safe sticky top-0 z-10 bg-ink/90 backdrop-blur">
        <div className="flex items-center justify-between px-5 py-3">
          <Link
            href={sessionId ? `/crew/${sessionId}` : "/"}
            aria-label="Leave test mode"
            className="flex h-10 w-10 items-center justify-center rounded-full text-paper-dim hover:bg-ink-raised"
          >
            <X size={20} />
          </Link>
          <div className="text-center">
            <p className="tnum text-sm font-semibold">
              {index + 1} / {OPEN_V1_TESTS.length}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-paper-faint">
              {test.capacityName}
            </p>
          </div>
          <SyncIndicator />
        </div>

        <ol className="flex gap-1 px-5 pb-3" aria-label="Battery progress">
          {OPEN_V1_TESTS.map((t, i) => (
            <li
              key={t.slug}
              title={t.name}
              className={cn(
                "h-1.5 flex-1 rounded-full",
                doneSlugs.has(t.slug)
                  ? "bg-signal"
                  : i === index
                    ? "bg-paper-dim"
                    : "bg-ink-line",
              )}
            />
          ))}
        </ol>
      </header>

      <div className="flex-1 px-5 pb-4">
        <div className="flex items-baseline gap-2">
          <h1 className="text-2xl font-bold tracking-tight">{test.name}</h1>
          {norms?.source.provisional && <ProvisionalTag slug={test.slug} />}
        </div>
        <p className="mt-1 text-sm font-medium text-signal">{test.cue}</p>

        {test.slug === "farmer_carry_half_bw" && bodyweight && (
          <p className="mt-3 rounded-xl bg-signal/10 px-4 py-3 text-sm font-semibold text-signal ring-1 ring-signal/25">
            Load: {(bodyweight / 2).toFixed(1)} kg in each hand.
          </p>
        )}

        {/*
          The input has to be reachable without scrolling. Someone entering a
          result is out of breath and holding a phone in one hand - making them
          scroll past a protocol they have already read, on every one of ten
          tests, is how results get typed into the wrong field. So the protocol
          and the demo collapse, and the cue line above carries the reminder.
        */}
        <details className="group mt-3">
          <summary className="flex cursor-pointer items-center justify-between rounded-xl bg-ink-raised px-4 py-2.5 text-xs font-semibold text-paper-dim ring-1 ring-ink-line">
            <span className="flex items-center gap-1.5">
              <BookOpen size={13} /> Protocol
            </span>
            <ChevronDown
              size={14}
              className="transition-transform group-open:rotate-180"
            />
          </summary>
          <p className="px-1 pt-3 text-sm leading-relaxed text-paper-dim">
            {test.protocol}
          </p>
          {test.demoVideoId ? (
            <div className="mt-3 aspect-video w-full overflow-hidden rounded-2xl bg-ink-raised ring-1 ring-ink-line">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube-nocookie.com/embed/${test.demoVideoId}`}
                title={`${test.name} demonstration`}
                allow="accelerometer; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          ) : (
            <p className="mt-3 rounded-xl bg-ink px-4 py-3 text-xs text-paper-faint ring-1 ring-ink-line-soft">
              Demo video to come.
            </p>
          )}
        </details>

        <div className="mt-5">
          <TestInput test={test} value={value} onChange={setValue} />
        </div>

        {doneSlugs.has(test.slug) && (
          <p className="mt-4 flex items-center gap-1.5 text-xs text-paper-faint">
            <Check size={13} className="text-signal" />
            Already recorded. Saving again replaces it - the old entry is kept.
          </p>
        )}
      </div>

      <div className="pb-safe sticky bottom-0 space-y-2 border-t border-ink-line-soft bg-ink/95 px-5 pt-3 backdrop-blur">
        <Button
          size="lg"
          className="w-full justify-between"
          disabled={value === null || saving}
          onClick={save}
        >
          <span>{saving ? "Saving..." : "Save and next"}</span>
          <ArrowRight size={20} />
        </Button>
        <div className="flex items-center justify-between">
          <button
            type="button"
            disabled={index === 0}
            onClick={() => {
              setValue(null);
              setIndex((i) => Math.max(0, i - 1));
            }}
            className="flex items-center gap-1 py-2 text-xs text-paper-faint disabled:opacity-30"
          >
            <ChevronLeft size={14} /> Back
          </button>
          <button
            type="button"
            onClick={skip}
            className="flex items-center gap-1 py-2 text-xs text-paper-faint hover:text-paper-dim"
          >
            Skip - no score without all ten <SkipForward size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
