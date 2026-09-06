import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseShareToken } from "@/lib/share-token";
import { PublicScoreView } from "@/components/public-score-view";
import { oneDecimal } from "@/lib/utils";

/**
 * The public face of a score. Server-rendered from the token in the URL, so it
 * works for someone who has never opened the app and has no account - and it
 * gives the OG scraper something real to read.
 */

type Props = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params;
  const share = parseShareToken(token);
  if (!share) return { title: "Score not found" };

  const title = `${share.name} - ${oneDecimal(share.composite)} on The Long Game`;
  const description = `${share.band}. Mean of eight percentiles, each against ${
    share.sex === "M" ? "men" : "women"
  } aged ${share.ageBand.slice(2)}.`;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: [
        { url: `/share/${token}/wide`, width: 1200, height: 630, alt: title },
        { url: `/share/${token}/square`, width: 1080, height: 1080, alt: title },
      ],
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function PublicScorePage({ params }: Props) {
  const { token } = await params;
  const share = parseShareToken(token);
  if (!share) notFound();

  return <PublicScoreView share={share} />;
}
