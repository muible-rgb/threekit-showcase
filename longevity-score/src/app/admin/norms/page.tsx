import type { Metadata } from "next";
import { NORMS } from "@/lib/norms/registry";
import { validateNormsFile } from "@/lib/norms/schema";
import { BATTERY_TESTS } from "@/lib/battery";

export const metadata: Metadata = {
  title: "Norms status",
  robots: { index: false, follow: false },
};

/**
 * Which norms files are loaded, what state each is in, and what the validator
 * says about them. Deliberately the only admin surface in v1.
 *
 * There is nothing sensitive here - it is the same data /methodology publishes,
 * arranged for someone deciding what to fix next rather than for someone
 * deciding whether to trust the score. It is noindex rather than authenticated
 * for that reason; when this grows anything that writes, it needs a real gate.
 */
export default function AdminNormsPage() {
  const rows = NORMS.map((file) => {
    const issues = validateNormsFile(file, file.test_variant);
    return {
      file,
      inBattery: BATTERY_TESTS.some((t) => t.slug === file.test_variant),
      errors: issues.filter((i) => i.level === "error"),
      warnings: issues.filter((i) => i.level === "warning"),
    };
  });

  const errorCount = rows.reduce((n, r) => n + r.errors.length, 0);
  const provisional = rows.filter((r) => r.file.source.provisional).length;
  const unverified = rows.filter(
    (r) => r.file.source.transcription_verified !== true,
  ).length;

  return (
    <div className="space-y-6 pb-6">
      <header>
        <h1 className="name text-[26px]">Norms status</h1>
        <p className="mt-1 meta">
          {rows.length} files loaded from /data/norms/v2.
        </p>
      </header>

      <dl className="grid grid-cols-3 gap-3">
        <Stat label="Errors" value={errorCount} tone={errorCount > 0 ? "bad" : "good"} />
        <Stat label="Provisional" value={provisional} tone="warn" />
        <Stat label="Unverified" value={unverified} tone="warn" />
      </dl>

      <div className="space-y-3">
        {rows.map(({ file, inBattery, errors, warnings }) => (
          <div
            key={file.test_variant}
            className="border-b border-rule py-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="num truncate text-name">
                  {file.test_variant}.json
                </p>
                <p className="mt-0.5 meta">
                  {file.capacity} - {file.unit} - {file.direction} -{" "}
                  {file.cohorts.length} cohorts -{" "}
                  {file.cohorts[0]?.mean !== undefined ? "mean/sd" : "cut-points"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 label">
                <span
                  className={
                    file.source.provisional
                      ? "border border-rule-2 px-2 py-0.5"
                      : "border border-rule-2 px-2 py-0.5"
                  }
                >
                  {file.source.provisional ? "provisional" : "sourced"}
                </span>
                {file.source.transcription_verified !== true && (
                  <span className="border border-rule-2 px-2 py-0.5">
                    unverified
                  </span>
                )}
                {!inBattery && (
                  <span className="border border-chalk px-2 py-0.5">
                    orphan
                  </span>
                )}
              </div>
            </div>

            {(errors.length > 0 || warnings.length > 0) && (
              <ul className="mt-3 space-y-1 border-t border-ink-line-soft pt-3">
                {errors.map((issue, i) => (
                  <li key={`e${i}`} className="meta">
                    error: {issue.message}
                  </li>
                ))}
                {warnings.map((issue, i) => (
                  <li key={`w${i}`} className="meta">
                    warning: {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <p className="text-[12px] leading-relaxed text-chalk-dim">
        Fixing an unverified file means opening the cited source and checking
        each cohort row by hand, then setting transcription_verified to true.
        See VERIFY_NORMS.md. Do not clear these in bulk.
      </p>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "good" | "warn" | "bad";
}) {
  // One accent per screen, and this screen is a checklist. Words, not colour.
  const colour = tone === "bad" ? "text-chalk" : "text-chalk-dim";
  return (
    <div className="border-b border-rule py-4">
      <dd className={`num text-[28px] ${colour}`}>{value}</dd>
      <dt className="label mt-0.5">
        {label}
      </dt>
    </div>
  );
}
