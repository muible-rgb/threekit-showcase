# Threekit · B3 Design System

Hand this folder to any agent to build new Threekit pages in the **B3 "duo-tone editorial"** style.

> B3's voice: a white editorial canvas, a single warm diagonal peach wash in the hero, clay-gradient CTAs, dark-green editorial headlines with one italic gradient-clay accent phrase per section. Lowercase everything. DM Sans for headings, DM Mono for eyebrows. Calm, intentional, manufacturer-serious but warm.

---

## Files

| File | Purpose |
|---|---|
| `tokens.css` | All CSS variables (color, type, spacing, radii, gradients, shadows). Import this **first**. |
| `b3.css` | Typography, buttons, render slot, surfaces, reveal animation. Requires tokens. |
| `b3-components.jsx` | `Nav`, `Footer`, `TKLogo`, `Arrow`, `LogoCloud`, `RenderSlot`, `AbstractProduct`, `useReveal` |
| `patterns.jsx` | Page-section building blocks: `HeroDuoTone`, `LogoStrip`, `EditorialBlock`, `PillarsSlab`, `TestimonialRow`, `GradientCTA` |

Also needed from the project root:
- `assets/threekit_logo_alpha.png` — used by `TKLogo` (transparent PNG so `filter: invert` works for dark themes)

---

## Quick start — boilerplate for a new page

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Threekit · New page</title>
  <link rel="stylesheet" href="design-system/tokens.css" />
  <link rel="stylesheet" href="design-system/b3.css" />
</head>
<body>
<div id="root"></div>

<script src="https://unpkg.com/react@18.3.1/umd/react.development.js" integrity="sha384-hD6/rw4ppMLGNu3tX5cjIb+uRZ7UkRJ6BPkLpg4hAu/6onKUg4lLsHAs9EBPT82L" crossorigin="anonymous"></script>
<script src="https://unpkg.com/react-dom@18.3.1/umd/react-dom.development.js" integrity="sha384-u6aeetuaXnQ38mYT8rp6sbXaQe3NL9t+IBXmnYxwkUI2Hw4bsp2Wvmx4yRQF1uAm" crossorigin="anonymous"></script>
<script src="https://unpkg.com/@babel/standalone@7.29.0/babel.min.js" integrity="sha384-m08KidiNqLdpJqLq95G/LEi8Qvjl/xUYll3QILypMoQ65QorJ9Lvtp2RXYGBFj1y" crossorigin="anonymous"></script>

<script type="text/babel" src="design-system/b3-components.jsx"></script>
<script type="text/babel" src="design-system/patterns.jsx"></script>

<script type="text/babel">
  function Page() {
    useReveal();
    return (
      <div className="tk-page">
        <Nav />
        <HeroDuoTone
          eyebrow="· threekit 2026"
          title={<>the 3d product<br/>experience platform<br/>for <span className="tk-accent-clay">manufacturers.</span></>}
          lead="built for teams who sell what they make. one configurable asset — rendered, shoppable, shipped."
        />
        <LogoStrip />
        <EditorialBlock
          eyebrow="· why threekit"
          title={<>catalogs grew 10×.<br/><span className="tk-accent-clay">photography teams didn't.</span></>}
          body="threekit closes the gap. photoreal 3d that scales with your product line, not your crew size."
        />
        <PillarsSlab />
        <TestimonialRow
          quote={<>"we used to photograph 400 skus a quarter.<br/><span className="tk-accent-clay">now we render 40,000</span> and they all look right."</>}
        />
        <GradientCTA
          title={<>we'll render it<br/>live, together.</>}
          body="thirty minutes. your product, our platform. no slides, no sales theater."
        />
        <Footer />
      </div>
    );
  }
  ReactDOM.createRoot(document.getElementById('root')).render(<Page />);
</script>
</body>
</html>
```

---

## Design rules (do not break)

### Voice & copy
- **Everything is lowercase.** Headlines, CTAs, nav, eyebrows, even brand-names-in-headlines. Proper brand names in body copy keep their capitalization.
- **Eyebrows start with "· "** — rendered automatically by `.tk-eyebrow::before`. Don't also put a `·` in the string.
- **One gradient-clay accent phrase per section, max.** Use `<span className="tk-accent-clay">…</span>` for a single italic-ish phrase in the headline. Two gradient phrases in one block is AI-slop territory.
- Headline style: "statement + em-dash + twist". Short. Balanced.
- CTA style: **action + object** (`book a demo`, `watch a tour`, `explore`). Never "Learn More."

### Color
- **Page background is white (`#ffffff`)**, not paper. B3 is white-first, unlike A (dark) and the older B (paper).
- **Ink color is `--tk-dark-green` (`#044849`)** for headings — not black. Body copy is `--tk-ink-70`.
- **Clay (`#C96442`) is the hero accent**, used in: eyebrows, CTAs (as gradient), gradient text accents, clay-gradient focal CTA panel.
- **Green (`--tk-green` / `--tk-mint`)** is the live-dot indicator and the secondary pillar color. Do not use green as a primary CTA on B3 pages.
- Warm surfaces only come out for specific roles:
  - `--tk-cream` (`#FBF4EF`) → pillars slab, metric cards
  - `--tk-peach-wash` → small image containers
  - `--tk-grad-duo-hero` → the hero panel only
  - `--tk-grad-clay` → the ONE focal CTA per page
- No saturated greens-on-green. No green+clay gradients mashed together.

### Type
- **DM Sans** 500 for every heading. 400 for body.
- **DM Mono** for eyebrows and labels on render slots / chips.
- Heading letter-spacing is **negative** (`-0.03em` to `-0.035em`). Body letter-spacing is `-0.005em`.
- Line-height 0.94–1.02 for display/h1, 1.5 for body.
- `text-wrap: balance` on headlines (built into `.tk-display`, `.tk-h1`, `.tk-h2`).
- Use `clamp()` so type scales with viewport — already baked into the utility classes.

### Layout
- **1344px** wide container for big panels (hero, pillars slab).
- **1200px** for editorial blocks, testimonials, CTA.
- **48px** horizontal page padding. Always.
- **Section rhythm:** 112px default, 80px short, 128px marquee. Don't invent new values.
- Borders on every floating panel: `1px solid var(--tk-ink-08)`. Never heavy.
- Radii: **28px** for hero + CTA panel, **20px** for mid panels, **12px** for chips/cards, **6px** for small UI.

### Imagery / product
- Real product shots go in `<RenderSlot kind=… />`. The built-in `AbstractProduct` SVGs (chair / sofa / sneaker / bottle / faucet) are placeholders until real renders arrive.
- Do **not** invent new hand-drawn SVG illustrations. If you need a placeholder with no matching kind, use a `RenderSlot` with a custom label and let the slot's striped gradient show through.
- Swatch row on product chips: first swatch = clay, has a 2px white + 2px dark-green ring to indicate "selected". The rest have a 1px inset stroke.

### Interaction
- Every section that should fade in: wrap in `<div className="tk-reveal">` and call `useReveal()` at the top of your page component. (`.in` class is added on viewport entry.)
- Buttons lift 1px on hover (`translateY(-1px)`) — already in `.tk-btn`.
- Arrow icon inside a CTA slides 3px right on hover — already wired via `.tk-btn:hover .tk-arrow`.
- Never use `scrollIntoView`.

---

## Token reference (the ones you'll actually use)

```
Colors
  --tk-dark-green   #044849   ← heading ink, primary button, nav text
  --tk-green        #2A826B   ← "live" dot, secondary pillar color
  --tk-mint         #78C4A2   ← on dark backgrounds only
  --tk-clay         #C96442   ← eyebrow + accent color
  --tk-orange       #FA8D71   ← tertiary pillar dot
  --tk-peach        #FFBA9B
  --tk-black        #021B15
  --tk-ink-70/55/35/15/08     ← body / caption / hairline
  --tk-cream        #FBF4EF   ← pillars slab
  --tk-paper        #FBFAF6

Gradients
  --tk-grad-btn-clay          ← primary CTA background
  --tk-grad-clay              ← focal CTA panel background
  --tk-grad-duo-hero          ← hero diagonal wash
  --tk-grad-btn-forest        ← dark theme CTA

Type
  --tk-font         DM Sans
  --tk-mono         DM Mono

Radii
  --tk-radius-sm 6  --tk-radius 12  --tk-radius-lg 20  --tk-radius-xl 28

Spacing
  --tk-pad-x 48  --tk-gutter 32
  --tk-section-sm 80  --tk-section 112  --tk-section-lg 128
  --tk-container 1200  --tk-container-wide 1344
```

---

## Component API cheat sheet

### `<Nav theme="light|dark" cta="book a demo" accent="clay|forest|primary" />`
Sticky, translucent blur on light. Dark theme has no backdrop. Nav items are hardcoded to `platform / solutions / customers / resources / pricing` — edit inside `b3-components.jsx` if you need different IA.

### `<Footer theme="light|dark" />`
Four-column sitemap + brand blurb + legal row. 2026 copyright string hardcoded.

### `<LogoCloud logos={['…','…']} color="…" />`
4-column uppercase text wordmarks. Default list is the Threekit customer lineup. Override with your own array.

### `<RenderSlot kind="chair|sofa|sneaker|bottle|faucet" ratio="4/3|auto" label="…" accent="…" dark={false} tag="3d · live" style={…} />`
The one placeholder for 3D product imagery. Replaces cleanly with a real `<img>` or `<canvas>` later — keep the outer `.tk-slot` wrapper so the live-dot + label chrome stays consistent.

### `<HeroDuoTone title={…} lead="…" primary={{label,href}} secondary={{label,href}} slotKind="…" swatches={[…]} chip={{eyebrow,value}} />`
640px tall diagonal-wash hero. `title` is JSX — put the italic gradient phrase in `<span className="tk-accent-clay">`.

### `<EditorialBlock title={…} body="…" slotKind="…" reverse={false} />`
60/40 editorial split. Flip with `reverse`.

### `<PillarsSlab title="…" pillars={[{n,h,d,dot},…]} />`
Cream slab with 3 (or N) cards divided by 1px hairlines. Each pillar takes a color dot token (`var(--tk-green)` / clay / orange).

### `<TestimonialRow quote={…} author={{initials,name,title}} stats={[{value,label,color},…]} />`
Big pull-quote on left, author + 2 metric cards on right.

### `<GradientCTA title={…} body="…" primary={{…}} secondary={{…}} />`
The **one** clay-gradient focal panel per page. Place it last, before the footer. Uses `tk-btn-on-clay` (white-on-dark-green) as the primary and `tk-btn-ghost-light` as secondary.

---

## Composition recipe

A standard Threekit page in this system is:

```
Nav
HeroDuoTone          ← sets the tone; one accent phrase
LogoStrip            ← social proof
EditorialBlock × 1-2 ← "catalogs grew 10×" style framing
PillarsSlab          ← the "what we do" stack
TestimonialRow       ← customer voice + 2 metrics
GradientCTA          ← the single focal ask
Footer
```

Deviate for product/feature pages by swapping `PillarsSlab` for multiple `EditorialBlock`s with `reverse` alternating.

---

## What NOT to do

- ❌ Don't add a second clay-gradient panel above or below `GradientCTA` — that's the only one.
- ❌ Don't mix `--tk-grad-forest` and `--tk-grad-clay` on the same page. Pick a tone.
- ❌ Don't apply `.tk-accent-clay` to full paragraphs. One **phrase** per section, max.
- ❌ Don't capitalize headlines or CTAs.
- ❌ Don't use emoji.
- ❌ Don't hand-draw new illustrative SVGs. Use `RenderSlot` placeholders and wait for real product renders.
- ❌ Don't use Inter, Roboto, or system fonts — DM Sans + DM Mono only.
- ❌ Don't replace `#044849` headlines with pure black — the dark green is the point.
