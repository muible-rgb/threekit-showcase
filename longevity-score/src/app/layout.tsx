import type { Metadata, Viewport } from "next";
import "./globals.css";
import { StoreProvider } from "@/lib/data/store-context";
import { AppFrame } from "@/components/app-frame";
import { RegisterServiceWorker } from "@/components/register-sw";

export const metadata: Metadata = {
  title: {
    default: "Longevity Score",
    template: "%s - Longevity Score",
  },
  description:
    "Ten tests, one score, graded against people your own age and sex. Test with your crew, compare on a shared board.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Longevity",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0c0f",
  width: "device-width",
  initialScale: 1,
  // Test mode has a lot of numbers on it; people need to be able to zoom.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-ink text-paper antialiased">
        <StoreProvider>
          <AppFrame>{children}</AppFrame>
        </StoreProvider>
        <RegisterServiceWorker />
      </body>
    </html>
  );
}
