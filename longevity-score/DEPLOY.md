# Getting this on the web

The app needs **no environment variables**. With Supabase unset it runs on
local storage with the demo crew seeded, so a deploy works immediately and
anyone who opens the link gets a working app on their own phone.

That also means, in this mode, **data lives on each person's device**. Two
people cannot see one shared crew session yet. That needs Supabase - see the
bottom of this file.

---

## Netlify

1. Push the branch (already done) and go to
   [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an
   existing project** → **GitHub** → pick `muible-rgb/threekit-showcase`.

2. On the settings screen, change **one field**:

   | Field | Value |
   |---|---|
   | **Base directory** | `longevity-score` |
   | Build command | leave it - read from `netlify.toml` |
   | Publish directory | leave it - read from `netlify.toml` |

   Base directory is the whole trick. Without it Netlify tries to build the
   repo root, which is the Threekit showcase site, and you get a static page
   instead of the app.

3. Pick the branch to deploy from. Right now the app only exists on
   `claude/big-daddy-7ro02s`, so either choose that branch or merge to `main`
   first.

4. **Deploy**. First build takes about two minutes.

You get a URL like `celebrated-marzipan-1a2b3c.netlify.app`. Rename it under
**Site configuration → Change site name**.

### Check this one thing after the first deploy

Open the app → **Score** → **Share** → open the copied link. If the page loads
but the social preview image is broken, the share-card route is the thing that
did not survive. Test it directly - take the link and swap `/s/` for `/share/`
and add `/wide`:

```
https://your-site.netlify.app/share/<the-long-token>/wide
```

Should return a PNG. It renders through `next/og`, which is the one piece of
this app that behaves differently across hosts. Everything else is static or
runs in the browser.

---

## Vercel, if Netlify fights you

Your original spec said Vercel, and for a Next.js app it is genuinely one
field less work - `next/og` is native there, so the share card cannot break.

1. [vercel.com/new](https://vercel.com/new) → import the same repo.
2. Set **Root Directory** to `longevity-score`. Nothing else.
3. Deploy.

Make it a **separate Vercel project** from the showcase site. The `vercel.json`
at the repo root belongs to the showcase and should not be touched.

---

## Custom domain

Both hosts: add the domain in the dashboard, then point DNS at them. Netlify
gives you a `CNAME` target; Vercel gives you an `A` record or a `CNAME`. HTTPS
is automatic on both.

---

## Turning on real crew sessions

Today two phones cannot see the same session - each device holds its own data.
To fix that:

1. Create a project at [supabase.com](https://supabase.com).
2. Run the files in `supabase/migrations/` in order (0001 through 0005), in the SQL editor.
3. Add these to the host's environment variables and redeploy:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   ```

The app switches adapters on its own when it sees those two. Everything
already recorded on a device syncs up through the outbox rather than being
stranded.

**Worth knowing before you rely on it:** the Supabase adapter is written
against that schema but has never been run - there was no project to test it
against. The local path is what all the testing covered. Budget an hour of
debugging on the first real crew session.
