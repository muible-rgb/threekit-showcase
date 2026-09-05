"use client";

import * as React from "react";
import { useParams } from "./shims/navigation";
import { parseShareToken } from "@/lib/share-token";
import { PublicScoreView } from "@/components/public-score-view";

/**
 * The public score page, client-side. Shares its body with the real
 * server-rendered route via PublicScoreView, so what you see here is what
 * gets served.
 *
 * The one thing missing is the OG image at /share/[token].png - that renders
 * through next/og on the server and has no client equivalent.
 */
export default function PublicScorePreview() {
  const { token } = useParams<{ token: string }>();
  const share = React.useMemo(() => parseShareToken(token ?? ""), [token]);

  if (!share) {
    return (
      <div className="mx-auto max-w-lg px-5 py-16 text-center">
        <p className="text-sm text-paper-dim">
          That share link could not be read.
        </p>
      </div>
    );
  }

  return <PublicScoreView share={share} />;
}
