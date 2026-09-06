"use client";

import * as React from "react";
import { ArrowRight, Check, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStore } from "@/lib/data/store-context";
import type { Sex } from "@/lib/scoring/types";
import { cn } from "@/lib/utils";

/**
 * Registration.
 *
 * Sex and date of birth are not preferences, they are the denominator: without
 * a cohort there is no percentile, and without a percentile there is no score.
 * So they are asked first, with the reason on screen, and they cannot be
 * skipped.
 *
 * Email is separate and genuinely optional. It buys two things and the screen
 * says which: your results follow you to another phone, and you appear on the
 * board under a name people recognise. Without it everything still works,
 * on this device only.
 */
export function Register({ onDone }: { onDone?: () => void }) {
  const { store, refresh } = useStore();
  const [mode, setMode] = React.useState<"new" | "returning">("new");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Longevity Score</h1>
        <p className="mt-1 text-sm text-paper-dim">
          Eight tests, graded against people your own age and sex.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-xl bg-ink-raised p-1 ring-1 ring-ink-line">
        {(
          [
            ["new", "I'm new"],
            ["returning", "I have an account"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={cn(
              "h-10 rounded-lg text-sm font-semibold transition-colors",
              mode === key ? "bg-signal text-ink" : "text-paper-dim",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "new" ? (
        <NewAccount store={store} refresh={refresh} onDone={onDone} />
      ) : (
        <ReturningAccount store={store} />
      )}
    </div>
  );
}

function NewAccount({
  store,
  refresh,
  onDone,
}: {
  store: ReturnType<typeof useStore>["store"];
  refresh: () => void;
  onDone?: () => void;
}) {
  const [name, setName] = React.useState("");
  const [sex, setSex] = React.useState<Sex | null>(null);
  const [birthDate, setBirthDate] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const emailLooksReal = email === "" || /.+@.+\..+/.test(email);
  const valid =
    name.trim().length > 0 &&
    sex !== null &&
    /^\d{4}-\d{2}-\d{2}$/.test(birthDate) &&
    Date.parse(birthDate) < Date.now() &&
    emailLooksReal;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    const me = await store.setMe({
      name: name.trim(),
      sex: sex!,
      birthDate,
      userId: null,
    });
    if (email.trim() !== "") {
      // In local mode this records the address; with Supabase configured it
      // also sends the magic link that binds this device to an account.
      await store.claimParticipant(me.id, email.trim());
    }
    refresh();
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="rounded-2xl bg-ink-raised p-5 ring-1 ring-ink-line">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="What your crew calls you"
            className="h-12 w-full rounded-xl bg-ink px-4 text-base ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
          />
        </Field>

        <div className="mt-5">
          <span className="text-xs font-semibold uppercase tracking-wider text-paper-faint">
            Sex
          </span>
          <div className="mt-1.5 grid grid-cols-2 gap-3">
            {(["F", "M"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSex(option)}
                className={cn(
                  "h-12 rounded-xl text-base font-semibold ring-1 transition-colors",
                  sex === option
                    ? "bg-signal text-ink ring-signal"
                    : "bg-ink text-paper-dim ring-ink-line",
                )}
              >
                {option === "F" ? "Female" : "Male"}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5">
          <Field label="Date of birth">
            <input
              type="date"
              value={birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setBirthDate(e.target.value)}
              className="h-12 w-full rounded-xl bg-ink px-4 text-base ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
            />
          </Field>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-paper-faint">
          These two set your cohort. Your score is a percentile against people
          of the same sex in your five-year age band, so there is no score
          without them.
        </p>
      </div>

      <div className="rounded-2xl bg-ink-raised p-5 ring-1 ring-ink-line">
        <Field label="Email (optional)">
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            className="h-12 w-full rounded-xl bg-ink px-4 text-base ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
          />
        </Field>
        <p className="mt-2 text-xs leading-relaxed text-paper-faint">
          Buys two things: your results follow you to another phone, and you
          show up on the board. Leave it blank and everything still works - it
          just lives on this device only.
        </p>
        {!emailLooksReal && (
          <p className="mt-2 text-xs text-risk">That does not look like an email.</p>
        )}
      </div>

      <Button type="submit" size="lg" className="w-full justify-between" disabled={!valid || saving}>
        <span>{saving ? "Setting up..." : "Start"}</span>
        <ArrowRight size={18} />
      </Button>
    </form>
  );
}

function ReturningAccount({
  store,
}: {
  store: ReturnType<typeof useStore>["store"];
}) {
  const [email, setEmail] = React.useState("");
  const [sent, setSent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const local = store.mode === "local";
  const valid = /.+@.+\..+/.test(email);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-ink-raised p-5 ring-1 ring-ink-line">
        {sent ? (
          <p className="flex items-start gap-2 text-sm text-strong">
            <Check size={16} className="mt-0.5 shrink-0" />
            <span>
              Link sent to {email}. Open it on this phone and your results come
              with you.
            </span>
          </p>
        ) : (
          <>
            <Field label="Email">
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="h-12 w-full rounded-xl bg-ink px-4 text-base ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
              />
            </Field>
            <p className="mt-2 text-xs leading-relaxed text-paper-faint">
              No password. We send a link; opening it signs you in.
            </p>
            {local && (
              <p className="mt-3 rounded-xl bg-below/10 px-3 py-2 text-xs leading-relaxed text-below ring-1 ring-below/25">
                This build has no server attached, so no link can actually be
                sent. Accounts need the Supabase project wiring up first - see
                DEPLOY.md.
              </p>
            )}
            <Button
              size="lg"
              className="mt-4 w-full"
              disabled={!valid || busy || local}
              onClick={async () => {
                setBusy(true);
                const me = await store.getMe();
                if (me) await store.claimParticipant(me.id, email.trim());
                setSent(true);
                setBusy(false);
              }}
            >
              <Mail size={16} /> {busy ? "Sending..." : "Send me a link"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-paper-faint">
        {label}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
