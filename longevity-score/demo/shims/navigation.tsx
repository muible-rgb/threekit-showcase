"use client";

import * as React from "react";

/**
 * Hash-router stand-in for next/navigation, used only by the single-file
 * preview build. The app's own components are unchanged - they still import
 * next/navigation, and esbuild aliases it here.
 *
 * An Artifact is one HTML file served at one URL with no server routing, so
 * the whole app has to live behind the fragment: #/score, #/crew/s_q2.
 */

const listeners = new Set<() => void>();

function currentPath(): string {
  const raw = window.location.hash.replace(/^#/, "");
  const path = raw.split("?")[0];
  return path === "" ? "/" : path;
}

function currentQuery(): URLSearchParams {
  const raw = window.location.hash.replace(/^#/, "");
  const q = raw.split("?")[1] ?? "";
  return new URLSearchParams(q);
}

export function navigate(to: string) {
  const next = to.startsWith("#") ? to : `#${to}`;
  if (window.location.hash === next) return;
  window.location.hash = next;
}

if (typeof window !== "undefined") {
  window.addEventListener("hashchange", () => listeners.forEach((fn) => fn()));
}

function useHash(): string {
  return React.useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    () => window.location.hash,
    () => "",
  );
}

export function usePathname(): string {
  useHash();
  return typeof window === "undefined" ? "/" : currentPath();
}

export function useSearchParams(): URLSearchParams {
  useHash();
  return typeof window === "undefined" ? new URLSearchParams() : currentQuery();
}

export function useRouter() {
  return React.useMemo(
    () => ({
      push: (to: string) => navigate(to),
      replace: (to: string) => navigate(to),
      back: () => window.history.back(),
      forward: () => window.history.forward(),
      refresh: () => {},
      prefetch: () => {},
    }),
    [],
  );
}

/**
 * Dynamic segments. The route table registers the matched params before it
 * renders the page, which is how [sessionId] and [token] keep working.
 */
let activeParams: Record<string, string> = {};
export function setActiveParams(params: Record<string, string>) {
  activeParams = params;
}

export function useParams<T = Record<string, string>>(): T {
  useHash();
  return activeParams as T;
}

export function notFound(): never {
  throw new Error("NEXT_NOT_FOUND");
}

export function redirect(to: string): never {
  navigate(to);
  throw new Error("NEXT_REDIRECT");
}
