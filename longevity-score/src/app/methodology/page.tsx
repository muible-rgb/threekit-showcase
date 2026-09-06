import type { Metadata } from "next";
import Link from "next/link";
import { BATTERY_TESTS } from "@/lib/battery";
import { normsRegistry } from "@/lib/norms/registry";
import { BANDS } from "@/lib/scoring/composite";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "Every test, its protocol, its source, and whether its norms are provisional. Plus how the score is worked out, in plain language.",
};

/**
 * Rendered from the norms files themselves rather than written by hand, so it
 * cannot drift from what the app actually uses. If a citation changes in
 * /data/norms, this page changes with it.
 */
export default function MethodologyPage() {
  const files = BATTERY_TESTS.map((test) => ({
    test,
    norms: normsRegistry.get(test.slug)!,
  }));

  const provisionalCount = files.filter((f) => f.norms.source.provisional).length;
  const unverifiedCount = files.filter(
    (f) => f.norms.source.transcription_verified !== true,
  ).length;

  return (
    <article className="space-y-8 pb-6">
      <header>
        <h1 className="name text-[26px]">Methodology</h1>
        <p className="mt-2 text-[13px] leading-relaxed text-chalk-dim">
          Every number this app shows you traces back to a source on this page.
          Where the source is weak, it says so. That is the point of the page.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="label border-b border-rule-2 pb-2">
          How the score works
        </h2>
        <div className="space-y-3 text-[13px] leading-relaxed text-chalk-dim">
          <p>
            You do eight tests. Each raw result is compared to published norms for
            people of your sex in your five-year age band. That comparison gives
            a percentile between 1 and 99.
          </p>
          <p className="font-medium text-chalk">
            Your Longevity Score is the average of those eight percentiles. Nothing
            is weighted. A 78-year-old woman can outscore a 30-year-old man,
            because both are measured against their own cohort.
          </p>
          <p>
            All eight are required. Seven tests gives you seven percentiles and no
            score, because a partial average would let you drop the test you are
            worst at and call the result an improvement.
          </p>
          <p>
            Nobody scores 0 and nobody scores 100. The floor is the 1st
            percentile and the ceiling is the 99th - a test can tell you that you
            are near the edge of a distribution, not that you are outside it.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="label border-b border-rule-2 pb-2">
          What the labels mean
        </h2>
        <ul className="">
          {BANDS.map((band) => (
            <li
              key={band.label}
              className="flex items-baseline justify-between border-b border-rule py-2.5"
            >
              <span className="name text-name">{band.label}</span>
              <span className="tnum meta">
                {band.min}-{Math.round(band.max)} percentile
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="label border-b border-rule-2 pb-2">
          Two numbers, never blended
        </h2>
        <div className="space-y-3 text-[13px] leading-relaxed text-chalk-dim">
          <p>
            <span className="font-semibold text-chalk">Longevity Score</span> is
            you against published general-population norms. It is the number that
            carries any health meaning.
          </p>
          <p>
            <span className="font-semibold text-chalk">Crew rank</span> is you
            against the other people in your session. It is the game. It never
            feeds into your Longevity Score, and your Longevity Score never
            changes because of who showed up on Saturday.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="label border-b border-rule-2 pb-2">
          Fitness age
        </h2>
        <div className="space-y-3 text-[13px] leading-relaxed text-chalk-dim">
          <p>
            For each test, we find the age at which your raw result would be
            exactly average for your sex, then take the median of those eight ages.
          </p>
          <p>
            It has a known limit in v1, and it is worth understanding before you
            read anything into it. Published norms describe the general
            population, which includes a lot of untrained people. A trained adult
            sitting one standard deviation above that median is often 20 to 40
            per cent above it in raw terms, which maps to an age below the
            youngest band the norms cover.
          </p>
          <p className="font-medium text-chalk">
            When that happens on more than three of your eight tests, the number is
            shown as a floor - &quot;22 or under&quot; - and tagged approx. It is
            not a more precise answer being rounded. It is the edge of what these
            norms can resolve.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="label border-b border-rule-2 pb-2">
          Where the norms are weak
        </h2>
        <div className="border border-rule-2 p-4">
          <p className="text-[13px] leading-relaxed text-chalk-dim">
            <span className="font-semibold text-chalk-dim">
              {provisionalCount} of {files.length} tests
            </span>{" "}
            use provisional norms, and {unverifiedCount} of {files.length} have
            not yet had their numbers proofread against the source document by a
            human. Both states are marked on every test below and tagged wherever
            a percentile from them appears in the app.
          </p>
          <p className="mt-3 text-[13px] leading-relaxed text-chalk-dim">
            A file is only non-provisional when both the average and the spread
            come from the cited source. If we had to infer the spread, it is
            provisional, even where the average is well published.
          </p>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="label border-b border-rule-2 pb-2">
          The eight tests
        </h2>

        {files.map(({ test, norms }, i) => (
          <div
            key={test.slug}
            id={test.slug}
            className="scroll-mt-20 border-b border-rule py-5"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label text-chalk-dim">
                  {i + 1} - {test.capacityName}
                </p>
                <h3 className="mt-0.5 name text-name">{test.name}</h3>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                {norms.source.provisional ? (
                  <span className="rounded px-2 py-0.5 label text-chalk-dim border border-rule-2">
                    provisional
                  </span>
                ) : (
                  <span className="rounded px-2 py-0.5 label text-chalk border border-rule-2">
                    sourced
                  </span>
                )}
                <span className="text-[10px] text-chalk-dim">
                  {test.direction === "lower_better" ? "lower is better" : "higher is better"}
                </span>
              </div>
            </div>

            <p className="mt-3 text-[13px] leading-relaxed text-chalk-dim">{test.protocol}</p>

            <dl className="mt-4 space-y-2 border-t border-ink-line-soft pt-3 text-[12px] leading-relaxed">
              <div>
                <dt className="font-semibold text-chalk-dim">Source</dt>
                <dd className="mt-0.5 text-chalk-dim">
                  {norms.source.citation}
                  {norms.source.url && (
                    <>
                      {" "}
                      <a
                        href={norms.source.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-chalk underline underline-offset-2"
                      >
                        link
                      </a>
                    </>
                  )}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-chalk-dim">Population</dt>
                <dd className="mt-0.5 text-chalk-dim">{norms.source.population}</dd>
              </div>
              {norms.source.notes && (
                <div>
                  <dt className="font-semibold text-chalk-dim">What to know</dt>
                  <dd className="mt-0.5 text-chalk-dim">{norms.source.notes}</dd>
                </div>
              )}
              <div>
                <dt className="font-semibold text-chalk-dim">Form</dt>
                <dd className="mt-0.5 text-chalk-dim">
                  {norms.cohorts[0]?.mean !== undefined
                    ? "Mean and standard deviation per cohort; percentile from the normal curve."
                    : "Published percentile cut-points per cohort; linear interpolation between them."}{" "}
                  {norms.cohorts.length} cohorts, ages{" "}
                  {Math.min(...norms.cohorts.map((c) => c.age_min))} to{" "}
                  {Math.max(...norms.cohorts.map((c) => c.age_max))}, both sexes.
                  {norms.source.transcription_verified !== true &&
                    " Numbers not yet proofread against the source document."}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="label border-b border-rule-2 pb-2">
          Not medical advice
        </h2>
        <p className="text-[13px] leading-relaxed text-chalk-dim">
          Several of these tests are associated with mortality risk in published
          research. That is a statement about populations, not about you. This is
          a fitness score, not a diagnosis, and a low band is a reason to train,
          not a reason to worry.
        </p>
      </section>

      <p className="text-center meta">
        <Link href="/" className="underline underline-offset-2">
          Back to your score
        </Link>
      </p>
    </article>
  );
}
