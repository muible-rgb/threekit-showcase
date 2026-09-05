"use client";

import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
} from "recharts";
import { testBySlug } from "@/lib/battery";
import type { TestPercentile } from "@/lib/scoring/types";
import { BAND_STYLES } from "@/lib/utils";
import { bandFor } from "@/lib/scoring/composite";

/**
 * Ten axes, one per capacity, each on the same 1-99 percentile scale. That
 * shared scale is the point: the shape of the chart is a shape of relative
 * strengths, not a mix of kilos and seconds pretending to be comparable.
 *
 * The 50th percentile ring is drawn heavier than the rest, because "am I above
 * or below average on this" is the question people actually ask of the chart.
 */
export function CapacityRadar({
  tests,
  previous,
  height = 300,
}: {
  tests: TestPercentile[];
  previous?: TestPercentile[];
  height?: number;
}) {
  const prevBySlug = new Map((previous ?? []).map((t) => [t.testVariant, t.percentile]));

  const data = tests.map((t) => ({
    axis: testBySlug(t.testVariant)?.shortName ?? t.capacity,
    percentile: t.percentile,
    previous: prevBySlug.get(t.testVariant) ?? null,
  }));

  const mean = tests.reduce((sum, t) => sum + t.percentile, 0) / (tests.length || 1);
  const colour = BAND_STYLES[bandFor(mean)].hex;

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart data={data} outerRadius="72%">
          <PolarGrid stroke="#232932" strokeWidth={1} />
          <PolarAngleAxis
            dataKey="axis"
            tick={{ fill: "#98a2b3", fontSize: 10, fontWeight: 600 }}
          />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />

          {previous && previous.length > 0 && (
            <Radar
              name="Last time"
              dataKey="previous"
              stroke="#667085"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="none"
              isAnimationActive={false}
            />
          )}

          <Radar
            name="Percentile"
            dataKey="percentile"
            stroke={colour}
            strokeWidth={2}
            fill={colour}
            fillOpacity={0.18}
            isAnimationActive={false}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
