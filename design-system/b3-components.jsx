// ============================================================
// Threekit · B3 Design System — Shared Components
// Requires: React, design-system/tokens.css + b3.css
// Exposes globals: TKLogo, Arrow, Nav, LogoCloud, RenderSlot,
//                  AbstractProduct, Footer, useReveal
// ============================================================

const { useEffect } = React;

// ── Logo ────────────────────────────────────────────────────
function TKLogo({ invert = false, height = 28 }) {
  const aspect = 288 / 70;
  return (
    <img
      src="assets/threekit_logo_alpha.png"
      alt="Threekit"
      style={{
        display: 'block',
        width: height * aspect,
        height,
        filter: invert ? 'brightness(0) invert(1)' : 'none',
      }}
    />
  );
}

// ── Arrow (CTAs) ────────────────────────────────────────────
function Arrow({ size = 16, weight = 1.6 }) {
  return (
    <svg className="tk-arrow" width={size} height={size} viewBox="0 0 18 18" fill="none"
         stroke="currentColor" strokeWidth={weight} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9h12M10 4l5 5-5 5" />
    </svg>
  );
}

// ── Navigation ──────────────────────────────────────────────
function Nav({ theme = 'light', cta = 'book a demo', accent = 'clay' }) {
  const dark = theme === 'dark';
  const color     = dark ? '#fff' : 'var(--tk-dark-green)';
  const linkColor = dark ? 'rgba(255,255,255,0.8)' : 'var(--tk-ink-70)';
  const border    = dark ? 'rgba(255,255,255,0.12)' : 'var(--tk-ink-08)';
  const items = ['platform', 'solutions', 'customers', 'resources', 'pricing'];

  const ctaClass = accent === 'clay' ? 'tk-btn tk-btn-clay'
                  : accent === 'forest' ? 'tk-btn tk-btn-forest'
                  : 'tk-btn tk-btn-primary';

  return (
    <nav style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '22px 48px', borderBottom: `1px solid ${border}`,
      position: 'sticky', top: 0, zIndex: 20,
      background: dark ? 'transparent' : 'rgba(251,250,246,0.85)',
      backdropFilter: dark ? 'none' : 'blur(8px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 48 }}>
        <TKLogo invert={dark} height={22} />
        <ul style={{ display: 'flex', gap: 28, listStyle: 'none', margin: 0, padding: 0 }}>
          {items.map(i => (
            <li key={i}>
              <a href="#" style={{ color: linkColor, textDecoration: 'none', fontSize: 14, fontWeight: 500, textTransform: 'lowercase', transition: 'color .2s' }}
                 onMouseEnter={e => e.currentTarget.style.color = color}
                 onMouseLeave={e => e.currentTarget.style.color = linkColor}>{i}</a>
            </li>
          ))}
        </ul>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <a href="#" style={{ color: linkColor, textDecoration: 'none', fontSize: 14, fontWeight: 500, textTransform: 'lowercase' }}>sign in</a>
        <a href="#" className={ctaClass}>{cta}<Arrow /></a>
      </div>
    </nav>
  );
}

// ── Customer logo cloud ─────────────────────────────────────
function LogoCloud({ color = 'var(--tk-ink-55)', logos }) {
  const defaults = ['CRATE & BARREL', 'HERMAN MILLER', 'LOVESAC', 'SHAW', 'ROCHE BOBOIS', 'BADGLEY MISCHKA', 'PELLA', 'KOHLER'];
  const list = logos || defaults;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', rowGap: 28, columnGap: 32, alignItems: 'center' }}>
      {list.map(l => (
        <div key={l} style={{
          fontFamily: 'var(--tk-font)', fontWeight: 500, letterSpacing: '0.14em', fontSize: 14,
          color, textAlign: 'center', textTransform: 'uppercase',
        }}>{l}</div>
      ))}
    </div>
  );
}

// ── Render slot + abstract product placeholder ──────────────
function RenderSlot({ label = 'render slot', kind = 'chair', ratio = '4 / 3', style, accent = 'var(--tk-dark-green)', dark = false, tag = '3d · live' }) {
  return (
    <div className="tk-slot" data-label={label}
      style={{
        aspectRatio: ratio,
        background: dark
          ? 'linear-gradient(180deg, #0a2f2e 0%, #021b15 100%)'
          : 'radial-gradient(120% 80% at 30% 20%, rgba(255,255,255,0.7), transparent 60%), linear-gradient(180deg, #eef3f1 0%, #dfe8e5 100%)',
        ...style
      }}>
      <AbstractProduct kind={kind} accent={accent} dark={dark} />
      <span className="tk-slot-tag" style={dark ? { color: 'rgba(255,255,255,0.6)' } : undefined}>{tag}</span>
    </div>
  );
}

function AbstractProduct({ kind = 'chair', accent = 'var(--tk-dark-green)', dark = false }) {
  const shadow = dark ? '0 40px 60px rgba(0,0,0,0.5)' : '0 40px 60px rgba(0,0,0,0.18)';
  const uid = React.useId ? React.useId() : Math.random().toString(36).slice(2);
  const gid = `g-${uid}-${kind}`;

  if (kind === 'sofa') {
    return (
      <svg viewBox="0 0 400 300" style={{ width: '72%', height: '72%', filter: `drop-shadow(${shadow})` }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={accent} /><stop offset="1" stopColor={dark ? '#021b15' : '#1e6251'} />
        </linearGradient></defs>
        <rect x="60" y="130" width="280" height="90" rx="22" fill={`url(#${gid})`} />
        <rect x="70" y="90"  width="80"  height="90" rx="16" fill={`url(#${gid})`} opacity=".9" />
        <rect x="170" y="90" width="80"  height="90" rx="16" fill={`url(#${gid})`} opacity=".85" />
        <rect x="270" y="90" width="80"  height="90" rx="16" fill={`url(#${gid})`} opacity=".92" />
        <rect x="76" y="220"  width="16" height="30" rx="3" fill={dark ? '#0a2f2e' : '#aaa'} />
        <rect x="308" y="220" width="16" height="30" rx="3" fill={dark ? '#0a2f2e' : '#aaa'} />
      </svg>
    );
  }
  if (kind === 'sneaker') {
    return (
      <svg viewBox="0 0 400 300" style={{ width: '78%', height: '78%', filter: `drop-shadow(${shadow})` }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" /><stop offset="1" stopColor={accent} />
        </linearGradient></defs>
        <path d="M40 200 Q 40 130 130 130 L 260 130 Q 330 140 360 200 L 360 220 Q 360 235 340 235 L 60 235 Q 40 235 40 220 Z" fill={`url(#${gid})`} />
        <ellipse cx="95" cy="170" rx="12" ry="10" fill="var(--tk-neon-orange)" />
        <rect x="140" y="150" width="80" height="10" rx="5" fill={dark ? '#021b15' : '#222'} opacity=".6" />
        <rect x="150" y="170" width="60" height="8"  rx="4" fill={dark ? '#021b15' : '#222'} opacity=".4" />
        <rect x="40"  y="235" width="320" height="6" fill={dark ? '#021b15' : '#222'} />
      </svg>
    );
  }
  if (kind === 'bottle') {
    return (
      <svg viewBox="0 0 400 300" style={{ width: '55%', height: '85%', filter: `drop-shadow(${shadow})` }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor={dark ? '#0a2f2e' : '#d8dfde'} />
          <stop offset=".4" stopColor={accent} />
          <stop offset="1" stopColor={dark ? '#021b15' : '#aab4b2'} />
        </linearGradient></defs>
        <rect x="160" y="20" width="80" height="30" rx="4" fill={dark ? '#0a2f2e' : '#444'} />
        <path d="M150 50 L150 90 Q 130 100 130 130 L 130 260 Q 130 280 150 280 L 250 280 Q 270 280 270 260 L 270 130 Q 270 100 250 90 L 250 50 Z" fill={`url(#${gid})`} />
        <rect x="150" y="160" width="100" height="60" fill={dark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.5)'} />
      </svg>
    );
  }
  if (kind === 'faucet') {
    return (
      <svg viewBox="0 0 400 300" style={{ width: '70%', height: '80%', filter: `drop-shadow(${shadow})` }}>
        <defs><linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#eef3f1" /><stop offset="1" stopColor={accent} />
        </linearGradient></defs>
        <rect x="180" y="40" width="40" height="30" fill={`url(#${gid})`} />
        <path d="M195 70 Q 170 90 170 140 L 170 180 L 230 180 L 230 140 Q 230 90 205 70 Z" fill={`url(#${gid})`} />
        <rect x="140" y="180" width="120" height="20" rx="6" fill={`url(#${gid})`} />
        <ellipse cx="200" cy="250" rx="120" ry="14" fill={dark ? '#0a2f2e' : '#c8d1cf'} />
      </svg>
    );
  }
  // chair (default)
  return (
    <svg viewBox="0 0 400 300" style={{ width: '68%', height: '80%', filter: `drop-shadow(${shadow})` }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor={accent} /><stop offset="1" stopColor={dark ? '#021b15' : '#1e6251'} />
      </linearGradient></defs>
      <path d="M120 40 Q 120 20 140 20 L 260 20 Q 280 20 280 40 L 280 160 Q 280 180 260 180 L 140 180 Q 120 180 120 160 Z" fill={`url(#${gid})`} />
      <rect x="140" y="170" width="120" height="25" rx="6" fill={`url(#${gid})`} opacity=".95" />
      <rect x="150" y="195" width="10" height="70" fill={dark ? '#0a2f2e' : '#8a8f8d'} />
      <rect x="240" y="195" width="10" height="70" fill={dark ? '#0a2f2e' : '#8a8f8d'} />
    </svg>
  );
}

// ── Footer ──────────────────────────────────────────────────
function Footer({ theme = 'light' }) {
  const dark = theme === 'dark';
  const bg      = dark ? 'var(--tk-black)' : '#fff';
  const text    = dark ? 'rgba(255,255,255,0.8)' : 'var(--tk-ink-70)';
  const heading = dark ? '#fff' : 'var(--tk-dark-green)';
  const border  = dark ? 'rgba(255,255,255,0.14)' : 'var(--tk-ink-15)';
  const cols = [
    { h: 'platform',  l: ['3d asset management', 'configurator', 'rendering api', 'ar/vr', 'integrations'] },
    { h: 'solutions', l: ['furniture', 'apparel', 'industrial', 'building products', 'consumer goods'] },
    { h: 'resources', l: ['customers', 'blog', 'webinars', 'documentation', 'partners'] },
    { h: 'company',   l: ['about', 'careers', 'press', 'contact'] },
  ];
  return (
    <footer style={{ background: bg, padding: '96px 48px 48px', color: text, borderTop: `1px solid ${border}` }}>
      <div style={{ maxWidth: 1344, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr repeat(4, 1fr)', gap: 48, marginBottom: 72 }}>
          <div>
            <TKLogo invert={dark} height={26} />
            <p style={{ marginTop: 20, maxWidth: 280, fontSize: 14, lineHeight: 1.55 }}>
              the 3d product experience platform for manufacturers who sell what they make.
            </p>
          </div>
          {cols.map(c => (
            <div key={c.h}>
              <div style={{ fontFamily: 'var(--tk-mono)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: heading, marginBottom: 16 }}>{c.h}</div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                {c.l.map(x => (
                  <li key={x}><a href="#" style={{ color: text, textDecoration: 'none', fontSize: 14 }}>{x}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${border}`, paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13 }}>
          <span>© 2026 threekit, inc. · all rights reserved.</span>
          <div style={{ display: 'flex', gap: 24 }}>
            <a href="#" style={{ color: text, textDecoration: 'none' }}>privacy</a>
            <a href="#" style={{ color: text, textDecoration: 'none' }}>terms</a>
            <a href="#" style={{ color: text, textDecoration: 'none' }}>security</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

// ── Reveal-on-scroll hook ───────────────────────────────────
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.tk-reveal');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
    }, { threshold: 0.1 });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
}

Object.assign(window, { TKLogo, Arrow, Nav, LogoCloud, RenderSlot, AbstractProduct, Footer, useReveal });
