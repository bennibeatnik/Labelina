import { ICONS, ICON_MAP, ICON_CATS, paintIcon } from './icons.js';
import { MEDIA, MEDIA_MAP, TAPE_COLORS, LENGTH_PRESETS, LENGTH_PRESET_MAP, PTOUCH_MIN_MARGIN_MM } from './media.js';
import { CODE_TYPES } from './codes.js';
import { FONTS, layout, scene, renderCanvas, toBitmap, squareBitmap, renderSVG, resolveMedia, dpiLabel, clearMetrics, labelLengthMm, chooseF } from './render.js';
import { buildRasterJob, joinStrip, STATUS_REQUEST, STATUS_ONLY, parseStatus, connectUSB, connectSerial, IS_NATIVE, listNativePrinters, connectNative } from './ptouch.js';
import { saveBlob, safeName, canvasToPNG, bitmapCanvas, bitmapToZPL, pdfPerLabel, pdfSheet, zipFiles, labelsToCSV, parseTable } from './exporters.js';
import { CATEGORIES, COMMON_FIELDS, defaultsFor } from './library.js';

const $ = id => document.getElementById(id);
const STORE_KEY = 'labelina-v1';
const LEGACY_STORE_KEY = 'partmark-studio-v1'; // pre-rename auto-save, read once if the new key is empty

// ------------------------------------------------------------------ state
const DEFAULTS = {
  media: 'tze-12', customW: 60, customH: 20, customDpi: '300', hd: '',
  lengthPreset: '', lengthMode: 'auto', lengthMm: 40, unitPitch: 42, unitInset: 6, tapeColor: 'bw',
  align: 'left', codePos: 'right', iconScale: 1, iconScale2: 0.65, iconGapMm: 0.5, padMm: 1.5, gapMm: 1, edgeMm: 0, border: 'none', invert: false,
  codeScale: 1, codeScales: {}, qrQuiet: 1, lineCount: 3,
  showIcon: true, showIcon2: true, showCode: true,
  font: 'Roboto Condensed', sizeMode: 'auto', match: false, upper: false,
  // Per-line text: size relative to line 1 (auto), point size (fixed), weight. Line spacing in mm.
  layout: 'row', lineRel: [1, 0.66, 0.66, 0.66, 0.66], linePt: [14, 9, 9, 9, 9], lineW: ['700', '400', '400', '400', '400'], lineGapMm: 0.3,
  qrSnap: false, orientV: 2,
  zoom: 'fit', outMode: 'pages', cutMode: 'each', marginMm: 2, flip: false, mirror: false, sheetPage: 'a4', skipSlots: 0,
};

const MAX_LINES = 5;
let uid = 1;
const newId = () => 'L' + (Date.now().toString(36)) + (uid++).toString(36);
const mkLabel = (o = {}) => ({
  id: newId(), lines: [...(o.lines || []), '', '', '', '', ''].slice(0, MAX_LINES), icon: o.icon || '', icon2: o.icon2 || '',
  codeType: o.codeType || 'none', code: o.code || '', len: o.len ?? null, qty: o.qty || 1,
  src: o.src || null,
});

const SAMPLE = [
  { lines: ['M3×8', 'Socket head · A2 SS', 'ISO 4762 · Key 2.5'], icon: 'shcs', icon2: 'd-hex' },
  { lines: ['M3×12', 'Socket head · A2 SS', 'ISO 4762 · Key 2.5'], icon: 'shcs', icon2: 'd-hex' },
  { lines: ['M4×10', 'Button head · A2 SS', 'ISO 7380 · Key 2.5'], icon: 'button', icon2: 'd-hex' },
  { lines: ['M5×16', 'Flat head · Torx', 'ISO 14581 · T25'], icon: 'flat', icon2: 'd-torx' },
  { lines: ['M3', 'Hex nut · A2 SS', 'ISO 4032 · AF 5.5'], icon: 'hexnut' },
  { lines: ['M3', 'Flat washer · A2 SS', '3.2×7×0.5'], icon: 'washer' },
  { lines: ['M3×5.7', 'Heat-set insert', 'Brass'], icon: 'insert' },
  { lines: ['10 kΩ', '¼ W · 1% · THT', 'BRN BLK ORG'], icon: 'resistor' },
  { lines: ['100 nF', 'MLCC · 50 V · X7R', '0805 · Code 104'], icon: 'capacitor' },
  { lines: ['JST-XH 4P', 'Housing · 2.5 mm', ''], icon: 'jst' },
  { lines: ['608ZZ', 'Ball bearing', '8×22×7'], icon: 'bearing', codeType: 'qr', code: '608ZZ' },
];

let S = { ...DEFAULTS };
let labels = SAMPLE.map(mkLabel);
let customIcons = []; // {id, name, src}
const customImages = new Map();
let selId = labels[0].id;
let libCat = 'screws';
const libValues = {};

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY) ?? localStorage.getItem(LEGACY_STORE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    applyProject(d, true);
    if (d.libCat) libCat = d.libCat;
    if (d.libValues) Object.assign(libValues, d.libValues);
  } catch { /* storage unavailable or corrupt: keep defaults */ }
}
let saveTimer = 0;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ ...projectData(), libCat, libValues })); } catch { /* quota or blocked */ }
  }, 300);
}
function projectData() { return { app: 'labelina', version: 1, style: S, labels, customIcons }; }
function applyProject(d, quiet) {
  if (!d || typeof d !== 'object') throw new Error('Not a Labelina project file');
  if (d.style) {
    S = { ...DEFAULTS, ...d.style };
    const o = d.style;
    // Older projects: one weight and size for line 1, one for the rest.
    if (!o.lineRel) S.lineRel = [1, ...Array(4).fill(+o.ratio || 0.66)];
    if (!o.linePt) S.linePt = [+o.pt || 14, ...Array(4).fill(+o.pt2 || 9)];
    if (!o.lineW) S.lineW = [String(o.w1 || '700'), ...Array(4).fill(String(o.w2 || '400'))];
    // Print orientation now follows Brother's driver; Flip/Mirror set to compensate before are reset.
    if (!o.orientV) { S.flip = false; S.mirror = false; S.orientV = 2; }
  }
  if (!MEDIA_MAP[S.media]) S.media = DEFAULTS.media;
  if (Array.isArray(d.labels)) labels = d.labels.map(l => ({ ...mkLabel(l), id: l.id || newId() }));
  if (Array.isArray(d.customIcons)) { customIcons = d.customIcons.filter(c => c && c.id && c.src); customIcons.forEach(loadCustomImage); }
  selId = labels[0] ? labels[0].id : null;
  if (!quiet) { syncControls(); buildTable(); renderCustomList(); rerender(true); }
}
function loadCustomImage(c) {
  if (customImages.has(c.id)) return;
  const img = new Image();
  img.onload = () => rerender(true);
  img.src = c.src;
  customImages.set(c.id, img);
}

// --------------------------------------------------------------- rendering
function currentMedia() { return resolveMedia(MEDIA_MAP[S.media] || MEDIA_MAP[DEFAULTS.media], S); }
const isVariable = m => m.kind === 'tape' || m.kind === 'continuous';
const isMono = m => m.kind !== 'sheet';
function env() {
  const media = currentMedia();
  return { media, style: S, feedMm: feedMmFor(media), codeScale: codeScaleFor(S.media), customImages };
}
// Code size is remembered per tape/stock, since what suits 6 mm tape doesn't suit 24 mm.
function codeScaleFor(mediaId) { const v = (S.codeScales || {})[mediaId]; return v != null ? +v : 1; }
// Blank tape at each end of a label. P-touch printers won't go below 2 mm, so the layout
// uses the same value the printer will, which keeps fixed lengths exact.
function feedMmFor(media) {
  if (media.kind !== 'tape' || S.outMode !== 'pages') return 0;
  return Math.max(PTOUCH_MIN_MARGIN_MM, +S.marginMm || 0);
}

let fontVersion = 0;
const bmCache = new Map();
let renders = []; // per label: {sc, key}

function computeRenders() {
  const E = env();
  const geos = labels.map(l => layout(l, E));
  let fs = geos.map(g => (g.lines.length ? chooseF(g, S) : 0));
  if (S.match) {
    const valid = fs.filter(f => f > 0);
    if (valid.length) { const mn = Math.min(...valid); fs = fs.map(f => (f > 0 ? mn : f)); }
  }
  const { zoom, ...styleOnly } = S;
  const styleKey = JSON.stringify([styleOnly, fontVersion, customIcons.length, E.feedMm]);
  renders = labels.map((l, i) => {
    const needsRelayout = isVariable(E.media) && labelLengthMm(l, S) == null;
    const geo = needsRelayout ? layout(l, E, fs[i]) : geos[i];
    const sc = scene(geo, fs[i], S);
    return { sc, key: JSON.stringify([l.lines, l.icon, l.icon2, l.codeType, l.code, l.len, fs[i], styleKey]) };
  });
  if (bmCache.size > 600) bmCache.clear();
}

function ssFor(dpi) { return dpi <= 210 ? 3 : 2; }
// 1-bit bitmap for label index i (cached).
function bitmapOf(i) {
  const r = renders[i];
  let bm = bmCache.get(r.key);
  if (!bm) {
    const ss = ssFor(r.sc.dpi);
    bm = toBitmap(renderCanvas(r.sc, ss, customImages), ss, 0.5, r.sc.ySub);
    bmCache.set(r.key, bm);
  }
  return bm;
}
function tapeColors() {
  const m = currentMedia();
  if (m.kind !== 'tape') return { tape: '#ffffff', ink: '#111111' };
  return TAPE_COLORS.find(c => c.id === S.tapeColor) || TAPE_COLORS[0];
}
const hexRGBA = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];

// Draw label i into `canvas` as it will look printed (thumbnail use).
function drawThumb(i, canvas) {
  const m = currentMedia();
  if (isMono(m)) {
    const bm = squareBitmap(bitmapOf(i));
    const col = tapeColors();
    const src = bitmapCanvas(bm, hexRGBA(col.ink), hexRGBA(col.tape));
    const scale = Math.min(1, 132 / bm.W, 56 / bm.H) * 2;
    canvas.width = Math.max(1, Math.round(bm.W * scale));
    canvas.height = Math.max(1, Math.round(bm.H * scale));
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  } else {
    const sc = renders[i].sc;
    const scale = Math.min(264 / sc.W, 56 / sc.H);
    renderCanvas(sc, scale, customImages, canvas);
  }
}

let rafQueued = false, fullRebuild = false;
function rerender(full) {
  if (full) fullRebuild = true;
  if (rafQueued) return;
  rafQueued = true;
  requestAnimationFrame(() => {
    rafQueued = false;
    computeRenders();
    labels.forEach((l, i) => {
      const row = document.querySelector(`tr[data-id="${l.id}"]`);
      if (!row) return;
      drawThumb(i, row.querySelector('.thumb canvas'));
      const errs = renders[i].sc.errors;
      const flag = row.querySelector('.flag');
      flag.hidden = !errs.length;
      flag.title = errs.join('\n');
      const lenInp = row.querySelector('.len input');
      if (lenInp) lenInp.placeholder = S.lengthMode === 'units' ? '1' : String(S.lengthMm);
    });
    drawStage();
    updateCounts();
    fullRebuild = false;
    save();
  });
}

// ------------------------------------------------------------------ stage
function selIndex() { const i = labels.findIndex(l => l.id === selId); return i < 0 ? 0 : i; }

function drawStage() {
  const cv = $('stageCanvas');
  const wrap = $('stageWrap');
  const meta = $('stageMeta'), warn = $('stageWarn');
  if (!labels.length) {
    cv.width = cv.height = 1; cv.style.width = cv.style.height = '0px';
    meta.textContent = 'No labels'; $('stagePos').textContent = '0 / 0'; warn.innerHTML = '';
    return;
  }
  const i = selIndex();
  const r = renders[i], sc = r.sc;
  const m = currentMedia();
  const k = m.dpi / 25.4;
  const tape = m.kind === 'tape';
  const fullH = tape ? Math.round(m.tapeMm * k) : sc.H;
  const offY = Math.round((fullH - sc.H) / 2);
  const feed = Math.round(feedMmFor(m) * k);
  const totalW = sc.W + 2 * feed;
  const avail = Math.max(120, wrap.clientWidth - 40);
  let z;
  if (S.zoom === 'fit') z = Math.min(avail / totalW, 260 / fullH, 10);
  else z = (S.zoom === 'true' ? 1 : +S.zoom) * 96 / m.dpi;
  const rulerH = 26;
  const dpr = window.devicePixelRatio || 1;
  const cssW = Math.round(totalW * z), cssH = Math.round(fullH * z) + rulerH;
  cv.style.width = cssW + 'px'; cv.style.height = cssH + 'px';
  cv.width = Math.round(cssW * dpr); cv.height = Math.round(cssH * dpr);
  wrap.classList.toggle('wide', cssW > avail + 20);
  const ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssW, cssH);
  const col = tapeColors();
  // label body
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 3;
  ctx.fillStyle = col.tape;
  const radius = m.kind === 'diecut' || m.kind === 'sheet' ? Math.min(1.5 * k * z, 10) : 1;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(0, 0, cssW, fullH * z, radius); else ctx.rect(0, 0, cssW, fullH * z);
  ctx.fill();
  ctx.restore();
  // printed content
  if (isMono(m)) {
    const bm = bitmapOf(i);
    const src = bitmapCanvas(bm, hexRGBA(col.ink), [0, 0, 0, 0]);
    ctx.imageSmoothingEnabled = z < 1;
    ctx.drawImage(src, feed * z, offY * z, sc.W * z, sc.H * z);
  } else {
    const hi = renderCanvas(sc, Math.max(0.5, z * dpr), customImages);
    ctx.drawImage(hi, 0, 0, sc.W * z, sc.H * z);
  }
  // feed margins
  if (feed) {
    ctx.fillStyle = 'rgba(120,130,145,0.18)';
    ctx.fillRect(0, 0, feed * z, fullH * z);
    ctx.fillRect((feed + sc.W) * z, 0, feed * z, fullH * z);
    ctx.strokeStyle = 'rgba(120,130,145,0.6)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(feed * z + 0.5, 0); ctx.lineTo(feed * z + 0.5, fullH * z);
    ctx.moveTo((feed + sc.W) * z - 0.5, 0); ctx.lineTo((feed + sc.W) * z - 0.5, fullH * z); ctx.stroke(); ctx.setLineDash([]);
  }
  // ruler
  const y0 = fullH * z + 6;
  const pxPerMm = k * z;
  const totalMm = totalW / k;
  ctx.strokeStyle = 'rgba(223,229,238,0.55)'; ctx.fillStyle = 'rgba(223,229,238,0.8)';
  ctx.lineWidth = 1; ctx.font = '10px "IBM Plex Mono", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.beginPath(); ctx.moveTo(0, y0 + 0.5); ctx.lineTo(cssW, y0 + 0.5);
  const every = pxPerMm >= 3 ? 1 : pxPerMm >= 0.8 ? 5 : 10;
  for (let mm = 0; mm <= totalMm + 0.001; mm += every) {
    const x = Math.round(mm * pxPerMm) + 0.5;
    const len = mm % 10 === 0 ? 7 : mm % 5 === 0 ? 5 : 3;
    ctx.moveTo(x, y0); ctx.lineTo(x, y0 + len);
  }
  ctx.stroke();
  const labelEvery = pxPerMm * 10 >= 26 ? 10 : 20;
  for (let mm = labelEvery; mm < totalMm - 2; mm += labelEvery) ctx.fillText(String(mm), mm * pxPerMm, y0 + 9);

  const lenMm = totalW / k, hMm = (tape ? m.tapeMm : sc.H / k);
  const what = tape ? `${m.tapeMm} mm tape` : m.kind === 'continuous' ? m.name : `${m.widthMm} × ${m.heightMm} mm`;
  meta.textContent = `${what} · ${lenMm.toFixed(1)} × ${hMm.toFixed(1)} mm · ${sc.W} × ${sc.H / (sc.ySub || 1)} dots @ ${dpiLabel(m)}`;
  $('stagePos').textContent = `${i + 1} / ${labels.length}`;
  warn.innerHTML = '';
  for (const e of sc.errors) { const li = document.createElement('li'); li.textContent = e; warn.appendChild(li); }
  updateLineEffects();
}

// ------------------------------------------------------------------ table
function iconThumb(canvas, id, px = 26) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.height = Math.round(px * dpr);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const pad = canvas.width * 0.1;
  paintIcon(ctx, id, pad, pad, canvas.width - 2 * pad, '#111111', '#ffffff', customImages);
}
function iconName(id) {
  if (!id) return 'No icon';
  if (id.startsWith('img-')) return (customIcons.find(c => c.id === id) || {}).name || 'Image';
  return (ICON_MAP[id] || {}).name || id;
}

function makeIconButton(l, slot) {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'icon-pick';
  const id = l[slot];
  b.title = `${slot === 'icon' ? 'Icon' : 'Second icon'}: ${iconName(id)}`;
  b.setAttribute('aria-label', b.title);
  if (id) { const c = document.createElement('canvas'); iconThumb(c, id); b.appendChild(c); }
  else { b.classList.add('empty'); b.textContent = '+'; }
  b.addEventListener('click', () => openIconDialog(id, slot === 'icon' ? 'Choose an icon' : 'Choose a second icon', newIcon => {
    l[slot] = newIcon;
    b.replaceWith(makeIconButton(l, slot));
    rerender();
  }));
  return b;
}

function makeRow(l) {
  const tr = document.createElement('tr');
  tr.dataset.id = l.id;
  if (l.id === selId) tr.classList.add('sel');
  const td = cls => { const c = document.createElement('td'); if (cls) c.className = cls; tr.appendChild(c); return c; };
  const thumb = td();
  thumb.innerHTML = '<div class="thumb"><canvas></canvas><span class="flag" hidden></span></div>';
  thumb.firstChild.addEventListener('click', () => select(l.id));
  ['l1', 'l2', 'l3', 'l4', 'l5'].forEach((cls, i) => {
    const c = td(cls);
    c.hidden = i >= (+S.lineCount || 3);
    const inp = document.createElement('input');
    inp.type = 'text'; inp.value = l.lines[i] || ''; inp.id = `${l.id}-line${i + 1}`;
    inp.setAttribute('aria-label', `Line ${i + 1}`);
    inp.placeholder = i === 0 ? 'Main text' : '';
    inp.addEventListener('input', () => { l.lines[i] = inp.value; rerender(); });
    c.appendChild(inp);
  });
  const ic = td(); const box = document.createElement('div'); box.className = 'icons-cell';
  box.append(makeIconButton(l, 'icon'), makeIconButton(l, 'icon2')); ic.appendChild(box);
  const cc = td(); const cbox = document.createElement('div'); cbox.className = 'code-cell';
  const sel = document.createElement('select'); sel.id = `${l.id}-ctype`; sel.setAttribute('aria-label', 'Code type');
  CODE_TYPES.forEach(t => sel.add(new Option(t.name, t.id, false, t.id === l.codeType)));
  const cin = document.createElement('input'); cin.type = 'text'; cin.value = l.code; cin.id = `${l.id}-code`; cin.placeholder = 'Code text'; cin.setAttribute('aria-label', 'Code text');
  cin.disabled = l.codeType === 'none';
  sel.addEventListener('change', () => { l.codeType = sel.value; cin.disabled = sel.value === 'none'; if (sel.value !== 'none' && !l.code) { l.code = l.lines[0]; cin.value = l.code; } rerender(); });
  cin.addEventListener('input', () => { l.code = cin.value; rerender(); });
  cbox.append(sel, cin); cc.appendChild(cbox);
  const lc = td('len'); lc.hidden = !lenColumnVisible();
  const lin = document.createElement('input'); lin.type = 'number'; lin.min = '0.5'; lin.step = S.lengthMode === 'units' ? '0.5' : '1';
  lin.value = l.len ?? ''; lin.id = `${l.id}-len`; lin.setAttribute('aria-label', 'Length');
  lin.addEventListener('input', () => { l.len = lin.value === '' ? null : +lin.value; rerender(); });
  lc.appendChild(lin);
  const qc = td('qty');
  const qin = document.createElement('input'); qin.type = 'number'; qin.min = '1'; qin.max = '999'; qin.value = l.qty; qin.id = `${l.id}-qty`; qin.setAttribute('aria-label', 'Copies');
  qin.addEventListener('input', () => { l.qty = Math.max(1, Math.min(999, parseInt(qin.value, 10) || 1)); updateCounts(); save(); });
  qc.appendChild(qin);
  const ac = td(); ac.innerHTML = '<div class="act"><button type="button" class="dup" title="Duplicate" aria-label="Duplicate">⧉</button><button type="button" class="del" title="Delete" aria-label="Delete">×</button></div>';
  ac.querySelector('.dup').addEventListener('click', () => {
    const idx = labels.indexOf(l);
    const copy = mkLabel({ ...l, lines: [...l.lines] });
    labels.splice(idx + 1, 0, copy);
    selId = copy.id; buildTable(); rerender(true);
  });
  ac.querySelector('.del').addEventListener('click', () => {
    const idx = labels.indexOf(l);
    labels.splice(idx, 1);
    if (selId === l.id) selId = labels[Math.min(idx, labels.length - 1)]?.id || null;
    buildTable(); rerender(true);
  });
  tr.addEventListener('focusin', () => select(l.id, true));
  return tr;
}

function lenColumnVisible() { return isVariable(currentMedia()) && S.lengthMode !== 'auto'; }
function buildTable() {
  const tb = $('labelRows');
  tb.innerHTML = '';
  labels.forEach(l => tb.appendChild(makeRow(l)));
  $('lenHead').hidden = !lenColumnVisible();
  $('lineHead4').hidden = (+S.lineCount || 3) < 4;
  $('lineHead5').hidden = (+S.lineCount || 3) < 5;
  $('lenHead').textContent = S.lengthMode === 'units' ? 'Units' : 'mm';
  $('emptyList').hidden = labels.length > 0;
}
function select(id, fromFocus) {
  if (selId === id) return;
  selId = id;
  document.querySelectorAll('#labelRows tr').forEach(tr => tr.classList.toggle('sel', tr.dataset.id === id));
  if (!fromFocus) { const row = document.querySelector(`tr[data-id="${id}"]`); row && row.scrollIntoView({ block: 'nearest' }); }
  drawStage();
}
function updateCounts() {
  const copies = labels.reduce((s, l) => s + (l.qty || 1), 0);
  $('listCount').textContent = labels.length ? `${labels.length} labels · ${copies} to print` : '';
  $('printAll').textContent = copies ? `Print all (${copies})` : 'Print all';
}

// ------------------------------------------------------------ icon dialog
let iconCb = null;
function openIconDialog(current, title, cb) {
  iconCb = cb;
  $('iconDlgTitle').textContent = title;
  $('iconSearch').value = '';
  buildIconGrid(current, '');
  const d = $('iconDlg');
  if (d.showModal) d.showModal(); else d.setAttribute('open', '');
  setTimeout(() => $('iconSearch').focus(), 30);
}
function buildIconGrid(current, q) {
  const grid = $('iconGrid');
  grid.innerHTML = '';
  q = q.trim().toLowerCase();
  const match = (name, extra = '') => !q || (name + ' ' + extra).toLowerCase().includes(q);
  const section = (title, items) => {
    if (!items.length) return;
    const wrap = document.createElement('div');
    wrap.innerHTML = `<h4>${title}</h4><div class="grid"></div>`;
    const g = wrap.querySelector('.grid');
    items.forEach(it => g.appendChild(it));
    grid.appendChild(wrap);
  };
  const opt = (id, name) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'icon-opt' + (id === current ? ' cur' : '');
    if (id) { const c = document.createElement('canvas'); iconThumb(c, id, 40); b.appendChild(c); }
    else { const s = document.createElement('span'); s.style.cssText = 'width:40px;height:40px;display:grid;place-items:center;font-size:20px;color:var(--muted)'; s.textContent = '∅'; b.appendChild(s); }
    b.append(document.createTextNode(name));
    b.addEventListener('click', () => { $('iconDlg').close(); iconCb && iconCb(id); });
    return b;
  };
  if (!q) section('None', [opt('', 'No icon')]);
  section('Your images', customIcons.filter(c => match(c.name)).map(c => opt(c.id, c.name)));
  for (const cat of ICON_CATS) section(cat, ICONS.filter(i => i.cat === cat && match(i.name, i.tags + ' ' + i.id)).map(i => opt(i.id, i.name)));
  if (!grid.children.length) grid.innerHTML = '<p class="hint">No icons match that search.</p>';
}

// ---------------------------------------------------------------- library
function renderCatPicker() {
  const root = $('catPicker');
  root.innerHTML = '';
  const groups = [...new Set(CATEGORIES.map(c => c.group))];
  for (const g of groups) {
    const wrap = document.createElement('div'); wrap.className = 'cat-group';
    wrap.innerHTML = `<h4>${g}</h4><div class="cat-grid"></div>`;
    const grid = wrap.querySelector('.cat-grid');
    CATEGORIES.filter(c => c.group === g).forEach(c => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'cat'; b.setAttribute('aria-pressed', String(c.id === libCat));
      const cv = document.createElement('canvas'); iconThumb(cv, c.icon, 30);
      b.append(cv, document.createTextNode(c.name));
      b.addEventListener('click', () => { libCat = c.id; renderCatPicker(); renderLibForm(); save(); });
      grid.appendChild(b);
    });
    root.appendChild(wrap);
  }
}
function libCategory() { return CATEGORIES.find(c => c.id === libCat) || CATEGORIES[0]; }
function libVals() {
  const cat = libCategory();
  if (!libValues[cat.id]) libValues[cat.id] = defaultsFor(cat);
  const v = libValues[cat.id];
  if (!Array.isArray(v.tpl)) migrateLibValues(cat, v);
  for (const f of [...cat.fields, ...COMMON_FIELDS]) if (!(f.id in v)) v[f.id] = Array.isArray(f.def) ? [...f.def] : f.def;
  return v;
}
// Older versions chose content with "Details on the label" (show), "Standard shown: None" and
// "Put specs on a third line" (three). Turn those choices into line templates once.
function migrateLibValues(cat, v) {
  let tpl = [...cat.tpl];
  const drop = new Set();
  if (Array.isArray(v.show)) {
    const optional = ['type', 'drive', 'material', 'standard', 'pitch', 'key', 'dims', 'power', 'tol', 'pkg', 'bands', 'smd', 'volt', 'diel', 'code'];
    for (const t of optional) if (!v.show.includes(t)) drop.add(t);
    // pitch/smd were opt-in extras: add them to the specs line if they were switched on
    if (v.show.includes('pitch') && cat.tokens.some(t => t[0] === 'pitch') && !tpl.join(' ').includes('{pitch}')) tpl[2] = tpl[2] ? `${tpl[2]} · {pitch}` : '{pitch}';
    if (v.show.includes('smd') && cat.id === 'resistors') tpl[2] = tpl[2] ? `${tpl[2]} · {smd}` : '{smd}';
  }
  if (v.std === 'none') { drop.add('standard'); v.std = 'iso'; }
  tpl = tpl.map(line => fillTemplateDrop(line, drop));
  if (v.three === false) { tpl = [tpl[0], [tpl[1], tpl[2]].filter(Boolean).join(' · '), '', tpl[3] || '', tpl[4] || '']; }
  v.tpl = tpl;
  delete v.show; delete v.three;
}
// Removes {token} pieces (and their separators) from a template line.
function fillTemplateDrop(line, drop) {
  return line.split(/\s*·\s*/).filter(seg => !(/^\{(\w+)\}$/.test(seg.trim()) && drop.has(seg.trim().slice(1, -1)))).join(' · ');
}
// "Label lines" editor: one template per line. Item buttons insert {token} into the line that
// was clicked last; anything else typed is printed as is.
let tplFocus = 1;
function lineTemplateEditor(cat, v) {
  const wrap = document.createElement('div'); wrap.className = 'lines-editor';
  const head = document.createElement('div'); head.className = 'lines-head';
  head.innerHTML = '<label>Label lines</label>';
  const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = 'Reset';
  reset.title = 'Back to this category\'s standard lines';
  reset.addEventListener('click', () => { v.tpl = [...cat.tpl]; renderLibForm(); });
  head.appendChild(reset);
  // Example values from the first part, so each button shows what it will print.
  let sample = {};
  try { sample = (cat.build(v)[0] || {}).parts || {}; } catch { /* no parts selected */ }
  const bar = document.createElement('div'); bar.className = 'token-bar';
  const inputs = [];
  for (const [id, label] of cat.tokens) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'chip token';
    b.innerHTML = `<b></b><span></span>`;
    b.querySelector('b').textContent = label;
    b.querySelector('span').textContent = sample[id] ? sample[id] : '(empty for this part)';
    b.title = `Adds {${id}} to line ${tplFocus + 1}`;
    b.addEventListener('mousedown', e => e.preventDefault()); // keep the caret in the line input
    b.addEventListener('click', () => {
      const inp = inputs[tplFocus];
      const tok = `{${id}}`;
      const s = inp.value, a = inp.selectionStart ?? s.length, z = inp.selectionEnd ?? s.length;
      const before = s.slice(0, a), after = s.slice(z);
      const sepBefore = before.trim() && !/[·\s]$/.test(before) ? ' · ' : before.trim() && !/·\s*$/.test(before) ? '· ' : '';
      const sepAfter = after.trim() && !/^\s*·/.test(after) ? ' · ' : '';
      inp.value = before + sepBefore + tok + sepAfter + after;
      const caret = (before + sepBefore + tok).length;
      inp.focus(); inp.setSelectionRange(caret, caret);
      inp.dispatchEvent(new Event('input'));
    });
    bar.appendChild(b);
  }
  const rows = document.createElement('div'); rows.className = 'line-tpls';
  for (let i = 0; i < 5; i++) {
    const lab = document.createElement('label'); lab.className = 'line-tpl';
    const span = document.createElement('span'); span.textContent = `Line ${i + 1}`;
    const inp = document.createElement('input'); inp.type = 'text'; inp.value = (v.tpl || [])[i] || '';
    inp.id = `lib-${cat.id}-tpl-${i}`; inp.placeholder = i === 0 ? 'e.g. {size}' : '(empty)';
    inp.setAttribute('aria-label', `Line ${i + 1} contents`);
    inp.addEventListener('focus', () => { tplFocus = i; rows.querySelectorAll('.line-tpl').forEach((r, j) => r.classList.toggle('focus', j === i)); bar.querySelectorAll('.token').forEach(b => { b.title = b.title.replace(/line \d/, `line ${i + 1}`); }); });
    inp.addEventListener('input', () => { v.tpl = inputs.map(x => x.value); updateLibPreview(); });
    if (i === tplFocus) lab.classList.add('focus');
    inputs.push(inp);
    lab.append(span, inp);
    rows.appendChild(lab);
  }
  const hint = document.createElement('p'); hint.className = 'hint';
  hint.textContent = 'Click a line, then click items to add them. Type anything else to print it as written, e.g. "Bin 14". Items that are empty for a part are left out. Lines 4 and 5 print when Design → Text lines is 4 or 5 (it goes up automatically when you add labels that use them).';
  wrap.append(head, bar, rows, hint);
  return wrap;
}
const resolveOpts = (f, v) => (typeof f.options === 'function' ? f.options(v) : f.options || []);

function renderLibForm() {
  const cat = libCategory();
  const v = libVals();
  const form = $('libForm');
  form.innerHTML = '';
  // The line editor goes first: what each line says is the main thing to set here.
  const fields = [...cat.fields, ...COMMON_FIELDS];
  fields.sort((a, b) => (b.type === 'lines') - (a.type === 'lines'));
  for (const f of fields) {
    if (f.show && !f.show(v)) continue;
    const fid = `lib-${cat.id}-${f.id}`;
    if (f.type === 'lines') { form.appendChild(lineTemplateEditor(cat, v)); continue; }
    if (f.type === 'chips') {
      const opts = resolveOpts(f, v);
      const wrap = document.createElement('div'); wrap.className = 'chips-field';
      const head = document.createElement('span');
      head.innerHTML = `<label>${f.label}</label>`;
      const allBtn = document.createElement('button'); allBtn.type = 'button';
      const allOn = opts.length && opts.every(o => v[f.id].includes(o.v));
      allBtn.textContent = allOn ? 'None' : 'All';
      allBtn.addEventListener('click', () => {
        const ids = opts.map(o => o.v);
        v[f.id] = allOn ? v[f.id].filter(x => !ids.includes(x)) : [...new Set([...v[f.id], ...ids])];
        renderLibForm();
      });
      head.appendChild(allBtn);
      const chips = document.createElement('div'); chips.className = 'chips'; chips.id = fid;
      opts.forEach(o => {
        const c = document.createElement('button'); c.type = 'button'; c.className = 'chip'; c.textContent = o.t;
        c.setAttribute('aria-pressed', String(v[f.id].includes(o.v)));
        c.addEventListener('click', () => {
          const on = v[f.id].includes(o.v);
          v[f.id] = on ? v[f.id].filter(x => x !== o.v) : [...v[f.id], o.v];
          c.setAttribute('aria-pressed', String(!on));
          if (cat.fields.some(x => typeof x.options === 'function' && x.id !== f.id)) renderLibForm(); else updateLibPreview();
        });
        chips.appendChild(c);
      });
      wrap.append(head, chips);
      form.appendChild(wrap);
    } else if (f.type === 'check') {
      const lab = document.createElement('label'); lab.className = 'check check-field';
      const inp = document.createElement('input'); inp.type = 'checkbox'; inp.id = fid; inp.checked = !!v[f.id];
      inp.addEventListener('change', () => { v[f.id] = inp.checked; updateLibPreview(); });
      lab.append(inp, document.createTextNode(' ' + f.label));
      form.appendChild(lab);
    } else {
      const lab = document.createElement('label'); lab.className = 'field' + (f.wide || f.type === 'textarea' ? ' wide' : '');
      lab.innerHTML = `<span>${f.label}</span>`;
      let inp;
      if (f.type === 'select' || f.type === 'icon') {
        inp = document.createElement('select');
        if (f.type === 'icon') {
          inp.add(new Option('No icon', ''));
          for (const c of ICON_CATS) {
            const og = document.createElement('optgroup'); og.label = c;
            ICONS.filter(i => i.cat === c).forEach(i => og.appendChild(new Option(i.name, i.id)));
            inp.appendChild(og);
          }
          customIcons.forEach(c => inp.add(new Option(c.name, c.id)));
        } else resolveOpts(f, v).forEach(o => inp.add(new Option(o.t, o.v)));
        inp.value = v[f.id];
        if (inp.value !== v[f.id] && inp.options.length) { v[f.id] = inp.options[0].value; inp.value = v[f.id]; }
        inp.addEventListener('change', () => { v[f.id] = inp.value; renderLibForm(); });
      } else if (f.type === 'textarea') {
        inp = document.createElement('textarea'); inp.rows = 5; inp.value = v[f.id] || '';
        inp.addEventListener('input', () => { v[f.id] = inp.value; updateLibPreview(); });
      } else {
        inp = document.createElement('input'); inp.type = 'text'; inp.value = v[f.id] || ''; if (f.placeholder) inp.placeholder = f.placeholder;
        inp.addEventListener('input', () => { v[f.id] = inp.value; updateLibPreview(); });
      }
      inp.id = fid;
      lab.appendChild(inp);
      form.appendChild(lab);
    }
  }
  updateLibPreview();
}

function libBuild() {
  const cat = libCategory();
  const v = libVals();
  let items = [];
  try { items = cat.build(v) || []; } catch (e) { console.error(e); items = []; }
  let n = parseInt(v.skuStart, 10) || 1;
  const snapshot = JSON.parse(JSON.stringify(v));
  return items.map((it, i) => {
    const lines = [...it.lines, '', '', '', '', ''].slice(0, MAX_LINES);
    let codeType = 'none', code = '';
    if (v.codeType && v.codeType !== 'none') {
      codeType = v.codeType;
      code = v.codeFrom === 'sku' ? `${v.skuPrefix || ''}${String(n++).padStart(3, '0')}` : v.codeType === 'qr' ? lines.filter(Boolean).join(' ') : lines[0];
    }
    // `src` remembers which library settings made this label, so "Update labels in the list"
    // can re-apply new display choices (details, standard, size format) to it later.
    return { lines, icon: it.icon || '', icon2: it.icon2 || '', codeType, code, src: { cat: cat.id, v: snapshot, i } };
  });
}
// Library fields that only change what's written, not which parts are listed.
const DISPLAY_FIELDS = ['tpl', 'std', 'fmt', 'driveIcon'];
function libLabelsInList() { const id = libCategory().id; return labels.filter(l => l.src && l.src.cat === id); }
function libUpdateExisting() {
  const cat = libCategory(), cur = libVals();
  const groups = new Map();
  for (const l of libLabelsInList()) { const k = JSON.stringify(l.src.v); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(l); }
  let n = 0;
  for (const [k, ls] of groups) {
    const v = JSON.parse(k);
    for (const f of DISPLAY_FIELDS) if (f in cur) v[f] = Array.isArray(cur[f]) ? [...cur[f]] : cur[f];
    let items = [];
    try { items = cat.build(v) || []; } catch (e) { console.error(e); }
    for (const l of ls) {
      const it = items[l.src.i];
      if (!it) continue;
      l.lines = [...it.lines, '', '', '', '', ''].slice(0, MAX_LINES);
      l.icon = it.icon || ''; l.icon2 = it.icon2 || '';
      l.src = { ...l.src, v };
      n++;
    }
  }
  const raised = fitLineCount(labels);
  buildTable(); rerender(true);
  $('libUpdateMsg').textContent = `Updated ${n} label${n === 1 ? '' : 's'}.${raised ? ` Text lines set to ${raised} so every line shows.` : ''}`;
}
// If labels use lines beyond the Text lines setting, raise it so nothing is silently hidden.
function fitLineCount(list) {
  let need = 0;
  for (const l of list) for (let i = MAX_LINES - 1; i >= 0; i--) if ((l.lines[i] || '').trim()) { need = Math.max(need, i + 1); break; }
  if (need > (+S.lineCount || 3)) { S.lineCount = need; syncControls(); return need; }
  return 0;
}
function updateLibPreview() {
  const items = libBuild();
  $('libCount').textContent = items.length;
  const ul = $('libPreview');
  ul.innerHTML = '';
  items.slice(0, 40).forEach(it => {
    const li = document.createElement('li');
    const b = document.createElement('b'); b.textContent = it.lines[0];
    const s = document.createElement('span'); s.textContent = it.lines.slice(1).filter(Boolean).join(' / ');
    li.append(b, s); ul.appendChild(li);
  });
  if (items.length > 40) { const li = document.createElement('li'); li.innerHTML = `<span>and ${items.length - 40} more</span>`; ul.appendChild(li); }
  $('libAdd').disabled = $('libReplace').disabled = !items.length;
  $('libAdd').textContent = items.length ? `Add ${items.length} to list` : 'Add to list';
  const inList = libLabelsInList().length;
  $('libUpdate').hidden = !inList;
  $('libUpdate').textContent = `Update ${inList} ${libCategory().name.toLowerCase()} label${inList === 1 ? '' : 's'} in the list`;
  $('libUpdateMsg').textContent = '';
  save();
}
function addLabels(items, replace) {
  const fresh = items.map(mkLabel);
  if (replace) labels = fresh; else labels.push(...fresh);
  fitLineCount(fresh);
  if (fresh.length) selId = fresh[0].id;
  buildTable();
  rerender(true);
  updateLibPreview(); // refresh the "Update N labels in the list" count
  const row = document.querySelector(`tr[data-id="${selId}"]`);
  row && row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

// ------------------------------------------------------- design controls
function fillSelects() {
  const ms = $('media');
  const groups = {};
  MEDIA.forEach(m => { (groups[m.group] ||= []).push(m); });
  for (const [g, list] of Object.entries(groups)) {
    const og = document.createElement('optgroup'); og.label = g;
    list.forEach(m => og.appendChild(new Option(m.name, m.id)));
    ms.appendChild(og);
  }
  const lp = $('lengthPreset');
  lp.add(new Option('None (set the length below)', ''));
  const pg = {};
  LENGTH_PRESETS.forEach(p => { (pg[p.group] ||= []).push(p); });
  for (const [g, list] of Object.entries(pg)) {
    const og = document.createElement('optgroup'); og.label = g;
    list.forEach(p => og.appendChild(new Option(p.name, p.id)));
    lp.appendChild(og);
  }
  TAPE_COLORS.forEach(c => $('tapeColor').add(new Option(c.name, c.id)));
  FONTS.forEach(f => $('font').add(new Option(f.family + (f.system ? ' (system)' : ''), f.family)));
}
function syncControls() {
  document.querySelectorAll('[data-key]').forEach(el => {
    const v = S[el.dataset.key];
    if (el.type === 'checkbox') el.checked = !!v; else el.value = v;
  });
  updateDesignVisibility();
}
function updateDesignVisibility() {
  const m = currentMedia();
  const variable = isVariable(m);
  $('customSize').hidden = !m.custom;
  $('lengthBlock').hidden = !variable;
  $('fLengthMm').hidden = S.lengthMode !== 'fixed';
  $('fUnitPitch').hidden = $('fUnitInset').hidden = S.lengthMode !== 'units';
  $('unitHint').hidden = S.lengthMode !== 'units';
  const p = +S.unitPitch || 42, ins = +S.unitInset || 0;
  $('unitHint').textContent = `1 unit = ${(p - ins).toFixed(1)} mm · 2 = ${(2 * p - ins).toFixed(1)} mm · 3 = ${(3 * p - ins).toFixed(1)} mm. Set each label's units in the list.`;
  $('fTapeColor').hidden = m.kind !== 'tape';
  $('fEdge').hidden = m.kind !== 'tape';
  renderLineSpecs();
  $('iconScaleOut').textContent = Math.round(S.iconScale * 100) + '%';
  $('iconScale2Out').textContent = Math.round((S.iconScale2 ?? 0.66) * 100) + '%';
  const cs = codeScaleFor(S.media);
  $('codeScale').value = cs;
  $('codeScaleOut').textContent = Math.round(cs * 100) + '% of the height';
  $('codeScaleFor').textContent = `(for ${m.custom ? 'custom size' : m.name})`;
  const tape = m.kind === 'tape';
  $('printBody').hidden = !tape;
  $('connUsb').hidden = $('connBt').hidden = IS_NATIVE || !tape || !!conn;
  $('nativePick').hidden = !IS_NATIVE || !tape || !!conn;
  $('connClose').hidden = !conn;
  $('printNA').hidden = tape;
  document.querySelector('[data-exp="bin"]').disabled = !tape;
  $('sheetRow').hidden = false;
  $('fSkip').hidden = m.kind !== 'sheet';
  $('sheetPage').disabled = m.kind === 'sheet';
  const what = m.custom ? `Custom ${m.widthMm}×${m.heightMm} mm` : m.name;
  $('mediaChip').textContent = `${what} · ${dpiLabel(m)}`;
  $('fHd').hidden = !MEDIA_MAP[S.media]?.hdCapable;
  const pre = LENGTH_PRESET_MAP[S.lengthPreset];
  $('presetHint').hidden = !pre;
  if (pre) {
    const tight = pre.tight ? ' Margins are as small as the printer allows: 2 mm of blank tape at each end, no padding.' : '';
    $('presetHint').textContent = `Each label is cut at ${pre.mm} mm.${tight} The first label of a print run can come out longer, because the printer feeds about 24 mm of tape before its first cut.`;
  }
}
// Per-line size and weight table (Design → Text). Auto mode: % of line 1. Fixed mode: points.
let lineSpecSig = '';
const WEIGHTS = [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold']];
function renderLineSpecs() {
  const n = +S.lineCount || 3, fixed = S.sizeMode === 'fixed';
  $('lineSizeHead').textContent = fixed ? 'Size (pt)' : 'Size (% of line 1)';
  $('sizeHint').textContent = fixed
    ? 'Each line prints at its point size, unless it doesn\'t fit; then the text shrinks and the preview says so.'
    : 'Line 1 grows until the text fills the height or a line reaches the end of the label. Other lines follow at their percentage.';
  const sig = `${n}|${fixed}`;
  const tb = $('lineSpecs');
  if (sig === lineSpecSig && tb.children.length) {
    // Same shape: just refresh the values (e.g. after Open or New).
    [...tb.querySelectorAll('input')].forEach(inp => { const i = +inp.dataset.i; inp.value = fixed ? S.linePt[i] : Math.round(S.lineRel[i] * 100); });
    [...tb.querySelectorAll('select')].forEach(sel => { sel.value = S.lineW[+sel.dataset.i]; });
    return;
  }
  lineSpecSig = sig;
  tb.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const tr = document.createElement('tr');
    const c0 = document.createElement('td'); c0.textContent = String(i + 1);
    const c1 = document.createElement('td');
    if (!fixed && i === 0) { c1.textContent = '100% (sets the scale)'; }
    else {
      const inp = document.createElement('input');
      inp.type = 'number'; inp.dataset.i = i; inp.setAttribute('aria-label', `Line ${i + 1} size`);
      if (fixed) { inp.min = '3'; inp.max = '96'; inp.step = '0.5'; inp.value = S.linePt[i]; }
      else { inp.min = '10'; inp.max = '200'; inp.step = '1'; inp.value = Math.round(S.lineRel[i] * 100); }
      inp.addEventListener('input', () => {
        const v = +inp.value; if (!(v > 0)) return;
        if (fixed) { S.linePt = S.linePt.map((x, j) => (j === i ? v : x)); }
        else { S.lineRel = S.lineRel.map((x, j) => (j === i ? v / 100 : x)); }
        rerender(true);
      });
      c1.appendChild(inp);
    }
    const c2 = document.createElement('td');
    const sel = document.createElement('select'); sel.dataset.i = i; sel.setAttribute('aria-label', `Line ${i + 1} weight`);
    WEIGHTS.forEach(([v, t]) => sel.add(new Option(t, v)));
    sel.value = S.lineW[i];
    sel.addEventListener('change', () => { S.lineW = S.lineW.map((x, j) => (j === i ? sel.value : x)); ensureFont(); rerender(true); });
    c2.appendChild(sel);
    const c3 = document.createElement('td'); c3.className = 'eff'; c3.dataset.i = i; c3.textContent = '–';
    tr.append(c0, c1, c2, c3);
    tb.appendChild(tr);
  }
  updateLineEffects();
}
// "Prints at" column: the size each line of the selected label really gets, and why it's smaller
// than its setting when the label's length is the limit.
function updateLineEffects() {
  const r = renders[selIndex()];
  const cells = [...document.querySelectorAll('#lineSpecs td.eff')];
  const note = $('limitNote');
  if (!r) { cells.forEach(c => { c.textContent = '–'; c.classList.remove('lim'); }); note.hidden = true; return; }
  const texts = r.sc.items.filter(it => it.k === 'text');
  const limited = [];
  cells.forEach(c => {
    const t = texts.find(it => it.idx === +c.dataset.i);
    c.classList.toggle('lim', !!(t && t.limited));
    c.textContent = t ? `${(t.size * 72 / r.sc.dpi).toFixed(1)} pt${t.limited ? ' · max' : ''}` : '–';
    if (t && t.limited) limited.push(+c.dataset.i + 1);
  });
  note.hidden = !limited.length;
  if (limited.length) {
    const which = limited.length === 1 ? `Line ${limited[0]} is` : `Lines ${limited.slice(0, -1).join(', ')} and ${limited[limited.length - 1]} are`;
    note.textContent = `${which} as large as this label's length allows, so a bigger size setting can't make ${limited.length === 1 ? 'it' : 'them'} grow. To get bigger text: put less on the line (Parts library → Details on the label, then "Update labels in the list"), make the label longer, put the second icon on line 1 (Arrangement), or make the icons smaller.`;
  }
}
// Applies a length preset. Tight presets (SLICC) also pick the smallest margins.
function applyLengthPreset(id) {
  const p = LENGTH_PRESET_MAP[id];
  if (!p) return;
  S.lengthMode = 'fixed';
  S.lengthMm = p.mm;
  if (p.tight) {
    Object.assign(S, { marginMm: PTOUCH_MIN_MARGIN_MM, padMm: 0, edgeMm: 0, outMode: 'pages', cutMode: 'each' });
  }
  syncControls(); // labels with their own length (mm column) keep it, so 33 and 63 mm can share a batch
}
async function ensureFont() {
  const f = FONTS.find(x => x.family === S.font);
  if (!f || f.system || !document.fonts) return;
  try {
    await Promise.all([...new Set(S.lineW)].map(w => document.fonts.load(`${w} 40px "${S.font}"`)));
  } catch { /* fall back silently */ }
  clearMetrics(); fontVersion++; rerender(true);
}
function onControl(el) {
  const key = el.dataset.key;
  let v;
  if (el.type === 'checkbox') v = el.checked;
  else if (el.type === 'number' || el.type === 'range') v = el.value === '' ? DEFAULTS[key] : +el.value;
  else v = el.value;
  S[key] = v;
  if (key === 'lengthPreset') applyLengthPreset(v);
  else if ((key === 'lengthMode' || key === 'lengthMm') && S.lengthPreset) { S.lengthPreset = ''; $('lengthPreset').value = ''; }
  updateDesignVisibility();
  if (key === 'font') ensureFont();
  if (key === 'media' || key === 'lengthMode' || key === 'lengthPreset' || key === 'lineCount') buildTable();
  rerender(true);
}

// ----------------------------------------------------------------- import
const HEADER_MAP = [
  [/^(line ?1|text|label|name|title|part)$/i, 'l1'], [/^(line ?2|sub(title)?|desc(ription)?|detail)$/i, 'l2'], [/^(line ?3|note|spec(s)?)$/i, 'l3'], [/^line ?4$/i, 'l4'], [/^line ?5$/i, 'l5'],
  [/^(icon ?1?|graphic|symbol)$/i, 'icon'], [/^(icon ?2|drive)$/i, 'icon2'], [/^(code|qr|barcode|sku|url)$/i, 'code'],
  [/^(code[ _]?type|format)$/i, 'codeType'], [/^(len(gth)?|units?|u|size)$/i, 'len'], [/^(qty|copies|count|quantity)$/i, 'qty'],
];
function findIcon(s) {
  if (!s) return '';
  const q = s.trim().toLowerCase();
  if (ICON_MAP[q]) return q;
  const hit = ICONS.find(i => i.name.toLowerCase() === q) || ICONS.find(i => i.name.toLowerCase().includes(q) || i.tags.includes(q));
  const custom = customIcons.find(c => c.name.toLowerCase() === q || c.id === s.trim());
  return hit ? hit.id : custom ? custom.id : '';
}
function findCodeType(s, code) {
  if (!s) return code ? 'qr' : 'none';
  const q = s.toLowerCase().replace(/[\s-]/g, '');
  const t = CODE_TYPES.find(c => c.id === q || c.name.toLowerCase().replace(/[\s-]/g, '') === q);
  return t ? t.id : 'qr';
}
function importRows(replace) {
  const rows = parseTable($('importText').value);
  const msg = $('importMsg');
  if (!rows.length) { msg.textContent = 'Nothing to import. Paste rows or load a CSV file first.'; return; }
  let map = rows[0].map(h => (HEADER_MAP.find(([re]) => re.test(h.trim())) || [])[1] || null);
  let body = rows;
  if (map.some(Boolean)) body = rows.slice(1);
  else map = ['l1', 'l2', 'l3', 'code'];
  const items = body.map(r => {
    const g = key => { const i = map.indexOf(key); return i >= 0 ? (r[i] || '').trim() : ''; };
    const code = g('code');
    return {
      lines: [g('l1'), g('l2'), g('l3'), g('l4'), g('l5')], icon: findIcon(g('icon')), icon2: findIcon(g('icon2')),
      code, codeType: code ? findCodeType(g('codeType'), code) : 'none',
      len: g('len') ? +g('len') || null : null, qty: Math.max(1, parseInt(g('qty'), 10) || 1),
    };
  }).filter(it => it.lines.some(Boolean));
  if (!items.length) { msg.textContent = 'No rows with text were found.'; return; }
  addLabels(items, replace);
  msg.textContent = `Imported ${items.length} label${items.length === 1 ? '' : 's'}.`;
}
function renderCustomList() {
  const root = $('customList');
  root.innerHTML = '';
  customIcons.forEach(c => {
    const d = document.createElement('div'); d.className = 'custom-item';
    const img = document.createElement('img'); img.src = c.src; img.alt = '';
    const name = document.createElement('span'); name.textContent = c.name;
    const del = document.createElement('button'); del.type = 'button'; del.textContent = '×'; del.title = `Remove ${c.name}`; del.setAttribute('aria-label', del.title);
    del.addEventListener('click', () => {
      customIcons = customIcons.filter(x => x.id !== c.id); customImages.delete(c.id);
      labels.forEach(l => { if (l.icon === c.id) l.icon = ''; if (l.icon2 === c.id) l.icon2 = ''; });
      renderCustomList(); buildTable(); rerender(true);
    });
    d.append(img, name, del); root.appendChild(d);
  });
}

// ---------------------------------------------------------------- printer
let conn = null;
function log(text, cls) {
  const li = document.createElement('li');
  li.textContent = text;
  if (cls) li.className = cls;
  const ol = $('log');
  ol.prepend(li);
  while (ol.children.length > 30) ol.lastChild.remove();
}
function connErr(e, what) {
  const msg = String(e && (e.message || e));
  if (e && (e.name === 'NotFoundError' || e.name === 'AbortError')) { log('No printer was chosen.'); return; }
  if (e && e.code === 'claim') {
    log('USB found the printer, but Windows\' Brother driver is holding it, so the browser can\'t open it. Use Bluetooth instead, or switch the printer to the WinUSB driver (see Connection help).', 'err');
    console.warn(e); return;
  }
  if (IS_NATIVE) { log(msg, 'err'); return; } // messages from the desktop app are already written for people
  const blocked = !window.isSecureContext || /permissions policy|feature .* disallowed/i.test(msg);
  if (blocked) { log(`This page isn't allowed to use ${what} here. Open the studio directly in Chrome or Edge over HTTPS or localhost.`, 'err'); return; }
  log(`${what} error: ${e && e.name ? e.name + ': ' : ''}${msg}`, 'err');
}
function setConn(c) {
  conn = c;
  const pill = $('connPill');
  pill.textContent = c ? `${c.kind} · ${c.name}` : 'Not connected';
  pill.classList.toggle('on', !!c);
  updateDesignVisibility();
}
// ---- desktop app: printers listed by Windows, last one remembered and reconnected at startup
const PRINTER_KEY = 'labelina-printer';
let nativePrinters = [];
const printerId = p => `${p.kind}:${p.address}`;
async function refreshNativePrinters() {
  const sel = $('nativePrinter');
  try { nativePrinters = await listNativePrinters(); } catch (e) { nativePrinters = []; connErr(e, 'Printer search'); }
  let saved = null; try { saved = localStorage.getItem(PRINTER_KEY); } catch { }
  sel.innerHTML = '';
  if (!nativePrinters.length) sel.add(new Option('No printers found: plug in USB or pair Bluetooth, then Refresh', ''));
  nativePrinters.forEach(p => sel.add(new Option(`${p.name} · ${p.detail}`, printerId(p))));
  if (saved && nativePrinters.some(p => printerId(p) === saved)) sel.value = saved;
  $('nativeConnect').disabled = !nativePrinters.length;
  return saved;
}
async function connectNativeSelected(quiet) {
  const p = nativePrinters.find(x => printerId(x) === $('nativePrinter').value);
  if (!p) return;
  const pill = $('connPill');
  pill.textContent = `Connecting to ${p.name}…`; pill.classList.add('busy');
  $('nativeConnect').disabled = true;
  try {
    const c = await connectNative(p);
    try { localStorage.setItem(PRINTER_KEY, printerId(p)); } catch { }
    setConn(c);
    log(`Connected to ${p.name} over ${c.kind}.`, 'ok');
    if (c.canRead) readTape(true);
  } catch (e) {
    setConn(null);
    if (quiet) log(`Couldn't reconnect to ${p.name}. Switch it on and press Connect. (${e})`);
    else connErr(e, p.name);
  } finally { pill.classList.remove('busy'); $('nativeConnect').disabled = !nativePrinters.length; }
}
async function initNative() {
  document.querySelectorAll('[data-web]').forEach(el => { el.hidden = true; });
  $('nativeConnect').addEventListener('click', () => connectNativeSelected(false));
  $('nativeRefresh').addEventListener('click', () => refreshNativePrinters());
  const saved = await refreshNativePrinters();
  updateDesignVisibility();
  if (saved && nativePrinters.some(p => printerId(p) === saved)) connectNativeSelected(true);
}

async function doConnect(kind) {
  try {
    const c = kind === 'usb' ? await connectUSB() : await connectSerial();
    setConn(c);
    log(`Connected over ${c.kind}.`, 'ok');
    readTape(true);
  } catch (e) { connErr(e, kind === 'usb' ? 'USB' : 'Bluetooth'); }
}
let busy = false;
async function readTape(quiet) {
  if (!conn) { log('Connect a printer first.', 'err'); return; }
  if (conn.canRead === false) {
    if (!quiet) log('The Windows print queue can\'t report the tape. Pick the tape size under Design, or connect the USB or Bluetooth entry to read it.');
    return;
  }
  if (busy) return;
  busy = true;
  try {
    await conn.write(STATUS_REQUEST);
    const st = parseStatus(await conn.read(32, 3000));
    if (!st) { if (!quiet) log('The printer did not answer the status request.', 'err'); return; }
    log(`Tape: ${st.widthMm} mm ${st.mediaType.toLowerCase()}, ${st.textColor.toLowerCase()} on ${st.tapeColor.toLowerCase()}.`);
    st.errors.forEach(e => log(e, 'err'));
    // Switch for any TZe tape (laminated, non-laminated, fabric, flexible ID, satin…); tube
    // widths (HS 2:1 = 0x11, 3:1 = 0x17) aren't reported in a documented way.
    const id = `tze-${st.widthMm}`;
    const isTape = st.mediaTypeCode && ![0x00, 0x11, 0x17, 0xff].includes(st.mediaTypeCode);
    if (isTape && MEDIA_MAP[id] && S.media !== id) { S.media = id; log(`Switched media to ${st.widthMm} mm tape.`, 'ok'); }
    const col = TAPE_COLORS.find(c => c.code === st.tapeColorCode && c.text === st.textColorCode);
    if (col) S.tapeColor = col.id;
    syncControls(); buildTable(); rerender(true);
  } catch (e) { connErr(e, 'the printer'); } finally { busy = false; }
}
function expandIndices(which) {
  const idx = which === 'sel' ? [selIndex()] : labels.map((_, i) => i);
  const out = [];
  idx.forEach(i => { for (let q = 0; q < (labels[i].qty || 1); q++) out.push(i); });
  return out;
}
function makeJob(bitmaps) {
  const media = currentMedia();
  const pages = S.outMode === 'strip' && bitmaps.length > 1 ? [joinStrip(bitmaps)] : bitmaps;
  const cut = S.cutMode;
  return buildRasterJob(pages, {
    media, marginMm: feedMmFor(media) || PTOUCH_MIN_MARGIN_MM, flip: S.flip, mirror: S.mirror,
    autoCut: cut !== 'end', chain: cut === 'chain',
  });
}
// Jobs switch automatic status messages off (as Brother's driver does), so we ask: send a bare
// status request every ~0.4 s. Phase 1 = printing, phase 0 = idle/receiving. "Printed" needs
// printing followed by idle; an error bit ends it at once.
async function awaitPrinted(pages) {
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const deadline = Date.now() + 10000 + pages * 6000;
  let sawPrinting = false, idleCount = 0;
  while (Date.now() < deadline) {
    let st = null;
    try { await conn.write(STATUS_ONLY); st = parseStatus(await conn.read(32, 1200)); } catch { break; }
    if (st) {
      if (st.errors.length || st.statusType === 0x02) { log(`The printer reported: ${st.errors.join(', ') || 'an error'}.`, 'err'); return; }
      if (st.phaseType === 1) { sawPrinting = true; idleCount = 0; }
      else if (sawPrinting) { log(`Printed ${pages === 1 ? 'the label' : pages + ' labels'}.`, 'ok'); return; }
      else if (++idleCount >= 8) break; // idle for ~3 s and never started
    }
    await sleep(400);
  }
  if (sawPrinting) log('The printer started but hasn\'t finished yet. Check it for a message.');
  else log('The printer received the job but didn\'t start printing. Check its screen; if it says "Printing… please wait", note what it shows and tell us.', 'err');
}
async function print(which) {
  const media = currentMedia();
  if (media.kind !== 'tape') { log('Direct printing needs P-touch tape media.', 'err'); return; }
  if (!conn) { log('Connect a printer first: USB or Bluetooth.', 'err'); return; }
  if (busy) return;
  let bitmaps;
  if (which === 'test') {
    const test = mkLabel({ lines: ['TOP ▲  START →', 'Orientation test', ''], icon: 'tag' });
    const E = env();
    const g = layout(test, E);
    const f = chooseF(g, S);
    const geo = isVariable(media) && labelLengthMm(test, S) == null ? layout(test, E, f) : g;
    const sc = scene(geo, f, S);
    const ss = ssFor(sc.dpi);
    bitmaps = [toBitmap(renderCanvas(sc, ss, customImages), ss, 0.5, sc.ySub)];
  } else {
    const list = expandIndices(which);
    if (!list.length) { log('There are no labels to print.', 'err'); return; }
    bitmaps = list.map(bitmapOf);
  }
  busy = true;
  ['printSel', 'printAll', 'printTest'].forEach(id => { $(id).disabled = true; });
  try {
    const job = makeJob(bitmaps);
    log(`Sending ${bitmaps.length} label${bitmaps.length === 1 ? '' : 's'} (${(job.length / 1024).toFixed(1)} KB)…`);
    await conn.write(job);
    if (conn.canRead === false) log('Sent to the Windows print queue. If it doesn\'t print, use the plain USB entry instead.', 'ok');
    else await awaitPrinted(S.outMode === 'strip' && bitmaps.length > 1 ? 1 : bitmaps.length);
  } catch (e) { connErr(e, 'the printer'); }
  finally { busy = false; ['printSel', 'printAll', 'printTest'].forEach(id => { $(id).disabled = false; }); }
}

// ---------------------------------------------------------------- exports
function fontCssUrl() {
  const f = FONTS.find(x => x.family === S.font);
  if (!f || f.system) return '';
  const w = [...new Set(S.lineW.map(Number))].filter(x => f.weights.includes(x));
  return `https://fonts.googleapis.com/css2?family=${encodeURIComponent(f.family).replace(/%20/g, '+')}${w.length ? ':wght@' + w.sort((a, b) => a - b).join(';') : ''}&display=swap`;
}
const customSrc = id => (customIcons.find(c => c.id === id) || {}).src;
function exportCanvas(i) {
  const m = currentMedia();
  if (isMono(m)) return bitmapCanvas(squareBitmap(bitmapOf(i)));
  return renderCanvas(renders[i].sc, 2, customImages);
}
const mmOf = sc => ({ wMm: sc.W / sc.dpi * 25.4, hMm: sc.H / sc.dpi * 25.4 });
const fileStem = i => `${String(i + 1).padStart(3, '0')}-${safeName(labels[i].lines[0])}`;

async function doExport(kind) {
  if (!labels.length && kind !== 'csv') { log('Add some labels first.', 'err'); return; }
  const m = currentMedia();
  const i = selIndex();
  try {
    if (kind === 'png') {
      saveBlob(await canvasToPNG(exportCanvas(i), isMono(m) ? m.dpi : m.dpi * 2), `${safeName(labels[i].lines[0])}.png`);
    } else if (kind === 'png-zip') {
      const files = [];
      for (let j = 0; j < labels.length; j++) files.push({ name: `${fileStem(j)}.png`, data: await canvasToPNG(exportCanvas(j), isMono(m) ? m.dpi : m.dpi * 2) });
      saveBlob(await zipFiles(files), 'labels-png.zip');
    } else if (kind === 'svg') {
      saveBlob(new Blob([renderSVG(renders[i].sc, customSrc, fontCssUrl())], { type: 'image/svg+xml' }), `${safeName(labels[i].lines[0])}.svg`);
    } else if (kind === 'svg-zip') {
      const files = labels.map((_, j) => ({ name: `${fileStem(j)}.svg`, data: renderSVG(renders[j].sc, customSrc, fontCssUrl()) }));
      saveBlob(await zipFiles(files), 'labels-svg.zip');
    } else if (kind === 'pdf-each' || kind === 'pdf-sheet') {
      const items = labels.map((l, j) => ({ canvas: exportCanvas(j), ...mmOf(renders[j].sc), qty: l.qty || 1 }));
      const blob = kind === 'pdf-each' ? pdfPerLabel(items) : pdfSheet(items, m.kind === 'sheet' ? m.sheet : null, S.sheetPage, { skip: +S.skipSlots || 0 });
      saveBlob(blob, kind === 'pdf-each' ? 'labels.pdf' : 'labels-sheet.pdf');
    } else if (kind === 'zpl') {
      const zpl = labels.map((l, j) => bitmapToZPL(squareBitmap(bitmapOf(j)), l.qty || 1)).join('');
      saveBlob(new Blob([zpl], { type: 'text/plain' }), 'labels.zpl');
      if (m.dpi !== 203 && m.dpi !== 300) log(`ZPL was rendered at ${m.dpi} dpi. Pick a thermal media size that matches your printer's resolution.`);
    } else if (kind === 'bin') {
      if (m.kind !== 'tape') { log('The raster job is only for P-touch tape.', 'err'); return; }
      saveBlob(new Blob([makeJob(expandIndices('all').map(bitmapOf))], { type: 'application/octet-stream' }), 'ptouch-job.bin');
    } else if (kind === 'csv') {
      saveBlob(new Blob([labelsToCSV(labels)], { type: 'text/csv' }), 'labels.csv');
    }
    log(`Downloaded ${kind.toUpperCase().replace('-', ' ')}.`, 'ok');
  } catch (e) { console.error(e); log(String(e.message || e), 'err'); }
}

// ------------------------------------------------------------------ wiring
function wire() {
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(x => x.setAttribute('aria-selected', String(x === t)));
    document.querySelectorAll('.tabpanel').forEach(p => { p.hidden = p.id !== `panel-${t.dataset.tab}`; });
  }));
  $('mediaChip').addEventListener('click', () => { $('tab-design').click(); $('media').focus(); });
  document.querySelectorAll('[data-key]').forEach(el => el.addEventListener(el.type === 'range' || el.type === 'number' ? 'input' : 'change', () => onControl(el)));

  $('prevLabel').addEventListener('click', () => { if (labels.length) select(labels[(selIndex() - 1 + labels.length) % labels.length].id); });
  $('nextLabel').addEventListener('click', () => { if (labels.length) select(labels[(selIndex() + 1) % labels.length].id); });
  $('addBlank').addEventListener('click', () => addLabels([{ lines: ['New label', '', ''] }]));
  $('clearAll').addEventListener('click', () => {
    if (!labels.length) return;
    $('confirmText').textContent = `Remove all ${labels.length} labels from the list?`;
    $('confirmBar').hidden = false;
  });
  $('confirmNo').addEventListener('click', () => { $('confirmBar').hidden = true; });
  $('confirmYes').addEventListener('click', () => { $('confirmBar').hidden = true; labels = []; selId = null; buildTable(); rerender(true); });

  $('libAdd').addEventListener('click', () => addLabels(libBuild(), false));
  $('libReplace').addEventListener('click', () => addLabels(libBuild(), true));
  $('libUpdate').addEventListener('click', libUpdateExisting);

  $('importAdd').addEventListener('click', () => importRows(false));
  $('importReplace').addEventListener('click', () => importRows(true));
  $('importFile').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    $('importText').value = await f.text();
    $('importMsg').textContent = `Loaded ${f.name}. Check the rows, then add them.`;
    e.target.value = '';
  });
  $('imgFile').addEventListener('change', e => {
    [...e.target.files].forEach(f => {
      if (f.size > 1.5e6) { $('importMsg').textContent = `${f.name} is larger than 1.5 MB; use a smaller image.`; return; }
      const rd = new FileReader();
      rd.onload = () => {
        const c = { id: 'img-' + Math.random().toString(36).slice(2, 9), name: f.name.replace(/\.\w+$/, '').slice(0, 30), src: rd.result };
        customIcons.push(c); loadCustomImage(c); renderCustomList(); save();
      };
      rd.readAsDataURL(f);
    });
    e.target.value = '';
  });

  $('iconSearch').addEventListener('input', e => buildIconGrid(null, e.target.value));
  $('codeScale').addEventListener('input', e => {
    S.codeScales = { ...(S.codeScales || {}), [S.media]: +e.target.value };
    updateDesignVisibility(); rerender(true);
  });

  $('connUsb').addEventListener('click', () => doConnect('usb'));
  $('connBt').addEventListener('click', () => doConnect('bt'));
  $('connClose').addEventListener('click', async () => {
    if (conn) await conn.close();
    if (conn && conn.native) { try { localStorage.removeItem(PRINTER_KEY); } catch { } } // don't auto-reconnect after a deliberate disconnect
    setConn(null); log('Disconnected.');
  });
  $('checkTape').addEventListener('click', () => readTape(false));
  $('printSel').addEventListener('click', () => print('sel'));
  $('printAll').addEventListener('click', () => print('all'));
  $('printTest').addEventListener('click', () => print('test'));
  document.querySelectorAll('.exp').forEach(b => b.addEventListener('click', () => doExport(b.dataset.exp)));

  $('btnSave').addEventListener('click', () => saveBlob(new Blob([JSON.stringify(projectData(), null, 1)], { type: 'application/json' }), 'labels.labelina.json'));
  $('btnOpen').addEventListener('click', () => $('openFile').click());
  $('openFile').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { applyProject(JSON.parse(await f.text())); log(`Opened ${f.name}.`, 'ok'); } catch (err) { log(`Couldn't open ${f.name}: ${err.message}`, 'err'); }
    e.target.value = '';
  });
  $('btnNew').addEventListener('click', () => {
    $('confirmText').textContent = labels.length ? `Start over? This removes all ${labels.length} labels.` : 'Start over?';
    $('confirmBar').hidden = false;
  });

  let rt = 0;
  window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawStage, 80); });
  if (navigator.serial) navigator.serial.addEventListener('disconnect', () => { if (conn && conn.kind !== 'USB') { setConn(null); log('Printer disconnected.'); } });
  if (navigator.usb) navigator.usb.addEventListener('disconnect', () => { if (conn && conn.kind === 'USB') { setConn(null); log('Printer disconnected.'); } });
}

function init() {
  try { if (window.self !== window.top) $('frameNotice').hidden = false; } catch { $('frameNotice').hidden = false; }
  load();
  fillSelects();
  syncControls();
  wire();
  renderCatPicker();
  renderLibForm();
  renderCustomList();
  buildTable();
  rerender(true);
  const tabFromHash = () => { const t = document.querySelector(`.tab[data-tab="${location.hash.slice(1)}"]`); if (t) t.click(); };
  tabFromHash();
  window.addEventListener('hashchange', tabFromHash);
  if (IS_NATIVE) {
    document.querySelectorAll('[data-native]').forEach(el => { el.hidden = false; });
    initNative();
  } else {
    document.querySelectorAll('[data-native]').forEach(el => { el.hidden = true; });
    if (!('usb' in navigator) && !('serial' in navigator)) log('Direct printing needs Chrome or Edge on a desktop computer, or the Labelina desktop app. Downloads work in any browser.');
  }
  if (document.fonts) document.fonts.ready.then(() => { clearMetrics(); fontVersion++; rerender(true); });
  ensureFont();
}
init();
