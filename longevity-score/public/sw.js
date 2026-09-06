/*
 * Service worker for Longevity Score.
 *
 * The offline story here is a fallback, not the mechanism. Results survive a
 * dead network because they are written to localStorage before anything else
 * happens - see src/lib/data/local-store.ts. This worker only makes sure the
 * app SHELL loads when someone opens the app in a park with no signal, so
 * they can get to the local data at all.
 *
 * Strategy:
 *   - navigations: network first, fall back to the cached shell
 *   - static assets: cache first, refresh in the background
 *   - everything else (Supabase, anything cross-origin): straight to network,
 *     never cached, because a stale score is worse than no score
 */

const VERSION = "v1";
const SHELL = `shell-${VERSION}`;
const ASSETS = `assets-${VERSION}`;

const ROUTES = ["/", "/board", "/you", "/methodology"];
const PRECACHE = [...ROUTES, "/manifest.webmanifest"];

/**
 * Warm the RSC payload for each route as well as the document. Without this,
 * the first offline navigation to a route nobody has visited yet has to fall
 * all the way back to a full page load.
 */
function precacheRscPayloads(cache) {
  return Promise.all(
    ROUTES.map((route) =>
      fetch(`${route}?_rsc=warm`, { headers: { RSC: "1" } })
        .then((response) =>
          response.ok ? cache.put(`${route}?_rsc=warm`, response) : undefined,
        )
        .catch(() => undefined),
    ),
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) =>
        cache
          .addAll(PRECACHE)
          .then(() => precacheRscPayloads(cache))
          .catch(() => undefined),
      )
      .catch(() => undefined)
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => !key.endsWith(VERSION))
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? (await caches.match("/")) ?? Response.error();
        }),
    );
    return;
  }

  /*
   * Next's client-side router fetches RSC payloads, not documents. Those are
   * not navigations and not static assets, so without this branch every
   * in-app navigation dies offline and the browser shows its own error page -
   * which is exactly what happens right after someone finishes a battery in a
   * park and taps through to their score.
   *
   * Network first so a live app never serves a stale route, cache fallback so
   * an offline one still moves.
   */
  const isRsc =
    url.searchParams.has("_rsc") || request.headers.get("RSC") === "1";

  if (isRsc) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          if (cached) return cached;
          // No cached payload. Failing here makes Next fall back to a full
          // navigation, which the handler above serves from the shell cache.
          return new Response("", { status: 503 });
        }),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static") || url.pathname.startsWith("/icon")) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            const copy = response.clone();
            caches.open(ASSETS).then((cache) => cache.put(request, copy));
            return response;
          })
          .catch(() => cached ?? Response.error());
        return cached ?? network;
      }),
    );
  }
});
