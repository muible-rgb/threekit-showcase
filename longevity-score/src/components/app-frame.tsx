"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, ClipboardList, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { SyncIndicator } from "@/components/sync-indicator";

const TABS = [
  { href: "/", label: "Score", icon: ClipboardList },
  { href: "/crew", label: "Crew", icon: Users },
  { href: "/methodology", label: "Method", icon: BookOpen },
];

/** Public pages run full-bleed - they are not the app, they are a link. */
const FULL_BLEED = [/^\/s\//, /^\/join/];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const bare = FULL_BLEED.some((re) => re.test(pathname));

  if (bare) return <div className="min-h-dvh">{children}</div>;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="pt-safe sticky top-0 z-20 border-b border-ink-line-soft bg-ink/85 backdrop-blur">
        <div className="flex items-center justify-between px-5 py-3">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="text-base font-bold tracking-tight">Longevity</span>
            <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-signal">
              Score
            </span>
          </Link>
          <SyncIndicator />
        </div>
      </header>

      <main className="flex-1 px-5 pb-28 pt-5">{children}</main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-lg border-t border-ink-line-soft bg-ink/95 backdrop-blur">
        <ul className="grid grid-cols-3">
          {TABS.map((tab) => {
            const active =
              tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            const Icon = tab.icon;
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors",
                    active ? "text-signal" : "text-paper-faint hover:text-paper-dim",
                  )}
                >
                  <Icon size={20} strokeWidth={active ? 2.4 : 1.8} />
                  {tab.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
