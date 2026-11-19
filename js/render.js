// Layout and rendering. Everything is laid out in device dots at the media's
// dpi so barcode and QR modules fall on whole dots. A layout produces a
// "scene" (a list of primitives) that the canvas and SVG renderers share.

import { paintIcon, iconSVG, ICON_MAP } from './icons.js';
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

let measureCtx = null;
function mctx() {
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d');
  return measureCtx;
}
const metricCache = new Map();
export function clearMetrics() { metricCache.clear(); }
function fontMetrics(fam, weight) {
  const key = fam + weight;
  let m = metricCache.get(key);
  if (!m) {
    const c = mctx();
    c.font = `${weight} 100px ${fontStack(fam)}`;
    m = { a: c.measureText('HdlkÅ').actualBoundingBoxAscent / 100, d: c.measureText('gjpqy').actualBoundingBoxDescent / 100 };
    if (!(m.a > 0)) m = { a: 0.72, d: 0.21 };
    metricCache.set(key, m);
  }
  return m;
}
function textWidth(s, fam, weight) {
  const c = mctx();
  c.font = `${weight} 100px ${fontStack(fam)}`;
  return c.measureText(s).width / 100;
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

function textLines(lbl, style) {
  const lines = (lbl.lines || []).map(s => (s || '').trim()).filter(Boolean);
  if (style.upper && lines[0]) lines[0] = lines[0].toUpperCase();
  return lines;
}

const DESC = /[gjpqyµ,;()[\]{}|Qß]/;

// Geometry pass. `fontPx` forces the primary line size; omit it to get the auto-fit size.
// env: { media, style, feedMm }
export function layout(lbl, env, fontPx) {
  const { style } = env;
  const media = env.media;
  const dpi = media.dpi, k = dpi / 25.4;
  const ySub = media.ySub || 1; // layout rows per printed dot across the tape
  const errors = [];
  let H, W = null;
  if (media.kind === 'tape') H = media.pins * ySub;
  else H = Math.round(media.heightMm * k);
  const variable = media.kind === 'tape' || media.kind === 'continuous';
  if (!variable) W = Math.round(media.widthMm * k);
  else {
    const L = labelLengthMm(lbl, style);
    // 4.4 mm is Brother's minimum print length; other roll printers are similar.
    if (L != null) W = Math.max(Math.round(4.4 * k), Math.round((L - 2 * (env.feedMm || 0)) * k));
  }
  const pad = Math.round((+style.padMm || 0) * k);
  const edge = media.kind === 'tape' ? Math.round((+style.edgeMm || 0) * k) : pad;
  const gap = Math.round((+style.gapMm || 0) * k);
  let ih = H - 2 * edge;
  const iy = edge;

  // Code
  let codeBox = null, code = null;
  if (style.showCode !== false && lbl.codeType && lbl.codeType !== 'none' && lbl.code) {
    code = encodeCode(lbl.codeType, lbl.code);
    if (code && code.error) { errors.push(code.error); code = null; }
  }
  const mdefault = Math.max(1, Math.round(dpi / 90));
  let codeW = 0, belowH = 0;
  if (code && code.kind === 'qr') {
    const q = code.n + 2;
    let mod = Math.floor(ih / q);
    mod -= mod % ySub; // keep modules square once rows are merged
    if (mod < ySub) { errors.push('QR code is too dense for this label height'); code = null; }
    else {
      if (mod === ySub && dpi / ySub < 250) errors.push('QR modules are 1 dot wide; phones may struggle to scan it');
      const side = mod * q;
      let y = iy + Math.floor((ih - side) / 2);
      y -= y % ySub; // start on a printer dot
      codeBox = { kind: 'qr', mod, side, y };
      codeW = side;
    }
  } else if (code && code.kind === 'bar') {
    const n = code.bits.length, quiet = 8;
    const below = style.codePos === 'below' && ih >= Math.round(11 * k);
    if (below) {
      belowH = Math.round(ih * 0.4);
      let mod = mdefault;
      if (W != null) mod = Math.min(mdefault, Math.floor((W - 2 * pad) / (n + 2 * quiet)));
      if (mod < 1) { errors.push('Barcode is too long for this label'); code = null; belowH = 0; }
      else codeBox = { kind: 'bar', below: true, mod, w: mod * n, h: belowH, y: iy + ih - belowH };
    } else {
      let mod = mdefault;
      if (W != null) mod = Math.min(mdefault, Math.floor(((W - 2 * pad) * 0.62) / (n + 2 * quiet)));
      if (mod < 1) { errors.push('Barcode is too long for this label; try a QR code'); code = null; }
      else {
        if (mod === 1 && dpi < 250) errors.push('Barcode bars are 1 dot wide; scanning may be unreliable');
        codeBox = { kind: 'bar', mod, w: mod * n, h: ih, y: iy, quiet: mod * quiet };
        codeW = mod * (n + 2 * quiet) - gap; // left quiet zone doubles as the gap
      }
    }
  }
  const textH = belowH ? ih - belowH - gap : ih;

  // Icons
  const icons = [];
  if (style.showIcon !== false && lbl.icon && (ICON_MAP[lbl.icon] || lbl.icon.startsWith('img-'))) {
    icons.push({ id: lbl.icon, side: Math.max(4, Math.round(textH * (+style.iconScale || 1))) });
  }
  if (style.showIcon2 !== false && lbl.icon2 && (ICON_MAP[lbl.icon2] || lbl.icon2.startsWith('img-'))) {
    icons.push({ id: lbl.icon2, side: Math.max(4, Math.round(textH * (+style.iconScale || 1) * 0.66)) });
  }
  const iconsW = icons.reduce((s, ic) => s + ic.side + gap, 0);

  // Text
  const lines = textLines(lbl, style);
  const fam = style.font, w1 = +style.w1 || 700, w2 = +style.w2 || 400, r = +style.ratio || 0.7;
  const m = fontMetrics(fam, w1);
  const n = lines.length;
  const heightUnits = n ? (m.a + m.d) * (1 + r * (n - 1)) + 0.12 * (n - 1) : 1;
  const unitWidths = lines.map((s, i) => textWidth(s, fam, i ? w2 : w1) * (i ? r : 1));
  const maxUnitW = Math.max(0, ...unitWidths);
  const fH = n ? textH / heightUnits : 0;

  let textW, autoF;
  if (W == null) {
    autoF = fH;
    const f = fontPx != null ? fontPx : (style.sizeMode === 'fixed' ? Math.min(fH, (+style.pt || 12) * dpi / 72) : fH);
    textW = Math.ceil(maxUnitW * f) + 2;
    W = Math.max(Math.round(6 * k), 2 * pad + iconsW + textW + (codeW ? codeW + gap : 0));
    if (codeBox && codeBox.below) W = Math.max(W, 2 * pad + codeBox.w + 16 * codeBox.mod);
    fontPx = f;
  } else {
    textW = W - 2 * pad - iconsW - (codeW ? codeW + gap : 0);
    if (textW < Math.round(3 * k) && n) errors.push('Not enough room for the text');
    const fW = maxUnitW > 0 ? Math.max(0, textW) / maxUnitW : Infinity;
    autoF = Math.min(fH, fW);
  }

  // Place
  let x = pad;
  const iconBoxes = icons.map(ic => {
    const b = { id: ic.id, x, y: iy + Math.floor((textH - ic.side) / 2), side: ic.side };
    x += ic.side + gap;
    return b;
  });
  const textBox = { x, y: iy, w: Math.max(0, textW), h: textH };
  if (codeBox) {
    if (codeBox.kind === 'qr') codeBox.x = W - pad - codeBox.side;
    else if (codeBox.below) codeBox.x = Math.round((W - codeBox.w) / 2);
    else codeBox.x = W - pad - codeBox.quiet - codeBox.w;
  }
  return { W, H, dpi, k, ySub, lines, unitWidths, metrics: m, iconBoxes, textBox, codeBox, code, autoF, errors, fam, w1, w2, r, fontPx };
}

// Build drawable primitives from a geometry at primary font size f.
export function scene(geo, f, style) {
  const items = [];
  const errors = [...geo.errors];
  for (const b of geo.iconBoxes) items.push({ k: 'icon', id: b.id, x: b.x, y: b.y, s: b.side });
  const { lines, metrics: m, textBox: tb } = geo;
  if (lines.length && f > 0) {
    if (style.sizeMode === 'fixed' && f + 0.01 < (+style.pt || 12) * geo.dpi / 72) errors.push('Text was shrunk to fit');
    const sizes = lines.map((_, i) => (i ? f * geo.r : f));
    const gapPx = f * 0.12;
    const desc = lines.map((s, i) => (DESC.test(s) ? m.d : m.d * 0.3) * sizes[i]);
    const block = sizes.reduce((s, sz, i) => s + sz * m.a + desc[i], 0) + gapPx * (lines.length - 1);
    let y = tb.y + (tb.h - block) / 2;
    const center = style.align === 'center';
    lines.forEach((s, i) => {
      const base = y + sizes[i] * m.a;
      items.push({ k: 'text', s, x: center ? tb.x + tb.w / 2 : tb.x, y: base, size: sizes[i], weight: i ? geo.w2 : geo.w1, fam: geo.fam, align: center ? 'center' : 'left' });
      y = base + desc[i] + gapPx;
    });
  }
  const cb = geo.codeBox;
  if (cb && geo.code) {
    const rects = [];
    if (cb.kind === 'qr') {
      const n = geo.code.n, g = geo.code.grid, md = cb.mod;
      for (let r = 0; r < n; r++) {
        let c = 0;
        while (c < n) {
          if (g[r * n + c]) { let e = c; while (e < n && g[r * n + e]) e++; rects.push([cb.x + (c + 1) * md, cb.y + (r + 1) * md, (e - c) * md, md]); c = e; } else c++;
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
