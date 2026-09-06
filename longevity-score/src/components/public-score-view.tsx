import Link from "next/link";
import type { DecodedShare } from "@/lib/share-token";
import { BAND_LABELS, COMPOSITE_CAPTION, formatDate, oneDecimal, ordinal } from "@/lib/utils";

/**
 * The body of a shared score. Shared between the server-rendered public page
 * and the client preview so they cannot drift.
 */
export function PublicScoreView({ share }: { share: DecodedShare }) {
  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg px-pad py-10">
      <p className="name text-logo">The Long Game</p>

      <div className="mt-8 border-t border-rule-2 pt-5">
        <p className="name text-name">{share.name}</p>
        <p className="meta mt-0.5">
          {share.ageBand} · {formatDate(share.completedAt)}
        </p>

        <div className="mt-4 flex items-baseline gap-3">
          <p className="figure text-accent text-[64px]">
            {oneDecimal(share.composite)}
          </p>
          <p className="name text-name text-chalk-dim">{BAND_LABELS[share.band]}</p>
        </div>

        <p className="meta mt-2">
          {share.populationPercentile !== null
            ? `Est. ${ordinal(Math.round(share.populationPercentile))} percentile · ${
                share.sex === "M" ? "men" : "women"
              } ${share.ageBand.slice(2)}`
            : COMPOSITE_CAPTION}
        </p>
        {share.fitnessAge !== null && (
          <p className="meta mt-0.5">
            Fitness age {share.fitnessAge}
            {share.fitnessAgeApprox ? " (approx)" : ""}
          </p>
        )}
      </div>

      <p className="label border-b border-rule-2 pb-2 pt-8">The eight</p>
      <div>
        {share.tests.map((t) => (
          <div
            key={t.slug}
            className="grid grid-cols-[1fr_auto] items-center gap-gap border-b border-rule py-row"
          >
            <div className="min-w-0">
              <p className="name text-name">{t.label}</p>
              <div className="mt-1.5 h-[3px] w-full bg-rule">
                <div className="h-full bg-chalk" style={{ width: `${t.percentile}%` }} />
              </div>
            </div>
            <p className="num text-score">{Math.round(t.percentile)}</p>
          </div>
        ))}
      </div>

      <Link
        href="/"
        className="btn mt-8 inline-flex h-12 items-center px-5 text-label"
      >
        Get your own score
      </Link>
      <p className="mt-3">
        <Link href="/methodology" className="meta underline underline-offset-4">
          How this is worked out
        </Link>
      </p>
    </div>
  );
}
