"use client";

import * as React from "react";

/**
 * Registers the offline shell worker.
 *
 * Note the readyState check. Registering only on the "load" event looks
 * correct and silently never fires when the effect runs after load has already
 * happened - which is most of the time on a warm navigation. That failure is
 * invisible until someone is standing in a park with no signal, so it is worth
 * the extra three lines.
 *
 * Skipped in development, where a cached shell during a rebuild is a
 * confusing hour.
 */
export function RegisterServiceWorker() {
  React.useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration costs offline shell loading and nothing else.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }
    window.addEventListener("load", register);
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
