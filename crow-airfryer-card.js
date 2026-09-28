/**
 * Crow Airfryer Card
 * VeSync air fryer progress card for Home Assistant — liquid-glass look with
 * four selectable layouts (Glass Dial, Live Activity pill, Tile, Timer),
 * light / dark / auto theming, phase-aware progress (heating temperature →
 * cook-time countdown), optional power-sensor completion detection and
 * optional smart-plug control.
 *
 * build: 2026-09-20.6 — iOS 27-style redesign: 4 layouts, light/dark, glass
 *   opacity, bottom-sheet popups; dial + timer are now true 1:1 squares with
 *   the name/status and Air/Set readouts tucked into the corners; compact
 *   iOS-scale sizing (Regular = +20%), one-row pill, 2:1 tile; per-phase
 *   colour pickers + presets, auto-tuned for light and dark contrast. Countdown stops when the fryer actually
 *   finishes (optional power sensor + expiry fallback).
 * build: 2026-09-23.1 — optional Idle colour picker (defaults to neutral grey).
 */

// ═══════════════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════════════

// Size scale: 1 = Compact (default), 1.2 = Regular. Every dimension below is
// multiplied by --af-s, which _applyTheme() sets from the `size` option.
const S  = n => `calc(${n}px * var(--af-s, 1))`;
const SC = (min, cq, max) => `calc(var(--af-s, 1) * clamp(${min}px, ${cq}cqw, ${max}px))`;

const STYLES = `
  :host { display: block; }
  [hidden] { display: none !important; }

  /* ── Liquid-glass surface ─────────────────────────────────────────
     Every colour below comes from CSS variables set by _applyTheme()
     (light / dark / glass opacity / size) and _update() (per-phase). */
  ha-card {
    position: relative; overflow: hidden; box-sizing: border-box;
    color: var(--af-ink, #fff);
    font-family: ui-rounded, 'SF Pro Rounded', -apple-system, BlinkMacSystemFont, system-ui, 'Segoe UI', sans-serif;
    background: linear-gradient(160deg, var(--af-glass1), var(--af-glass2));
    -webkit-backdrop-filter: blur(24px) saturate(170%);
    backdrop-filter: blur(24px) saturate(170%);
    border: 1px solid var(--af-edge);
    border-radius: ${S(24)};
    box-shadow: inset 0 1px 0 var(--af-hi), inset 0 -1px 0 var(--af-lo), var(--af-shadow);
    -webkit-tap-highlight-color: transparent;
    -webkit-user-select: none; user-select: none; -webkit-touch-callout: none;
    transition: border-radius .35s cubic-bezier(.34,1.2,.64,1);
  }
  /* soft state-coloured glow so the card feels alive even on a flat dashboard */
  ha-card::before {
    content: ''; position: absolute; inset: 0; z-index: 0; pointer-events: none;
    background: radial-gradient(80% 55% at 88% -8%, var(--af-glow, transparent), transparent 72%);
  }
  .af-inner { position: relative; z-index: 1; }

  /* ── Shared bits ─────────────────────────────────────────────── */
  .af-title { display: flex; align-items: center; gap: ${S(7)}; min-width: 0; flex: 1; }
  .af-head-icon { width: ${S(16)}; height: ${S(16)}; flex-shrink: 0; display: flex; }
  .af-head-icon svg { width: 100%; height: 100%; display: block; }
  .af-name {
    font-size: ${S(14)}; font-weight: 600; letter-spacing: -0.01em;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    cursor: pointer; min-width: 0;
  }
  .af-name:hover { opacity: 0.75; }

  /* status capsule (dial + timer) — tap area is padded out to ~44px */
  .af-pill {
    position: relative;
    display: inline-flex; align-items: center; gap: ${S(5)};
    padding: ${S(4)} ${S(9)} ${S(4)} ${S(7)}; border-radius: 999px;
    background: var(--af-chip); border: 1px solid var(--af-chipedge);
    box-shadow: inset 0 1px 0 var(--af-hi);
    font-size: ${S(11)}; font-weight: 600; letter-spacing: 0.01em;
    color: var(--af-ink); white-space: nowrap; flex-shrink: 0;
    cursor: pointer; user-select: none; -webkit-user-select: none;
    transition: background .15s, transform .12s, color .3s;
  }
  .af-pill::after { content: ''; position: absolute; inset: -10px -6px; }
  .af-pill:active { transform: scale(0.96); }
  .af-pill-dot {
    width: ${S(7)}; height: ${S(7)}; border-radius: 50%; flex-shrink: 0;
    background: var(--af-dot); box-shadow: 0 0 6px var(--af-pilldot, transparent);
    transition: background .35s;
  }
  /* plain variant: just coloured text (pill + tile layouts) */
  .af-pill-plain {
    padding: 0; background: none; border: none; box-shadow: none; border-radius: 0;
    color: var(--af-text); cursor: inherit; font-size: inherit; font-weight: 600;
  }
  .af-pill-plain::after { display: none; }
  .af-pill-plain .af-pill-dot { display: none; }

  .af-icon, .af-check { display: none; align-items: center; justify-content: center; }
  .af-icon svg, .af-check svg { width: 100%; height: 100%; display: block; }

  .af-time-val {
    font-weight: 600; letter-spacing: -0.02em; line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .af-time-unit { line-height: 1.1; color: var(--af-ink2); font-weight: 500; }

  .af-disc {
    position: relative;
    width: ${S(36)}; height: ${S(36)}; border-radius: 50%; flex-shrink: 0; box-sizing: border-box;
    display: flex; align-items: center; justify-content: center;
    background: var(--af-chip); border: 1px solid var(--af-chipedge);
    box-shadow: inset 0 1px 0 var(--af-hi);
    color: var(--af-text); cursor: pointer;
  }
  .af-disc::after { content: ''; position: absolute; inset: -6px; }
  .af-disc .af-icon  { display: flex; width: ${S(18)}; height: ${S(18)}; }
  ha-card.is-done .af-disc .af-icon  { display: none; }
  ha-card.is-done .af-disc .af-check { display: flex; width: ${S(18)}; height: ${S(18)}; }

  /* ── Ring layouts (dial + timer): true 1:1 square, corner layout ─
     Ring dead-centre; name + status in the top corners, Air / Set in the
     bottom corners. Sizes scale with the card width (container units). */
  .lay-dial, .lay-timer { aspect-ratio: 1 / 1; min-height: 130px; container-type: inline-size; }
  .lay-dial .af-inner, .lay-timer .af-inner { position: absolute; inset: 0; }

  .af-head {
    position: absolute; top: 0; left: 0; right: 0; z-index: 2;
    display: flex; align-items: center; justify-content: space-between; gap: ${S(8)};
    padding: ${S(10)} ${S(10)} 0 ${S(12)};
  }
  .lay-dial .af-name, .lay-timer .af-name { font-size: ${SC(12, 7.4, 15)}; }
  .lay-dial .af-pill, .lay-timer .af-pill { font-size: ${SC(10, 5.8, 12)}; }

  /* The body only occupies the band BETWEEN the header row and the chip
     row (percent padding = % of card width), and the ring is sized to fit
     that band with a clear gap on every side. */
  .af-body {
    position: absolute; inset: 0; box-sizing: border-box;
    padding: calc(18% * var(--af-s, 1)) 0 calc(19.5% * var(--af-s, 1));
    display: flex; align-items: center; justify-content: center;
    pointer-events: none;
  }
  .af-ring-wrap {
    position: relative; max-height: 100%; aspect-ratio: 1 / 1;
    width: calc(56% - (var(--af-s, 1) - 1) * 30%);
    cursor: pointer; pointer-events: auto;
  }
  .af-ring-wrap svg { display: block; width: 100%; height: 100%; }
  .af-ring-track { stroke: var(--af-track); stroke-width: 6; }
  .af-ring-arc {
    stroke-width: 6; stroke-dasharray: 100; stroke-dashoffset: 100;
    transition: stroke-dashoffset 1.1s cubic-bezier(0.34,1,0.64,1);
    filter: drop-shadow(0 0 2px var(--af-glow));
  }
  .af-ring-center {
    position: absolute; inset: 0; pointer-events: none;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
  }
  .lay-dial .af-time-val, .lay-timer .af-time-val { font-size: ${SC(18, 13.5, 36)}; }
  .lay-dial .af-time-unit, .lay-timer .af-time-unit { font-size: ${SC(9, 5.4, 12)}; }
  .af-ring-center .af-icon  { width: max(${S(22)}, 12cqw); height: max(${S(22)}, 12cqw); color: var(--af-ink2); }
  .af-ring-center .af-check { width: max(${S(26)}, 14cqw); height: max(${S(26)}, 14cqw); color: var(--af-c1); }
  ha-card.is-static .af-ring-center .af-icon  { display: flex; }
  ha-card.idle-tint .af-ring-center .af-icon  { color: var(--af-c1); }
  ha-card.is-static .af-ring-center .af-time-val { display: none; }
  ha-card.is-done   .af-ring-center .af-check { display: flex; }
  ha-card.is-done   .af-ring-center .af-time-val { display: none; }

  .af-chips {
    position: absolute; left: 0; right: 0; bottom: 0; z-index: 2;
    display: flex; justify-content: space-between; gap: ${S(6)};
    padding: 0 ${S(10)} ${S(10)};
  }
  .af-chip {
    flex: 0 1 auto; min-width: 0;
    display: flex; flex-direction: row; align-items: baseline; gap: ${S(5)};
    padding: ${S(4)} ${S(9)}; border-radius: 999px;
    background: var(--af-chip); border: 1px solid var(--af-chipedge);
    box-shadow: inset 0 1px 0 var(--af-hi);
  }
  .af-chip-l {
    font-size: ${SC(8, 4.8, 10)};
    font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--af-ink2);
  }
  .af-chip-v { font-size: ${SC(12, 7, 14)}; font-weight: 600; font-variant-numeric: tabular-nums; }

  /* Timer-app hero: hairline ring, light numerals */
  .lay-timer .af-ring-wrap { width: calc(60% - (var(--af-s, 1) - 1) * 30%); }
  .lay-timer .af-ring-track, .lay-timer .af-ring-arc { stroke-width: 1.6; }
  .lay-timer .af-ring-arc { filter: none; }
  .lay-timer .af-time-val { font-size: ${SC(20, 17, 40)}; font-weight: 200; letter-spacing: -0.04em; }
  .lay-timer .af-chip-l { letter-spacing: 0; text-transform: none; font-size: ${SC(9, 5.6, 11)}; }

  @container (max-width: 150px) { .af-head-icon { display: none; } }

  /* ── Live Activity pill: one 56px row, like a Kettle / Fan button ── */
  .lay-pill { border-radius: ${S(28)}; -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
  .lay-pill .af-inner {
    display: flex; align-items: center; gap: ${S(10)};
    padding: ${S(8)} ${S(14)} ${S(8)} ${S(10)}; min-height: ${S(56)}; box-sizing: border-box;
  }
  .af-pill-mid { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 1px; }
  .lay-pill .af-name { font-size: ${S(14)}; cursor: pointer; }
  .af-pill-sub {
    display: flex; align-items: center; gap: ${S(5)};
    font-size: ${S(12)}; font-weight: 500; color: var(--af-ink2);
    white-space: nowrap; overflow: hidden;
  }
  .af-pill-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .lay-pill .af-time-val { font-size: ${S(20)}; }
  .lay-pill .af-time-unit { font-size: ${S(10)}; }

  /* ── Control Center tile: compact 2:1 ─────────────────────────── */
  .lay-tile {
    aspect-ratio: 2 / 1; min-height: ${S(76)}; border-radius: ${S(22)}; cursor: pointer;
    container-type: inline-size;
  }
  .af-fill {
    position: absolute; left: 0; right: 0; bottom: 0; height: 0%; z-index: 0;
    background: linear-gradient(180deg, var(--af-fill1), var(--af-fill2));
    box-shadow: 0 -4px 18px var(--af-glow);
    transition: height 1.1s cubic-bezier(0.34,1,0.64,1);
  }
  .lay-tile .af-inner {
    position: absolute; inset: 0; box-sizing: border-box;
    padding: 0 ${S(12)};
    display: flex; flex-direction: row; align-items: center; gap: ${S(10)};
  }
  .lay-tile .af-disc { width: ${S(40)}; height: ${S(40)}; }
  .lay-tile .af-disc .af-icon, .lay-tile.is-done .af-disc .af-check { width: ${S(20)}; height: ${S(20)}; }
  .af-tile-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; text-shadow: var(--af-tshadow); }
  .af-tile-label {
    display: flex; gap: 4px; white-space: nowrap; overflow: hidden;
    font-size: ${SC(10, 6.4, 12)}; font-weight: 600; color: var(--af-ink);
  }
  .lay-tile .af-pill-plain, .lay-tile .af-disc { color: var(--af-ink); }   /* over the coloured fill */
  .lay-tile .af-name { font-size: inherit; font-weight: inherit; cursor: inherit; }
  .af-tile-value { display: flex; align-items: baseline; gap: 5px; }
  .lay-tile .af-time-val { font-size: ${SC(18, 12.5, 30)}; }
  .lay-tile .af-time-unit { font-size: ${SC(9, 5.8, 12)}; font-weight: 600; color: var(--af-ink); }

  /* ── Motion ─────────────────────────────────────────────────────
     subtle : (default) only what carries meaning — the icon while running,
              one pop when done, dimmed when paused
     full   : subtle + breathing ring, pulsing check, blinking pause
     off    : nothing moves
     system : subtle, but stands still if iOS "Reduce Motion" is on      */
  @keyframes af-warm { 0%,100% { filter: drop-shadow(0 0 0 transparent); transform: scale(1); } 50% { filter: drop-shadow(0 0 6px var(--af-dot)); transform: scale(1.14); } }
  @keyframes af-done-pop { 0% { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
  @keyframes af-breathe   { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
  @keyframes af-done-pulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.75; transform: scale(1.08); } }
  @keyframes af-paused-blink { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
  @keyframes af-wait-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }

  /* icon motion */
  ha-card:not(.anim-off).is-active .af-disc .af-icon,
  ha-card:not(.anim-off).is-active .af-head-icon { animation: af-warm var(--af-pulse, 2.6s) ease-in-out infinite; }
  ha-card.st-preheat { --af-pulse: 1.6s; }
  /* /icon motion */

  ha-card:not(.anim-off) .af-pill.is-waiting { animation: af-wait-pulse 1.3s ease-in-out infinite; }
  ha-card:not(.anim-off).is-done .af-check { animation: af-done-pop 0.55s cubic-bezier(0.34,1.56,0.64,1) 1; }
  ha-card:not(.anim-off).is-paused .af-disc .af-icon,
  ha-card:not(.anim-off).is-paused .af-time-val { opacity: 0.55; }

  ha-card.anim-full.is-active .af-ring-arc { animation: af-breathe 2.4s ease-in-out infinite; }
  ha-card.anim-full.is-done .af-check { animation: af-done-pulse 1.8s ease-in-out infinite; }
  ha-card.anim-full.is-paused .af-time-val,
  ha-card.anim-full.is-paused .af-disc .af-icon { animation: af-paused-blink 1.4s ease-in-out infinite; }

  /* Only "System" honours iOS Reduce Motion; Subtle / Full always animate. */
  @media (prefers-reduced-motion: reduce) {
    ha-card.anim-system, ha-card.anim-system * { animation: none !important; transition: none !important; }
  }
`;

// ═══════════════════════════════════════════════════════════════════
//  EDITOR STYLES
// ═══════════════════════════════════════════════════════════════════

const EDITOR_STYLES = `
  .container {
    display: flex; flex-direction: column; gap: 20px;
    padding: 12px;
    color: var(--primary-text-color);
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  }
  .section-title {
    font-size: 11px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.08em;
    color: #888; margin-bottom: 2px;
  }
  .card-block {
    background: var(--card-background-color);
    border: 1px solid rgba(128,128,128,0.15);
    border-radius: 12px; overflow: hidden;
  }
  .text-row { padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; }
  .text-row label { font-size: 14px; font-weight: 500; }
  .text-row .hint { font-size: 11px; color: #888; margin-top: -2px; }

  .select-row { padding: 12px 16px; display: flex; flex-direction: column; gap: 6px; }
  .select-row label { font-size: 14px; font-weight: 500; }
  .select-row .hint { font-size: 11px; color: #888; margin-top: -2px; }
  .select-row + .select-row { border-top: 1px solid rgba(128,128,128,0.10); }

  input[type="text"], input[type="number"] {
    width: 100%; box-sizing: border-box;
    background: var(--card-background-color);
    color: var(--primary-text-color);
    border: 1px solid rgba(128,128,128,0.20);
    border-radius: 8px; padding: 10px 12px; font-size: 14px;
    font-family: inherit;
  }
  input[type="text"]:focus, input[type="number"]:focus { outline: none; border-color: #007AFF; }

  .entity-search {
    padding: 7px 12px !important; font-size: 12px !important;
    background: rgba(128,128,128,0.06) !important;
  }

  select {
    width: 100%;
    background: var(--card-background-color);
    color: var(--primary-text-color);
    border: 1px solid rgba(128,128,128,0.20);
    border-radius: 8px; padding: 10px 12px; font-size: 14px;
    cursor: pointer; -webkit-appearance: none; appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23888' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 12px center;
    padding-right: 32px;
  }
  select:focus { outline: none; border-color: #007AFF; }
  select option { background: var(--card-background-color); }

  .toggle-list { display: flex; flex-direction: column; }
  .toggle-item {
    display: flex; align-items: center; justify-content: space-between;
    padding: 13px 16px;
    border-bottom: 1px solid rgba(128,128,128,0.08);
    min-height: 52px;
  }
  .toggle-item:last-child { border-bottom: none; }
  .toggle-label { font-size: 14px; font-weight: 500; flex: 1; padding-right: 12px; }
  .toggle-desc  { font-size: 11px; color: #888; margin-top: 2px; }

  /* iOS-style toggle */
  .toggle-switch { position: relative; width: 51px; height: 31px; flex-shrink: 0; }
  .toggle-switch input { opacity: 0; width: 0; height: 0; position: absolute; }
  .toggle-track {
    position: absolute; inset: 0; border-radius: 31px;
    background: rgba(120,120,128,0.32); cursor: pointer;
    transition: background 0.25s ease;
  }
  .toggle-track::after {
    content: ''; position: absolute;
    width: 27px; height: 27px; border-radius: 50%;
    background: #fff; top: 2px; left: 2px;
    box-shadow: 0 2px 6px rgba(0,0,0,0.3);
    transition: transform 0.25s ease;
  }
  .toggle-switch input:checked + .toggle-track { background: #34C759; }
  .toggle-switch input:checked + .toggle-track::after { transform: translateX(20px); }

  .badge-optional {
    display: inline-block;
    font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
    text-transform: uppercase;
    background: rgba(128,128,128,0.12); color: #888;
    border: 1px solid rgba(128,128,128,0.25);
    border-radius: 4px; padding: 1px 5px;
    margin-left: 6px; vertical-align: middle;
  }
  .layout-grid {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; padding: 12px;
  }
  .layout-opt {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 10px 8px 9px; border-radius: 14px; cursor: pointer;
    background: rgba(128,128,128,0.06); color: var(--primary-text-color);
    border: 2px solid transparent; font-family: inherit;
    transition: border-color .15s, background .15s, transform .1s;
  }
  .layout-opt:active { transform: scale(0.97); }
  .layout-opt svg { width: 100%; max-width: 132px; height: auto; display: block; }
  .layout-opt .lo-name { font-size: 13px; font-weight: 600; }
  .layout-opt .lo-sub  { font-size: 11px; color: #888; margin-top: -4px; }
  .layout-opt.is-selected { border-color: #007AFF; background: rgba(0,122,255,0.08); }

  .seg {
    display: flex; padding: 2px; gap: 2px; border-radius: 10px;
    background: rgba(120,120,128,0.16);
  }
  .seg-btn {
    flex: 1; border: none; border-radius: 8px; padding: 8px 6px; cursor: pointer;
    background: transparent; color: var(--primary-text-color);
    font-family: inherit; font-size: 13px; font-weight: 600;
    transition: background .15s, box-shadow .15s;
  }
  .seg-btn.is-selected {
    background: var(--card-background-color, #fff);
    box-shadow: 0 1px 4px rgba(0,0,0,0.25);
  }
  .range-row { display: flex; align-items: center; gap: 10px; }
  .range-row span { font-size: 11px; color: #888; flex-shrink: 0; }
  input[type="range"] { flex: 1; accent-color: #007AFF; margin: 4px 0; }

  .preset-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .preset-opt {
    display: flex; align-items: center; gap: 10px; padding: 9px 12px; border-radius: 12px; cursor: pointer;
    background: rgba(128,128,128,0.06); color: var(--primary-text-color);
    border: 2px solid transparent; font-family: inherit; font-size: 13px; font-weight: 600;
    transition: border-color .15s, background .15s;
  }
  .preset-opt.is-selected { border-color: #007AFF; background: rgba(0,122,255,0.08); }
  .preset-dots { display: inline-flex; }
  .preset-dots i { width: 14px; height: 14px; border-radius: 50%; margin-left: -4px; border: 1.5px solid var(--card-background-color, #fff); }
  .preset-dots i:first-child { margin-left: 0; }
  .select-row.color-row { flex-direction: row; align-items: center; gap: 10px; }
  .color-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
  .color-info label { font-size: 14px; font-weight: 500; }
  .color-info .hint { font-size: 11px; color: #888; margin: 0; }
  .color-prev { display: flex; gap: 4px; }
  .pv {
    width: 32px; height: 26px; border-radius: 8px; display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700; border: 1px solid rgba(128,128,128,0.25);
  }
  input[type="color"] {
    -webkit-appearance: none; appearance: none; width: 44px; height: 32px; padding: 0; flex-shrink: 0;
    border: 1px solid rgba(128,128,128,0.3); border-radius: 10px; background: none; cursor: pointer; overflow: hidden;
  }
  input[type="color"]::-webkit-color-swatch-wrapper { padding: 0; }
  input[type="color"]::-webkit-color-swatch { border: none; border-radius: 9px; }
  .reset-btn {
    border: none; background: none; color: #007AFF; font-family: inherit; font-size: 13px; font-weight: 600;
    cursor: pointer; padding: 8px 2px; flex-shrink: 0;
  }


  .badge-required {
    display: inline-block;
    font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
    text-transform: uppercase;
    background: rgba(0,122,255,0.15); color: #007AFF;
    border: 1px solid rgba(0,122,255,0.30);
    border-radius: 4px; padding: 1px 5px;
    margin-left: 6px; vertical-align: middle;
  }
`;

// ═══════════════════════════════════════════════════════════════════
//  ICONS (stroke = currentColor, sized by their container)
// ═══════════════════════════════════════════════════════════════════

const FRYER_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <rect x="4" y="3" width="16" height="15" rx="4"/>
  <path d="M8 7.5h8"/>
  <circle cx="12" cy="12.5" r="2.2"/>
  <path d="M9 21h6"/><path d="M12 18v3"/>
</svg>`;

const CHECK_SVG = `
<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M5 12.5l4.5 4.5L19 7.5"/>
</svg>`;

const WARN_SVG = `
<svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.8"
     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 3.5l9 15.5H3z"/><path d="M12 10v4.5"/><path d="M12 17.2v.1"/>
</svg>`;

const CLOSE_SVG = `
<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.4"
     stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;

const LAYOUTS = ['dial', 'pill', 'tile', 'timer'];

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ═══════════════════════════════════════════════════════════════════
//  THEME + PHASE COLOURS
// ═══════════════════════════════════════════════════════════════════

function hexA(hex, a) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${Math.round(a * 100) / 100})`;
}

// ═══════════════════════════════════════════════════════════════════
//  COLOUR MATH — keeps any user-picked colour legible in light AND dark
// ═══════════════════════════════════════════════════════════════════

function _hex2rgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function _rgb2hex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
}
function _rgb2hsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h *= 60;
  }
  return [h, s, l];
}
function _hsl2hex(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs((h / 60) % 2 - 1)), m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0]; else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x]; else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return _rgb2hex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
function _lum(hex) {
  const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const [r, g, b] = _hex2rgb(hex);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function _contrast(a, b) {
  const la = _lum(a), lb = _lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}
function _mix(fg, bg, a) {
  const f = _hex2rgb(fg), b = _hex2rgb(bg);
  return _rgb2hex(f[0] * a + b[0] * (1 - a), f[1] * a + b[1] * (1 - a), f[2] * a + b[2] * (1 - a));
}
function isHex(v) { return typeof v === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim()); }

// Approximate surfaces the card sits on (glass over a typical HA dashboard).
const SURFACE = { dark: '#34343a', light: '#f6f6f9' };
const INK     = { dark: '#ffffff', light: '#1c1c1e' };

// Nudge lightness (keeping hue + saturation) until `min` contrast is met.
function _ensure(h, s, l, bg, min, dir) {
  let hex = _hsl2hex(h, s, l);
  for (let i = 0; i < 60 && _contrast(hex, bg) < min; i++) {
    l = Math.min(0.97, Math.max(0.03, l + dir * 0.015));
    hex = _hsl2hex(h, s, l);
  }
  return hex;
}

const _tuneCache = {};
// One user-picked colour → { c1, c2, dot, text } that reads in this mode.
//   c1/c2 : ring + bar gradient (graphics, ≥3:1 on the surface)
//   dot   : status dot / glow
//   text  : status text (≥4.5:1 on the surface)
function tuneColor(base, dark) {
  const key = `${base}|${dark}`;
  if (_tuneCache[key]) return _tuneCache[key];
  const [h, s0, l0] = _rgb2hsl(..._hex2rgb(base));
  const bg = dark ? SURFACE.dark : SURFACE.light;
  const s = s0;
  let out;
  if (dark) {
    const l = Math.min(0.72, Math.max(0.52, l0));
    out = {
      c1:  _ensure(h, s, Math.min(0.86, l + 0.10), bg, 3, +1),
      c2:  _ensure(h, s, l - 0.06, bg, 3, +1),
      dot: _ensure(h, s, l, bg, 3, +1),
      text: _ensure(h, s, Math.min(0.85, l + 0.12), bg, 4.5, +1),
    };
  } else {
    const l = Math.min(0.56, Math.max(0.36, l0));
    out = {
      c1:  _ensure(h, s, Math.min(0.66, l + 0.10), bg, 2.4, -1),
      c2:  _ensure(h, s, l - 0.08, bg, 3.2, -1),
      dot: _ensure(h, s, l, bg, 3, -1),
      text: _ensure(h, s, Math.min(l, 0.34), bg, 4.5, -1),
    };
  }
  return (_tuneCache[key] = out);
}

// Tile fill: pick the strongest alpha at which the ink (white in dark, near-black
// in light) still reads ≥4.5:1 on the tinted area.
const _fillCache = {};
function fillTint(pal, dark) {
  const key = `${pal.c1}|${pal.c2}|${dark}`;
  if (_fillCache[key]) return _fillCache[key];
  const bg = SURFACE[dark ? 'dark' : 'light'], ink = INK[dark ? 'dark' : 'light'];
  const maxA = dark ? 0.70 : 0.90;
  const solve = c => {
    let a = maxA;
    while (a > 0.18 && _contrast(_mix(c, bg, a), ink) < 4.5) a -= 0.02;
    return a;
  };
  const a = Math.min(solve(pal.c1), solve(pal.c2));
  return (_fillCache[key] = { a1: a, a2: a });
}

const DEFAULT_PHASE_BASE = { cook: '#FF9F0A', preheat: '#FF6B35', done: '#34C759', paused: '#FFCC00', error: '#FF453A' };

const COLOR_PRESETS = [
  { id: 'ember',    name: 'Ember',    colors: null },
  { id: 'ocean',    name: 'Ocean',    colors: { preheat: '#64D2FF', cook: '#0A84FF', done: '#30D158', paused: '#A78BFA' } },
  { id: 'berry',    name: 'Berry',    colors: { preheat: '#FF6482', cook: '#BF5AF2', done: '#32D74B', paused: '#FFD60A' } },
  { id: 'graphite', name: 'Graphite', colors: { preheat: '#A0A7B5', cook: '#7DA2FF', done: '#34C759', paused: '#FFD60A' } },
];

// Idle / offline / unknown — deliberately not an alarm colour.
const NEUTRAL_COLORS = {
  dark:  { c1: '#EBEBF5', c2: '#98989F', dot: '#8E8E93', text: 'rgba(255,255,255,0.72)' },
  light: { c1: '#8E8E93', c2: '#636366', dot: '#8E8E93', text: 'rgba(60,60,67,0.72)' },
};

// Phase → colours for this mode. User picks (config `colors`) go through the
// same tuner as the defaults, so any choice stays legible in light AND dark.
function phaseColors(info, dark, custom) {
  // Idle has no default hue (neutral grey) — only tinted if the user picked one.
  if (info.phase === 'idle' && custom && isHex(custom.idle)) return tuneColor(custom.idle.trim(), dark);
  const key = ['cook', 'preheat', 'done', 'paused', 'error'].includes(info.phase) ? info.phase : null;
  if (!key) return NEUTRAL_COLORS[dark ? 'dark' : 'light'];
  const picked = (custom && key !== 'error' && isHex(custom[key])) ? custom[key].trim() : null;
  return tuneColor(picked || DEFAULT_PHASE_BASE[key], dark);
}

// Card-level theme tokens. `a` is the 0–1 glass slider (0 = clear, 1 = frosted).
function themeTokens(dark, a) {
  const f = n => n.toFixed(3);
  return dark ? {
    '--af-ink': '#ffffff', '--af-ink2': 'rgba(255,255,255,0.72)',
    '--af-glass1': `rgba(255,255,255,${f(0.10 + a * 0.16)})`,
    '--af-glass2': `rgba(255,255,255,${f(0.03 + a * 0.08)})`,
    '--af-edge': 'rgba(255,255,255,0.26)', '--af-hi': 'rgba(255,255,255,0.42)', '--af-lo': 'rgba(255,255,255,0.07)',
    '--af-shadow': '0 14px 36px rgba(0,0,0,0.32)',
    '--af-chip': 'rgba(255,255,255,0.13)', '--af-chipedge': 'rgba(255,255,255,0.20)',
    '--af-track': 'rgba(255,255,255,0.16)', '--af-tshadow': '0 1px 10px rgba(0,0,0,0.35)',
    '--af-danger-bg': 'rgba(255,69,58,0.32)', '--af-danger-ink': '#ffffff',
  } : {
    '--af-ink': '#1c1c1e', '--af-ink2': 'rgba(60,60,67,0.72)',
    '--af-glass1': `rgba(255,255,255,${f(0.50 + a * 0.32)})`,
    '--af-glass2': `rgba(255,255,255,${f(0.34 + a * 0.30)})`,
    '--af-edge': 'rgba(255,255,255,0.85)', '--af-hi': 'rgba(255,255,255,0.95)', '--af-lo': 'rgba(0,0,0,0.04)',
    '--af-shadow': '0 10px 30px rgba(28,36,80,0.14), 0 0 0 0.5px rgba(0,0,0,0.05)',
    '--af-chip': 'rgba(120,120,128,0.12)', '--af-chipedge': 'rgba(120,120,128,0.10)',
    '--af-track': 'rgba(120,120,128,0.20)', '--af-tshadow': 'none',
    '--af-danger-bg': 'rgba(255,59,48,0.14)', '--af-danger-ink': '#C4271C',
  };
}


// ⟦AI:HELPERS⟧
// ═══════════════════════════════════════════════════════════════════
//  AI + HISTORY HELPERS (shared)
// ═══════════════════════════════════════════════════════════════════

// "40m", "2h 5m", "3d" — how long ago something finished
function agoText(ms) {
  const m = Math.floor(ms / 60000);
  if (m < 1) return '';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h >= 24) return `${Math.floor(h / 24)}d`;
  return r ? `${h}h ${r}m` : `${h}h`;
}

// Clock time for an epoch-ms value, in the viewer's locale (e.g. "14:32")
function clockAt(ms) {
  try { return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
  catch (e) { return '--'; }
}

function durText(ms) {
  const m = Math.round(ms / 60000);
  if (m < 1) return '<1m';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h}h ${r}m` : `${h}h`;
}

const AI_ICONS = {
  info:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8v.01"/></svg>',
  power:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/></svg>',
  sparkle:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M18.5 16v4M16.5 18h4"/></svg>',
  chart:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 20V11"/><path d="M12 20V5"/><path d="M19 20v-6"/></svg>',
  timeline:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="1.6"/><circle cx="6" cy="12" r="1.6"/><circle cx="6" cy="18" r="1.6"/><path d="M11 6h8M11 12h6M11 18h8"/></svg>',
  more:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="18.5" cy="12" r="1"/></svg>',
  send:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5"/><path d="M5.5 11.5L12 5l6.5 6.5"/></svg>',
};
// ⟦/AI:HELPERS⟧

// ═══════════════════════════════════════════════════════════════════
//  STATE HELPERS
// ═══════════════════════════════════════════════════════════════════

function normalizeState(raw) {
  return (raw || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

// NOTE: VeSync's cooking_status vocabulary isn't fully documented and can
// vary by device/firmware (e.g. "cooking" vs "cookStop" vs "cookComplete").
// This uses substring matching rather than an exact-match list so odd
// variants still land in a sensible bucket — but the exact strings Leonard
// and Lucy actually report are worth checking against the More Info popup
// and adjusting here if anything looks off.
function getFryerInfo(raw) {
  if (!raw)
    return { label: '--', arcColor: 'var(--divider-color)', dotColor: 'rgba(255,255,255,0.22)',
             active: false, done: false, paused: false, offline: false, phase: 'idle' };

  const n = normalizeState(raw);

  // Numeric state — integration returning a code we can't label → Idle
  if (/^\d+$/.test(n))
    return { label: 'Idle', arcColor: 'var(--divider-color)', dotColor: 'rgba(255,255,255,0.35)',
             active: false, done: false, paused: false, offline: false, phase: 'idle' };

  if (['unavailable', 'unknown', ''].includes(n))
    return { label: 'Offline', arcColor: 'var(--error-color,#E24B4A)', dotColor: '#E24B4A',
             active: false, done: false, paused: false, offline: true, phase: 'offline' };

  // VeSync reports this phase as "heating" on most integrations (not "preheating") —
  // match both so the phase is actually recognised, animated and colourable.
  if (n.includes('heat'))
    return { label: 'Heating', arcColor: '#FF6B35', dotColor: '#FF6B35',
             active: true, done: false, paused: false, offline: false, phase: 'preheat' };

  if (n.includes('pause'))
    return { label: 'Paused', arcColor: 'var(--warning-color,#BA7517)', dotColor: '#FF9500',
             active: false, done: false, paused: true, offline: false, phase: 'paused' };

  // Check "done"-ish states before the generic "cook" check so things like
  // "cookStop" / "cookComplete" land here rather than in Cooking.
  if (n.includes('stop') || n.includes('complete') || n.includes('done') ||
      n.includes('finish') || n.includes('end'))
    return { label: 'Done', arcColor: 'var(--success-color,#1D9E75)', dotColor: '#34C759',
             active: false, done: true, paused: false, offline: false, phase: 'done' };

  if (n.includes('cook'))
    return { label: 'Cooking', arcColor: '#FF9500', dotColor: '#FF9500',
             active: true, done: false, paused: false, offline: false, phase: 'cook' };

  if (n.includes('error') || n.includes('fault') || n.includes('fail'))
    return { label: 'Error', arcColor: 'var(--error-color,#E24B4A)', dotColor: '#FF3B30',
             active: false, done: false, paused: false, offline: false, phase: 'error' };

  if (n.includes('standby') || n.includes('idle') || n === 'off' || n.includes('ready'))
    return { label: 'Idle', arcColor: 'var(--divider-color)', dotColor: 'rgba(255,255,255,0.35)',
             active: false, done: false, paused: false, offline: false, phase: 'idle' };

  // Unknown string state — show it nicely but do NOT animate
  const fmt = raw.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  return { label: fmt, arcColor: 'var(--divider-color)', dotColor: 'rgba(255,255,255,0.35)',
           active: false, done: false, paused: false, offline: false, phase: 'unknown' };
}

function resolveTempUnit(cfg, tempObj) {
  if (cfg.temp_unit_override === 'f') return '°F';
  if (cfg.temp_unit_override === 'c') return '°C';
  const raw = tempObj?.attributes?.unit_of_measurement;
  if (raw) return raw.includes('C') ? '°C' : '°F';
  return '°F';
}

function formatCountdown(totalSeconds) {
  const s   = Math.max(0, Math.round(totalSeconds));
  const m   = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ── Completion detection tuning ────────────────────────────────────
// VeSync's cooking_status is cloud-polled and can lag (or never report) the
// moment the fryer really stops. These are the independent signals the card
// uses so the countdown can't outlive the cook.
const COMPLETION = {
  POWER_OFF_W:      5,      // below this = fryer has powered down (matches the "Powers Down" automations)
  POWER_ON_W:       50,     // at/above this = fryer is actively heating (arms the power check)
  POWER_DEBOUNCE_MS: 8000,  // power must stay low this long before we call it finished
  POWER_UNARMED_MS:  90000, // if we never saw it heat this session, wait this long before trusting low power
  POWER_REARM_MS:    3000,  // power must stay high this long to treat a latched "done" as a new cook
  EXPIRY_GRACE_SEC:  60,    // no power sensor: how long past the expected end before we call it done
};

function timeAgo(isoStr) {
  if (!isoStr) return '--';
  const mins = Math.floor((Date.now() - new Date(isoStr).getTime()) / 60000);
  if (mins < 1)    return 'Just now';
  if (mins === 1)  return '1 min ago';
  if (mins < 60)   return `${mins} mins ago`;
  if (mins < 1440) return `${Math.floor(mins / 60)}h ago`;
  return `${Math.floor(mins / 1440)}d ago`;
}

// ═══════════════════════════════════════════════════════════════════
//  CARD
// ═══════════════════════════════════════════════════════════════════

class AntAirfryerCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass            = null;
    this._config           = null;
    this._built            = false;
    this._popupOverlay     = null;
    this._pillFlashState   = null;
    this._pillFlashInterval = null;

    // Phase-tracking for the locally-computed cook countdown (VeSync does
    // not expose a live "remaining time" sensor, so it's derived from a
    // start timestamp + the cooking_set_time value snapshotted at phase
    // entry, then ticked forward locally and rebased on real hass updates).
    this._lastPhase       = null;
    this._phaseStartTs    = null;
    this._phaseTotalSec   = null;
    this._lastRemainSec   = null;
    this._tickerInterval  = null;
    this._phaseStartTemp  = null; // current_temp reading captured at the moment preheat begins
    this._lastKnownTemp   = null; // most recent valid current_temp reading — smooths over the
                                   // brief unavailable/unknown gaps VeSync's cloud polling produces

    // Completion tracking — see _resolveCompletion(). The status entity is
    // cloud-polled and can be stale, so the card latches its own "done" when
    // an independent signal (power draw, or the countdown expiring) says the
    // cook is over, and holds that until the status entity or power says a
    // new cook has begun.
    this._rawPhase        = null;   // phase as reported by the status entity (before any latch)
    this._doneLatch       = null;   // null | 'power' | 'timer'
    this._sessionStartTs  = null;   // when the current preheat/cook session began
    this._powerSeenActive = false;  // saw real heating draw during this session
    this._powerLowSince   = null;
    this._powerHighSince  = null;
    this._forceStartNow   = false;  // next cook baseline starts at "now", not status.last_changed
    this._eff             = null;   // last resolved { info, isFinishing } — shared with the popup

    this._layout   = null;   // which layout is currently built
    this._dark     = true;   // resolved light/dark
    this._themeKey = null;

    this._aiSnap    = null;  // last facts, for the AI sheets
    this._aiCache   = null;
    this._doneSince = null;  // when the cook finished (context for the AI sheet only)
  }

  static getConfigElement() { return document.createElement('crow-airfryer-card-editor'); }

  static getStubConfig() {
    return {
      status_entity:       '',
      current_temp_entity: '',
      set_temp_entity:     '',
      cook_time_entity:    '',
      preheat_time_entity: '',
      friendly_name:       'Air Fryer',
      show_name:           true,
      temp_unit_override:  'auto',
      smart_plug_enabled:  false,
      smart_plug_entity:   '',
      power_entity:        '',
      layout:              'dial',   // dial | pill | tile | timer
      appearance:          'auto',   // auto | light | dark
      glass:               50,       // 0 (clear) – 100 (frosted)
      size:                'compact', // compact | regular (~20% larger)
      animation:           'subtle',  // subtle | full | off | system
      ai_features_enabled: false,
      ai_conversation_agent: '',
    };
  }

  setConfig(config) {
    this._config = { ...AntAirfryerCard.getStubConfig(), ...config };
    if (this._built) {
      if (this._layoutKey() !== this._layout) this._build();
      this._update();
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._built) { this._build(); this._built = true; }
    this._update();
  }

  disconnectedCallback() {
    this._stopPillFlash();
    this._stopTicker();
  }

  // ── Theme (light / dark / glass) ───────────────────────────────

  _applyTheme() {
    const cfg  = this._config || {};
    const mode = cfg.appearance || 'auto';
    let dark;
    if (mode === 'dark')       dark = true;
    else if (mode === 'light') dark = false;
    else if (typeof this._hass?.themes?.darkMode === 'boolean') dark = this._hass.themes.darkMode;
    else dark = !!(typeof window !== 'undefined' && window.matchMedia &&
                   window.matchMedia('(prefers-color-scheme: dark)').matches);

    let a = parseFloat(cfg.glass);
    a = isNaN(a) ? 0.5 : Math.min(1, Math.max(0, a / 100));
    const scale = cfg.size === 'regular' ? 1.2 : 1;

    const key = `${dark}|${a}|${scale}`;
    this._dark = dark;
    if (key === this._themeKey) return;
    this._themeKey = key;

    const tokens = themeTokens(dark, a);
    Object.entries(tokens).forEach(([k, v]) => this.style.setProperty(k, v));
    this.style.setProperty('--af-s', String(scale));
    this.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  // ── Build (once per layout) ────────────────────────────────────

  _layoutKey() {
    return LAYOUTS.includes(this._config?.layout) ? this._config.layout : 'dial';
  }

  _build() {
    const cfg    = this._config;
    const layout = this._layoutKey();
    this._layout = layout;
    if (this._pillFlashInterval || this._pillFlashState) this._stopPillFlash();

    const name  = esc(cfg.friendly_name || 'Air Fryer');
    const nameHidden = cfg.show_name === false ? 'hidden' : '';

    const capsule = `
      <div class="af-pill" id="af-pill">
        <span class="af-pill-dot" id="af-pill-dot"></span>
        <span id="af-pill-text">--</span>
      </div>`;
    const plainStatus = `
      <span class="af-pill af-pill-plain" id="af-pill">
        <span class="af-pill-dot" id="af-pill-dot"></span>
        <span id="af-pill-text">--</span>
      </span>`;
    const glyphs = `<div class="af-icon" id="af-icon">${FRYER_SVG}</div><div class="af-check" id="af-check">${CHECK_SVG}</div>`;
    const ringSvg = `
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id="af-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" style="stop-color:var(--af-c1)"/>
            <stop offset="1" style="stop-color:var(--af-c2)"/>
          </linearGradient>
        </defs>
        <circle class="af-ring-track" cx="50" cy="50" r="45" fill="none"/>
        <circle class="af-ring-arc" id="af-arc" cx="50" cy="50" r="45" fill="none"
          pathLength="100" stroke="url(#af-grad)" stroke-linecap="round"
          transform="rotate(-90 50 50)"/>
      </svg>`;

    let inner = '';
    if (layout === 'dial' || layout === 'timer') {
      inner = `
        <div class="af-inner">
          <div class="af-head">
            <div class="af-title">
              ${layout === 'dial' ? `<span class="af-head-icon">${FRYER_SVG}</span>` : ''}
              <span class="af-name" id="af-name" ${nameHidden}>${name}</span>
            </div>
            ${capsule}
          </div>
          <div class="af-body">
            <div class="af-ring-wrap" id="af-ring-wrap">
              ${ringSvg}
              <div class="af-ring-center">
                ${glyphs}
                <span class="af-time-val" id="af-time">--</span>
                <span class="af-time-unit" id="af-time-unit"></span>
              </div>
            </div>
          </div>
          <div class="af-chips">
            <div class="af-chip"><span class="af-chip-l">Air</span><span class="af-chip-v" id="af-chip-cur">--</span></div>
            <div class="af-chip"><span class="af-chip-l">Set</span><span class="af-chip-v" id="af-chip-set">--</span></div>
          </div>
        </div>`;
    } else if (layout === 'pill') {
      inner = `
        <div class="af-inner">
          <div class="af-disc" id="af-ring-wrap">${glyphs}</div>
          <div class="af-pill-mid">
            <span class="af-name" id="af-name" ${nameHidden}>${name}</span>
            <div class="af-pill-sub">
              ${plainStatus}
            </div>
          </div>
          <div class="af-pill-right" id="af-pill-right" hidden>
            <span class="af-time-val" id="af-time">--</span>
            <span class="af-time-unit" id="af-time-unit"></span>
          </div>
        </div>`;
    } else { // tile
      inner = `
        <div class="af-fill" id="af-fill"></div>
        <div class="af-inner">
          <div class="af-disc" id="af-ring-wrap">${glyphs}</div>
          <div class="af-tile-text">
            <div class="af-tile-label">
              <span class="af-name" id="af-name" ${nameHidden}>${name}</span>
              <span id="af-dotsep">·</span>
              ${plainStatus}
            </div>
            <div class="af-tile-value">
              <span class="af-time-val" id="af-time">--</span>
              <span class="af-time-unit" id="af-time-unit"></span>
            </div>
          </div>
        </div>`;
    }

    this.shadowRoot.innerHTML = `
      <style>${STYLES}</style>
      <ha-card id="af-card" class="lay-${layout}">${inner}</ha-card>`;

    // ── Click handlers ──────────────────────────────────────────
    const $ = id => this.shadowRoot.getElementById(id);
    const card = $('af-card');
    const pill = $('af-pill');
    const ring = $('af-ring-wrap');
    const nameEl = $('af-name');

    // Gestures. With AI on: tap the card = assistant sheet, long-press = actions sheet.
    // The icon / status capsule still toggles the power (same confirmation sheet).
    const ai = () => this._aiMode();
    const toggle = e => {
      e.stopPropagation();
      if (this._lpFired) { this._lpFired = false; return; }
      this._handlePillClick();
    };

    if (nameEl && layout !== 'tile') nameEl.addEventListener('click', e => {
      if (ai()) return;
      e.stopPropagation();
      if (this._lpFired) { this._lpFired = false; return; }
      const id = this._config?.status_entity;
      if (id) this._fireMoreInfo(id);
    });

    if (layout === 'dial' || layout === 'timer') {
      if (pill) pill.addEventListener('click', toggle);
      if (ring) ring.addEventListener('click', () => { if (!ai()) this._openStatusPopup(); });
    } else if (ring) {
      ring.addEventListener('click', toggle);     // pill + tile: the icon
    }

    card.addEventListener('click', () => {
      if (this._lpFired) { this._lpFired = false; return; }
      if (ai()) this._onAiTap();
      else if (layout === 'tile') this._openStatusPopup();
    });
    this._attachLongPress(card, () => {
      if (ai()) this._openActionsSheet();
      else if (layout === 'pill') this._openStatusPopup();
    });
  }

  // ── Update (every hass change, and every local tick) ───────────

  _update() {
    if (!this._hass || !this._config) return;
    const cfg  = this._config;
    const hass = this._hass;
    const root = this.shadowRoot;
    const layout     = this._layout || 'dial';
    const ringLayout = layout === 'dial' || layout === 'timer';
    const $ = id => root.getElementById(id);

    this._applyTheme();

    // Resolve entities
    const statusObj      = cfg.status_entity       ? hass.states[cfg.status_entity]       : null;
    const curTempObj     = cfg.current_temp_entity  ? hass.states[cfg.current_temp_entity]  : null;
    const setTempObj     = cfg.set_temp_entity      ? hass.states[cfg.set_temp_entity]      : null;
    const cookTimeObj    = cfg.cook_time_entity     ? hass.states[cfg.cook_time_entity]     : null;

    const statusRaw = statusObj?.state || '';
    const rawInfo   = getFryerInfo(statusRaw);
    const now       = Date.now();

    // The status entity is cloud-polled and can lag (or miss) the moment the
    // fryer really stops. _resolveCompletion() cross-checks it against power
    // draw and the countdown itself, and returns a "Done" info if the cook
    // is over even though the status entity hasn't said so yet.
    const info      = this._resolveCompletion(rawInfo, statusObj, now);

    const curTemp     = curTempObj  ? parseFloat(curTempObj.state)  : NaN;
    const setTemp     = setTempObj  ? parseFloat(setTempObj.state)  : NaN;
    const cookMinutes = cookTimeObj ? parseFloat(cookTimeObj.state) : NaN;

    // VeSync's current_temperature reading occasionally goes unavailable
    // for a poll or two even mid-cook — cache the last valid reading so a
    // brief gap doesn't make the temperature flicker in and out of the
    // display. displayTemp is what the UI should show; curTemp stays the
    // raw value for calculations that specifically need "do we have a
    // fresh reading right now" (e.g. the preheat baseline capture).
    if (info.phase === 'idle' || info.phase === 'offline') {
      this._lastKnownTemp = null;
    } else if (!isNaN(curTemp)) {
      this._lastKnownTemp = curTemp;
    }
    const displayTemp = !isNaN(curTemp) ? curTemp : this._lastKnownTemp;
    const haveTemp    = displayTemp !== null && !isNaN(displayTemp);

    // ── Phase transition & local countdown baseline ────────────────
    // cooking_set_time is assumed to be in minutes (matching the rest of
    // this household's HA conventions). It also appears to behave as a
    // live remaining-time reading that decrements over the course of the
    // cook, rather than a fixed value captured once at the start — the
    // rebase logic below is written to handle that correctly either way.
    if (info.phase !== this._lastPhase) {
      if (info.phase === 'cook' && !isNaN(cookMinutes) && cookMinutes > 0) {
        const changedAt = statusObj?.last_changed ? Date.parse(statusObj.last_changed) : NaN;
        // After a power-detected new cook on a stale status entity, last_changed
        // points at the *previous* cook — start from now instead.
        this._phaseStartTs  = (!this._forceStartNow && !isNaN(changedAt)) ? changedAt : now;
        this._phaseTotalSec = cookMinutes * 60;
        this._forceStartNow = false;
      } else if (info.phase === 'paused') {
        // Stop the wall clock but keep the total, so the frozen ring/bar can
        // still show how far through the cook we were.
        this._phaseStartTs = null;
      } else {
        this._phaseStartTs  = null;
        this._phaseTotalSec = null;
      }

      // Baseline temperature for the preheat ring — progress is measured
      // from wherever the fryer actually started, not from 0°, so the ring
      // visibly fills across the whole preheat instead of staying nearly
      // empty until the last few degrees before the target.
      if (info.phase === 'preheat' && !isNaN(curTemp)) {
        this._phaseStartTemp = curTemp;
      } else if (info.phase !== 'preheat') {
        this._phaseStartTemp = null;
      }

      this._lastPhase = info.phase;
    }
    // NOTE: deliberately no mid-cycle rebase here anymore. cooking_set_time
    // appears to jitter/update on nearly every poll rather than behaving
    // as a clean decrementing "remaining time" value — continuously
    // trusting it as ground truth was resetting the local countdown back
    // toward its starting point on almost every hass update, which is why
    // the timer barely moved in real time. Snapshotting the total once at
    // the moment cooking begins and counting down purely from wall-clock
    // time from there on is far more reliable, at the cost of not
    // reflecting a genuine mid-cook time adjustment on the physical device
    // (an edge case with no separate signal to detect it).

    // ── Local ticker on/off ─────────────────────────────────────────
    // Runs while the countdown is live, and also while a power sensor is
    // being watched during preheat/cook (its debounce needs a heartbeat even
    // when no entity happens to change).
    const rawActive     = rawInfo.phase === 'cook' || rawInfo.phase === 'preheat';
    const watchingPower = rawActive && !!cfg.power_entity;
    if ((info.phase === 'cook' && this._phaseStartTs !== null) || watchingPower) {
      this._startTicker();
    } else {
      this._stopTicker();
    }

    // ── Remaining seconds (cook phase, frozen while paused) ─────────
    let remainSec    = null;
    let overshootSec = null; // how far past the expected finish we are, once cooking
    if (info.phase === 'cook' && this._phaseStartTs !== null && this._phaseTotalSec !== null) {
      const elapsed = (Date.now() - this._phaseStartTs) / 1000;
      remainSec     = Math.min(this._phaseTotalSec, Math.max(0, this._phaseTotalSec - elapsed));
      overshootSec  = elapsed - this._phaseTotalSec;
      this._lastRemainSec = remainSec;
    } else if (info.phase === 'paused' && this._lastRemainSec !== null) {
      remainSec = this._lastRemainSec;
    }

    // VeSync is cloud-polled, so cooking_status can lag a real stop by a
    // poll cycle or two — the card's own countdown will hit zero and stay
    // there while the sensor still says "cooking". Once we're a few
    // seconds past our own expected finish with no phase change, show
    // "Finishing…" rather than a numeric countdown that reads as broken
    // (after EXPIRY_GRACE_SEC, or when power drops, _resolveCompletion
    // latches Done).
    const isFinishing = info.phase === 'cook' && overshootSec !== null && overshootSec > 3;
    this._eff = { info, isFinishing };

    // ── Progress fractions ─────────────────────────────────────────
    // ringFrac: how much of the ring is drawn (cook = time remaining,
    //           preheat = temperature progress, done = full).
    // barFrac:  for the pill bar / tile fill, which fill UP as the cook
    //           progresses (cook = time elapsed).
    let ringFrac = 0, barFrac = 0;
    if (info.phase === 'preheat') {
      if (haveTemp && !isNaN(setTemp) && setTemp > 0) {
        const baseline = (this._phaseStartTemp !== null && this._phaseStartTemp < setTemp) ? this._phaseStartTemp : 0;
        const span     = setTemp - baseline;
        const f        = span > 0 ? Math.min(1, Math.max(0, (displayTemp - baseline) / span)) : 1;
        ringFrac = f; barFrac = f;
      } else {
        ringFrac = 1; barFrac = 0; // active, no temp data yet → ring full, breathing conveys "in progress"
      }
    } else if (info.phase === 'cook' || info.phase === 'paused') {
      if (remainSec !== null && this._phaseTotalSec) {
        const f = Math.min(1, Math.max(0, remainSec / this._phaseTotalSec));
        ringFrac = f; barFrac = 1 - f;
      } else {
        ringFrac = info.phase === 'cook' ? 1 : 0; barFrac = 0;
      }
    } else if (info.done) {
      ringFrac = 1; barFrac = 1;
    }

    // ── Phase colours + state classes ───────────────────────────────
    const card = $('af-card');
    const pal  = phaseColors(info, this._dark, cfg.colors);
    const idleTint = info.phase === 'idle' && !!(cfg.colors && isHex(cfg.colors.idle));
    const glowOn = idleTint || ['cook', 'preheat', 'done', 'paused', 'error'].includes(info.phase);
    const isStatic = ['idle', 'offline', 'error', 'unknown'].includes(info.phase);
    if (card) {
      const set = (k, v) => card.style.setProperty(k, v);
      set('--af-c1', pal.c1);  set('--af-c2', pal.c2);
      set('--af-dot', pal.dot); set('--af-text', pal.text);
      set('--af-glow',  glowOn ? hexA(pal.dot, this._dark ? 0.34 : 0.22) : 'transparent');
      const ft = fillTint(pal, this._dark);   // strongest tint that keeps the text readable
      set('--af-fill1', hexA(pal.c1, ft.a1));
      set('--af-fill2', hexA(pal.c2, ft.a2));
      ['cook', 'preheat', 'done', 'paused', 'idle', 'offline', 'error', 'unknown']
        .forEach(p => card.classList.toggle(`st-${p}`, info.phase === p));
      card.classList.toggle('is-active', info.active);
      card.classList.toggle('is-done',   info.done);
      card.classList.toggle('is-paused', info.paused);
      card.classList.toggle('is-static', isStatic);
      card.classList.toggle('idle-tint', idleTint);
      // subtle (default) | full | off | system (= subtle, but honours iOS Reduce Motion). Legacy "auto" → subtle.
      const anim = ['off', 'full', 'system'].includes(cfg.animation) ? cfg.animation : 'subtle';
      card.classList.toggle('anim-off',    anim === 'off');
      card.classList.toggle('anim-subtle', anim === 'subtle' || anim === 'system');
      card.classList.toggle('anim-full',   anim === 'full');
      card.classList.toggle('anim-system', anim === 'system');
    }

    // Stop flash when plug reaches expected state
    const plugOn = (cfg.smart_plug_enabled && cfg.smart_plug_entity)
      ? hass.states[cfg.smart_plug_entity]?.state === 'on' : null; // null = no plug configured
    if (plugOn !== null) {
      if (this._pillFlashState === 'on'  && plugOn)  this._stopPillFlash();
      if (this._pillFlashState === 'off' && !plugOn) this._stopPillFlash();
    }

    // ── Status pill — text = fryer status; dot = plug state (green/red) or phase colour ─
    if (!this._pillFlashState) {
      const pillEl     = $('af-pill');
      const dotEl      = $('af-pill-dot');
      const pillTextEl = $('af-pill-text');
      let label, dotColor;
      if (plugOn !== null) {
        label    = plugOn ? (info.offline ? 'Starting…' : (isFinishing ? 'Finishing…' : info.label)) : 'Off';
        dotColor = plugOn ? '#34C759' : '#8E8E93';   // green = powered, grey = off (red is for errors)
      } else {
        label    = isFinishing ? 'Finishing…' : info.label;
        dotColor = pal.dot;
      }
      if (pillTextEl) pillTextEl.textContent = label;
      if (dotEl) { dotEl.style.background = dotColor; dotEl.style.setProperty('--af-pilldot', dotColor); }
      if (pillEl) pillEl.classList.toggle('is-waiting', isFinishing);
    }

    // Track when it finished (context for the AI sheet — nothing is drawn from this)
    if (info.done) {
      if (this._doneSince === null) {
        const t = rawInfo.done && statusObj?.last_changed ? Date.parse(statusObj.last_changed) : now;
        this._doneSince = isNaN(t) ? now : t;
      }
    } else {
      this._doneSince = null;
    }

    // ── Centre / main text ───────────────────────────────────────────
    const plugOff     = plugOn === false;
    const staticLabel = plugOff ? 'Off' : info.label;
    let main = '--', unit = '';
    if (info.done) {
      main = ringLayout ? '' : 'Done';
      unit = ringLayout ? 'Ready' : '';
    } else if (info.phase === 'preheat') {
      main = haveTemp ? `${Math.round(displayTemp)}°` : '--';
      unit = !isNaN(setTemp) ? `→ ${Math.round(setTemp)}°` : 'heating';
    } else if (info.phase === 'cook' && remainSec !== null) {
      main = formatCountdown(remainSec);
      unit = isFinishing ? 'finishing…' : (ringLayout ? 'remaining' : '');   // pill/tile: the number speaks for itself
    } else if (info.phase === 'cook') {
      main = '--'; unit = 'cooking';
    } else if (info.phase === 'paused') {
      main = remainSec !== null ? formatCountdown(remainSec) : '--';
      unit = 'paused';
    } else {
      // Idle / off / offline: the status is already shown once (capsule / label),
      // so ring layouts show just the icon and pill/tile show it as the headline.
      main = ringLayout ? '' : staticLabel;
      unit = '';
    }
    // pill/tile: don't say "Off" / "Done" twice
    const dupMain = !ringLayout && (info.done || isStatic);
    const timeEl = $('af-time'), unitEl = $('af-time-unit');
    if (timeEl) timeEl.textContent = main;
    if (unitEl) unitEl.textContent = unit;

    // ── Temperature readouts (chips / pill right-hand block) ─────────
    const curEl = $('af-chip-cur'), setEl = $('af-chip-set');
    if (curEl) curEl.textContent = haveTemp ? `${Math.round(displayTemp)}°` : '--';
    if (setEl) setEl.textContent = !isNaN(setTemp) ? `${Math.round(setTemp)}°` : '--';
    const rightEl = $('af-pill-right');
    if (rightEl) rightEl.hidden = dupMain;
    // tile: status label only when it adds something the headline doesn't
    if (layout === 'tile') {
      const st = $('af-pill'), sep = $('af-dotsep');
      if (st)  st.hidden  = dupMain;
      if (sep) sep.hidden = dupMain || cfg.show_name === false;
    }

    // ── Ring / bar / tile fill ───────────────────────────────────────
    const arcEl = $('af-arc');
    if (arcEl) arcEl.style.strokeDashoffset = (100 * (1 - ringFrac)).toFixed(2);
    const fillEl = $('af-fill');
    if (fillEl) fillEl.style.height = `${(barFrac * 100).toFixed(1)}%`;

    // Facts for the AI sheets
    this._aiSnap = {
      info, isFinishing, remainSec, now,
      curTemp: haveTemp ? displayTemp : null,
      setTemp: isNaN(setTemp) ? null : setTemp,
      unit: resolveTempUnit(cfg, curTempObj),
      setMinutes: this._phaseTotalSec ? Math.round(this._phaseTotalSec / 60) : null,
      doneSince: this._doneSince, plugOn,
    };

    // ── Card name ─────────────────────────────────────────────────
    const nameEl = $('af-name');
    if (nameEl) {
      if (cfg.friendly_name) nameEl.textContent = cfg.friendly_name;
      nameEl.hidden = cfg.show_name === false;
    }
    const sepEl = $('af-dotsep');
    if (sepEl && layout !== 'tile') sepEl.hidden = cfg.show_name === false;
  }

  // ⟦AI:SHARED⟧
  // ── AI (shared) ────────────────────────────────────────────────
  // Tap the card → assistant sheet (status line, next step, quick questions).
  // Long-press → actions sheet (details, power, ask, this week, more info).
  // Everything goes through HA's conversation agent, and only when the user
  // opens a sheet — nothing runs in the background.

  _aiEnabled() {
    const c = this._config;
    return !!(c?.ai_features_enabled && c?.ai_conversation_agent);
  }

  // AI mode changes what tap / long-press do (otherwise the classic gestures stay)
  _aiMode() { return this._aiEnabled(); }

  _onAiTap() {
    if (this._config.ai_enable_tap === false) this._openActionsSheet();
    else this._openAiSheet();
  }

  async _aiConverse(prompt, { ttl = 600000, key = null, force = false } = {}) {
    if (!this._aiEnabled() || !this._hass?.connection) return null;
    if (!this._aiCache) this._aiCache = new Map();
    const ck  = key || prompt.slice(0, 1500);
    const hit = this._aiCache.get(ck);
    if (!force && hit && Date.now() - hit.t < ttl) return hit.v;
    try {
      const resp = await this._hass.connection.sendMessagePromise({
        type: 'conversation/process', text: prompt,
        agent_id: this._config.ai_conversation_agent, language: navigator.language || 'en',
      });
      if (resp?.response?.response_type === 'error') return null;
      const text = resp?.response?.speech?.plain?.speech || null;
      if (!text) return null;
      this._aiCache.set(ck, { t: Date.now(), v: text });
      return text;
    } catch (e) {
      console.warn('[Crow AI]', e);
      return null;
    }
  }

  // Strips markdown fences and parses the first {...} block
  _aiExtractJson(raw) {
    if (!raw) return null;
    const s = String(raw).split('```json').join('').split('```').join('');
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    if (a === -1 || b <= a) return null;
    try { return JSON.parse(s.slice(a, b + 1)); } catch (_) { return null; }
  }

  _aiCompanionFacts() {
    const ids = this._config.ai_related_entities;
    if (!Array.isArray(ids) || !ids.length) return '';
    const parts = ids.map(id => {
      const o = this._hass?.states[id];
      return o ? `${o.attributes?.friendly_name || id}: ${o.state}` : null;
    }).filter(Boolean);
    return parts.length ? `Other appliances right now — ${parts.join('; ')}.` : '';
  }

  _aiContextText() {
    const spec = this._aiSpec(), snap = this._aiSnapshot();
    const clock = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return [
      `You are the assistant inside a smart-home dashboard card for a ${spec.appliance} named "${this._config.friendly_name || spec.title}".`,
      `Local time: ${clock}.`,
      `Current state: ${snap.facts.join('; ')}.`,
      this._aiCompanionFacts(),
      spec.guidance,
    ].filter(Boolean).join(' ');
  }

  _aiCacheKey(prefix, extra = '') {
    const rel = (this._config.ai_related_entities || []).map(id => `${id}=${this._hass?.states[id]?.state}`).join(',');
    return `${prefix}|${this._aiSnapshot().key}|${rel}|${extra}`;
  }

  async _aiLoadTap(force = false) {
    const spec = this._aiSpec();
    const prompt = `${this._aiContextText()}
Reply with ONLY a JSON object, no markdown: {"status":"...","next":"..."}
- status: one sentence (max 24 words) saying what is happening now, plus one practical tip for this stage. Only use facts given above.
- next: one short sentence (max 16 words) with the sensible next step, or "" if there is nothing to do.
Plain text only. No emojis.`;
    const raw = await this._aiConverse(prompt, { key: this._aiCacheKey('tap'), force });
    if (!raw) return null;
    const j = this._aiExtractJson(raw);
    if (j && typeof j.status === 'string') return { status: j.status.trim(), next: (j.next || '').trim() };
    return { status: String(raw).replace(/[{}"]/g, '').trim(), next: '' };   // agent ignored the JSON format
  }

  async _aiAnswer(question, force = false) {
    const prompt = `${this._aiContextText()}
Question: "${question}"
Answer in at most 45 words, plain text, no markdown or emojis. Be practical and cautious; if you don't know, say so.`;
    const raw = await this._aiConverse(prompt, { key: this._aiCacheKey('ans', question), force });
    return raw ? String(raw).trim() : null;
  }

  // ── History → runs / energy (for "This week") ────────────────────

  async _aiHistory(ids, startMs, endMs) {
    const res = await this._hass.connection.sendMessagePromise({
      type: 'history/history_during_period',
      start_time: new Date(startMs).toISOString(), end_time: new Date(endMs).toISOString(),
      entity_ids: ids, include_start_time_state: true, significant_changes_only: false,
      minimal_response: true, no_attributes: true,
    });
    const out = {};
    ids.forEach(id => {
      out[id] = (res?.[id] || []).map(p => {
        const ts = p.lc ?? p.lu ?? p.last_changed ?? p.last_updated;
        const t  = typeof ts === 'number' ? ts * 1000 : Date.parse(ts);
        return { t: Math.max(startMs, t), s: p.s ?? p.state };
      }).filter(p => !isNaN(p.t));
    });
    return out;
  }

  _aiRuns(series, isRunning, endMs) {
    const runs = []; let start = null;
    for (const p of series) {
      const r = !!isRunning(p.s);
      if (r && start === null) start = p.t;
      else if (!r && start !== null) { runs.push({ a: start, b: p.t }); start = null; }
    }
    if (start !== null) runs.push({ a: start, b: endMs });
    const merged = [];
    runs.forEach(r => {                       // bridge short gaps (e.g. a brief "unavailable", under 5 min)
      const last = merged[merged.length - 1];
      if (last && r.a - last.b < 300000) last.b = r.b; else merged.push({ ...r });
    });
    return merged.filter(r => r.b - r.a >= 60000);
  }

  _aiWeekStats(runs) {
    if (!runs.length) return { count: 0, totalMs: 0, longestMs: 0, busiest: null, last: null };
    const byDay = {};
    runs.forEach(r => {
      const d = new Date(r.a).toLocaleDateString([], { weekday: 'long' });
      (byDay[d] = byDay[d] || { count: 0, ms: 0 });
      byDay[d].count += 1; byDay[d].ms += r.b - r.a;
    });
    const busiest = Object.entries(byDay).sort((x, y) => y[1].count - x[1].count || y[1].ms - x[1].ms)[0];
    return {
      count: runs.length,
      totalMs: runs.reduce((s, r) => s + (r.b - r.a), 0),
      longestMs: Math.max(...runs.map(r => r.b - r.a)),
      busiest: { day: busiest[0], count: busiest[1].count },
      last: runs[runs.length - 1],
    };
  }

  // Step-hold integration of a power series (W) over the run intervals → kWh
  _aiEnergy(series, runs, unit) {
    if (!series?.length || !runs.length) return null;
    const mult = /^kw$/i.test(unit || '') ? 1000 : 1;
    const pts = series.map(p => { const w = parseFloat(p.s); return { t: p.t, w: isNaN(w) ? 0 : w * mult }; })
                      .sort((x, y) => x.t - y.t);
    const per = runs.map(r => {
      let wh = 0;
      for (let i = 0; i < pts.length; i++) {
        const a = Math.max(pts[i].t, r.a);
        const b = Math.min(i + 1 < pts.length ? pts[i + 1].t : r.b, r.b);
        if (b > a) wh += pts[i].w * (b - a) / 3600000;
      }
      return wh / 1000;
    });
    return { total: per.reduce((s, v) => s + v, 0), last: per[per.length - 1], per };
  }

  // ── Sheets ───────────────────────────────────────────────────────

  _aiSection(parent, label) {
    const sec = document.createElement('div');
    sec.className = 'af-sec';
    if (label) { const l = document.createElement('div'); l.className = 'af-sec-label'; l.textContent = label; sec.appendChild(l); }
    const body = document.createElement('div');
    sec.appendChild(body);
    parent.appendChild(sec);
    return { sec, body };
  }

  _aiSkeleton(el, lines = 2) {
    el.innerHTML = Array.from({ length: lines }, (_, i) => `<div class="af-skel" style="width:${i === lines - 1 ? 62 : 100}%"></div>`).join('');
  }

  _aiFooter(popup, text) {
    const f = document.createElement('div');
    f.className = 'af-foot';
    f.textContent = text;
    popup.appendChild(f);
    return f;
  }

  // Tap sheet: what's happening now, an AI status line and the next step
  async _openAiSheet() {
    const spec = this._aiSpec();
    const popup = this._createPopupBase(this._config.friendly_name || spec.title);
    if (!popup) return;

    const now = this._aiSection(popup, 'Now');
    now.body.innerHTML = `<div class="af-local">${esc(this._aiSnapshot().local || '—')}</div>`;

    const assist = this._aiSection(popup, 'Assistant');
    const next   = this._aiSection(popup, 'Next step');   next.sec.hidden = true;
    const foot = this._aiFooter(popup, spec.disclaimer);

    const alive = () => popup.isConnected;

    const load = async (force) => {
      this._aiSkeleton(assist.body, 2);
      next.sec.hidden = true;
      const res = await this._aiLoadTap(force);
      if (!alive()) return;
      if (!res) {
        assist.body.innerHTML = `<div class="af-ai-text">I couldn’t reach the assistant. Check the AI settings in this card’s editor, then tap the card again.</div>`;
        return;
      }
      assist.body.innerHTML = `<div class="af-ai-text">${esc(res.status)}</div>`;
      if (res.next) { next.sec.hidden = false; next.body.innerHTML = `<div class="af-ai-text">${esc(res.next)}</div>`; }
    };
    load(false);
  }

  // Long-press sheet: everything that used to be a tap
  _openActionsSheet() {
    const spec = this._aiSpec();
    const popup = this._createPopupBase(this._config.friendly_name || spec.title);
    if (!popup) return;

    const plugOn = spec.plugId ? this._hass?.states[spec.plugId]?.state === 'on' : false;
    const rows = [
      { icon: 'info', label: 'Details', fn: () => this._openStatusPopup() },
    ];
    if (spec.plugId) rows.push({
      icon: 'power', label: plugOn ? 'Turn off…' : spec.startLabel, danger: plugOn, fn: () => this._handlePillClick(),
    });
    if (this._config.ai_enable_ask !== false)    rows.push({ icon: 'sparkle',  label: 'Ask AI…',        fn: () => this._openAskSheet() });
    if (this._config.ai_enable_recap !== false)  rows.push({ icon: 'timeline', label: 'What happened?', fn: () => this._openRecapSheet() });
    if (this._config.ai_enable_week !== false)   rows.push({ icon: 'chart',    label: 'This week',      fn: () => this._openWeekSheet() });
    if (spec.moreInfoEntity) rows.push({ icon: 'more', label: 'More info', fn: () => this._fireMoreInfo(spec.moreInfoEntity) });

    const list = document.createElement('div');
    list.className = 'af-rows';
    rows.forEach(r => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'af-row' + (r.danger ? ' is-danger' : '');
      b.innerHTML = `${AI_ICONS[r.icon]}<span>${esc(r.label)}</span>`;
      b.addEventListener('click', () => { this._closePopup(); r.fn(); });
      list.appendChild(b);
    });
    popup.appendChild(list);
  }

  // Typed question (+ suggestion chips)
  _openAskSheet() {
    const spec = this._aiSpec();
    const popup = this._createPopupBase('Ask AI');
    if (!popup) return;

    const chips = document.createElement('div'); chips.className = 'af-chips-q';
    popup.appendChild(chips);
    const answer = document.createElement('div'); popup.appendChild(answer);

    const row = document.createElement('div'); row.className = 'af-ask-row';
    row.innerHTML = `<input type="text" class="af-ask-input" placeholder="Ask about this ${esc(spec.appliance)}…" autocomplete="off" enterkeyhint="send">
                     <button type="button" class="af-send" aria-label="Send">${AI_ICONS.send}</button>`;
    popup.appendChild(row);
    this._aiFooter(popup, spec.disclaimer);

    const input = row.querySelector('input'), send = row.querySelector('button');
    const alive = () => popup.isConnected;
    const ask = async (q) => {
      q = (q || '').trim(); if (!q) return;
      answer.innerHTML = `<div class="af-answer"><div class="af-q-title">${esc(q)}</div><div class="af-ans-body"></div></div>`;
      const bodyEl = answer.querySelector('.af-ans-body');
      this._aiSkeleton(bodyEl, 2);
      const a = await this._aiAnswer(q);
      if (!alive()) return;
      bodyEl.textContent = a || 'Sorry, I couldn’t get an answer just now.';
    };
    spec.defaultQuestions.forEach(q => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'af-q'; b.textContent = q;
      b.addEventListener('click', () => { input.value = ''; ask(q); });
      chips.appendChild(b);
    });
    send.addEventListener('click', () => { ask(input.value); input.value = ''; });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { ask(input.value); input.value = ''; } });
  }

  // Last 7 days from history (+ energy if a power sensor is set) with a one-line AI summary
  async _openWeekSheet() {
    const spec = this._aiSpec();
    const popup = this._createPopupBase('This week');
    if (!popup) return;
    const body = document.createElement('div'); popup.appendChild(body);
    this._aiSkeleton(body, 3);
    const alive = () => popup.isConnected;

    const end = Date.now(), start = end - 7 * 86400000;
    const powerId = spec.powerEntity;
    let hist = null;
    try {
      const ids = [spec.historyEntity, powerId].filter(Boolean);
      hist = ids.length ? await this._aiHistory(ids, start, end) : null;
    } catch (e) { console.warn('[Crow AI] history', e); }
    if (!alive()) return;

    const series = hist?.[spec.historyEntity] || [];
    if (!hist || !series.length) {
      body.innerHTML = `<div class="af-ai-text">I couldn’t find any history for this ${esc(spec.appliance)} in the last 7 days. (Home Assistant’s recorder needs to keep this entity.)</div>`;
      return;
    }
    const runs  = this._aiRuns(series, spec.isRunning, end);
    const stats = this._aiWeekStats(runs);
    const unit  = powerId ? this._hass.states[powerId]?.attributes?.unit_of_measurement : '';
    const en    = powerId && hist[powerId]?.length ? this._aiEnergy(hist[powerId], runs, unit) : null;

    const pl = n => /(s|sh|ch|x)$/.test(n) ? n + 'es' : n + 's';
    const tile = (v, l) => `<div class="af-stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`;
    const fmtKwh = v => `${v < 0.1 ? v.toFixed(3) : v.toFixed(2)} kWh`;
    body.innerHTML = `<div class="af-stats">
      ${tile(String(stats.count), `${stats.count === 1 ? spec.runNoun : pl(spec.runNoun)} this week`)}
      ${tile(stats.count ? durText(stats.totalMs) : '—', 'total time')}
      ${tile(stats.count ? durText(stats.longestMs) : '—', 'longest')}
      ${tile(stats.busiest ? stats.busiest.day : '—', 'busiest day')}
      ${en ? tile(fmtKwh(en.total), 'energy this week') : ''}
      ${en && en.last != null ? tile(fmtKwh(en.last), 'last ' + spec.runNoun) : ''}
    </div>`;
    const sum = document.createElement('div'); sum.className = 'af-ai-text'; body.appendChild(sum);
    if (!stats.count) { sum.textContent = `No ${pl(spec.runNoun)} in the last 7 days.`; return; }

    this._aiSkeleton(sum, 2);
    const facts = [
      `${stats.count} ${stats.count === 1 ? spec.runNoun : pl(spec.runNoun)} in the last 7 days`,
      `total running time ${durText(stats.totalMs)}`, `longest ${durText(stats.longestMs)}`,
      stats.busiest ? `busiest day ${stats.busiest.day}` : '',
      en ? `energy about ${en.total.toFixed(2)} kWh` : '',
    ].filter(Boolean).join('; ');
    const raw = await this._aiConverse(
      `You are the assistant inside a smart-home card for a ${spec.appliance}. Usage facts: ${facts}. Write at most two short, friendly sentences summarising this week. Plain text, no markdown or emojis, don't invent numbers.`,
      { key: `week|${facts}`, ttl: 3600000 });
    if (!alive()) return;
    sum.textContent = raw ? String(raw).trim() : '';
    if (!raw) sum.remove();
  }

  // Latest run as a timeline (from history) + notes + a short AI summary
  async _openRecapSheet() {
    const spec = this._aiSpec();
    const popup = this._createPopupBase('What happened?');
    if (!popup) return;
    const body = document.createElement('div'); popup.appendChild(body);
    this._aiSkeleton(body, 4);
    const alive = () => popup.isConnected;

    const end = Date.now(), start = end - 7 * 86400000;
    const ids = [spec.historyEntity, spec.powerEntity].filter(Boolean);
    let hist = null;
    try { hist = ids.length ? await this._aiHistory(ids, start, end) : null; } catch (e) { console.warn('[Crow AI] history', e); }
    if (!alive()) return;

    const series = hist?.[spec.historyEntity] || [];
    const runs = series.length ? this._aiRuns(series, spec.isRunning, end) : [];
    if (!runs.length) {
      body.innerHTML = `<div class="af-ai-text">I couldn’t find a recent ${esc(spec.runNoun)} in the last 7 days. (Home Assistant’s recorder needs to keep this entity.)</div>`;
      return;
    }
    const run  = runs[runs.length - 1];
    const live = spec.isRunning(series[series.length - 1].s) && run.b >= end - 1000;

    // timeline: every state change during the run, plus the change that ended it
    const evs = [];
    series.forEach(p => {
      if (p.t < run.a - 120000 || p.t > run.b + 1000) return;
      const label = spec.stateLabel(p.s);
      const prev = evs[evs.length - 1];
      if (prev && prev.label === label) return;
      evs.push({ t: p.t, label, running: !!spec.isRunning(p.s) });
    });
    evs.forEach((e, i) => {
      const nextT = i + 1 < evs.length ? evs[i + 1].t : (live ? end : null);
      e.dur = (e.t < run.b || live) && nextT ? Math.max(0, nextT - e.t) : null;   // the state that ended the run has no duration
    });

    const notes = [];
    evs.forEach(e => { if (/^offline$/i.test(e.label) && e.dur >= 60000) notes.push(`Connection dropped for ${durText(e.dur)}.`); });
    const prevDur = runs.slice(0, -1).map(r => r.b - r.a).sort((a, b) => a - b);
    if (!live && prevDur.length >= 3) {
      const med = prevDur[Math.floor(prevDur.length / 2)], d = run.b - run.a;
      if (d > med * 1.4 && d - med >= 600000)      notes.push(`Longer than your usual ~${durText(med)}.`);
      else if (d < med * 0.6 && med - d >= 600000) notes.push(`Shorter than your usual ~${durText(med)}.`);
    }
    if (this._aiRecapNotes) notes.push(...this._aiRecapNotes(run, live));
    const unit = spec.powerEntity ? this._hass.states[spec.powerEntity]?.attributes?.unit_of_measurement : '';
    const en = spec.powerEntity && hist[spec.powerEntity]?.length ? this._aiEnergy(hist[spec.powerEntity], [run], unit) : null;
    if (en && en.total > 0) notes.push(`Energy about ${en.total < 0.1 ? en.total.toFixed(3) : en.total.toFixed(2)} kWh.`);

    const day = new Date(run.a).toLocaleDateString([], { weekday: 'short' });
    const head = live
      ? `In progress · started ${clockAt(run.a)} · ${durText(end - run.a)} so far`
      : `Latest ${spec.runNoun} · ${day} ${clockAt(run.a)}–${clockAt(run.b)} · ${durText(run.b - run.a)}`;
    body.innerHTML = `<div class="af-tl-head">${esc(head)}</div>
      <div class="af-tl">${evs.map(e => `<div class="af-tl-row"><span class="af-tl-time">${esc(clockAt(e.t))}</span><span class="af-tl-label">${esc(e.label)}</span><span class="af-tl-dur">${e.dur != null ? esc(durText(e.dur)) : ''}</span></div>`).join('')}</div>
      ${notes.map(n => `<div class="af-note">${esc(n)}</div>`).join('')}`;

    const sum = document.createElement('div'); sum.className = 'af-ai-text'; sum.style.marginTop = '10px'; body.appendChild(sum);
    this._aiSkeleton(sum, 2);
    const tlText = evs.map(e => `${clockAt(e.t)} ${e.label}${e.dur != null ? ` (${durText(e.dur)})` : ''}`).join('; ');
    const raw = await this._aiConverse(
      `You are the assistant inside a smart-home card for a ${spec.appliance}. Timeline of the ${live ? 'current' : 'latest'} ${spec.runNoun}: ${tlText}. Total ${durText((live ? end : run.b) - run.a)}. Notes: ${notes.join(' ') || 'none'}. In at most three short sentences, say what happened and mention anything unusual. Plain text, no markdown or emojis. Do not invent details.`,
      { key: `recap|${run.a}|${live ? 'live' : run.b}`, ttl: live ? 60000 : 1800000 });
    if (!alive()) return;
    if (raw) sum.textContent = String(raw).trim(); else sum.remove();
  }
  // ⟦/AI:SHARED⟧


  // ── AI adapters (air fryer) ─────────────────────────────────────

  _aiSpec() {
    const cfg = this._config;
    return {
      appliance: 'air fryer', title: 'Air Fryer', runNoun: 'cook',
      guidance: 'Give general air-fryer tips only (for example shaking or turning food halfway and not overcrowding the basket). Never say food is safe or fully cooked; remind the user to check it is cooked through when relevant.',
      disclaimer: 'AI-generated tips. Always check food is cooked through and follow your air fryer’s instructions.',
      defaultQuestions: ['What suits this temperature?', 'When should I shake the basket?', 'How do I keep food crisp?'],
      startLabel: 'Turn on…',
      plugId: (cfg.smart_plug_enabled && cfg.smart_plug_entity) ? cfg.smart_plug_entity : null,
      moreInfoEntity: cfg.status_entity || null,
      historyEntity: cfg.status_entity || null,
      powerEntity: cfg.power_entity || null,
      isRunning: s => { const p = getFryerInfo(s).phase; return p === 'preheat' || p === 'cook' || p === 'paused'; },
      stateLabel: s => getFryerInfo(s).label,
    };
  }

  _aiSnapshot() {
    const a = this._aiSnap;
    if (!a) return { facts: ['no data yet'], key: 'nodata', local: '' };
    const i = a.info, u = a.unit;
    const facts = [`status ${i.label}${a.isFinishing ? ' (about to finish)' : ''}`];
    const local = [i.label];
    if (i.phase === 'cook' && a.remainSec != null) {
      facts.push(`time left ${formatCountdown(a.remainSec)}`, `finishes around ${clockAt(a.now + a.remainSec * 1000)}`);
      local.push(`${formatCountdown(a.remainSec)} left`, `ends ${clockAt(a.now + a.remainSec * 1000)}`);
    }
    if (a.curTemp != null) { facts.push(`current temperature ${Math.round(a.curTemp)}${u}`); }
    if (a.setTemp != null) { facts.push(`target temperature ${Math.round(a.setTemp)}${u}`); }
    if (a.curTemp != null && a.setTemp != null) local.push(`${Math.round(a.curTemp)}° / ${Math.round(a.setTemp)}°`);
    if (a.setMinutes) facts.push(`cook time set to ${a.setMinutes} minutes`);
    if (i.done && a.doneSince) facts.push(`finished ${agoText(a.now - a.doneSince) || 'just now'} ago`);
    const key = [i.phase, a.remainSec != null ? Math.ceil(a.remainSec / 300) : '-', a.curTemp != null ? Math.round(a.curTemp / 10) : '-',
                 a.doneSince ? Math.floor((a.now - a.doneSince) / 600000) : '-'].join('|');
    return { facts, key, local: local.join(' · ') };
  }

  // ── Completion arbiter ───────────────────────────────────────────
  // Decides whether the fryer has really finished, independent of the
  // (cloud-polled, sometimes stale) status entity. Returns the info the UI
  // should render: rawInfo untouched normally, or a "Done" info once a
  // completion signal has latched.
  //
  //   1. Power draw (optional power_entity): armed once the fryer has been
  //      seen heating (≥ power_on_threshold, default 50 W); a sustained
  //      drop below power_off_threshold (default 5 W) = powered down.
  //      Same thresholds as the "Powers Down" announcement automations.
  //   2. Countdown expiry (fallback): if the local countdown ran out
  //      EXPIRY_GRACE_SEC ago and the status entity still says cooking —
  //      and no power reading contradicts it — call it done rather than
  //      leaving "Finishing…" up indefinitely.
  //
  // The latch clears when the status entity leaves cook/preheat, or (with a
  // power sensor) when heating draw returns, i.e. a genuinely new cook.
  _resolveCompletion(rawInfo, statusObj, now) {
    const cfg = this._config;
    const C   = COMPLETION;
    const raw = rawInfo.phase;
    this._rawPhase = raw;

    const active = raw === 'preheat' || raw === 'cook';

    // Session ends whenever the status entity says anything other than
    // preheat / cook / paused. Pause keeps the session but drops any latch
    // (a fresh "Paused" report is real data) and suspends power judgement,
    // since the fryer legitimately idles there.
    if (!active) {
      if (raw !== 'paused') {
        this._sessionStartTs  = null;
        this._powerSeenActive = false;
      }
      this._doneLatch      = null;
      this._powerLowSince  = null;
      this._powerHighSince = null;
      return rawInfo;
    }

    if (this._sessionStartTs === null) {
      const changedAt = statusObj?.last_changed ? Date.parse(statusObj.last_changed) : NaN;
      this._sessionStartTs = (!isNaN(changedAt) && changedAt <= now) ? changedAt : now;
    }

    // ── Power reading ───────────────────────────────────────────
    const num = (v, d) => { const n = parseFloat(v); return isNaN(n) ? d : n; };
    const offW = num(cfg.power_off_threshold, C.POWER_OFF_W);
    const onW  = num(cfg.power_on_threshold,  C.POWER_ON_W);

    const powerObj = cfg.power_entity ? this._hass?.states[cfg.power_entity] : null;
    let watts = powerObj ? parseFloat(powerObj.state) : NaN;
    if (!isNaN(watts) && /^kw$/i.test(powerObj.attributes?.unit_of_measurement || '')) watts *= 1000;
    const havePower = !isNaN(watts);

    if (havePower) {
      if (watts >= onW) this._powerSeenActive = true;
      this._powerLowSince  = watts < offW ? (this._powerLowSince  ?? now) : null;
      this._powerHighSince = watts >= onW ? (this._powerHighSince ?? now) : null;
    } else {
      // unavailable / no sensor — no evidence either way, never latch on it
      this._powerLowSince  = null;
      this._powerHighSince = null;
    }

    const doneInfo = getFryerInfo('done');

    // ── Already latched: hold until heating draw genuinely returns ──
    if (this._doneLatch) {
      const reheated = this._powerHighSince !== null && (now - this._powerHighSince) >= C.POWER_REARM_MS;
      if (!reheated) return doneInfo;
      this._doneLatch       = null;
      this._forceStartNow   = true;
      this._sessionStartTs  = now;
      this._powerSeenActive = true;
    }

    // ── Signal 1: fryer powered down ────────────────────────────
    if (havePower && this._powerLowSince !== null &&
        (now - this._powerLowSince) >= C.POWER_DEBOUNCE_MS &&
        (this._powerSeenActive || (now - this._sessionStartTs) >= C.POWER_UNARMED_MS)) {
      this._doneLatch = 'power';
      return doneInfo;
    }

    // ── Signal 2: countdown expired and nothing says it's still running ──
    if (raw === 'cook' && this._phaseStartTs !== null && this._phaseTotalSec !== null) {
      const overshoot     = (now - this._phaseStartTs) / 1000 - this._phaseTotalSec;
      const powerSaysBusy = havePower && watts >= offW;
      if (overshoot > C.EXPIRY_GRACE_SEC && !powerSaysBusy) {
        this._doneLatch = 'timer';
        return doneInfo;
      }
    }

    return rawInfo;
  }

  // ── Local countdown ticker ───────────────────────────────────────

  _startTicker() {
    if (this._tickerInterval) return;
    this._tickerInterval = setInterval(() => this._update(), 1000);
  }

  _stopTicker() {
    if (this._tickerInterval) { clearInterval(this._tickerInterval); this._tickerInterval = null; }
  }

  // ── Pill click ─────────────────────────────────────────────────

  _handlePillClick() {
    const cfg    = this._config;
    const hass   = this._hass;
    const plugId = cfg.smart_plug_entity;

    // No plug configured — open info popup
    if (!cfg.smart_plug_enabled || !plugId) { if (this._aiMode()) this._onAiTap(); else this._openStatusPopup(); return; }

    const plugObj = hass?.states[plugId];
    const plugOn  = plugObj?.state === 'on';

    if (plugOn) {
      // Plug is on — ask before turning off (extra-loud warning if mid-cook)
      this._openConfirmOffPopup();
    } else {
      // Plug is off — ask before turning on
      this._openConfirmOnPopup();
    }
  }

  _fireMoreInfo(entityId) {
    if (!entityId) return;
    this.dispatchEvent(new CustomEvent('hass-more-info', {
      bubbles: true, composed: true, detail: { entityId }
    }));
  }

  // Long-press (~0.5s, finger must stay put) → cb. Sets _lpFired so the click
  // that follows the release can be ignored.
  _attachLongPress(el, cb) {
    let timer = null, sx = 0, sy = 0;
    const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
    el.addEventListener('pointerdown', e => {
      if (e.button) return;
      sx = e.clientX; sy = e.clientY; this._lpFired = false;
      clear();
      timer = setTimeout(() => { timer = null; this._lpFired = true; cb(); }, 500);
    });
    el.addEventListener('pointermove', e => {
      if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 10) clear();
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(t => el.addEventListener(t, clear));
    el.addEventListener('contextmenu', e => e.preventDefault());
  }

  // ── Pill flash ─────────────────────────────────────────────────

  _startPillFlash(mode) {
    this._stopPillFlash();
    this._pillFlashState = mode;

    const root       = this.shadowRoot;
    const pillEl     = root.getElementById('af-pill');
    const dotEl      = root.getElementById('af-pill-dot');
    const pillTextEl = root.getElementById('af-pill-text');
    if (!pillEl || !dotEl || !pillTextEl) return;

    const LABEL  = mode === 'on' ? 'Turning On' : 'Turning Off';
    const YELLOW = '#FF9500';
    let flash    = true;

    const apply = () => {
      if (!this._pillFlashState) return;
      pillTextEl.textContent   = LABEL;
      dotEl.style.background   = flash ? YELLOW : 'rgba(255,255,255,0.15)';
      pillEl.style.borderColor = flash ? `${YELLOW}88` : 'rgba(255,255,255,0.08)';
      pillEl.style.color       = flash ? YELLOW : 'rgba(255,255,255,0.30)';
      flash = !flash;
    };

    apply();
    this._pillFlashInterval = setInterval(apply, 600);
  }

  _stopPillFlash() {
    if (this._pillFlashInterval) { clearInterval(this._pillFlashInterval); this._pillFlashInterval = null; }
    this._pillFlashState = null;
    const pillEl = this.shadowRoot.getElementById('af-pill');
    if (pillEl) { pillEl.style.color = ''; pillEl.style.borderColor = ''; }
  }

  // ── Popup base ─────────────────────────────────────────────────

  _closePopup() {
    if (!this._popupOverlay) return;
    const ov = this._popupOverlay;
    ov.style.transition = 'opacity 0.18s ease';
    ov.style.opacity    = '0';
    setTimeout(() => { ov.parentNode?.removeChild(ov); }, 185);
    this._popupOverlay  = null;
  }

  // Theme tokens for popups — they live on document.body, outside the card's
  // shadow root, so the card's CSS variables don't reach them.
  _popupVars() {
    return this._dark
      ? '--af-ink:#fff;--af-ink2:rgba(255,255,255,0.68);--af-line:rgba(255,255,255,0.12);--af-chip:rgba(255,255,255,0.10);' +
        '--af-sheet:linear-gradient(160deg,rgba(70,70,80,0.88),rgba(30,30,36,0.94));--af-sheet-edge:rgba(255,255,255,0.22);'
      : '--af-ink:#1c1c1e;--af-ink2:rgba(60,60,67,0.68);--af-line:rgba(60,60,67,0.14);--af-chip:rgba(120,120,128,0.12);' +
        '--af-sheet:linear-gradient(160deg,rgba(255,255,255,0.92),rgba(244,244,250,0.94));--af-sheet-edge:rgba(255,255,255,0.9);';
  }

  _createPopupBase(titleText) {
    if (this._popupOverlay) return null;

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      ${this._popupVars()}
      position:fixed;inset:0;z-index:9999;box-sizing:border-box;
      display:flex;align-items:flex-end;justify-content:center;
      padding:12px;padding-bottom:max(12px, env(safe-area-inset-bottom));
      background:rgba(0,0,0,${this._dark ? 0.5 : 0.30});
      backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
      animation:afFadeIn 0.2s ease;`;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes afFadeIn  { from{opacity:0} to{opacity:1} }
      @keyframes afSheetUp { from{transform:translateY(40px);opacity:0} to{transform:none;opacity:1} }
      @media (min-width:700px) { .af-overlay-center { align-items:center !important; } }
      .af-popup {
        background:var(--af-sheet);
        border:1px solid var(--af-sheet-edge);
        border-radius:34px;
        box-shadow:0 24px 64px rgba(0,0,0,0.38), inset 0 1px 0 rgba(255,255,255,0.4);
        -webkit-backdrop-filter:blur(40px) saturate(180%);backdrop-filter:blur(40px) saturate(180%);
        padding:20px 20px 20px;
        width:100%;max-width:420px;max-height:88vh;overflow-y:auto;box-sizing:border-box;
        font-family:ui-rounded,'SF Pro Rounded',-apple-system,BlinkMacSystemFont,system-ui,'Segoe UI',sans-serif;
        color:var(--af-ink);
        animation: afSheetUp 0.38s cubic-bezier(0.32,1.1,0.5,1);
      }
      .af-info-row {
        display:flex;align-items:flex-start;justify-content:space-between;
        padding:10px 0;border-bottom:1px solid var(--af-line);
      }
      .af-info-row:last-child { border-bottom:none; }
      .af-info-label { font-size:13px;color:var(--af-ink2);font-weight:500;flex-shrink:0;padding-right:12px; }
      .af-info-value { font-size:13px;font-weight:600;color:var(--af-ink);text-align:right;word-break:break-all; }
      .af-close-btn { background:var(--af-chip);border:none;border-radius:50%;
                      width:32px;height:32px;cursor:pointer;display:flex;align-items:center;justify-content:center;
                      color:var(--af-ink2);padding:0;flex-shrink:0;font-family:inherit; }
      .af-btn { border:none;border-radius:16px;height:50px;padding:0 18px;font-size:17px;font-weight:600;
                cursor:pointer;font-family:inherit;transition:opacity 0.15s,transform 0.1s; }
      .af-btn:active { transform:scale(0.98); }
      .af-btn-cancel  { background:var(--af-chip);color:var(--af-ink); }
      .af-btn-confirm { background:#FF453A;color:#fff; }
      .af-btn-confirm-on { background:#34C759;color:#fff; }
      .af-btn-stack { display:flex;flex-direction:column;gap:10px; }
      .af-glyph { width:60px;height:60px;border-radius:50%;margin:0 auto 14px;display:flex;align-items:center;justify-content:center;
                  background:var(--af-chip);color:var(--af-ink2); }
      .af-glyph svg { width:28px;height:28px;display:block; }
      .af-sec { margin-bottom:16px; }
      .af-sec[hidden] { display:none; }
      .af-sec-label { font-size:11px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:var(--af-ink2);margin-bottom:6px; }
      .af-local { font-size:14px;color:var(--af-ink2);line-height:1.4; }
      .af-ai-text { font-size:17px;line-height:1.4;color:var(--af-ink);font-weight:500; }
      .af-skel { height:14px;border-radius:7px;margin:9px 0;background:linear-gradient(90deg,var(--af-chip) 25%,var(--af-line) 50%,var(--af-chip) 75%);background-size:200% 100%;animation:afShimmer 1.2s linear infinite; }
      @keyframes afShimmer { from{background-position:200% 0} to{background-position:-200% 0} }
      .af-chips-q { display:flex;flex-wrap:wrap;gap:8px; }
      .af-q { border:1px solid var(--af-line);background:var(--af-chip);color:var(--af-ink);border-radius:999px;padding:10px 14px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;text-align:left; }
      .af-q:active { transform:scale(0.98); }
      .af-answer { margin-top:12px;padding:12px 14px;border-radius:16px;background:var(--af-chip); }
      .af-q-title { font-size:12px;font-weight:700;color:var(--af-ink2);margin-bottom:6px; }
      .af-ans-body { font-size:15px;line-height:1.45;color:var(--af-ink); }
      .af-foot { margin-top:14px;font-size:11px;line-height:1.45;color:var(--af-ink2); }
      .af-rows { display:flex;flex-direction:column;border-radius:18px;overflow:hidden;background:var(--af-chip); }
      .af-row { display:flex;align-items:center;gap:14px;width:100%;box-sizing:border-box;padding:15px 16px;background:none;border:none;border-top:1px solid var(--af-line);color:var(--af-ink);font:inherit;font-size:17px;font-weight:500;text-align:left;cursor:pointer; }
      .af-row:first-child { border-top:none; }
      .af-row:active { background:var(--af-line); }
      .af-row svg { width:22px;height:22px;flex-shrink:0;color:var(--af-ink2); }
      .af-row.is-danger, .af-row.is-danger svg { color:#FF453A; }
      .af-stats { display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-bottom:14px; }
      .af-stat { border-radius:16px;background:var(--af-chip);padding:12px 14px; }
      .af-stat b { display:block;font-size:21px;font-weight:700;letter-spacing:-0.02em; }
      .af-stat span { font-size:12px;color:var(--af-ink2); }
      .af-ask-row { display:flex;gap:8px;margin-top:14px; }
      .af-ask-input { flex:1;min-width:0;box-sizing:border-box;height:44px;padding:0 14px;border-radius:22px;border:1px solid var(--af-line);background:var(--af-chip);color:var(--af-ink);font:inherit;font-size:16px; }
      .af-ask-input:focus { outline:none;border-color:#0A84FF; }
      .af-send { width:44px;height:44px;flex-shrink:0;border-radius:50%;border:none;background:#0A84FF;color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer; }
      .af-send svg { width:20px;height:20px; }
      .af-tl-head { font-size:13px;color:var(--af-ink2);margin-bottom:8px;line-height:1.4; }
      .af-tl { display:flex;flex-direction:column;border-radius:16px;background:var(--af-chip);padding:2px 14px;margin-bottom:12px; }
      .af-tl-row { display:flex;align-items:baseline;gap:12px;padding:10px 0;border-top:1px solid var(--af-line); }
      .af-tl-row:first-child { border-top:none; }
      .af-tl-time { width:52px;flex-shrink:0;font-size:14px;font-weight:600;font-variant-numeric:tabular-nums;color:var(--af-ink2); }
      .af-tl-label { flex:1;min-width:0;font-size:16px;font-weight:600; }
      .af-tl-dur { font-size:13px;color:var(--af-ink2);font-variant-numeric:tabular-nums; }
      .af-note { font-size:13px;color:var(--af-ink2);line-height:1.4;margin:0 0 6px; }
    `;
    overlay.classList.add('af-overlay-center');
    overlay.appendChild(style);
    const openedAt = Date.now();   // ignore the tail of the long-press that opened it
    overlay.addEventListener('click', e => { if (e.target === overlay && Date.now() - openedAt > 350) this._closePopup(); });

    const popup = document.createElement('div');
    popup.className = 'af-popup';
    popup.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
    popup.addEventListener('click',     e => e.stopPropagation());

    const hdr = document.createElement('div');
    hdr.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;';
    hdr.innerHTML = `
      <span style="font-size:22px;font-weight:700;letter-spacing:-0.01em;color:var(--af-ink);">${esc(titleText)}</span>
      <button type="button" class="af-close-btn" aria-label="Close">${CLOSE_SVG}</button>`;
    hdr.querySelector('.af-close-btn').addEventListener('click', () => this._closePopup());
    popup.appendChild(hdr);

    overlay.appendChild(popup);
    document.body.appendChild(overlay);
    this._popupOverlay = overlay;
    return popup;
  }

  _addInfoRow(parent, label, value) {
    const row = document.createElement('div');
    row.className = 'af-info-row';
    row.innerHTML = `<span class="af-info-label">${esc(label)}</span>
                     <span class="af-info-value">${esc(value)}</span>`;
    parent.appendChild(row);
  }

  // Shared body for the two confirm sheets
  _confirmBody(glyphSvg, title, html) {
    const body = document.createElement('div');
    body.style.cssText = 'text-align:center;padding:6px 0 20px;';
    body.innerHTML = `
      <div class="af-glyph">${glyphSvg}</div>
      <div style="font-size:19px;font-weight:700;color:var(--af-ink);margin-bottom:8px;line-height:1.25;">${title}</div>
      <div style="font-size:14px;color:var(--af-ink2);line-height:1.5;max-width:280px;margin:0 auto;">${html}</div>`;
    return body;
  }

  // ── Confirm off popup (phase-aware warning) ─────────────────────

  _openConfirmOffPopup() {
    const cfg        = this._config;
    const name       = esc(cfg.friendly_name || 'your air fryer');
    const statusObj  = cfg.status_entity ? this._hass?.states[cfg.status_entity] : null;
    const info       = this._eff?.info ?? getFryerInfo(statusObj?.state || '');
    const midCook    = info.phase === 'cook' || info.phase === 'preheat';

    const popup = this._createPopupBase('Turn Off');
    if (!popup) return;

    popup.appendChild(midCook
      ? this._confirmBody(WARN_SVG, `Still ${info.label.toLowerCase()}`,
          `<strong style="color:var(--af-ink);">${name}</strong> is currently ${info.label.toLowerCase()} — turning it off now will stop the cook. Continue?`)
      : this._confirmBody(FRYER_SVG, 'All done cooking?',
          `Just checking — do you want to turn off <strong style="color:var(--af-ink);">${name}</strong> now?`));

    const btns = document.createElement('div');
    btns.className = 'af-btn-stack';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className   = 'af-btn af-btn-confirm';
    confirmBtn.textContent = midCook ? 'Turn Off Anyway' : 'Turn Off';
    confirmBtn.addEventListener('click', () => {
      this._closePopup();
      if (cfg.smart_plug_entity && this._hass) {
        this._hass.callService('homeassistant', 'turn_off', { entity_id: cfg.smart_plug_entity });
        this._startPillFlash('off');
      }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className   = 'af-btn af-btn-cancel';
    cancelBtn.textContent = 'Not yet';
    cancelBtn.addEventListener('click', () => this._closePopup());

    btns.appendChild(confirmBtn);
    btns.appendChild(cancelBtn);
    popup.appendChild(btns);
  }

  // ── Confirm on popup ───────────────────────────────────────────

  _openConfirmOnPopup() {
    const cfg  = this._config;
    const name = esc(cfg.friendly_name || 'your air fryer');
    const popup = this._createPopupBase('Turn On');
    if (!popup) return;

    popup.appendChild(this._confirmBody(FRYER_SVG, 'Ready to start cooking?',
      `Just checking — do you want to turn on <strong style="color:var(--af-ink);">${name}</strong> now?`));

    const btns = document.createElement('div');
    btns.className = 'af-btn-stack';

    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className   = 'af-btn af-btn-confirm-on';
    confirmBtn.textContent = 'Turn On';
    confirmBtn.addEventListener('click', () => {
      this._closePopup();
      if (cfg.smart_plug_entity && this._hass) {
        this._hass.callService('homeassistant', 'turn_on', { entity_id: cfg.smart_plug_entity });
        this._startPillFlash('on');
      }
    });

    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className   = 'af-btn af-btn-cancel';
    cancelBtn.textContent = 'Not yet';
    cancelBtn.addEventListener('click', () => this._closePopup());

    btns.appendChild(confirmBtn);
    btns.appendChild(cancelBtn);
    popup.appendChild(btns);
  }

  // ── Status info popup ──────────────────────────────────────────

  _openStatusPopup() {
    const cfg  = this._config;
    const hass = this._hass;
    const name = cfg.friendly_name || 'Air Fryer';

    const statusObj      = cfg.status_entity       ? hass?.states[cfg.status_entity]       : null;
    const curTempObj     = cfg.current_temp_entity  ? hass?.states[cfg.current_temp_entity]  : null;
    const setTempObj     = cfg.set_temp_entity      ? hass?.states[cfg.set_temp_entity]      : null;
    const cookTimeObj    = cfg.cook_time_entity     ? hass?.states[cfg.cook_time_entity]     : null;
    const preheatTimeObj = cfg.preheat_time_entity  ? hass?.states[cfg.preheat_time_entity]  : null;
    const powerObj       = cfg.power_entity        ? hass?.states[cfg.power_entity]        : null;
    const statusRaw      = statusObj?.state || '';
    // Same resolved state the card itself is showing (incl. a latched "Done"),
    // so the popup can never disagree with the ring.
    const info            = this._eff?.info ?? getFryerInfo(statusRaw);
    const tempUnit         = resolveTempUnit(cfg, curTempObj);

    // Same "past our own expected finish, status hasn't caught up" check
    // used by the main card, so the popup label matches the pill.
    const popupOvershoot = (info.phase === 'cook' && this._phaseStartTs !== null && this._phaseTotalSec !== null)
      ? ((Date.now() - this._phaseStartTs) / 1000 - this._phaseTotalSec)
      : null;
    const popupIsFinishing = popupOvershoot !== null && popupOvershoot > 3;
    const displayLabel     = popupIsFinishing ? 'Finishing…' : info.label;

    const popup = this._createPopupBase(name);
    if (!popup) return;

    // Mini ring hero — reuses the same phase-aware fraction as the main ring
    const circ = 2 * Math.PI * 24;
    let arcOffset = circ;
    let heroVal = '--', heroUnit = '';

    if (info.done) {
      heroVal = '✓'; heroUnit = 'done'; arcOffset = 0;
    } else if (info.phase === 'preheat') {
      const curTemp = parseFloat(curTempObj?.state), setTemp = parseFloat(setTempObj?.state);
      heroVal  = !isNaN(curTemp) ? `${Math.round(curTemp)}°` : '--';
      heroUnit = !isNaN(setTemp) ? `→ ${Math.round(setTemp)}°` : '';
      if (!isNaN(curTemp) && !isNaN(setTemp) && setTemp > 0) {
        const baseline = (this._phaseStartTemp !== null && this._phaseStartTemp < setTemp) ? this._phaseStartTemp : 0;
        const span      = setTemp - baseline;
        const fraction  = span > 0 ? Math.min(1, Math.max(0, (curTemp - baseline) / span)) : 1;
        arcOffset = circ * (1 - fraction);
      } else {
        arcOffset = 0;
      }
    } else if ((info.phase === 'cook' || info.phase === 'paused') && this._lastRemainSec !== null) {
      heroVal  = formatCountdown(this._lastRemainSec);
      heroUnit = info.phase === 'paused' ? 'paused' : (popupIsFinishing ? 'finishing…' : 'left');
      if (this._phaseTotalSec) {
        arcOffset = circ * (1 - Math.min(1, Math.max(0, this._lastRemainSec / this._phaseTotalSec)));
      }
    }

    const hero = document.createElement('div');
    hero.style.cssText = 'display:flex;align-items:center;gap:14px;margin-bottom:16px;';
    hero.innerHTML = `
      <div style="position:relative;width:60px;height:60px;flex-shrink:0;">
        <svg viewBox="0 0 60 60" width="60" height="60" style="display:block;">
          <circle cx="30" cy="30" r="24" fill="none"
            stroke="var(--af-line)" stroke-width="3.5"/>
          <circle cx="30" cy="30" r="24" fill="none"
            stroke="${phaseColors(info, this._dark, cfg.colors).dot}" stroke-width="3.5" stroke-linecap="round"
            style="stroke-dasharray:${circ.toFixed(2)};stroke-dashoffset:${arcOffset.toFixed(2)};
                   transform:rotate(-90deg);transform-origin:30px 30px;"/>
        </svg>
        <div style="position:absolute;inset:0;display:flex;flex-direction:column;
                    align-items:center;justify-content:center;gap:1px;">
          <span style="font-size:14px;font-weight:700;color:var(--af-ink);line-height:1;">${heroVal}</span>
          ${heroUnit ? `<span style="font-size:8px;color:var(--af-ink2);">${heroUnit}</span>` : ''}
        </div>
      </div>
      <div style="flex:1;min-width:0;">
        <div style="font-size:20px;font-weight:700;color:var(--af-ink);
                    margin-bottom:6px;line-height:1;">${displayLabel}</div>
        <span style="font-size:9px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;
                     padding:2px 7px;border-radius:20px;border:1px solid;
                     color:var(--af-ink2);
                     border-color:var(--af-line);
                     background:var(--af-chip);">${name}</span>
      </div>`;
    popup.appendChild(hero);

    const table = document.createElement('div');
    table.style.cssText = 'border-top:1px solid var(--af-line);padding-top:4px;';
    popup.appendChild(table);

    if (statusObj) {
      const attrs = statusObj.attributes || {};
      if (attrs.friendly_name) this._addInfoRow(table, 'Device', attrs.friendly_name);
      this._addInfoRow(table, 'Status', statusObj.state);
    }
    if (curTempObj)     this._addInfoRow(table, 'Current Temp', `${curTempObj.state}${tempUnit}`);
    if (setTempObj)     this._addInfoRow(table, 'Set Temp',     `${setTempObj.state}${tempUnit}`);
    if (cookTimeObj)    this._addInfoRow(table, 'Cook Time',    `${cookTimeObj.state} min`);
    if (preheatTimeObj) this._addInfoRow(table, 'Preheat Time', `${preheatTimeObj.state} min`);
    if (powerObj)       this._addInfoRow(table, 'Power',        `${powerObj.state} ${powerObj.attributes?.unit_of_measurement || 'W'}`);
    if (this._doneLatch) {
      this._addInfoRow(table, 'Finish Detected',
        this._doneLatch === 'power'
          ? `Power draw dropped (status sensor still says "${statusRaw}")`
          : `Countdown expired (status sensor still says "${statusRaw}")`);
    }

    if (cfg.status_entity)       this._addInfoRow(table, 'Status Entity',       cfg.status_entity);
    if (cfg.current_temp_entity) this._addInfoRow(table, 'Current Temp Entity', cfg.current_temp_entity);
    if (cfg.set_temp_entity)     this._addInfoRow(table, 'Set Temp Entity',     cfg.set_temp_entity);
    if (cfg.cook_time_entity)    this._addInfoRow(table, 'Cook Time Entity',    cfg.cook_time_entity);
    if (cfg.preheat_time_entity) this._addInfoRow(table, 'Preheat Time Entity', cfg.preheat_time_entity);
    if (cfg.power_entity)        this._addInfoRow(table, 'Power Entity',        cfg.power_entity);
    if (cfg.smart_plug_entity)   this._addInfoRow(table, 'Smart Plug',          cfg.smart_plug_entity);

    if (statusObj) {
      this._addInfoRow(table, 'Last Changed', timeAgo(statusObj.last_changed));
      this._addInfoRow(table, 'Last Updated', timeAgo(statusObj.last_updated));
      const skip = new Set(['friendly_name', 'unit_of_measurement', 'icon', 'device_class', 'state_class', 'restored']);
      Object.entries(statusObj.attributes || {}).forEach(([k, v]) => {
        if (skip.has(k)) return;
        if (typeof v === 'string' || typeof v === 'number') {
          this._addInfoRow(table, k.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), v);
        }
      });
    } else if (!cfg.status_entity) {
      this._addInfoRow(table, 'Notice', 'No entities configured');
    }

    // Plug control lives here too, so every layout can reach it
    if (cfg.smart_plug_enabled && cfg.smart_plug_entity) {
      const plugIsOn = hass?.states[cfg.smart_plug_entity]?.state === 'on';
      const plugBtn  = document.createElement('button');
      plugBtn.type = 'button';
      plugBtn.className = `af-btn ${plugIsOn ? 'af-btn-confirm' : 'af-btn-confirm-on'}`;
      plugBtn.style.cssText = 'width:100%;margin-top:16px;';
      plugBtn.textContent = plugIsOn ? 'Turn Off…' : 'Turn On…';
      plugBtn.addEventListener('click', () => { this._closePopup(); this._handlePillClick(); });
      popup.appendChild(plugBtn);
    }
  }

  getCardSize() { return { dial: 4, timer: 4, tile: 2, pill: 1 }[this._layout] || 4; }
}



// ═══════════════════════════════════════════════════════════════════
//  EDITOR — layout picker thumbnails
// ═══════════════════════════════════════════════════════════════════

const _thumb = inner => `
  <svg viewBox="0 0 96 64" aria-hidden="true">
    <defs>
      <linearGradient id="lt-bg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6a4bdc"/><stop offset="0.55" stop-color="#e4597f"/><stop offset="1" stop-color="#ff9b3d"/>
      </linearGradient>
      <linearGradient id="lt-a" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FFC15A"/><stop offset="1" stop-color="#FF8A1F"/>
      </linearGradient>
    </defs>
    <rect width="96" height="64" rx="10" fill="url(#lt-bg)"/>
    ${inner}
  </svg>`;
const _glass = (x, y, w, h, r) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="rgba(255,255,255,0.28)" stroke="rgba(255,255,255,0.55)" stroke-width="0.8"/>`;

const PHASE_ROWS = [['preheat', 'Heating'], ['cook', 'Cooking'], ['done', 'Done'], ['paused', 'Paused'], ['idle', 'Idle']];
const PRESET_KEYS = ['preheat', 'cook', 'done', 'paused'];   // presets leave Idle alone
const IDLE_DEFAULT_HEX = '#8e8e93';                            // swatch shown when Idle is left neutral

const LAYOUT_OPTIONS = [
  { id: 'dial', name: 'Glass Dial', sub: 'Square · ring + corners', svg: _thumb(
      _glass(25, 9, 46, 46, 11) +
      `<rect x="30" y="14" width="10" height="3.5" rx="1.7" fill="rgba(255,255,255,0.85)"/><rect x="54" y="13" width="12" height="5" rx="2.5" fill="rgba(255,255,255,0.5)"/>` +
      `<circle cx="48" cy="32" r="11" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="3"/>` +
      `<circle cx="48" cy="32" r="11" fill="none" stroke="url(#lt-a)" stroke-width="3" stroke-linecap="round" stroke-dasharray="42 100" transform="rotate(-90 48 32)"/>` +
      `<rect x="29" y="45" width="15" height="6" rx="3" fill="rgba(255,255,255,0.5)"/><rect x="52" y="45" width="15" height="6" rx="3" fill="rgba(255,255,255,0.5)"/>`) },
  { id: 'pill', name: 'Live Activity', sub: 'One row · long-press for details', svg: _thumb(
      _glass(8, 22, 80, 20, 10) +
      `<circle cx="20" cy="32" r="6" fill="rgba(255,255,255,0.4)"/>` +
      `<rect x="31" y="26" width="22" height="4" rx="2" fill="rgba(255,255,255,0.85)"/><rect x="31" y="33" width="30" height="3" rx="1.5" fill="rgba(255,255,255,0.4)"/>` +
      `<rect x="68" y="27" width="14" height="6" rx="3" fill="rgba(255,255,255,0.8)"/>`) },
  { id: 'tile', name: 'Tile', sub: 'Compact · fills as it cooks', svg: _thumb(
      `<clipPath id="lt-c"><rect x="16" y="17" width="64" height="30" rx="9"/></clipPath>` +
      _glass(16, 17, 64, 30, 9) +
      `<rect x="16" y="35" width="64" height="12" fill="url(#lt-a)" opacity="0.85" clip-path="url(#lt-c)"/>` +
      `<circle cx="29" cy="32" r="7" fill="rgba(255,255,255,0.45)"/>` +
      `<rect x="41" y="24" width="20" height="3.5" rx="1.7" fill="rgba(255,255,255,0.6)"/><rect x="41" y="31" width="30" height="7" rx="3" fill="rgba(255,255,255,0.9)"/>`) },
  { id: 'timer', name: 'Timer', sub: 'Square · big countdown', svg: _thumb(
      _glass(25, 9, 46, 46, 11) +
      `<rect x="30" y="14" width="10" height="3.5" rx="1.7" fill="rgba(255,255,255,0.85)"/><rect x="54" y="13" width="12" height="5" rx="2.5" fill="rgba(255,255,255,0.5)"/>` +
      `<circle cx="48" cy="32" r="13" fill="none" stroke="rgba(255,255,255,0.3)" stroke-width="0.9"/>` +
      `<circle cx="48" cy="32" r="13" fill="none" stroke="url(#lt-a)" stroke-width="1.1" stroke-linecap="round" stroke-dasharray="48 100" transform="rotate(-90 48 32)"/>` +
      `<text x="48" y="36" text-anchor="middle" font-size="11" font-weight="200" fill="#fff" font-family="system-ui,sans-serif">7:02</text>` +
      `<rect x="29" y="45" width="15" height="6" rx="3" fill="rgba(255,255,255,0.5)"/><rect x="52" y="45" width="15" height="6" rx="3" fill="rgba(255,255,255,0.5)"/>`) },
];

// ═══════════════════════════════════════════════════════════════════
//  EDITOR
// ═══════════════════════════════════════════════════════════════════

class AntAirfryerCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config      = {};
    this._hass        = null;
    this._initialized = false;
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) this._render();
  }

  setConfig(config) {
    this._config = { ...AntAirfryerCard.getStubConfig(), ...config };
    if (!this._initialized && this._hass) this._render();
    else if (this._initialized) this._syncUI();
  }

  // ── Helpers ────────────────────────────────────────────────────

  _getName(entityId) {
    return this._hass?.states[entityId]?.attributes?.friendly_name || entityId;
  }

  _scoreEntity(id, fn, kws) {
    const i = id.toLowerCase(), n = fn.toLowerCase();
    return kws.reduce((s, k) => s + (i.includes(k) || n.includes(k) ? 1 : 0), 0);
  }

  _buildOptions(candidates, pool, sel) {
    const cs  = new Set(candidates.map(c => c.e));
    const sug = candidates.map(({ e, score }) =>
      `<option value="${e}" ${e === sel ? 'selected' : ''}>${score > 0 ? '★ ' : ''}${this._getName(e)} (${e})</option>`).join('');
    const rest = pool.filter(e => !cs.has(e)).map(e =>
      `<option value="${e}" ${e === sel ? 'selected' : ''}>${this._getName(e)} (${e})</option>`).join('');
    return `<option value="">— None —</option>${sug}${sug && rest ? '<option disabled>──────────────────</option>' : ''}${rest}`;
  }

  _scored(pool, kws) {
    return pool
      .map(e => ({ e, score: this._scoreEntity(e, this._getName(e), kws) }))
      .sort((a, b) => b.score - a.score || a.e.localeCompare(b.e));
  }

  // ── Render ─────────────────────────────────────────────────────

  _render() {
    if (!this._hass || !this._config) return;
    this._initialized = true;

    const cfg         = this._config;
    const allEntities = Object.keys(this._hass.states).sort();
    const allSensors  = allEntities.filter(e => e.startsWith('sensor.'));
    const allSwitches = allEntities.filter(e => e.startsWith('switch.') || e.startsWith('input_boolean.'));

    const fryerKws    = ['fryer', 'airfryer', 'air_fryer', 'cosori', 'vesync', 'leonard', 'lucy'];
    const statusKws   = [...fryerKws, 'cooking', 'status', 'state', 'program', 'phase'];
    const curTempKws  = [...fryerKws, 'current', 'temperature', 'temp'];
    const setTempKws  = [...fryerKws, 'set', 'target', 'temperature', 'temp'];
    const cookTimeKws = [...fryerKws, 'cooking', 'time', 'duration', 'minutes'];
    const preheatKws  = [...fryerKws, 'preheat', 'preheating', 'heat', 'heating', 'time'];
    const plugKws     = ['plug', 'socket', 'outlet', 'power', 'tasmota', 'shelly', 'tp_link',
                          'kasa', 'sonoff', 'wemo', 'hue_plug', 'ikea_outlet', 'smart_plug'];

    // Power sensor pool — prefer real power sensors (device_class power / W / kW);
    // fall back to every sensor if none are found.
    const isPowerSensor = e => {
      const a = this._hass.states[e]?.attributes || {};
      return a.device_class === 'power' || /^k?w$/i.test(a.unit_of_measurement || '');
    };
    const powerPoolRaw = allSensors.filter(isPowerSensor);
    const powerPool    = powerPoolRaw.length ? powerPoolRaw : allSensors;
    const powerKws     = [...fryerKws, 'power', 'watt', 'consumption'];

    const statusCandidates   = this._scored(allSensors, statusKws);
    const curTempCandidates  = this._scored(allSensors, curTempKws);
    const setTempCandidates  = this._scored(allSensors, setTempKws);
    const cookTimeCandidates = this._scored(allSensors, cookTimeKws);
    const preheatCandidates  = this._scored(allSensors, preheatKws);

    const fryerName = (cfg.status_entity
      ? (this._hass.states[cfg.status_entity]?.attributes?.friendly_name || cfg.status_entity)
      : '').toLowerCase();
    const plugCandidates = allSwitches.map(e => {
      let score = this._scoreEntity(e, this._getName(e), plugKws);
      if (fryerName) fryerName.split(/\W+/).filter(w => w.length > 3).forEach(w => {
        if (e.toLowerCase().includes(w) || this._getName(e).toLowerCase().includes(w)) score += 2;
      });
      return { e, score };
    }).sort((a, b) => b.score - a.score || a.e.localeCompare(b.e));

    // Power candidates: boost sensors that share a distinctive token (e.g. the
    // "1" in air_fryer_1) with the chosen status entity, so Leonard's card
    // doesn't get Lucy's power sensor.
    const GENERIC = new Set(['sensor', 'air', 'fryer', 'airfryer', 'cooking', 'status', 'state',
                             'current', 'temperature', 'temp', 'time', 'set', 'preheat', 'heat', 'heating', 'power', 'the']);
    const tokens = str => new Set(String(str).toLowerCase().split(/[^a-z0-9]+/).filter(t => t && !GENERIC.has(t)));
    const statusTokens = cfg.status_entity
      ? new Set([...tokens(cfg.status_entity.split('.')[1] || ''), ...tokens(fryerName)])
      : new Set();
    const powerCandidates = powerPool.map(e => {
      let score = this._scoreEntity(e, this._getName(e), powerKws);
      if (isPowerSensor(e)) score += 3;
      const cand = new Set([...tokens(e.split('.')[1] || ''), ...tokens(this._getName(e))]);
      statusTokens.forEach(t => { if (cand.has(t)) score += 2; });
      return { e, score };
    }).sort((a, b) => b.score - a.score || a.e.localeCompare(b.e));

    // Auto-select best candidates (plug scored but never forced — too risky to auto-switch)
    const autoSelect = (key, candidates) => {
      if (!cfg[key]) {
        const best = candidates.find(x => x.score > 0);
        if (best) { cfg[key] = best.e; this._dispatch(); }
      }
    };
    autoSelect('status_entity',       statusCandidates);
    autoSelect('current_temp_entity', curTempCandidates);
    autoSelect('set_temp_entity',     setTempCandidates);
    autoSelect('cook_time_entity',    cookTimeCandidates);
    autoSelect('preheat_time_entity', preheatCandidates);
    autoSelect('smart_plug_entity',   plugCandidates);
    // Power sensor: a wrong pick would end the countdown early, so only
    // auto-select when there is a single clear winner (never on a tie).
    if (!cfg.power_entity) {
      const [a, b] = powerCandidates;
      if (a && a.score >= 6 && (!b || a.score > b.score)) { cfg.power_entity = a.e; this._dispatch(); }
    }

    const statusOpts   = this._buildOptions(statusCandidates,   allSensors,  cfg.status_entity       || '');
    const curTempOpts  = this._buildOptions(curTempCandidates,  allSensors,  cfg.current_temp_entity || '');
    const setTempOpts  = this._buildOptions(setTempCandidates,  allSensors,  cfg.set_temp_entity     || '');
    const cookTimeOpts = this._buildOptions(cookTimeCandidates, allSensors,  cfg.cook_time_entity    || '');
    const preheatOpts  = this._buildOptions(preheatCandidates,  allSensors,  cfg.preheat_time_entity || '');
    const plugOpts     = this._buildOptions(plugCandidates,     allSwitches, cfg.smart_plug_entity   || '');
    const powerOpts    = this._buildOptions(powerCandidates,    powerPool,   cfg.power_entity        || '');

    this.shadowRoot.innerHTML = `
      <style>${EDITOR_STYLES}</style>
      <div class="container">

        <!-- Layout -->
        <div>
          <div class="section-title">Layout</div>
          <div class="card-block">
            <div class="layout-grid">
              ${LAYOUT_OPTIONS.map(o => `
                <button type="button" class="layout-opt" data-layout="${o.id}" aria-pressed="false">
                  ${o.svg}
                  <span class="lo-name">${o.name}</span>
                  <span class="lo-sub">${o.sub}</span>
                </button>`).join('')}
            </div>
          </div>
        </div>

        <!-- Appearance -->
        <div>
          <div class="section-title">Appearance</div>
          <div class="card-block">
            <div class="select-row">
              <label>Theme</label>
              <div class="hint">Auto follows your Home Assistant theme</div>
              <div class="seg" id="appearance_seg">
                <button type="button" class="seg-btn" data-appearance="auto">Auto</button>
                <button type="button" class="seg-btn" data-appearance="light">Light</button>
                <button type="button" class="seg-btn" data-appearance="dark">Dark</button>
              </div>
            </div>
            <div class="select-row">
              <label>Size</label>
              <div class="hint">Compact matches standard iOS widget sizing; Regular is about 20% larger</div>
              <div class="seg" id="size_seg">
                <button type="button" class="seg-btn" data-size="compact">Compact</button>
                <button type="button" class="seg-btn" data-size="regular">Regular</button>
              </div>
            </div>
            <div class="select-row">
              <label>Animations</label>
              <div class="hint">Subtle animates only what matters. System is Subtle but stays still if your iPhone's Reduce Motion is on.</div>
              <div class="seg" id="anim_seg">
                <button type="button" class="seg-btn" data-anim="subtle">Subtle</button>
                <button type="button" class="seg-btn" data-anim="full">Full</button>
                <button type="button" class="seg-btn" data-anim="off">Off</button>
                <button type="button" class="seg-btn" data-anim="system">System</button>
              </div>
            </div>
            <div class="select-row">
              <label for="glass">Glass</label>
              <div class="hint">How see-through the card is (needs a wallpaper or coloured view behind it)</div>
              <div class="range-row">
                <span>Clear</span>
                <input type="range" id="glass" min="0" max="100" step="5" value="${Number.isFinite(parseFloat(cfg.glass)) ? parseFloat(cfg.glass) : 50}">
                <span>Frosted</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Display -->
        <div>
          <div class="section-title">Card</div>
          <div class="card-block">
            <div class="toggle-list">
              <div class="toggle-item">
                <div>
                  <div class="toggle-label">Show Name</div>
                  <div class="toggle-desc">Display the fryer name in the card header</div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="show_name" ${cfg.show_name !== false ? 'checked' : ''}>
                  <span class="toggle-track"></span>
                </label>
              </div>
            </div>
            <div class="text-row" id="name_row"
              style="${cfg.show_name !== false ? '' : 'display:none'}">
              <label for="friendly_name">Display Name</label>
              <div class="hint">Shown in the card header</div>
              <input type="text" id="friendly_name"
                placeholder="Air Fryer" value="${cfg.friendly_name || ''}">
            </div>
            <div class="select-row" style="border-top:1px solid rgba(128,128,128,0.08);">
              <label for="temp_unit_override">Temperature Unit</label>
              <div class="hint">Auto uses the sensor's own unit if available</div>
              <select id="temp_unit_override">
                <option value="auto" ${(!cfg.temp_unit_override || cfg.temp_unit_override === 'auto') ? 'selected' : ''}>Auto</option>
                <option value="f" ${cfg.temp_unit_override === 'f' ? 'selected' : ''}>°F</option>
                <option value="c" ${cfg.temp_unit_override === 'c' ? 'selected' : ''}>°C</option>
              </select>
            </div>
          </div>
        </div>

        <!-- Entities -->
        <div>
          <div class="section-title">Entities</div>
          <div class="card-block">
            <div class="select-row">
              <label for="status_entity">Cooking Status</label>
              <div class="hint">★ auto-detected · sensor for phase (Heating, Cooking, Idle…)</div>
              <input type="text" class="entity-search" id="status_search" placeholder="Search sensors…">
              <select id="status_entity">${statusOpts}</select>
            </div>
            <div class="select-row">
              <label for="current_temp_entity">Current Temperature <span class="badge-optional">Optional</span></label>
              <div class="hint">★ auto-detected · drives the preheat ring</div>
              <input type="text" class="entity-search" id="current_temp_search" placeholder="Search sensors…">
              <select id="current_temp_entity">${curTempOpts}</select>
            </div>
            <div class="select-row">
              <label for="set_temp_entity">Set Temperature <span class="badge-optional">Optional</span></label>
              <div class="hint">★ auto-detected · preheat target</div>
              <input type="text" class="entity-search" id="set_temp_search" placeholder="Search sensors…">
              <select id="set_temp_entity">${setTempOpts}</select>
            </div>
            <div class="select-row">
              <label for="cook_time_entity">Cook Time <span class="badge-optional">Optional</span></label>
              <div class="hint">★ auto-detected · minutes · drives the cook countdown ring</div>
              <input type="text" class="entity-search" id="cook_time_search" placeholder="Search sensors…">
              <select id="cook_time_entity">${cookTimeOpts}</select>
            </div>
            <div class="select-row">
              <label for="preheat_time_entity">Preheat Time <span class="badge-optional">Optional</span></label>
              <div class="hint">★ auto-detected · minutes · shown in the info popup</div>
              <input type="text" class="entity-search" id="preheat_time_search" placeholder="Search sensors…">
              <select id="preheat_time_entity">${preheatOpts}</select>
            </div>
            <div class="select-row">
              <label for="power_entity">Power Sensor <span class="badge-optional">Optional</span></label>
              <div class="hint">Watts · lets the card detect the fryer powering down (under 5 W), so the countdown stops even if the status sensor lags. Pick this fryer's own plug sensor.</div>
              <input type="text" class="entity-search" id="power_search" placeholder="Search sensors…">
              <select id="power_entity">${powerOpts}</select>
            </div>
          </div>
        </div>

        <!-- Smart Plug -->
        <div>
          <div class="section-title">Smart Plug <span class="badge-optional">Optional</span></div>
          <div class="card-block">
            <div class="toggle-list">
              <div class="toggle-item">
                <div>
                  <div class="toggle-label">Enable Plug Control</div>
                  <div class="toggle-desc">Tap status pill to power the fryer on or off</div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="smart_plug_enabled"
                    ${cfg.smart_plug_enabled ? 'checked' : ''}>
                  <span class="toggle-track"></span>
                </label>
              </div>
            </div>
            <div id="plug_entity_row"
              style="${cfg.smart_plug_enabled ? '' : 'display:none'}">
              <div class="select-row" style="border-top:1px solid rgba(128,128,128,0.08);">
                <label for="smart_plug_entity">Plug / Switch</label>
                <div class="hint">★ auto-detected · switches &amp; input booleans · green dot = on, red = off</div>
                <input type="text" class="entity-search" id="plug_search" placeholder="Search switches…">
                <select id="smart_plug_entity">${plugOpts}</select>
                <div class="hint" style="margin-top:2px;">
                  Pill tap when <strong>off</strong> → turns plug on &nbsp;·&nbsp;
                  Pill tap when <strong>on</strong> → asks before turning off
                  (extra warning if mid-cook)
                </div>
              </div>
            </div>
          </div>
        </div>

${this._aiMarkup()}
        <!-- Colours -->
        <div>
          <div class="section-title">Colours</div>
          <div class="card-block">
            <div class="select-row">
              <label>Preset</label>
              <div class="hint">One tap sets all four colours — then adjust any of them below</div>
              <div class="preset-grid" id="preset_grid">
                ${COLOR_PRESETS.map(pr => `
                  <button type="button" class="preset-opt" data-preset="${pr.id}" aria-pressed="false">
                    <span class="preset-dots">${['preheat', 'cook', 'done', 'paused'].map(k =>
                      `<i style="background:${(pr.colors && pr.colors[k]) || DEFAULT_PHASE_BASE[k]}"></i>`).join('')}</span>
                    ${pr.name}
                  </button>`).join('')}
              </div>
            </div>
            ${PHASE_ROWS.map(([k, label]) => `
              <div class="select-row color-row">
                <div class="color-info"><label for="color_${k}">${label}</label><div class="hint" id="hint_${k}">Default</div></div>
                <div class="color-prev" title="Dark theme / light theme">
                  <span class="pv" id="pvd_${k}">Aa</span><span class="pv" id="pvl_${k}">Aa</span>
                </div>
                <input type="color" id="color_${k}" value="${DEFAULT_PHASE_BASE[k] || IDLE_DEFAULT_HEX}">
                <button type="button" class="reset-btn" id="reset_${k}" hidden>Reset</button>
              </div>`).join('')}
            <div class="select-row">
              <div class="hint">Colours are adjusted automatically so they stay readable in both light and dark themes. The two “Aa” swatches preview each colour on a dark (left) and light (right) card. Idle stays neutral grey unless you pick a colour for it. Errors are always red.</div>
            </div>
          </div>
        </div>

      </div>`;

    this._syncUI();
    this._attachListeners();
    this._wireSearches(statusCandidates,   allSensors,
                        curTempCandidates, allSensors,
                        setTempCandidates, allSensors,
                        cookTimeCandidates, allSensors,
                        preheatCandidates, allSensors,
                        plugCandidates,    allSwitches,
                        powerCandidates,   powerPool);
  }

  // ── Sync UI to config ──────────────────────────────────────────

  _syncUI() {
    const root = this.shadowRoot;
    const cfg  = this._config;
    const set  = (id, val) => { const el = root.getElementById(id); if (el) el.value = val ?? ''; };
    const chk  = (id, val) => { const el = root.getElementById(id); if (el) el.checked = !!val; };

    set('friendly_name',        cfg.friendly_name        || '');
    set('status_entity',        cfg.status_entity        || '');
    set('current_temp_entity',  cfg.current_temp_entity  || '');
    set('set_temp_entity',      cfg.set_temp_entity      || '');
    set('cook_time_entity',     cfg.cook_time_entity     || '');
    set('preheat_time_entity',  cfg.preheat_time_entity  || '');
    set('temp_unit_override',   cfg.temp_unit_override   || 'auto');
    set('smart_plug_entity',    cfg.smart_plug_entity    || '');
    set('power_entity',         cfg.power_entity         || '');
    chk('show_name',            cfg.show_name !== false);
    chk('smart_plug_enabled',   cfg.smart_plug_enabled === true);

    const layout = LAYOUTS.includes(cfg.layout) ? cfg.layout : 'dial';
    root.querySelectorAll('.layout-opt').forEach(b => {
      const on = b.dataset.layout === layout;
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const appearance = cfg.appearance || 'auto';
    root.querySelectorAll('.seg-btn[data-appearance]').forEach(b => b.classList.toggle('is-selected', b.dataset.appearance === appearance));
    const size = cfg.size === 'regular' ? 'regular' : 'compact';
    root.querySelectorAll('.seg-btn[data-size]').forEach(b => b.classList.toggle('is-selected', b.dataset.size === size));
    const anim = ['off', 'full', 'system'].includes(cfg.animation) ? cfg.animation : 'subtle';   // legacy "auto" shows as Subtle
    root.querySelectorAll('.seg-btn[data-anim]').forEach(b => b.classList.toggle('is-selected', b.dataset.anim === anim));
    const g = parseFloat(cfg.glass);
    set('glass', Number.isFinite(g) ? g : 50);
    this._syncColors();
    this._aiSync();
  }

  // Colour rows + preset highlight
  _syncColors() {
    const root = this.shadowRoot, cols = this._config.colors || {};
    const hex6 = v => { let h = v.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return '#' + h.toLowerCase(); };
    const eff = {};
    PHASE_ROWS.forEach(([k]) => {
      const custom = isHex(cols[k]) ? hex6(cols[k]) : null;
      const base   = custom || hex6(DEFAULT_PHASE_BASE[k] || IDLE_DEFAULT_HEX);
      eff[k] = base;
      const input = root.getElementById(`color_${k}`);
      if (input) input.value = base;
      const hint  = root.getElementById(`hint_${k}`);
      if (hint) hint.textContent = custom ? custom.toUpperCase() : 'Default';
      const reset = root.getElementById(`reset_${k}`);
      if (reset) reset.hidden = !custom;
      this._paintPreview(k, base, k === 'idle' && !custom);
    });
    root.querySelectorAll('.preset-opt').forEach(b => {
      const pr = COLOR_PRESETS.find(x => x.id === b.dataset.preset);
      const target = { ...DEFAULT_PHASE_BASE, ...(pr.colors || {}) };
      const on = PRESET_KEYS.every(k => hex6(target[k]) === eff[k]);
      b.classList.toggle('is-selected', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }

  // Dark + light "Aa" swatches show the tuned result for a colour
  _paintPreview(k, base, neutral = false) {
    const root = this.shadowRoot;
    const d = root.getElementById(`pvd_${k}`), l = root.getElementById(`pvl_${k}`);
    const txt = dark => neutral ? NEUTRAL_COLORS[dark ? 'dark' : 'light'].text : tuneColor(base, dark).text;
    if (d) { d.style.background = SURFACE.dark;  d.style.color = txt(true); }
    if (l) { l.style.background = SURFACE.light; l.style.color = txt(false); }
  }

  // ⟦AI:EDITOR⟧
  // ── AI Features section (shared) ───────────────────────────────

  _aiMarkup() {
    const cfg = this._config;
    const on  = cfg.ai_features_enabled === true;
    const tog = (id, label, desc, checked) => `
              <div class="toggle-item">
                <div>
                  <div class="toggle-label">${label}</div>
                  <div class="toggle-desc">${desc}</div>
                </div>
                <label class="toggle-switch">
                  <input type="checkbox" id="${id}" ${checked ? 'checked' : ''}>
                  <span class="toggle-track"></span>
                </label>
              </div>`;
    return `
        <!-- AI -->
        <div>
          <div class="section-title">AI Features <span class="badge-optional">Optional</span></div>
          <div class="card-block">
            <div class="toggle-list">
              ${tog('ai_features_enabled', 'Enable AI features',
                    'Tap the card for an AI status line and quick questions. Long-press for actions: details, power, ask, this week.', on)}
            </div>
            <div id="ai_rows" style="${on ? '' : 'display:none'}">
              <div class="select-row" style="border-top:1px solid rgba(128,128,128,0.10);">
                <label for="ai_conversation_agent">Conversation agent</label>
                <div class="hint">Set one up in Settings → Voice assistants (e.g. Google Generative AI or OpenAI). AI stays off until you choose one.</div>
                <select id="ai_conversation_agent"><option value="">Choose an agent…</option></select>
              </div>
              <div class="toggle-list" style="border-top:1px solid rgba(128,128,128,0.10);">
                ${tog('ai_enable_tap',  'Tap assistant', 'Status line and next step', cfg.ai_enable_tap  !== false)}
                ${tog('ai_enable_ask',  'Ask AI',        'Type a question from the long-press sheet',            cfg.ai_enable_ask  !== false)}
                ${tog('ai_enable_recap', 'What happened?', 'Latest run as a timeline with notes and a short summary', cfg.ai_enable_recap !== false)}
                ${tog('ai_enable_week', 'This week',     'Runs, time and energy from history, with a short summary', cfg.ai_enable_week !== false)}
              </div>
            </div>
          </div>
        </div>`;
  }

  // Display-only: never writes config (only the user's own changes do)
  _aiSync() {
    const root = this.shadowRoot, cfg = this._config;
    const chk = (id, v) => { const el = root.getElementById(id); if (el) el.checked = !!v; };
    chk('ai_features_enabled', cfg.ai_features_enabled === true);
    chk('ai_enable_tap',  cfg.ai_enable_tap  !== false);
    chk('ai_enable_ask',  cfg.ai_enable_ask  !== false);
    chk('ai_enable_week', cfg.ai_enable_week !== false);
    chk('ai_enable_recap', cfg.ai_enable_recap !== false);
    const rows = root.getElementById('ai_rows');
    if (rows) rows.style.display = cfg.ai_features_enabled === true ? '' : 'none';
    this._aiLoadAgents();
  }

  _aiLoadAgents() {
    const sel = this.shadowRoot.getElementById('ai_conversation_agent');
    if (!sel || !this._hass?.connection) return;
    const saved = this._config.ai_conversation_agent || '';
    if (this._aiAgentsLoaded) { sel.value = saved; return; }
    this._aiAgentsLoaded = true;
    this._hass.connection.sendMessagePromise({ type: 'conversation/agent/list' }).then(resp => {
      const cur = this._config.ai_conversation_agent || '';
      const agents = (resp?.agents || []).filter(a => {
        const id = (a.id || '').toLowerCase(), nm = (a.name || '').toLowerCase();
        return a.id !== 'conversation.home_assistant' && !id.includes('assistant_sdk') && !id.includes('google_assistant') && !nm.includes('sdk');
      });
      const opts = ['<option value="">Choose an agent…</option>'];
      agents.forEach(a => opts.push(`<option value="${esc(a.id)}">${esc(a.name || a.id)}</option>`));
      if (cur && !agents.some(a => a.id === cur)) opts.push(`<option value="${esc(cur)}">${esc(this._getName(cur))}</option>`);   // never let a saved choice vanish
      sel.innerHTML = opts.join('');
      sel.value = cur;
    }).catch(() => { this._aiAgentsLoaded = false; });
  }

  _aiListen() {
    const root = this.shadowRoot, get = id => root.getElementById(id);
    get('ai_features_enabled').addEventListener('change', e => {
      this._set('ai_features_enabled', e.target.checked);
      const rows = get('ai_rows'); if (rows) rows.style.display = e.target.checked ? '' : 'none';
    });
    get('ai_conversation_agent').addEventListener('change', e => this._set('ai_conversation_agent', e.target.value || null));
    ['ai_enable_tap', 'ai_enable_ask', 'ai_enable_week', 'ai_enable_recap'].forEach(id => {
      const el = get(id);
      if (el) el.addEventListener('change', e => this._set(id, e.target.checked));
    });
  }
  // ⟦/AI:EDITOR⟧

  // ── Listeners ──────────────────────────────────────────────────

  _attachListeners() {
    const root = this.shadowRoot;
    const get  = id => root.getElementById(id);

    get('friendly_name').addEventListener('input', e =>
      this._set('friendly_name', e.target.value));
    get('status_entity').addEventListener('change', e =>
      this._set('status_entity', e.target.value));
    get('current_temp_entity').addEventListener('change', e =>
      this._set('current_temp_entity', e.target.value || null));
    get('set_temp_entity').addEventListener('change', e =>
      this._set('set_temp_entity', e.target.value || null));
    get('cook_time_entity').addEventListener('change', e =>
      this._set('cook_time_entity', e.target.value || null));
    get('preheat_time_entity').addEventListener('change', e =>
      this._set('preheat_time_entity', e.target.value || null));
    get('temp_unit_override').addEventListener('change', e =>
      this._set('temp_unit_override', e.target.value));
    get('smart_plug_entity').addEventListener('change', e =>
      this._set('smart_plug_entity', e.target.value || null));
    get('power_entity').addEventListener('change', e =>
      this._set('power_entity', e.target.value || null));

    root.querySelectorAll('.layout-opt').forEach(b =>
      b.addEventListener('click', () => this._set('layout', b.dataset.layout) || this._syncUI()));
    root.querySelectorAll('.seg-btn[data-appearance]').forEach(b =>
      b.addEventListener('click', () => this._set('appearance', b.dataset.appearance) || this._syncUI()));
    root.querySelectorAll('.seg-btn[data-size]').forEach(b =>
      b.addEventListener('click', () => this._set('size', b.dataset.size) || this._syncUI()));
    root.querySelectorAll('.seg-btn[data-anim]').forEach(b =>
      b.addEventListener('click', () => this._set('animation', b.dataset.anim) || this._syncUI()));
    get('glass').addEventListener('input', e =>
      this._set('glass', Number(e.target.value)));

    root.querySelectorAll('.preset-opt').forEach(b => b.addEventListener('click', () => {
      const pr = COLOR_PRESETS.find(x => x.id === b.dataset.preset);
      const keep = (this._config.colors && isHex(this._config.colors.idle)) ? { idle: this._config.colors.idle } : {};
      const next = { ...(pr.colors || {}), ...keep };
      this._set('colors', Object.keys(next).length ? next : null);
      this._syncUI();
    }));
    PHASE_ROWS.forEach(([k]) => {
      const input = get(`color_${k}`), reset = get(`reset_${k}`);
      input.addEventListener('input',  () => this._paintPreview(k, input.value));   // live preview only
      input.addEventListener('change', () => {
        this._set('colors', { ...(this._config.colors || {}), [k]: input.value });
        this._syncUI();
      });
      reset.addEventListener('click', () => {
        const next = { ...(this._config.colors || {}) };
        delete next[k];
        this._set('colors', Object.keys(next).length ? next : null);
        this._syncUI();
      });
    });

    this._aiListen();

    get('show_name').addEventListener('change', e => {
      this._set('show_name', e.target.checked);
      const row = root.getElementById('name_row');
      if (row) row.style.display = e.target.checked ? '' : 'none';
    });

    get('smart_plug_enabled').addEventListener('change', e => {
      this._set('smart_plug_enabled', e.target.checked);
      const row = root.getElementById('plug_entity_row');
      if (row) row.style.display = e.target.checked ? '' : 'none';
    });
  }

  _wireSearches(statusCand, allSens, curTempCand, allSens2, setTempCand, allSens3,
                cookTimeCand, allSens4, preheatCand, allSens5, plugCand, allSw,
                powerCand, powerPoolArg) {
    const root = this.shadowRoot;

    const makeData = (candidates, pool) => {
      const cs = new Set(candidates.map(c => c.e));
      return [
        ...candidates.map(({ e, score }) => ({ id: e, name: this._getName(e), suggested: score > 0 })),
        ...pool.filter(e => !cs.has(e)).map(e => ({ id: e, name: this._getName(e), suggested: false })),
      ];
    };

    const wire = (searchId, selectId, data) => {
      const searchEl = root.getElementById(searchId);
      const selectEl = root.getElementById(selectId);
      if (!searchEl || !selectEl) return;
      searchEl.addEventListener('input', () => {
        const term = searchEl.value.toLowerCase().trim();
        const cur  = selectEl.value;
        const hits = term ? data.filter(d =>
          d.id.toLowerCase().includes(term) || d.name.toLowerCase().includes(term)) : data;
        const sug  = hits.filter(d => d.suggested);
        const rest = hits.filter(d => !d.suggested);
        selectEl.innerHTML =
          `<option value="">— None —</option>` +
          sug.map( d => `<option value="${d.id}" ${d.id===cur?'selected':''}>★ ${d.name} (${d.id})</option>`).join('') +
          (sug.length && rest.length ? `<option disabled>──────────────────</option>` : '') +
          rest.map(d => `<option value="${d.id}" ${d.id===cur?'selected':''}>${d.name} (${d.id})</option>`).join('');
      });
    };

    wire('status_search',       'status_entity',       makeData(statusCand,   allSens));
    wire('current_temp_search', 'current_temp_entity',  makeData(curTempCand, allSens2));
    wire('set_temp_search',     'set_temp_entity',       makeData(setTempCand, allSens3));
    wire('cook_time_search',    'cook_time_entity',      makeData(cookTimeCand, allSens4));
    wire('preheat_time_search', 'preheat_time_entity',   makeData(preheatCand, allSens5));
    wire('plug_search',         'smart_plug_entity',     makeData(plugCand,    allSw));
    wire('power_search',        'power_entity',          makeData(powerCand,   powerPoolArg));
  }

  _set(key, value) {
    const newConfig = { ...this._config, [key]: value };
    if (value === null || value === '') delete newConfig[key];
    this._config = newConfig;
    this._dispatch();
  }

  _dispatch() {
    this.dispatchEvent(new CustomEvent('config-changed', {
      detail: { config: this._config }, bubbles: true, composed: true,
    }));
  }
}


// ═══════════════════════════════════════════════════════════════════
//  REGISTRATION
// ═══════════════════════════════════════════════════════════════════

if (!customElements.get('crow-airfryer-card')) {
  customElements.define('crow-airfryer-card', AntAirfryerCard);
}
if (!customElements.get('crow-airfryer-card-editor')) {
  customElements.define('crow-airfryer-card-editor', AntAirfryerCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.some(c => c.type === 'crow-airfryer-card')) {
  window.customCards.push({
    type:        'crow-airfryer-card',
    name:        'Crow Airfryer Card',
    preview:     false,
    description: 'VeSync air fryer card with four glass layouts (dial, pill, tile, timer), light and dark themes.',
  });
}
