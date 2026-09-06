import { ImageResponse } from "next/og";
import { parseShareToken } from "@/lib/share-token";
import { BAND_LABELS } from "@/lib/utils";

export const runtime = "nodejs";

/**
 * The share card. Gym whiteboard: board ground, chalk type, one accent on the
 * score. Eight hairline bars, no radar, no colour scale.
 *
 * Satori supports a subset of CSS and cannot read the app's tokens, so the
 * values are repeated here once, named, and nowhere else.
 */
const BOARD = "#141414";
const CHALK = "#f2f0eb";
const DIM = "#8a8a8a";
const RULE = "#262626";
const ACCENT = "#d8ff3e";

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
  if (!share) return new Response("Not found", { status: 404 });

  const isSquare = size.width === size.height;
  const pad = isSquare ? 80 : 56;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: BOARD,
          color: CHALK,
          padding: pad,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontSize: 22,
              letterSpacing: 4,
              textTransform: "uppercase",
              color: CHALK,
            }}
          >
            The Long Game
          </span>
          <span style={{ fontSize: 20, color: DIM, marginTop: 24, letterSpacing: 2 }}>
            {share.name.toUpperCase()} · {share.ageBand}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 24 }}>
          <span
            style={{
              fontSize: isSquare ? 250 : 180,
              fontWeight: 500,
              letterSpacing: -6,
              lineHeight: 0.85,
              color: ACCENT,
            }}
          >
            {share.composite.toFixed(1)}
          </span>
          <span
            style={{
              fontSize: 34,
              letterSpacing: 3,
              textTransform: "uppercase",
              color: DIM,
              paddingBottom: 14,
            }}
          >
            {BAND_LABELS[share.band]}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: isSquare ? 14 : 8 }}>
          {share.tests.map((t) => (
            <div key={t.slug} style={{ display: "flex", alignItems: "center", gap: 18 }}>
              <span
                style={{
                  width: 210,
                  fontSize: 19,
                  letterSpacing: 1.5,
                  textTransform: "uppercase",
                  color: DIM,
                }}
              >
                {t.label}
              </span>
              <div style={{ display: "flex", flex: 1, height: 4, background: RULE }}>
                <div style={{ width: `${t.percentile}%`, background: CHALK }} />
              </div>
              <span style={{ width: 46, fontSize: 19, textAlign: "right", color: CHALK }}>
                {Math.round(t.percentile)}
              </span>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size },
  );
}
