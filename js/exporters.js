// File exporters. Everything runs in the browser; nothing is uploaded.

import { PAGE_SIZES } from './media.js';

export function saveBlob(blob, name) {
  // Desktop app: show a native Save dialog instead of a browser download.
  const tauri = globalThis.__TAURI__;
  if (tauri && tauri.core) {
    blob.arrayBuffer()
      .then(buf => tauri.core.invoke('save_file', new Uint8Array(buf), { headers: { 'x-file-name': encodeURIComponent(name) } }))
      .catch(e => alert(`Couldn't save ${name}: ${e}`));
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export const safeName = s => (String(s || 'label').replace(/[^\w.\-×]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'label');

// ---- PNG with a pHYs chunk so other software knows the real print size ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export async function canvasToPNG(canvas, dpi) {
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  const src = new Uint8Array(await blob.arrayBuffer());
  const ppm = Math.round(dpi / 0.0254);
  const chunk = new Uint8Array(21);
  const dv = new DataView(chunk.buffer);
  dv.setUint32(0, 9);
  chunk.set([0x70, 0x48, 0x59, 0x73], 4); // pHYs
  dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;
  dv.setUint32(17, crc32(chunk.subarray(4, 17)));
  const out = new Uint8Array(src.length + 21);
  out.set(src.subarray(0, 33)); // signature + IHDR
  out.set(chunk, 33);
  out.set(src.subarray(33), 54);
  return new Blob([out], { type: 'image/png' });
}

// 1-bit bitmap -> black/white canvas
export function bitmapCanvas(bm, ink = [0, 0, 0, 255], paper = [255, 255, 255, 255]) {
  const c = document.createElement('canvas');
  c.width = bm.W; c.height = bm.H;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(bm.W, bm.H);
  for (let i = 0; i < bm.bits.length; i++) img.data.set(bm.bits[i] ? ink : paper, i * 4);
  ctx.putImageData(img, 0, 0);
  return c;
}

// ---- ZPL (Zebra and compatible thermal printers) ----
export function bitmapToZPL(bm, qty = 1) {
  const bytesPerRow = Math.ceil(bm.W / 8);
  let hex = '';
  for (let y = 0; y < bm.H; y++) {
    let row = '';
    for (let bx = 0; bx < bytesPerRow; bx++) {
      let v = 0;
      for (let b = 0; b < 8; b++) { const x = bx * 8 + b; if (x < bm.W && bm.bits[y * bm.W + x]) v |= 0x80 >> b; }
      row += v.toString(16).padStart(2, '0').toUpperCase();
    }
    hex += row;
  }
  const total = bytesPerRow * bm.H;
  return `^XA^PW${bm.W}^LL${bm.H}^LH0,0^FO0,0^GFA,${total},${total},${bytesPerRow},${hex}^FS^PQ${qty}^XZ\n`;
}

// ---- PDF ----
function jsPDFCtor() {
  const ns = window.jspdf;
  if (!ns || !ns.jsPDF) throw new Error('The PDF library did not load. Check your connection and reload.');
  return ns.jsPDF;
}

// One label per page, page size = label size. items: [{canvas, wMm, hMm, qty}]
export function pdfPerLabel(items) {
  const JsPDF = jsPDFCtor();
  let doc = null;
  for (const it of items) {
    const orient = it.wMm >= it.hMm ? 'landscape' : 'portrait';
    const data = it.canvas.toDataURL('image/png');
    for (let q = 0; q < (it.qty || 1); q++) {
      if (!doc) doc = new JsPDF({ unit: 'mm', format: [it.wMm, it.hMm], orientation: orient, compress: true });
      else doc.addPage([it.wMm, it.hMm], orient);
      doc.addImage(data, 'PNG', 0, 0, it.wMm, it.hMm, undefined, 'FAST');
    }
  }
  return doc ? doc.output('blob') : null;
}

// Place labels on a sheet template (cols x rows grid) or pack them onto plain pages.
// items: [{canvas, wMm, hMm, qty}], template: media.sheet or null, page: 'a4'|'letter'
export function pdfSheet(items, template, page, opts = {}) {
  const JsPDF = jsPDFCtor();
  const [pw, ph] = PAGE_SIZES[template ? template.page : page] || PAGE_SIZES.a4;
  const doc = new JsPDF({ unit: 'mm', format: [pw, ph], orientation: 'portrait', compress: true });
  const flat = [];
  for (const it of items) { const d = it.canvas.toDataURL('image/png'); for (let q = 0; q < (it.qty || 1); q++) flat.push({ ...it, d }); }
  let first = true;
  if (template) {
    const per = template.cols * template.rows;
    let slot = opts.skip || 0;
    for (const it of flat) {
      if (slot >= per) { doc.addPage([pw, ph], 'portrait'); slot = 0; }
      const col = slot % template.cols, row = Math.floor(slot / template.cols);
      doc.addImage(it.d, 'PNG', template.left + col * template.pitchX, template.top + row * template.pitchY, it.wMm, it.hMm, undefined, 'FAST');
      slot++;
    }
  } else {
    const m = 10, g = 3;
    let x = m, y = m, rowH = 0;
    doc.setLineWidth(0.1);
    doc.setDrawColor(150);
    for (const it of flat) {
      if (x + it.wMm > pw - m) { x = m; y += rowH + g; rowH = 0; }
      if (y + it.hMm > ph - m) { doc.addPage([pw, ph], 'portrait'); x = m; y = m; rowH = 0; }
      doc.addImage(it.d, 'PNG', x, y, it.wMm, it.hMm, undefined, 'FAST');
      if (opts.cutLines !== false) doc.rect(x, y, it.wMm, it.hMm);
      x += it.wMm + g;
      rowH = Math.max(rowH, it.hMm);
      first = false;
    }
  }
  return doc.output('blob');
}

// ---- ZIP ----
export async function zipFiles(files) {
  if (!window.JSZip) throw new Error('The ZIP library did not load. Check your connection and reload.');
  const zip = new window.JSZip();
  const used = new Set();
  for (const f of files) {
    let name = f.name, i = 2;
    while (used.has(name)) name = f.name.replace(/(\.\w+)$/, `-${i++}$1`);
    used.add(name);
    zip.file(name, f.data);
  }
  return zip.generateAsync({ type: 'blob' });
}

// ---- CSV ----
const csvCell = v => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
export function labelsToCSV(labels) {
  const head = ['line1', 'line2', 'line3', 'icon', 'icon2', 'code_type', 'code', 'length', 'qty'];
  const rows = labels.map(l => [l.lines[0], l.lines[1], l.lines[2], l.icon, l.icon2, l.codeType, l.code, l.len ?? '', l.qty]);
  return [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function parseTable(text) {
  const delim = text.includes('\t') ? '\t' : (text.split(';').length > text.split(',').length ? ';' : ',');
  const rows = [];
  let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter(r => r.some(c => c.trim()));
}
