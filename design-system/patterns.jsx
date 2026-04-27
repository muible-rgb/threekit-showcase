// ============================================================
// Threekit · B3 Design System — Page-section Patterns
// Higher-level building blocks lifted directly from B3 so a new
// agent can assemble a fresh page by composing these.
//
// All patterns are self-contained and rely ONLY on tokens.css +
// b3.css + b3-components.jsx (Nav, Footer, LogoCloud, RenderSlot,
// Arrow, useReveal).
// ============================================================

// ── 1. Duo-tone Hero ────────────────────────────────────────
// White → peach diagonal wash. Big editorial headline (500wt),
// one italic gradient word as the "accent phrase", clay CTA +
// ghost CTA. Right column is a glass product chip with swatch
// row + config counter chip.
function HeroDuoTone({
  eyebrow = '· threekit 2026',
  title,                   // JSX — include <span className="tk-accent-clay"> for gradient word
  lead,
  primary = { label: 'book a demo', href: '#' },
  secondary = { label: 'explore', href: '#' },
  slotKind = 'chair',
  swatches = ['#C96442', '#FFBA9B', '#044849', '#2a826b'],
  chip = { eyebrow: 'configuration', value: '2,458,312 combinations' },
}) {
  return (
    <section style={{ padding: '60px 48px' }}>
      <div style={{ maxWidth: 1344, margin: '0 auto' }}>
        <div className="tk-reveal tk-panel tk-surface-duo" style={{ minHeight: 640 }}>
          <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(55% 75% at 82% 22%, rgba(255,255,255,0.55), transparent 60%)' }} />
          <div style={{ position: 'relative', zIndex: 1, padding: '64px 56px', display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: 48, height: 640, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div className="tk-eyebrow">{eyebrow.replace(/^·\s*/, '')}</div>
              <h1 className="tk-display" style={{ margin: 0, maxWidth: 620 }}>{title}</h1>
              <div>
                <p className="tk-lead" style={{ maxWidth: 460, marginBottom: 28 }}>{lead}</p>
                <div style={{ display: 'flex', gap: 14 }}>
                  <a href={primary.href} className="tk-btn tk-btn-clay">{primary.label}<Arrow /></a>
                  <a href={secondary.href} className="tk-btn tk-btn-ghost">{secondary.label}</a>
                </div>
              </div>
            </div>
            <div style={{ position: 'relative' }}>
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.45)', backdropFilter: 'blur(8px)', borderRadius: 20, border: '1px solid rgba(255,255,255,0.7)' }} />
              <RenderSlot kind={slotKind} label="interactive · drag to rotate" ratio="auto"
                style={{ position: 'absolute', inset: 8, background: 'transparent' }} />
              <div style={{ position: 'absolute', top: 24, right: 24, display: 'flex', gap: 6 }}>
                {swatches.map((c, i) => (
                  <span key={c + i} style={{ width: 26, height: 26, borderRadius: '50%', background: c,
                    boxShadow: i === 0 ? '0 0 0 2px #fff, 0 0 0 4px var(--tk-dark-green)' : 'inset 0 0 0 1px rgba(0,0,0,0.1)' }} />
                ))}
              </div>
              <div style={{ position: 'absolute', bottom: 24, left: 24, right: 24, background: 'rgba(255,255,255,0.96)', color: 'var(--tk-dark-green)', padding: '14px 18px', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--tk-ink-08)' }}>
                <div>
                  <div style={{ fontFamily: 'var(--tk-mono)', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--tk-clay)', marginBottom: 2 }}>{chip.eyebrow}</div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>{chip.value}</div>
                </div>
                <Arrow size={18} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 2. Logo cloud strip ─────────────────────────────────────
function LogoStrip({ heading = '· manufacturers who ship with threekit', logos }) {
  return (
    <section style={{ padding: '0 48px 80px' }}>
      <div style={{ maxWidth: 1344, margin: '0 auto' }}>
        <div className="tk-eyebrow" style={{ textAlign: 'center', color: 'var(--tk-ink-55)', marginBottom: 28 }}>
          {heading.replace(/^·\s*/, '')}
        </div>
        <LogoCloud logos={logos} />
      </div>
    </section>
  );
}

// ── 3. Editorial block (big type + square image) ────────────
function EditorialBlock({
  eyebrow = '· why threekit',
  title,           // JSX — include <span className="tk-accent-clay"> for gradient line
  body,
  slotKind = 'faucet',
  slotLabel = 'before / after',
  reverse = false,
}) {
  return (
    <section className="tk-section">
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: reverse ? '1fr 1.5fr' : '1.5fr 1fr', gap: 80, alignItems: 'center' }}>
        <div className="tk-reveal" style={{ order: reverse ? 2 : 1 }}>
          <div className="tk-eyebrow" style={{ marginBottom: 24 }}>{eyebrow.replace(/^·\s*/, '')}</div>
          <h2 className="tk-h2" style={{ margin: '0 0 32px' }}>{title}</h2>
          <p className="tk-lead" style={{ maxWidth: 520 }}>{body}</p>
        </div>
        <div className="tk-reveal tk-surface-peach" style={{ order: reverse ? 1 : 2, borderRadius: 'var(--tk-radius-lg)', padding: 28, aspectRatio: '1 / 1', border: '1px solid var(--tk-ink-08)' }}>
          <RenderSlot kind={slotKind} label={slotLabel} ratio="auto"
            style={{ height: '100%', background: 'rgba(255,255,255,0.5)' }} />
        </div>
      </div>
    </section>
  );
}

// ── 4. Pillars slab (cream, 3-column cards with color dots) ─
function PillarsSlab({
  eyebrow = 'one platform',
  title = 'the full stack, from cad to cart.',
  pillars = [
    { n: '01', h: 'asset platform', d: 'import cad, optimize geometry, define variants. one master.',  dot: 'var(--tk-green)' },
    { n: '02', h: 'configurator',   d: 'real-time 3d product configuration embedded anywhere.',          dot: 'var(--tk-clay)' },
    { n: '03', h: 'rendering api',  d: 'thousands of photoreal images generated on demand.',             dot: 'var(--tk-orange)' },
  ],
}) {
  return (
    <section style={{ padding: '80px 48px 128px' }}>
      <div style={{ maxWidth: 1344, margin: '0 auto' }}>
        <div className="tk-reveal tk-surface-cream" style={{ borderRadius: 'var(--tk-radius-lg)', padding: '72px 56px', color: 'var(--tk-dark-green)', position: 'relative', overflow: 'hidden', border: '1px solid var(--tk-ink-08)' }}>
          <div style={{ position: 'absolute', top: -160, right: -80, width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,186,155,0.45) 0%, transparent 65%)', filter: 'blur(12px)' }} />
          <div style={{ position: 'relative', zIndex: 1 }}>
            <div className="tk-eyebrow" style={{ marginBottom: 18 }}>{eyebrow.replace(/^·\s*/, '')}</div>
            <h2 className="tk-h2" style={{ maxWidth: 680, marginBottom: 56 }}>{title}</h2>
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${pillars.length}, 1fr)`, gap: 1, background: 'var(--tk-ink-08)', border: '1px solid var(--tk-ink-08)', borderRadius: 'var(--tk-radius)', overflow: 'hidden' }}>
              {pillars.map(p => (
                <div key={p.n} style={{ background: '#fff', padding: '32px 28px', display: 'flex', flexDirection: 'column', minHeight: 220 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                    <div style={{ fontFamily: 'var(--tk-mono)', fontSize: 12, letterSpacing: '0.14em', color: p.dot }}>{p.n}</div>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.dot }} />
                  </div>
                  <h3 style={{ fontSize: 26, fontWeight: 500, letterSpacing: '-0.015em', margin: '0 0 12px', color: 'var(--tk-dark-green)' }}>{p.h}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--tk-ink-70)', margin: 0 }}>{p.d}</p>
                  <a href="#" className="tk-link" style={{ marginTop: 'auto', paddingTop: 24, fontSize: 13, color: p.dot, borderColor: p.dot, alignSelf: 'start' }}>explore →</a>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 5. Testimonial row (pull quote + metric duo) ────────────
function TestimonialRow({
  quote,           // JSX — include <span className="tk-accent-clay"> on the middle phrase
  author = { initials: 'kn', name: 'katherine ng', title: 'vp digital commerce, herman miller' },
  stats = [
    { value: '100×',  label: 'more skus live', color: 'var(--tk-clay)' },
    { value: '6 wks', label: 'to go live',     color: 'var(--tk-green)' },
  ],
}) {
  return (
    <section style={{ padding: '96px 48px', background: '#fff', borderTop: '1px solid var(--tk-ink-08)', borderBottom: '1px solid var(--tk-ink-08)' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 72, alignItems: 'center' }}>
        <blockquote className="tk-reveal" style={{ margin: 0, fontSize: 'clamp(32px, 3.2vw, 52px)', fontWeight: 500, lineHeight: 1.15, letterSpacing: '-0.02em', color: 'var(--tk-dark-green)', textWrap: 'balance' }}>
          {quote}
        </blockquote>
        <div className="tk-reveal">
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 32 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--tk-grad-btn-clay)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500 }}>{author.initials}</div>
            <div>
              <div style={{ fontWeight: 500, fontSize: 15, color: 'var(--tk-dark-green)' }}>{author.name}</div>
              <div style={{ fontSize: 13, color: 'var(--tk-ink-55)' }}>{author.title}</div>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${stats.length}, 1fr)`, gap: 20 }}>
            {stats.map((s, i) => (
              <div key={i} style={{ padding: '20px 22px', background: 'var(--tk-cream)', borderRadius: 'var(--tk-radius)', border: '1px solid var(--tk-ink-08)' }}>
                <div style={{ fontSize: 32, fontWeight: 500, letterSpacing: '-0.02em', color: s.color }}>{s.value}</div>
                <div className="tk-small" style={{ marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 6. Gradient Clay CTA panel ──────────────────────────────
function GradientCTA({
  eyebrow = '· bring a sku',
  title,              // JSX — multi-line ok, use <br />
  body,
  primary = { label: 'book a demo', href: '#' },
  secondary = { label: 'watch a tour', href: '#' },
}) {
  return (
    <section style={{ padding: '128px 48px', background: '#fff' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <div className="tk-reveal" style={{ background: 'var(--tk-grad-clay)', borderRadius: 28, padding: '96px 64px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: -100, right: -80, width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,255,255,0.25) 0%, transparent 60%)' }} />
          <div style={{ position: 'relative', zIndex: 1, display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 56, alignItems: 'center' }}>
            <div>
              <div className="tk-eyebrow" style={{ color: 'rgba(255,255,255,0.8)', marginBottom: 24 }}>{eyebrow.replace(/^·\s*/, '')}</div>
              <h2 style={{ fontSize: 'clamp(48px, 5.6vw, 88px)', fontWeight: 500, lineHeight: 0.96, letterSpacing: '-0.03em', margin: 0, textWrap: 'balance', color: '#fff' }}>
                {title}
              </h2>
            </div>
            <div>
              <p style={{ fontSize: 18, lineHeight: 1.5, opacity: 0.9, marginBottom: 32 }}>{body}</p>
              <div style={{ display: 'flex', gap: 14 }}>
                <a href={primary.href} className="tk-btn tk-btn-on-clay">{primary.label}<Arrow /></a>
                <a href={secondary.href} className="tk-btn tk-btn-ghost-light">{secondary.label}</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

Object.assign(window, { HeroDuoTone, LogoStrip, EditorialBlock, PillarsSlab, TestimonialRow, GradientCTA });
