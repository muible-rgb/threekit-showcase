"use client";

import * as React from "react";
import { Check, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { useStore } from "@/lib/data/store-context";
import { oneDecimal } from "@/lib/utils";

/**
 * Guests claim their results after the session. The magic link goes to their
 * email; the participant row is then linked to a user account. Nothing about
 * the recorded results changes - they were always theirs, they just had no
 * account attached.
 */
export function ClaimPrompt({
  guests,
}: {
  guests: Array<{ id: string; name: string; composite: number | null }>;
}) {
  const { store, refresh } = useStore();
  const [emails, setEmails] = React.useState<Record<string, string>>({});
  const [sent, setSent] = React.useState<Record<string, boolean>>({});

  return (
    <Card className="ring-signal/30">
      <CardHeader>
        <CardTitle>Claim your results</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-xs leading-relaxed text-paper-dim">
          {guests.length === 1 ? "One person" : `${guests.length} people`} tested
          today without an account. Enter an email and they get a link that
          attaches today&apos;s results to their own history.
        </p>

        {guests.map((guest) => (
          <div key={guest.id} className="space-y-2 border-t border-ink-line-soft pt-3">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-semibold">{guest.name}</span>
              <span className="tnum text-sm text-paper-dim">
                {guest.composite === null ? "no score" : oneDecimal(guest.composite)}
              </span>
            </div>
            {sent[guest.id] ? (
              <p className="flex items-center gap-1.5 text-xs font-medium text-strong">
                <Check size={13} /> Link sent to {emails[guest.id]}
              </p>
            ) : (
              <div className="flex gap-2">
                <input
                  type="email"
                  inputMode="email"
                  value={emails[guest.id] ?? ""}
                  onChange={(e) =>
                    setEmails((prev) => ({ ...prev, [guest.id]: e.target.value }))
                  }
                  placeholder="their@email.com"
                  className="h-11 flex-1 rounded-xl bg-ink px-3 text-sm ring-1 ring-ink-line focus:outline-none focus:ring-2 focus:ring-signal"
                />
                <Button
                  size="sm"
                  className="h-11"
                  disabled={!(emails[guest.id] ?? "").includes("@")}
                  onClick={async () => {
                    await store.claimParticipant(guest.id, emails[guest.id]);
                    setSent((prev) => ({ ...prev, [guest.id]: true }));
                    refresh();
                  }}
                >
                  <Mail size={14} /> Send
                </Button>
              </div>
            )}
          </div>
        ))}
      </CardBody>
    </Card>
  );
}
