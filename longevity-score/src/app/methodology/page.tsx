import type { Metadata } from "next";
import Link from "next/link";
import { BATTERY_TESTS } from "@/lib/battery";
import { currentBenchmark } from "@/lib/benchmarks/registry";
import { BENCHMARK_NOTES, GRADE_MEANING } from "@/lib/benchmarks/notes";
import { coverageLine, eventGrades } from "@/lib/benchmarks/summary";
import { BANDS } from "@/lib/scoring/composite";
import type { EvidenceGrade } from "@/lib/scoring/types";

export const metadata: Metadata = {
  title: "Methodology",
  description:
    "Every test, its protocol, its sources, and how strong the evidence behind its benchmark is. Plus how the score is worked out, in plain language.",
};

const GRADES: EvidenceGrade[] = ["A", "B", "C", "D"];

/**
 * Grades, floors, ceilings and age coverage are read from the benchmark table
 * itself rather than written by hand, so this page cannot say one thing while
 * the scorer does another. The prose about sources is condensed from the
 * methodology report in docs/, which remains the full account.
 */
export default function MethodologyPage() {
  const table = currentBenchmark;
  const rows = BATTERY_TESTS.map((test) => ({
    test,
    ev: table.events[test.benchmark.event],
    note: BENCHMARK_NOTES[test.benchmark.event],
  }));
  const provisional = rows.filter((r) => r.ev.grade.M === "D" || r.ev.grade.F === "D");

  return (
    <article className="space-y-8 pb-6">
      <header>
        <h1 className="name text-[26px]">Methodology</h1>
        <p className="meta mt-2">
          Benchmarks v{table.version} · {table.generated} · ages {table.age_min}-{table.age_max}
        </p>
        <p className="mt-3 text-[13px] leading-relaxed text-chalk-dim">
          Every number this app shows you traces back to a source on this page.
          Where the source is weak, it says so. That is the point of the page.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="label border-b border-rule-2 pb-2">How the score works</h2>
        <div className="space-y-3 text-[13px] leading-relaxed text-chalk-dim">
          <p>
            You do eight tests. Each raw result is placed against a population
            benchmark for people of your sex and your exact age at the time of the
            test - not a five-year band, a column for every year from{" "}
            {table.age_min} to {table.age_max}. That gives a percentile from 0 to
            100: the share of people like you that the result beats.
          </p>
          <p className="font-medium text-chalk">
            Your Longevity Score is the average of those eight percentiles. Nothing
            is weighted. A 78-year-old woman can outscore a 30-year-old man,
            because both are measured against their own age and sex.
          </p>
          <p>
            The score itself is not a percentile. Averaging eight related
            percentiles gives a tighter number than any one of them: roughly, 70
            is strong, 80 is the top tenth, 90 the top few percent. It is never
            described as &quot;better than X% of people&quot;.
          </p>
          <p>
            All eight are required. Seven tests gives you seven percentiles and no
            score, because a partial average would let you drop the test you are
            worst at and call the result an improvement.
          </p>
          <p>
            Ties are scored in the middle of the tied group. Zero reps is a real
            result: a man of 55 who does no pull-ups scores about 29, because 58%
            of his peers also score zero, and one rep moves him past all of them.
            A did-not-finish on the mile or the shuttle is scored with everyone
            who could not finish. Reaching the balance cap or a perfect
            sit-to-rise ties you with everyone else at the cap.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="label border-b border-rule-2 pb-2">What the labels mean</h2>
        <ul>
          {BANDS.map((band) => (
            <li
              key={band.label}
              className="flex items-baseline justify-between border-b border-rule py-2.5"
            >
              <span className="name text-name">{band.label}</span>
              <span className="num meta">
                {band.min}-{Math.round(band.max)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="label border-b border-rule-2 pb-2">Evidence grades</h2>
        <ul>
          {GRADES.map((g) => (
            <li key={g} className="grid grid-cols-[24px_1fr] gap-gap border-b border-rule py-2.5">
              <span className="num text-name">{g}</span>
              <span className="text-[13px] leading-relaxed text-chalk-dim">{GRADE_MEANING[g]}</span>
            </li>
          ))}
        </ul>
        <p className="text-[13px] leading-relaxed text-chalk-dim">
          {provisional.length} of {rows.length} tests are Grade D -{" "}
          {provisional.map((r) => r.test.name).join(", ")}. No general-population
          norm exists for them. They are honest models built from adjacent
          evidence, marked provisional wherever their percentile appears, and the
          first thing to recalibrate once real results exist.
        </p>
      </section>

      <section className="space-y-4">
        <h2 className="label border-b border-rule-2 pb-2">The eight tests</h2>

        {rows.map(({ test, ev, note }, i) => (
          <div key={test.slug} id={test.slug} className="scroll-mt-20 border-b border-rule py-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="label">
                  {i + 1} - {test.capacityName}
                </p>
                <h3 className="name mt-0.5 text-name">{test.name}</h3>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="label border border-rule-2 px-2 py-0.5 text-chalk">
                  grade {eventGrades(ev)}
                </span>
                <span className="meta">
                  {test.direction === "lower_better" ? "lower is better" : "higher is better"}
                </span>
              </div>
            </div>

            <p className="mt-3 text-[13px] leading-relaxed text-chalk-dim">{test.protocol}</p>

            <dl className="mt-4 space-y-2 border-t border-rule pt-3 text-[12px] leading-relaxed">
              <div>
                <dt className="font-semibold text-chalk-dim">Basis</dt>
                <dd className="mt-0.5 text-chalk-dim">{note.basis}</dd>
              </div>
              <div>
                <dt className="font-semibold text-chalk-dim">Sources</dt>
                <dd className="mt-0.5 text-chalk-dim">
                  <ul className="list-disc space-y-0.5 pl-4">
                    {note.sources.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-chalk-dim">Coverage</dt>
                <dd className="mt-0.5 text-chalk-dim">
                  Ages {coverageLine(ev)}.
                  {ev.floor !== null && ` Floor at ${ev.floor} ${ev.unit} (could not do it).`}
                  {ev.ceiling !== null && ` Ceiling at ${ev.ceiling} ${ev.unit}.`}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-chalk-dim">What to know</dt>
                <dd className="mt-0.5 text-chalk-dim">{note.limitation}</dd>
              </div>
            </dl>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="label border-b border-rule-2 pb-2">Fitness age</h2>
        <div className="space-y-3 text-[13px] leading-relaxed text-chalk-dim">
          <p>
            For each test, we find the age at which your raw result would be
            exactly average for your sex, then take the median of those eight ages.
          </p>
          <p>
            Population benchmarks include a lot of untrained people. A trained
            adult often beats the average {table.age_min}-year-old on several
            tests, and there is no younger age to read. When that happens on more
            than three of your eight, the number is shown as a floor - &quot;
            {table.age_min} or under&quot; - and tagged approx. It is not a more
            precise answer being rounded. It is the edge of what the table can
            resolve.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="label border-b border-rule-2 pb-2">Versions</h2>
        <p className="text-[13px] leading-relaxed text-chalk-dim">
          Every result is stamped with the benchmark version it was entered under
          and scored against that version on read. When a recalibrated table
          ships, your history does not move. Boards pin one version per season.
          The full report, every parameter, and the model that generates the table
          live in the repository under docs/ and tools/benchmarks/.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="label border-b border-rule-2 pb-2">Not medical advice</h2>
        <p className="text-[13px] leading-relaxed text-chalk-dim">
          Several of these tests are associated with mortality risk in published
          research. That is a statement about populations, not about you. This is
          a fitness score, not a diagnosis, and a low band is a reason to train,
          not a reason to worry.
        </p>
      </section>

      <p className="meta text-center">
        <Link href="/" className="underline underline-offset-2">
          Back to your score
        </Link>
      </p>
    </article>
  );
}
