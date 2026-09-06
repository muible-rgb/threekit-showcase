"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/data/store-context";
import { SyncIndicator } from "@/components/sync-indicator";

const TABS = [
  { href: "/", label: "Score" },
  { href: "/board", label: "Board" },
  { href: "/you", label: "You" },
];

/** Public pages are a link, not the app. */
const FULL_BLEED = [/^\/s\//];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const { me, ready } = useStore();

  // Before there is an account there is no app to frame.
  const noAccount = ready && me === null;
  const fullBleed = FULL_BLEED.some((re) => re.test(pathname));

  if (fullBleed) return <div className="min-h-dvh">{children}</div>;
  if (noAccount) {
    return (
      <div className="pt-safe mx-auto min-h-dvh w-full max-w-lg px-pad py-10">
        {children}
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col">
      <header className="pt-safe sticky top-0 z-20 border-b border-rule-2 bg-board">
        <div className="flex items-center justify-between px-pad py-3">
          <Link href="/" className="name text-logo font-500">
            The Long Game
          </Link>
          <SyncIndicator />
        </div>
      </header>

      <main className="flex-1 px-pad pb-24 pt-2">{children}</main>

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-20 mx-auto w-full max-w-lg border-t border-rule-2 bg-board">
        <ul className="grid grid-cols-3">
          {TABS.map((tab) => {
            const active =
              tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href);
            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "label flex h-14 items-center justify-center border-t-2",
                    active
                      ? "border-t-chalk text-chalk"
                      : "border-t-transparent text-chalk-off",
                  )}
                >
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
