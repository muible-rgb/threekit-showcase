import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Oswald } from "next/font/google";
import "./globals.css";
import { StoreProvider } from "@/lib/data/store-context";
import { AppFrame } from "@/components/app-frame";
import { RegisterServiceWorker } from "@/components/register-sw";

/** Two families. No more - DESIGN.md. */
const oswald = Oswald({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-oswald",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: { default: "The Long Game", template: "%s - The Long Game" },
  description:
    "Eight tests. One score, graded against people your own age and sex.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "The Long Game",
  },
};

export const viewport: Viewport = {
  themeColor: "#141414",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${oswald.variable} ${plexMono.variable}`}>
      <body className="min-h-dvh bg-board text-chalk">
        <StoreProvider>
          <AppFrame>{children}</AppFrame>
        </StoreProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
