import type { Metadata } from "next";
import { NORMS_V1 } from "@/lib/norms/registry";
import { validateNormsFile } from "@/lib/norms/schema";
import { OPEN_V1_TESTS } from "@/lib/battery";

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
  const rows = NORMS_V1.map((file) => {
    const issues = validateNormsFile(file, file.test_variant);
    return {
      file,
      inBattery: OPEN_V1_TESTS.some((t) => t.slug === file.test_variant),
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
        <h1 className="text-2xl font-bold tracking-tight">Norms status</h1>
        <p className="mt-1 text-sm text-paper-dim">
          {rows.length} files loaded from /data/norms/v1.
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
            className="rounded-2xl bg-ink-raised p-4 ring-1 ring-ink-line"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-mono text-sm font-semibold">
                  {file.test_variant}.json
                </p>
                <p className="mt-0.5 text-xs text-paper-faint">
                  {file.capacity} - {file.unit} - {file.direction} -{" "}
                  {file.cohorts.length} cohorts -{" "}
                  {file.cohorts[0]?.mean !== undefined ? "mean/sd" : "cut-points"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 text-[10px] font-semibold uppercase tracking-wider">
                <span
                  className={
                    file.source.provisional
                      ? "rounded px-2 py-0.5 text-below ring-1 ring-below/30"
                      : "rounded px-2 py-0.5 text-strong ring-1 ring-strong/30"
                  }
                >
                  {file.source.provisional ? "provisional" : "sourced"}
                </span>
                {file.source.transcription_verified !== true && (
                  <span className="rounded px-2 py-0.5 text-paper-faint ring-1 ring-ink-line">
                    unverified
                  </span>
                )}
                {!inBattery && (
                  <span className="rounded px-2 py-0.5 text-risk ring-1 ring-risk/30">
                    orphan
                  </span>
                )}
              </div>
            </div>

            {(errors.length > 0 || warnings.length > 0) && (
              <ul className="mt-3 space-y-1 border-t border-ink-line-soft pt-3">
                {errors.map((issue, i) => (
                  <li key={`e${i}`} className="text-xs text-risk">
                    error: {issue.message}
                  </li>
                ))}
                {warnings.map((issue, i) => (
                  <li key={`w${i}`} className="text-xs text-below">
                    warning: {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs leading-relaxed text-paper-faint">
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
  const colour =
    tone === "bad" ? "text-risk" : tone === "warn" ? "text-below" : "text-strong";
  return (
    <div className="rounded-2xl bg-ink-raised p-4 ring-1 ring-ink-line">
      <dd className={`tnum text-3xl font-bold ${colour}`}>{value}</dd>
      <dt className="mt-0.5 text-[10px] uppercase tracking-wider text-paper-faint">
        {label}
      </dt>
    </div>
  );
}
