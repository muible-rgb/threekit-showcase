# The Long Game - design system

Direction: **gym whiteboard**. Near-black board, chalk white type, one acid accent.
The data is the design. No decoration. If an element isn't a number, a label, or a rule, cut it.

## Tokens

```css
:root {
  /* surfaces */
  --board:      #141414; /* page background, everywhere */
  --board-2:    #1d1d1d; /* your own row, active state */
  --rule:       #262626; /* hairline between rows */
  --rule-2:     #333333; /* header rule, section breaks */

  /* ink */
  --chalk:      #f2f0eb; /* primary text, names, numbers */
  --chalk-dim:  #8a8a8a; /* labels, rank digits, metadata */
  --chalk-off:  #5a5a5a; /* untested, disabled, empty state */

  /* accent - use once per screen, on your own result only */
  --accent:     #d8ff3e;

  /* type */
  --font-display: 'Oswald', system-ui, sans-serif;  /* names, labels, headings */
  --font-num:     'IBM Plex Mono', monospace;       /* every number on screen */

  /* scale */
  --t-logo: 15px; --t-name: 17px; --t-score: 17px;
  --t-label: 12px; --t-meta: 11px;

  /* space */
  --gap: 12px; --pad: 20px; --row-y: 13px;
}
```

Google Fonts: `Oswald:wght@300;400;500;600` and `IBM Plex Mono:wght@400;500`.

## Rules

- **Numbers are always mono**, always `font-variant-numeric: tabular-nums`. Scores, times, reps, ranks, dates. No exceptions - columns must align down the page.
- **Names and labels are Oswald, uppercase, letter-spaced.** `text-transform: uppercase; letter-spacing: .04em` for names, `.06em` for small labels.
- **Rows, not cards.** Separate list items with a 1px `--rule` bottom border. No border-radius, no shadows, no background fills on rows.
- **One accent per screen.** The accent marks the user's own row or result, nothing else. Never a button fill, never a heading.
- **Your row** gets `--board-2` background, a 3px left border in `--accent`, and the accent on its score only.
- **Grids are hairline grids** - 1px `--rule` background with `--board` cells and a 1px gap. Not gutters between cards.
- **Untested / empty is `--` in `--chalk-off`.** Never "N/A", never a spinner, never a placeholder card.
- **Buttons** are text in `--chalk` with a 1px `--chalk-dim` border, square corners, uppercase. No fills.
- Sentence-free labels. "Dead hang", not "Your dead hang result".

## Never

- Gradients, glassmorphism, blur, drop shadows, glow
- `border-radius` above 0 anywhere except the app icon
- Emoji, or emoji standing in for icons
- Purple, blue, or teal in any form
- Centered body text or centered hero blocks
- More than two font families
- Animated entrances on lists or cards

## Reference row

```html
<div class="row is-me">
  <span class="rank">3</span>
  <span class="name">You</span>
  <span class="score">804</span>
</div>
```

```css
.row {
  display: grid;
  grid-template-columns: 26px 1fr auto;
  align-items: center;
  gap: var(--gap);
  padding: var(--row-y) 0;
  border-bottom: 1px solid var(--rule);
}
.rank  { font-family: var(--font-num); font-size: var(--t-meta); color: var(--chalk-dim); }
.name  { font-family: var(--font-display); font-size: var(--t-name);
         text-transform: uppercase; letter-spacing: .04em; }
.score { font-family: var(--font-num); font-size: var(--t-score); font-weight: 500;
         font-variant-numeric: tabular-nums; }

.row.is-me {
  background: var(--board-2);
  margin: 0 calc(var(--pad) * -1);
  padding: var(--row-y) var(--pad);
  border-left: 3px solid var(--accent);
}
.row.is-me .score { color: var(--accent); }
```
