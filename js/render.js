// Layout and rendering. Everything is laid out in device dots at the media's
// dpi so barcode and QR modules fall on whole dots. A layout produces a
// "scene" (a list of primitives) that the canvas and SVG renderers share.
//
// Text is measured by its actual ink (each line's own ascent and descent), so a block of
// text fills the available height exactly: no hidden padding above, below or between lines
// beyond the line spacing setting.

import { paintIcon, iconSVG, iconInkBounds, ICON_MAP } from './icons.js';
import { encodeCode } from './codes.js';

export const FONTS = [
  { family: 'Roboto Condensed', weights: [400, 700] },
  { family: 'Barlow Condensed', weights: [500, 700] },
  { family: 'IBM Plex Sans', weights: [400, 600] },
  { family: 'Inter', weights: [400, 700] },
  { family: 'Atkinson Hyperlegible', weights: [400, 700] },
  { family: 'Archivo Narrow', weights: [400, 700] },
  { family: 'Saira Condensed', weights: [400, 700] },
  { family: 'Oswald', weights: [400, 700] },
  { family: 'Bebas Neue', weights: [400] },
  { family: 'JetBrains Mono', weights: [400, 700] },
  { family: 'IBM Plex Mono', weights: [400, 600] },
  { family: 'Arial', weights: [400, 700], system: true },
];
export const fontStack = fam => `"${fam}", "Arial Narrow", Arial, sans-serif`;
export const MAX_LINES = 5;

let measureCtx = null;
function mctx() {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}
const inkCache = new Map();
export function clearMetrics() { inkCache.clear(); }
// Ink box of a string per 1 px of font size: a = above the baseline, d = below, w = advance.
function inkMetrics(s, fam, weight) {
  const key = `${fam}|${weight}|${s}`;
  let v = inkCache.get(key);
  if (!v) {
    const c = mctx();
    c.font = `${weight} 100px ${fontStack(fam)}`;
    const t = c.measureText(s);
    let a = t.actualBoundingBoxAscent / 100, d = t.actualBoundingBoxDescent / 100;
    if (!(a + d > 0.01)) { a = 0.7; d = 0; } // spaces or a font that reports nothing
    v = { a: Math.max(0, a), d: Math.max(0, d), w: t.width / 100 };
    if (inkCache.size > 4000) inkCache.clear();
    inkCache.set(key, v);
  }
  return v;
}

export const mmToDots = (mm, dpi) => mm * dpi / 25.4;

// Effective media (custom sizes resolved).
export function resolveMedia(media, style) {
  if (media.custom) return { ...media, widthMm: +style.customW || 60, heightMm: +style.customH || 20, dpi: +style.customDpi || 300 };
  // High resolution (P-touch HD): 360 dpi along the tape, 180 dpi across it. Layout runs on a
  // square 360 dpi grid; the 1-bit bitmap then merges every 2 rows into one printer dot (ySub).
  if (media.hdCapable && (style.hd === '1' || style.hd === true)) return { ...media, dpi: 360, ySub: 2, hd: true };
  return media;
}
export const dpiLabel = m => (m.hd ? '180 × 360 dpi (HD)' : `${m.dpi} dpi`);

export function labelLengthMm(lbl, style) {
  if (style.lengthMode === 'units') return (+lbl.len || 1) * (+style.unitPitch || 42) - (+style.unitInset || 0);
  if (style.lengthMode === 'fixed') return +lbl.len || +style.lengthMm || 40;
  return null; // auto
}

// Per-line text settings. Auto mode: `rel` = size relative to line 1. Fixed mode: point sizes.
// Older projects stored w1/w2/ratio/pt/pt2; those still work as a fallback.
export function lineSettings(style) {
  const r = +style.ratio || 0.66;
  const rel = style.lineRel || [1, r, r, r, r];
  const pt = style.linePt || [+style.pt || 14, +style.pt2 || 9, +style.pt2 || 9, +style.pt2 || 9, +style.pt2 || 9];
  const w = style.lineW || [style.w1 || 700, style.w2 || 400, style.w2 || 400, style.w2 || 400, style.w2 || 400];
  return Array.from({ length: MAX_LINES }, (_, i) => ({ rel: i ? +rel[i] || r : 1, pt: +pt[i] || (i ? 9 : 14), weight: +w[i] || (i ? 400 : 700) }));
}

// Visible lines (Text lines setting; empty ones skipped), keeping each line's own settings.
function textLines(lbl, style) {
  const set = lineSettings(style);
  const fixed = style.sizeMode === 'fixed';
  const out = [];
  (lbl.lines || []).slice(0, +style.lineCount || 3).forEach((raw, idx) => {
    let s = (raw || '').trim();
    if (!s) return;
    if (style.upper && idx === 0) s = s.toUpperCase();
    const spec = set[idx];
    const rel = fixed ? spec.pt / set[0].pt : spec.rel;
    out.push({ s, idx, rel, pt: spec.pt, weight: spec.weight, ...inkMetrics(s, style.font, spec.weight) });
  });
  return out;
}

// Size of each line for line-1 size f, each capped by the width it has.
export function lineSizes(geo, f) {
  return geo.L.map(ln => Math.min(f * ln.rel, ln.cap));
}
// Total ink height of the block at line-1 size f.
function blockHeight(L, f, lineGap) {
  let h = 0;
  for (const ln of L) h += Math.min(f * ln.rel, ln.cap) * (ln.a + ln.d);
  return h + lineGap * Math.max(0, L.length - 1);
}
// Largest f whose block fits maxH (binary search; blockHeight only grows with f).
function fitF(L, maxH, lineGap) {
  if (!L.length || maxH <= 0) return 0;
  let lo = 0, hi = maxH / Math.min(...L.map(ln => ln.rel * (ln.a + ln.d) || 1));
  if (blockHeight(L, hi, lineGap) <= maxH) return hi;
  for (let i = 0; i < 32; i++) { const mid = (lo + hi) / 2; if (blockHeight(L, mid, lineGap) <= maxH) lo = mid; else hi = mid; }
  return lo;
}

// Geometry pass. `fontPx` forces the line-1 size; omit it to get the auto-fit size.
// env: { media, style, feedMm, codeScale, customImages }
// Layouts (style.layout): 'row'    = [icons] [text block] next to each other, icons full height
//                         'header' = icons on the same line as line 1, other lines underneath
export function layout(lbl, env, fontPx) {
  const { style } = env;
  const media = env.media;
  const dpi = media.dpi, k = dpi / 25.4;
  const ySub = media.ySub || 1; // layout rows per printed dot across the tape
  const mode = style.layout === 'header' ? 'header' : 'row';
  const errors = [];
  let H, W = null;
  if (media.kind === 'tape') H = media.pins * ySub;
  else H = Math.round(media.heightMm * k);
  const variable = media.kind === 'tape' || media.kind === 'continuous';
  if (!variable) W = Math.round(media.widthMm * k);
  else {
    const Lmm = labelLengthMm(lbl, style);
    // 4.4 mm is Brother's minimum print length; other roll printers are similar.
    if (Lmm != null) W = Math.max(Math.round(4.4 * k), Math.round((Lmm - 2 * (env.feedMm || 0)) * k));
  }
  const num = (v, d) => (v != null && v !== '' && isFinite(+v) ? +v : d);
  const pad = Math.round(num(style.padMm, 0) * k);
  const edge = media.kind === 'tape' ? Math.round(num(style.edgeMm, 0) * k) : pad;
  const gap = Math.round(num(style.gapMm, 1) * k);
  const iconGap = Math.round(num(style.iconGapMm, 0.5) * k);
  const lineGap = num(style.lineGapMm, 0.3) * k;
  const ih = H - 2 * edge;
  const iy = edge;

  // ---- code
  const codeScale = Math.min(1, Math.max(0.1, num(env.codeScale ?? style.codeScale, 1)));
  const qrQuiet = Math.max(0, Math.round(num(style.qrQuiet, 1)));
  const qrSnap = !!style.qrSnap;
  const codePos = style.codePos || 'right';
  let code = null;
  if (style.showCode !== false && lbl.codeType && lbl.codeType !== 'none' && lbl.code) {
    code = encodeCode(lbl.codeType, lbl.code);
    if (code && code.error) { errors.push(code.error); code = null; }
  }
  const mdefault = Math.max(1, Math.round(dpi / 90));
  const below = !!code && code.kind === 'bar' && codePos === 'below' && ih >= Math.round(11 * k);

  // ---- icons
  const iconList = [];
  const addIcon = (id, scale) => {
    if (!id || !(ICON_MAP[id] || id.startsWith('img-'))) return;
    const b = iconInkBounds(id, env.customImages);
    const fw = Math.max(0.02, b.x1 - b.x0), fh = Math.max(0.02, b.y1 - b.y0);
    iconList.push({ id, scale, b, fw, fh, aspect: Math.min(fw / fh, 1.6) }); // ink width per ink height
  };
  if (style.showIcon !== false) addIcon(lbl.icon, num(style.iconScale, 1));
  if (style.showIcon2 !== false) addIcon(lbl.icon2, num(style.iconScale2, 0.65));
  // Icon box for an ink height T: drawing scaled so its ink is T tall (or 1.6 T wide at most).
  const iconBox = (ic, T) => {
    const side = Math.max(1, Math.min(T / ic.fh, 1.6 * T / ic.fw));
    return { side, w: ic.fw * side, h: ic.fh * side, offX: ic.b.x0 * side, offY: ic.b.y0 * side };
  };

  // Code and (row layout) icons at scale f. Fixed lengths retry with a smaller f until the
  // text has room, instead of overlapping it.
  const build = f => {
    const errs = [];
    let codeBox = null, codeW = 0, belowH = 0;
    if (code && code.kind === 'qr') {
      const q = code.n + 2 * qrQuiet;
      // Smooth by default: modules may be fractional and are snapped to whole dots when drawn.
      let mod = ih * codeScale * f / q;
      if (qrSnap) { mod = Math.floor(mod); mod -= mod % ySub; }
      // Smallest printable QR: 1 printer dot per module. Below that, stop shrinking (don't vanish).
      if (mod < ySub && q * ySub <= ih) { mod = ySub; errs.push('The QR code is at its smallest printable size (1 dot per module)'); }
      if (mod < ySub) errs.push('QR code is too dense for this label height');
      else {
        if (mod / ySub < 2 && dpi / ySub < 250) errs.push('QR modules are under 2 dots wide; phones may struggle to scan it');
        const side = Math.round(mod * q);
        let y = iy + Math.floor((ih - side) / 2);
        y -= y % ySub; // start on a printer dot
        codeBox = { kind: 'qr', mod, side, quiet: qrQuiet, y };
        codeW = side;
      }
    } else if (code && code.kind === 'bar') {
      const n = code.bits.length, quiet = 8;
      if (below) {
        belowH = Math.round(ih * 0.4 * codeScale);
        let mod = mdefault;
        if (W != null) mod = Math.min(mdefault, Math.floor((W - 2 * pad) / (n + 2 * quiet)));
        if (mod < 1) { errs.push('Barcode is too long for this label'); belowH = 0; }
        else codeBox = { kind: 'bar', below: true, mod, w: mod * n, h: belowH, y: iy + ih - belowH };
      } else {
        let mod = mdefault;
        if (W != null) mod = Math.min(mdefault, Math.floor(((W - 2 * pad) * 0.62 * f) / (n + 2 * quiet)));
        if (mod < 1) errs.push('Barcode is too long for this label; try a QR code');
        else {
          if (mod === 1 && dpi < 250) errs.push('Barcode bars are 1 dot wide; scanning may be unreliable');
          const h = Math.max(1, Math.round(ih * codeScale));
          codeBox = { kind: 'bar', mod, w: mod * n, h, y: iy + Math.floor((ih - h) / 2), quiet: mod * quiet };
          codeW = mod * (n + 2 * quiet);
        }
      }
    }
    const textH = belowH ? ih - belowH - gap : ih;
    let icons = [], iconsW = 0;
    if (mode === 'row') {
      icons = iconList.map(ic => ({ ic, ...iconBox(ic, Math.max(4, textH * ic.scale * f)) }));
      iconsW = icons.reduce((s, b) => s + b.w, 0) + Math.max(0, icons.length - 1) * iconGap;
    }
    return { codeBox, codeW, belowH, textH, icons, iconsW, errs };
  };

  const L = textLines(lbl, style);
  const n = L.length;
  // Width used by everything except the text (row layout: icons too), including the gaps.
  const sideW = B => (B.icons.length ? B.iconsW + gap : 0) + (B.codeW ? B.codeW + gap : 0);
  // Header layout: line 1's row also holds the icons. K = icon ink width per unit of line-1 ink height.
  const headK = mode === 'header' ? iconList.reduce((s, ic) => s + ic.scale * ic.aspect, 0) : 0;
  const headG = mode === 'header' && iconList.length ? gap + iconGap * (iconList.length - 1) : 0;
  const setCaps = textW => {
    L.forEach((ln, j) => {
      ln.cap = ln.w > 0 ? Math.max(0, textW) / ln.w : Infinity;
      if (j === 0 && mode === 'header' && iconList.length) ln.cap = Math.max(0, textW - headG) / (ln.w + (ln.a + ln.d) * headK);
    });
  };

  let B = build(1);
  if (W != null && n) {
    // Keep at least ~40% of the length for text (or what it needs at full height, if less).
    const inner = W - 2 * pad;
    setCaps(Infinity);
    const f0 = fitF(L, B.textH, lineGap);
    const needed = Math.max(...L.map((ln, j) => f0 * ln.rel * ln.w + (j === 0 ? f0 * (ln.a + ln.d) * headK + headG : 0)));
    const want = Math.min(Math.round(inner * 0.4), Math.ceil(needed));
    let f = 1;
    for (let i = 0; i < 6 && inner - sideW(B) < want; i++) {
      const shrinkable = B.iconsW + B.codeW;
      if (!shrinkable || f <= 0.3) break;
      const fixed = sideW(B) - shrinkable;
      f = Math.max(0.3, f * Math.max(0.3, (inner - want - fixed) / shrinkable) * 0.98);
      B = build(f);
    }
    // Never let icons and code run past the label, even if that leaves no room for text.
    for (let i = 0; i < 6 && sideW(B) > inner && f > 0.05; i++) {
      const shrinkable = B.iconsW + B.codeW;
      if (!shrinkable) break;
      const fixed = sideW(B) - shrinkable;
      f = Math.max(0.05, f * Math.max(0.05, (inner - fixed) / shrinkable) * 0.98);
      B = build(f);
    }
    if (sideW(B) > inner) errors.push("The icons and code don't fit on this label; make it longer or hide one");
    else if (f < 0.999) errors.push('Icons and code were shrunk to make room for the text');
  }
  errors.push(...B.errs);
  const { codeBox, codeW, textH, icons, iconsW } = B;
  if (!codeBox) code = null;

  let textW, autoF;
  if (W == null) {
    setCaps(Infinity);
    autoF = fitF(L, textH, lineGap);
    const f = fontPx != null ? fontPx : (style.sizeMode === 'fixed' ? Math.min(autoF, (L[0] ? L[0].pt / L[0].rel : 14) * dpi / 72) : autoF);
    textW = n ? Math.ceil(Math.max(...L.map((ln, j) => f * ln.rel * ln.w + (j === 0 ? f * (ln.a + ln.d) * headK + headG : 0)))) + 2 : 0;
    const side = n ? sideW(B) : Math.max(0, sideW(B) - gap); // no gap before missing text
    W = Math.max(Math.round(6 * k), Math.ceil(2 * pad + side + textW)); // whole raster lines
    if (codeBox && codeBox.below) W = Math.max(W, 2 * pad + codeBox.w + 16 * codeBox.mod);
    fontPx = f;
  } else {
    textW = W - 2 * pad - sideW(B);
    if (textW < Math.round(3 * k) && n) errors.push('Not enough room for the text');
    setCaps(textW);
    autoF = fitF(L, textH, lineGap);
  }

  // Place
  let x = pad;
  if (codeBox && !codeBox.below && codePos === 'left') {
    codeBox.x = codeBox.kind === 'qr' ? x : x + codeBox.quiet;
    x += codeW + gap;
  }
  const iconBoxes = icons.map((b, i) => {
    const box = { id: b.ic.id, x: x - b.offX, y: iy + (textH - b.h) / 2 - b.offY, side: b.side };
    x += b.w + (i < icons.length - 1 ? iconGap : gap);
    return box;
  });
  const textBox = { x, y: iy, w: Math.max(0, textW), h: textH };
  if (codeBox) {
    if (codeBox.below) codeBox.x = Math.round((W - codeBox.w) / 2);
    else if (codePos !== 'left') codeBox.x = codeBox.kind === 'qr' ? W - pad - codeBox.side : W - pad - codeBox.quiet - codeBox.w;
  }
  return {
    W, H, dpi, k, ySub, mode, L, lines: L.map(ln => ln.s), iconBoxes, headIcons: mode === 'header' ? iconList : [],
    iconGap, gap, lineGap, textBox, codeBox, code, autoF, errors, fam: style.font, fontPx,
  };
}

// Line-1 size to draw with: the fitted size, or in fixed mode the line-1 point size unless the
// text doesn't fit (then the fitted size). The app and the self-test both use this.
export function chooseF(geo, style) {
  if (style.sizeMode !== 'fixed') return geo.autoF;
  return Math.min(lineSettings(style)[0].pt * geo.dpi / 72, geo.autoF);
}

// Build drawable primitives from a geometry at line-1 size f.
export function scene(geo, f, style) {
  const items = [];
  const errors = [...geo.errors];
  for (const b of geo.iconBoxes) items.push({ k: 'icon', id: b.id, x: b.x, y: b.y, s: b.side });
  const { L, textBox: tb } = geo;
  if (L.length && f > 0) {
    const sizes = lineSizes(geo, f);
    if (style.sizeMode === 'fixed' && L.some((ln, j) => sizes[j] + 0.01 < ln.pt * geo.dpi / 72)) errors.push('Text was shrunk to fit');
    const inkH = sizes.map((s, j) => s * (L[j].a + L[j].d));
    const block = inkH.reduce((a, b) => a + b, 0) + geo.lineGap * (L.length - 1);
    let y = tb.y + Math.max(0, (tb.h - block) / 2);
    const center = style.align === 'center';
    // Header layout: icons sit on line 1's row, sized to that row's ink height.
    let row0X = tb.x;
    if (geo.mode === 'header' && geo.headIcons.length) {
      const T0 = inkH[0];
      geo.headIcons.forEach((ic, j) => {
        const T = T0 * ic.scale;
        const side = Math.max(1, Math.min(T / ic.fh, 1.6 * T / ic.fw));
        const w = ic.fw * side, h = ic.fh * side;
        items.push({ k: 'icon', id: ic.id, x: row0X - ic.b.x0 * side, y: y + (T0 - h) / 2 - ic.b.y0 * side, s: side });
        row0X += w + (j < geo.headIcons.length - 1 ? geo.iconGap : geo.gap);
      });
    }
    L.forEach((ln, j) => {
      const s = sizes[j];
      const base = y + ln.a * s;
      const x0 = j === 0 ? row0X : tb.x;
      const avail = tb.x + tb.w - x0;
      items.push({ k: 'text', s: ln.s, x: center ? x0 + avail / 2 : x0, y: base, size: s, weight: ln.weight, fam: geo.fam, align: center ? 'center' : 'left' });
      y = base + ln.d * s + geo.lineGap;
    });
  }
  const cb = geo.codeBox;
  if (cb && geo.code) {
    const rects = [];
    if (cb.kind === 'qr') {
      // Module edges are rounded to whole layout dots (rows to whole printer dots in HD), so a
      // fractional module size gives modules of n or n+1 dots instead of blurry edges.
      const n = geo.code.n, g = geo.code.grid, md = cb.mod, qz = cb.quiet ?? 1, ys = geo.ySub || 1;
      const ex = c => Math.round(cb.x + (c + qz) * md);
      const ey = r => { const v = Math.round(cb.y + (r + qz) * md); return v - (v % ys); };
      for (let r = 0; r < n; r++) {
        let c = 0;
        while (c < n) {
          if (g[r * n + c]) { let e = c; while (e < n && g[r * n + e]) e++; rects.push([ex(c), ey(r), ex(e) - ex(c), ey(r + 1) - ey(r)]); c = e; } else c++;
        }
      }
    } else {
      const bits = geo.code.bits, md = cb.mod;
      let i = 0;
      while (i < bits.length) {
        if (bits[i] === '1') { let e = i; while (e < bits.length && bits[e] === '1') e++; rects.push([cb.x + i * md, cb.y, (e - i) * md, cb.h]); i = e; } else i++;
      }
    }
    items.push({ k: 'rects', rects });
  }
  if (style.border && style.border !== 'none') {
    const lw = Math.max(1, Math.round(geo.k * 0.25));
    items.push({ k: 'frame', lw, round: style.border === 'round' ? Math.round(geo.k * 1.2) : 0 });
  }
  return { W: geo.W, H: geo.H, dpi: geo.dpi, ySub: geo.ySub || 1, items, errors, invert: !!style.invert };
}

export function colorsFor(sc) {
  return sc.invert ? { ink: '#ffffff', paper: '#000000' } : { ink: '#000000', paper: '#ffffff' };
}

export function renderCanvas(sc, scale, customImages, canvas) {
  const c = canvas || document.createElement('canvas');
  c.width = Math.max(1, Math.round(sc.W * scale));
  c.height = Math.max(1, Math.round(sc.H * scale));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  const { ink, paper } = colorsFor(sc);
  ctx.fillStyle = paper;
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = ink;
  ctx.strokeStyle = ink;
  for (const it of sc.items) {
    if (it.k === 'icon') paintIcon(ctx, it.id, it.x * scale, it.y * scale, it.s * scale, ink, paper, customImages);
    else if (it.k === 'text') {
      ctx.fillStyle = ink;
      ctx.font = `${it.weight} ${it.size * scale}px ${fontStack(it.fam)}`;
      ctx.textAlign = it.align;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(it.s, it.x * scale, it.y * scale);
    } else if (it.k === 'rects') {
      ctx.fillStyle = ink;
      for (const [x, y, w, h] of it.rects) ctx.fillRect(x * scale, y * scale, w * scale, h * scale);
    } else if (it.k === 'frame') {
      const lw = it.lw * scale;
      ctx.lineWidth = lw;
      ctx.strokeStyle = ink;
      ctx.beginPath();
      if (it.round && ctx.roundRect) ctx.roundRect(lw / 2, lw / 2, c.width - lw, c.height - lw, it.round * scale);
      else ctx.rect(lw / 2, lw / 2, c.width - lw, c.height - lw);
      ctx.stroke();
    }
  }
  return c;
}

// Downsample a supersampled canvas into a 1-bit bitmap (1 = ink dot). With ySub = 2 (HD tape)
// every 2 layout rows become one printer dot, so W is at 360 dpi and H at 180 dpi.
export function toBitmap(canvas, scale, threshold = 0.5, ySub = 1) {
  const sy = scale * ySub;
  const W = Math.round(canvas.width / scale), H = Math.round(canvas.height / sy);
  const data = canvas.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, canvas.width, canvas.height).data;
  const bits = new Uint8Array(W * H);
  const cw = canvas.width, n = scale * sy, cut = threshold * 255 * n;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let s = 0;
      for (let dy = 0; dy < sy; dy++) {
        let p = ((y * sy + dy) * cw + x * scale) * 4;
        for (let dx = 0; dx < scale; dx++, p += 4) s += data[p];
      }
      bits[y * W + x] = s < cut ? 1 : 0;
    }
  }
  return { bits, W, H, ySub };
}

// Bitmap with square pixels for previews and image exports (HD rows repeated).
export function squareBitmap(bm) {
  const f = bm.ySub || 1;
  if (f === 1) return bm;
  const H = bm.H * f, bits = new Uint8Array(bm.W * H);
  for (let y = 0; y < H; y++) bits.set(bm.bits.subarray(((y / f) | 0) * bm.W, ((y / f) | 0) * bm.W + bm.W), y * bm.W);
  return { bits, W: bm.W, H, ySub: 1 };
}

const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderSVG(sc, customSrc, fontCssUrl) {
  const { ink, paper } = colorsFor(sc);
  const mmW = (sc.W / sc.dpi * 25.4).toFixed(3), mmH = (sc.H / sc.dpi * 25.4).toFixed(3);
  const parts = [`<rect width="${sc.W}" height="${sc.H}" fill="${paper}"/>`];
  for (const it of sc.items) {
    if (it.k === 'icon') parts.push(iconSVG(it.id, it.x, it.y, it.s, ink, paper, customSrc && customSrc(it.id)));
    else if (it.k === 'text') parts.push(`<text x="${+it.x.toFixed(2)}" y="${+it.y.toFixed(2)}" font-family="${esc(fontStack(it.fam))}" font-weight="${it.weight}" font-size="${+it.size.toFixed(2)}" fill="${ink}"${it.align === 'center' ? ' text-anchor="middle"' : ''}>${esc(it.s)}</text>`);
    else if (it.k === 'rects') parts.push(`<path fill="${ink}" d="${it.rects.map(([x, y, w, h]) => `M${x} ${y}h${w}v${h}h${-w}z`).join('')}"/>`);
    else if (it.k === 'frame') parts.push(`<rect x="${it.lw / 2}" y="${it.lw / 2}" width="${sc.W - it.lw}" height="${sc.H - it.lw}" rx="${it.round}" fill="none" stroke="${ink}" stroke-width="${it.lw}"/>`);
  }
  const style = fontCssUrl ? `<style>@import url('${fontCssUrl}');</style>` : '';
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${mmW}mm" height="${mmH}mm" viewBox="0 0 ${sc.W} ${sc.H}">${style}${parts.join('')}</svg>\n`;
}
