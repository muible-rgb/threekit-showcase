import { ImageResponse } from "next/og";
import { parseShareToken } from "@/lib/share-token";
import { BAND_STYLES } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * Server-rendered score card. Two shapes: 1080x1080 for a story or a post,
 * 1200x630 for the link preview on the public score page.
 *
 * Drawn by hand rather than by rendering the app's radar component, because
 * Satori supports a subset of CSS and no SVG-generating libraries - the polygon
 * below is plain arithmetic on ten percentiles, which is all the chart is.
 */

const SIZES = {
  square: { width: 1080, height: 1080 },
  wide: { width: 1200, height: 630 },
} as const;

type Shape = keyof typeof SIZES;

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string; shape: string }> },
) {
  const { token, shape } = await params;
  const size = SIZES[(shape as Shape) in SIZES ? (shape as Shape) : "square"];
  const share = parseShareToken(token);

  if (!share) {
    return new Response("Not found", { status: 404 });
  }

  const accent = BAND_STYLES[share.band].hex;
  const isSquare = size.width === size.height;
  const radius = isSquare ? 210 : 150;
  const cx = isSquare ? size.width - 280 : size.width - 200;
  const cy = isSquare ? 620 : size.height / 2 + 10;

  const points = polygonPoints(
    share.tests.map((t) => t.percentile),
    cx,
    cy,
    radius,
  );
  const ring50 = polygonPoints(
    share.tests.map(() => 50),
    cx,
    cy,
    radius,
  );
  const ring100 = polygonPoints(
    share.tests.map(() => 100),
    cx,
    cy,
    radius,
  );

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0a0c0f",
          color: "#f2f4f7",
          padding: isSquare ? 72 : 56,
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: -0.5 }}>
            Longevity
          </span>
          <span
            style={{
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: 4,
              color: "#d6ff3f",
              textTransform: "uppercase",
            }}
          >
            Score
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 26, color: "#98a2b3" }}>{share.name}</span>
          <span
            style={{
              fontSize: isSquare ? 260 : 190,
              fontWeight: 800,
              letterSpacing: -12,
              lineHeight: 0.86,
              color: accent,
              marginTop: 8,
            }}
          >
            {share.composite.toFixed(1)}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 22 }}>
            <span
              style={{
                fontSize: 22,
                fontWeight: 700,
                letterSpacing: 2,
                textTransform: "uppercase",
                color: accent,
                border: `2px solid ${accent}55`,
                borderRadius: 999,
                padding: "8px 22px",
              }}
            >
              {share.band}
            </span>
            <span style={{ fontSize: 22, color: "#98a2b3" }}>{share.ageBand}</span>
            {share.fitnessAge !== null && (
              <span style={{ fontSize: 22, color: "#98a2b3" }}>
                Fitness age {share.fitnessAge}
                {share.fitnessAgeApprox ? "*" : ""}
              </span>
            )}
          </div>
        </div>

        <span style={{ fontSize: 19, color: "#667085" }}>
          Ten tests, graded against published norms for the same age and sex.
        </span>

        {/* Radar, drawn as three polygons. */}
        <svg
          width={radius * 2 + 60}
          height={radius * 2 + 60}
          viewBox={`0 0 ${size.width} ${size.height}`}
          style={{ position: "absolute", inset: 0, width: size.width, height: size.height }}
        >
          <polygon points={ring100} fill="none" stroke="#232932" strokeWidth={2} />
          <polygon points={ring50} fill="none" stroke="#2f3742" strokeWidth={2} />
          <polygon points={points} fill={`${accent}33`} stroke={accent} strokeWidth={4} />
        </svg>
      </div>
    ),
    { ...size },
  );
}

/** Ten percentiles into an SVG polygon, first axis pointing straight up. */
function polygonPoints(
  values: number[],
  cx: number,
  cy: number,
  radius: number,
): string {
  const n = values.length;
  return values
    .map((value, i) => {
      const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
      const r = (Math.max(0, Math.min(100, value)) / 100) * radius;
      return `${(cx + r * Math.cos(angle)).toFixed(1)},${(cy + r * Math.sin(angle)).toFixed(1)}`;
    })
    .join(" ");
}
