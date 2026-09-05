# Preview build

Bundles the app into one self-contained HTML file so it can be looked at
without a server - dropped into a page, opened from disk, attached to a
message.

```bash
node demo/build.mjs   # -> demo/dist/longevity-preview.html  (~900 kB)
```

It is the real app, not a mock: the same scoring engine, the same norms JSON,
the same components. `next/link` and `next/navigation` are aliased at bundle
time to the shims in `demo/shims`, so nothing in `src/` is modified or
duplicated for the preview's benefit.

Two things are necessarily different, and the preview says so on screen:

- **Routing is on the URL hash** (`#/score`, `#/crew/s_q2`), because the output
  is one file at one URL with no server to route.
- **No share-card PNG.** `/share/[token]` renders through `next/og` on the
  server and has no client equivalent. The public score page it links to does
  work - it shares `PublicScoreView` with the real route.

Everything else behaves as deployed, including the local store, so a battery
run in the preview persists in that browser exactly as it would on the phone.
