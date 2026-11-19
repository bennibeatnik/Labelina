// Barcode and QR encoding. Uses the qrcode-generator and JsBarcode globals
// (loaded as classic scripts) and only asks them for the module pattern;
// drawing happens in render.js so modules land on whole printer dots.

export const CODE_TYPES = [
  { id: 'none', name: 'No code' },
  { id: 'qr', name: 'QR code' },
  { id: 'code128', name: 'Code 128', format: 'CODE128' },
  { id: 'code39', name: 'Code 39', format: 'CODE39' },
  { id: 'ean13', name: 'EAN-13', format: 'EAN13' },
  { id: 'upc', name: 'UPC-A', format: 'UPC' },
];
const FORMAT = Object.fromEntries(CODE_TYPES.filter(c => c.format).map(c => [c.id, c.format]));

const memo = new Map();

export function encodeCode(type, text) {
  if (!type || type === 'none' || !text) return null;
  const key = type + '\u0000' + text;
  if (memo.has(key)) return memo.get(key);
  let out;
  try {
    if (type === 'qr') {
      const qr = window.qrcode;
      if (!qr) throw new Error('QR library did not load');
      if (qr.stringToBytesFuncs && qr.stringToBytesFuncs['UTF-8']) qr.stringToBytes = qr.stringToBytesFuncs['UTF-8'];
      const q = qr(0, 'M');
      q.addData(text, 'Byte');
      q.make();
      const n = q.getModuleCount();
      const grid = new Uint8Array(n * n);
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) grid[r * n + c] = q.isDark(r, c) ? 1 : 0;
      out = { kind: 'qr', n, grid };
    } else {
      if (!window.JsBarcode) throw new Error('Barcode library did not load');
      const o = {};
      window.JsBarcode(o, text, { format: FORMAT[type] });
      const bits = (o.encodings || []).map(e => e.data).join('');
      if (!bits) throw new Error('empty');
      out = { kind: 'bar', bits };
    }
  } catch (e) {
    const name = (CODE_TYPES.find(c => c.id === type) || {}).name || type;
    out = { error: `“${text}” can't be encoded as ${name}` };
  }
  if (memo.size > 2000) memo.clear();
  memo.set(key, out);
  return out;
}
