"use client";

import * as React from "react";
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
      <div className="border-b border-rule-2 pb-5">
        <h1 className="name text-[26px]">The Long Game</h1>
        <p className="meta mt-1">
          Eight tests, graded against people your own age and sex
        </p>
      </div>

      <div className="flex">
        {(
          [
            ["new", "I'm new"],
            ["returning", "I have an account"],
          ] as const
        ).map(([key, label], i) => (
          <button
            key={key}
            onClick={() => setMode(key)}
            className={cn(
              "label flex-1 border py-2.5",
              mode === key ? "border-chalk text-chalk" : "border-rule-2 text-chalk-off",
              i === 1 && "-ml-px",
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
      <div className="border border-rule-2 p-pad">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            placeholder="What your crew calls you"
            className="h-12 w-full border border-rule-2 bg-board px-3 text-name text-chalk focus:border-chalk focus:outline-none"
          />
        </Field>

        <div className="mt-5">
          <span className="label">Sex</span>
          <div className="mt-1.5 grid grid-cols-2 gap-3">
            {(["F", "M"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setSex(option)}
                className={cn(
                  "label h-12 border",
                  sex === option
                    ? "border-chalk text-chalk"
                    : "border-rule-2 text-chalk-off",
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
              className="h-12 w-full border border-rule-2 bg-board px-3 text-name text-chalk focus:border-chalk focus:outline-none"
            />
          </Field>
        </div>

        <p className="mt-3 text-[12px] leading-relaxed text-chalk-dim">
          These two set your cohort. Your score is a percentile against people
          of the same sex in your five-year age band, so there is no score
          without them.
        </p>
      </div>

      <div className="border border-rule-2 p-pad">
        <Field label="Email (optional)">
          <input
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            className="h-12 w-full border border-rule-2 bg-board px-3 text-name text-chalk focus:border-chalk focus:outline-none"
          />
        </Field>
        <p className="mt-2 text-[12px] leading-relaxed text-chalk-dim">
          Buys two things: your results follow you to another phone, and you
          show up on the board. Leave it blank and everything still works, on
          this device only.
        </p>
        {!emailLooksReal && (
          <p className="meta mt-2">That does not look like an email.</p>
        )}
      </div>

      <Button type="submit" size="lg" variant="accent" className="w-full" disabled={!valid || saving}>
        {saving ? "Setting up" : "Start"}
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
      <div className="border border-rule-2 p-pad">
        {sent ? (
          <p className="text-[13px] leading-relaxed text-chalk-dim">
            Link sent to {email}. Open it on this phone and your results come
            with you.
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
                className="h-12 w-full border border-rule-2 bg-board px-3 text-name text-chalk focus:border-chalk focus:outline-none"
              />
            </Field>
            <p className="mt-2 text-[12px] leading-relaxed text-chalk-dim">
              No password. We send a link; opening it signs you in.
            </p>
            {local && (
              <p className="mt-3 border border-rule-2 p-3 text-[12px] leading-relaxed text-chalk-dim">
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
              {busy ? "Sending" : "Send me a link"}
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
      <span className="label">{label}</span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}
