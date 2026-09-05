"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/data/store-context";
import type { Sex } from "@/lib/scoring/types";
import { cn } from "@/lib/utils";

/**
 * Sex and birth date are not optional and cannot be skipped: without them
 * there is no cohort, and without a cohort there is no percentile. Asking for
 * them up front, with the reason stated, beats asking later when someone is
 * standing at a pull-up bar.
 */
export function ProfileGate({ onDone }: { onDone?: () => void }) {
  const { store, refresh } = useStore();
  const [name, setName] = React.useState("");
  const [sex, setSex] = React.useState<Sex | null>(null);
  const [birthDate, setBirthDate] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  const valid =
    name.trim().length > 0 &&
    sex !== null &&
    /^\d{4}-\d{2}-\d{2}$/.test(birthDate) &&
    Date.parse(birthDate) < Date.now();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    await store.setMe({ name: name.trim(), sex: sex!, birthDate, userId: null });
    refresh();
    onDone?.();
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Set up</CardTitle>
        </CardHeader>
        <CardBody className="space-y-5">
          <p className="text-sm text-paper-dim">
            You are scored against people your own age and sex. That is why
            these are needed.
          </p>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-paper-faint">
              Name
            </span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              placeholder="What your crew calls you"
              className="mt-1.5 h-12 w-full rounded-xl bg-ink px-4 text-base ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
            />
          </label>

          <div>
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
                      : "bg-ink text-paper-dim ring-ink-line hover:text-paper",
                  )}
                >
                  {option === "F" ? "Female" : "Male"}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-paper-faint">
              Date of birth
            </span>
            <input
              type="date"
              value={birthDate}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setBirthDate(e.target.value)}
              className="mt-1.5 h-12 w-full rounded-xl bg-ink px-4 text-base ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
            />
          </label>
        </CardBody>
      </Card>

      <Button type="submit" size="lg" className="w-full" disabled={!valid || saving}>
        {saving ? "Saving..." : "Continue"}
      </Button>
    </form>
  );
}
