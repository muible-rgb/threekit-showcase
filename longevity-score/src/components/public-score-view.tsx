import Link from "next/link";
import type { DecodedShare } from "@/lib/share-token";
import { BAND_STYLES, formatDate, oneDecimal } from "@/lib/utils";

/**
 * The body of a shared score. Extracted so the server-rendered public page and
 * the client preview build render the same markup rather than two copies that
 * drift apart.
 */
export function PublicScoreView({ share }: { share: DecodedShare }) {
  const bandStyle = BAND_STYLES[share.band];

  return (
    <div className="mx-auto min-h-dvh w-full max-w-lg px-5 py-10">
      <div className="mb-8 text-center">
        <span className="text-base font-bold tracking-tight">Longevity</span>{" "}
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-signal">
          Score
        </span>
      </div>

      <div className="rounded-3xl bg-ink-raised p-6 ring-1 ring-ink-line">
        <p className="text-sm font-semibold">{share.name}</p>
        <p className="text-[11px] uppercase tracking-widest text-paper-faint">
          {share.ageBand} - {formatDate(share.completedAt)}
        </p>

        <p className={`score-hero mt-4 text-[80px] ${bandStyle.text}`}>
          {oneDecimal(share.composite)}
        </p>

        <p
          className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ring-1 ${bandStyle.text} ${bandStyle.bg} ${bandStyle.ring}`}
        >
          {share.band}
        </p>

        <p className="mt-4 text-sm text-paper-dim">
          Better than {Math.round(share.composite)}% of{" "}
          {share.sex === "M" ? "men" : "women"} the same age.
        </p>

        {share.fitnessAge !== null && (
          <p className="mt-1 text-sm text-paper-dim">
            Fitness age {share.fitnessAge}
            {share.fitnessAgeApprox && (
              <span className="ml-1 text-[10px] uppercase tracking-wider text-below">
                approx
              </span>
            )}
          </p>
        )}

        <ul className="mt-6 space-y-2 border-t border-ink-line-soft pt-4">
          {share.tests.map((t) => (
            <li key={t.slug} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-xs text-paper-dim">{t.label}</span>
              <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-line">
                <span
                  className="block h-full rounded-full"
                  style={{
                    width: `${t.percentile}%`,
                    backgroundColor: BAND_STYLES[t.band].hex,
                  }}
                />
              </span>
              <span className="tnum w-7 text-right text-xs font-semibold">
                {Math.round(t.percentile)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 space-y-3 text-center">
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-xl bg-signal px-6 font-semibold text-ink"
        >
          Get your own score
        </Link>
        <p>
          <Link
            href="/methodology"
            className="text-xs text-paper-dim underline underline-offset-2"
          >
            How this is worked out
          </Link>
        </p>
      </div>
    </div>
  );
}
