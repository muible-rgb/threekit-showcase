"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import type { Sex } from "@/lib/scoring/types";
import { cn } from "@/lib/utils";

/**
 * A guest is a real participant with no account. The host enters their name,
 * sex and birth date - all three are needed, because without a cohort there is
 * no percentile and a guest with no percentile is just a name on a board.
 *
 * They can claim the results by email afterwards, which links this row to a
 * user account without touching any of the recorded results.
 */
export function AddGuestForm({
  onAdd,
  onCancel,
}: {
  onAdd: (guest: { name: string; sex: Sex; birthDate: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = React.useState("");
  const [sex, setSex] = React.useState<Sex | null>(null);
  const [birthDate, setBirthDate] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const valid =
    name.trim() !== "" && sex !== null && /^\d{4}-\d{2}-\d{2}$/.test(birthDate);

  return (
    <Card className="ring-signal/30">
      <CardHeader>
        <CardTitle>Add someone</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <input
          value={name}
          autoFocus
          onChange={(e) => setName(e.target.value)}
          placeholder="Their name"
          className="h-12 w-full rounded-xl bg-ink px-4 ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
        />
        <div className="grid grid-cols-2 gap-3">
          {(["F", "M"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setSex(option)}
              className={cn(
                "h-12 rounded-xl font-semibold ring-1 transition-colors",
                sex === option
                  ? "bg-signal text-ink ring-signal"
                  : "bg-ink text-paper-dim ring-ink-line",
              )}
            >
              {option === "F" ? "Female" : "Male"}
            </button>
          ))}
        </div>
        <input
          type="date"
          value={birthDate}
          max={new Date().toISOString().slice(0, 10)}
          onChange={(e) => setBirthDate(e.target.value)}
          className="h-12 w-full rounded-xl bg-ink px-4 ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
        />
        <p className="text-xs text-paper-faint">
          They can claim these results by email once you lock.
        </p>
        <div className="flex gap-3">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            className="flex-1"
            disabled={!valid || busy}
            onClick={async () => {
              setBusy(true);
              await onAdd({ name: name.trim(), sex: sex!, birthDate });
            }}
          >
            {busy ? "Adding..." : "Add to session"}
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}
