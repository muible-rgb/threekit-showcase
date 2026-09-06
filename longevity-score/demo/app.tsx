"use client";

import * as React from "react";
import { createRoot } from "react-dom/client";

import { StoreProvider } from "@/lib/data/store-context";
import { AppFrame } from "@/components/app-frame";
import { setActiveParams, usePathname, navigate } from "./shims/navigation";

import HomePage from "@/app/page";
import BoardPage from "@/app/board/page";
import DeepDivePage from "@/app/you/page";
import MethodologyPage from "@/app/methodology/page";
import AdminNormsPage from "@/app/admin/norms/page";
import PublicScorePreview from "./public-score";

import "@/app/globals.css";

/**
 * Single-file preview build.
 *
 * This is the real app - the same scoring engine, the same norms files, the
 * same components - bundled to run without a server so it can be looked at in
 * one page. Two things are necessarily different and both are called out on
 * screen:
 *
 *   1. Routing is on the hash, because an Artifact is one URL.
 *   2. The share card image (/share/[token].png) is server-rendered through
 *      next/og and has no client equivalent, so the preview shows the public
 *      score page but not the generated PNG.
 *
 * Everything else - the engine, the percentiles, the offline local store, the
 * crew boards - is the deployed code, unmodified.
 */

type Route = {
  pattern: RegExp;
  keys: string[];
  Component: React.ComponentType;
  bare?: boolean;
};

function route(
  path: string,
  Component: React.ComponentType,
  bare = false,
): Route {
  const keys: string[] = [];
  const pattern = new RegExp(
    "^" +
      path.replace(/:([A-Za-z]+)/g, (_, key) => {
        keys.push(key);
        return "([^/]+)";
      }) +
      "/?$",
  );
  return { pattern, keys, Component, bare };
}

const ROUTES: Route[] = [
  route("/", HomePage),
  route("/board", BoardPage),
  route("/you", DeepDivePage),
  route("/methodology", MethodologyPage),
  route("/admin/norms", AdminNormsPage),
  route("/s/:token", PublicScorePreview, true),
];

function Router() {
  const pathname = usePathname();

  for (const r of ROUTES) {
    const match = r.pattern.exec(pathname);
    if (!match) continue;

    const params: Record<string, string> = {};
    r.keys.forEach((key, i) => {
      params[key] = decodeURIComponent(match[i + 1]);
    });
    setActiveParams(params);

    const { Component } = r;
    return (
      <AppFrame>
        <Component />
      </AppFrame>
    );
  }

  return (
    <AppFrame>
      <div className="space-y-4 pt-6">
        <h1 className="name text-[22px]">Not here</h1>
        <p className="meta">
          No screen at <code className="num text-chalk">{pathname}</code>.
        </p>
        <button
          onClick={() => navigate("/")}
          className="btn h-12 px-5 text-[12px]"
        >
          Back to the app
        </button>
      </div>
    </AppFrame>
  );
}

/**
 * A thrown error inside a screen would otherwise blank the whole preview with
 * no clue why, which is a bad way to look at someone's app.
 */
class Boundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="mx-auto max-w-lg px-pad py-10">
        <h1 className="name text-[20px]">This screen threw</h1>
        <pre className="num mt-3 overflow-x-auto border border-rule-2 p-3 text-[11px] text-chalk-dim">
          {this.state.error.message}
        </pre>
        <button
          onClick={() => {
            this.setState({ error: null });
            navigate("/");
          }}
          className="btn mt-4 h-12 px-5 text-[12px]"
        >
          Back to the app
        </button>
      </div>
    );
  }
}

function PreviewBanner() {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="pointer-events-none fixed bottom-[4.25rem] right-3 z-40 flex w-[min(100%-1.5rem,22rem)] flex-col items-end">
      {open && (
        <div className="pointer-events-auto mb-2 border border-rule-2 bg-board p-3 text-left text-[11px] leading-relaxed text-chalk-dim">
          <p className="label text-chalk">Preview build</p>
          <p className="mt-1.5">
            The real app, bundled to run without a server. Same scoring engine,
            same norms files, same screens.
          </p>
          <p className="mt-2">
            Two differences: routing sits on the URL hash, and the share card
            PNG is server-rendered so it has no preview. Data lives in this
            browser, seeded with the demo crew.
          </p>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="label pointer-events-auto border border-rule-2 bg-board px-2 py-1"
      >
        {open ? "Hide" : "Preview"}
      </button>
    </div>
  );
}

function App() {
  // Land on the home screen rather than a blank fragment.
  React.useEffect(() => {
    if (!window.location.hash) window.location.hash = "#/";
  }, []);

  return (
    <Boundary>
      <StoreProvider>
        <Router />
        <PreviewBanner />
      </StoreProvider>
    </Boundary>
  );
}

const container = document.getElementById("root");
if (container) createRoot(container).render(<App />);
