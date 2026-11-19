// Brother P-touch raster driver (PT-D610BT, PT-P710BT, PT-E550W, PT-P750W family).
// Built from Brother's published raster command reference for 128-pin, 180 dpi
// tape printers. Transports: WebUSB and Web Serial (Bluetooth SPP shows up as a
// serial port once the printer is paired with the computer).

const SPP_UUID = '00001101-0000-1000-8000-00805f9b34fb';
const BROTHER_VID = 0x04f9;

function packbits(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    let j = i;
    while (j + 1 < src.length && src[j + 1] === src[i] && j - i < 127) j++;
    const run = j - i + 1;
    if (run >= 2) { out.push((257 - run) & 0xff, src[i]); i = j + 1; continue; }
    const lit = [];
    let q = i;
    while (q < src.length && lit.length < 128 && !(q + 1 < src.length && src[q] === src[q + 1])) lit.push(src[q++]);
    out.push(lit.length - 1, ...lit);
    i = q;
  }
  return out;
}

// Brother's minimum feed margin is 2 mm: 14 dots at 180 dpi, 28 at 360 dpi (reference 2.3.3).
export const MIN_MARGIN_MM = 2;

// pages: array of {bits, W, H}. Each W column becomes one raster line. H must equal media.pins.
// opts: { media, autoCut, chain, marginMm, flip, mirror }. media.hd = high resolution:
// raster lines (and the margin) are counted at 360 dpi along the tape.
export function buildRasterJob(pages, opts) {
  const { media } = opts;
  const lineDpi = media.hd ? 360 : 180;
  const out = [];
  const push = (...b) => { for (const x of b) out.push(x); };
  for (let i = 0; i < 100; i++) out.push(0); // invalidate
  push(0x1b, 0x40); // initialise
  push(0x1b, 0x69, 0x61, 0x01); // raster mode
  const minMargin = Math.round(MIN_MARGIN_MM * lineDpi / 25.4);
  const margin = Math.max(minMargin, Math.round((opts.marginMm ?? MIN_MARGIN_MM) * lineDpi / 25.4));
  pages.forEach((pg, idx) => {
    const lines = pg.W;
    const kind = idx === 0 ? 0 : 1; // n9: starting page 0, other pages 1 (reference, ESC i z)
    // Print information: validity flags = recover (+ width when the tape has a width code),
    // media width in mm, raster line count. Tubes have no documented width code, so they skip the check.
    const flags = media.widthCode ? 0x84 : 0x80;
    push(0x1b, 0x69, 0x7a, flags, 0x00, media.widthCode || 0, 0x00,
      lines & 0xff, (lines >> 8) & 0xff, (lines >> 16) & 0xff, (lines >> 24) & 0xff, kind, 0x00);
    push(0x1b, 0x69, 0x4d, opts.autoCut ? 0x40 : 0x00); // various mode: auto cut
    // No ESC i A ("cut every n labels"): the PT-P710BT family doesn't support it, and a printer
    // that misreads it waits for data that never comes. Its default is already "cut each label".
    // advanced mode: bit 3 = no chain (feed and cut after the last label), bit 6 = high resolution
    push(0x1b, 0x69, 0x4b, (opts.chain ? 0x00 : 0x08) | (media.hd ? 0x40 : 0x00));
    push(0x1b, 0x69, 0x64, margin & 0xff, (margin >> 8) & 0xff); // feed margin
    push(0x4d, 0x02); // TIFF (PackBits) compression
    const line = new Uint8Array(16);
    for (let c = 0; c < lines; c++) {
      const x = opts.mirror ? lines - 1 - c : c;
      line.fill(0);
      let any = false;
      for (let y = 0; y < pg.H; y++) {
        if (!pg.bits[y * pg.W + x]) continue;
        const pin = media.pinOffset + (opts.flip ? y : pg.H - 1 - y);
        if (pin < 0 || pin > 127) continue;
        line[pin >> 3] |= 0x80 >> (pin & 7);
        any = true;
      }
      if (!any) { push(0x5a); continue; }
      const packed = packbits(Array.from(line));
      push(0x47, packed.length & 0xff, (packed.length >> 8) & 0xff, ...packed);
    }
    push(idx === pages.length - 1 ? 0x1a : 0x0c);
  });
  return new Uint8Array(out);
}

// Join labels into one long page with dashed cut marks between them.
export function joinStrip(bitmaps) {
  const H = bitmaps[0].H;
  const W = bitmaps.reduce((s, b) => s + b.W, 0) + (bitmaps.length - 1);
  const bits = new Uint8Array(W * H);
  let x0 = 0;
  bitmaps.forEach((b, i) => {
    for (let y = 0; y < H; y++) bits.set(b.bits.subarray(y * b.W, y * b.W + b.W), y * W + x0);
    x0 += b.W;
    if (i < bitmaps.length - 1) {
      for (let y = 0; y < H; y++) if (y % 6 < 3) bits[y * W + x0] = 1;
      x0 += 1;
    }
  });
  return { bits, W, H };
}

export const STATUS_REQUEST = (() => {
  const a = new Uint8Array(105);
  a.set([0x1b, 0x40, 0x1b, 0x69, 0x53], 100);
  return a;
})();

const MEDIA_TYPES = { 0x00: 'No tape', 0x01: 'Laminated', 0x03: 'Non-laminated', 0x11: 'Heat-shrink 2:1', 0x17: 'Heat-shrink 3:1', 0x13: 'Fabric', 0x14: 'Flexible ID', 0x15: 'Satin', 0xff: 'Incompatible tape' };
const TAPE_COLOR = { 0x01: 'White', 0x03: 'Clear', 0x04: 'Red', 0x05: 'Blue', 0x06: 'Yellow', 0x07: 'Green', 0x08: 'Black', 0x09: 'Clear (white text)', 0x20: 'Matte white', 0x21: 'Matte clear', 0x22: 'Matte silver', 0x23: 'Satin gold', 0x24: 'Satin silver', 0x40: 'Fluorescent orange', 0x41: 'Fluorescent yellow', 0x50: 'Berry pink', 0x51: 'Light grey', 0x52: 'Lime green', 0x70: 'Heat-shrink white', 0xf0: 'Cleaning', 0xf1: 'Stencil', 0xff: 'Incompatible' };
const TEXT_COLOR = { 0x01: 'White', 0x04: 'Red', 0x05: 'Blue', 0x08: 'Black', 0x0a: 'Gold', 0x62: 'Blue (F)', 0xf0: 'Cleaning', 0xf1: 'Stencil', 0x02: 'Other', 0xff: 'Incompatible' };

export function parseStatus(r) {
  if (!r || r.length < 32 || r[0] !== 0x80) return null;
  const errs = [];
  const e1 = r[8], e2 = r[9];
  if (e1 & 0x01) errs.push('No tape loaded');
  if (e1 & 0x02) errs.push('End of tape');
  if (e1 & 0x04) errs.push('Cutter jam');
  if (e1 & 0x08) errs.push('Batteries weak');
  if (e1 & 0x40) errs.push('Wrong power adapter');
  if (e2 & 0x01) errs.push('Wrong tape for this job');
  if (e2 & 0x04) errs.push('Expansion buffer full');
  if (e2 & 0x10) errs.push('Cover open');
  if (e2 & 0x20) errs.push('Overheating');
  const widthMm = r[10] === 4 ? 3.5 : r[10];
  return {
    widthMm, mediaTypeCode: r[11], mediaType: MEDIA_TYPES[r[11]] || `Type 0x${r[11].toString(16)}`,
    tapeColorCode: r[24], textColorCode: r[25],
    tapeColor: TAPE_COLOR[r[24]] || 'Unknown', textColor: TEXT_COLOR[r[25]] || 'Unknown',
    errors: errs, model: r[4],
    // 0 reply to status request, 1 printing completed, 2 error, 4 turned off, 6 phase change
    statusType: r[18], phaseType: r[19],
  };
}

function withTimeout(p, ms) {
  return Promise.race([p, new Promise(res => setTimeout(() => res(null), ms))]);
}

export async function connectUSB() {
  if (!('usb' in navigator)) throw new Error('This browser has no WebUSB. Use Chrome or Edge on a desktop computer.');
  const dev = await navigator.usb.requestDevice({ filters: [{ vendorId: BROTHER_VID }] });
  try {
    await dev.open();
    if (dev.configuration === null) await dev.selectConfiguration(1);
  } catch (e) {
    const err = new Error(`The printer was found, but the operating system driver is holding it (${e.message}).`);
    err.code = 'claim';
    throw err;
  }
  let ifaceNum = null, epOut = null, epIn = null;
  for (const iface of dev.configuration.interfaces) {
    for (const alt of iface.alternates) {
      const o = alt.endpoints.find(e => e.direction === 'out' && e.type === 'bulk');
      if (o) { ifaceNum = iface.interfaceNumber; epOut = o.endpointNumber; const i = alt.endpoints.find(e => e.direction === 'in' && e.type === 'bulk'); epIn = i ? i.endpointNumber : null; break; }
    }
    if (ifaceNum !== null) break;
  }
  if (ifaceNum === null) throw new Error('This USB device has no printer interface.');
  try { await dev.claimInterface(ifaceNum); } catch (e) {
    const err = new Error('The printer was found, but the operating system driver is holding it.');
    err.code = 'claim';
    throw err;
  }
  return {
    kind: 'USB', name: dev.productName || 'Brother printer',
    async write(bytes) { for (let i = 0; i < bytes.length; i += 16384) await dev.transferOut(epOut, bytes.slice(i, i + 16384)); },
    async read(n, ms) {
      if (epIn === null) return null;
      const r = await withTimeout(dev.transferIn(epIn, n), ms);
      return r && r.data ? new Uint8Array(r.data.buffer) : null;
    },
    async close() { try { await dev.releaseInterface(ifaceNum); } catch { } try { await dev.close(); } catch { } },
  };
}

// ------------------------------------------------------------ desktop app (Tauri)
// In the desktop app the bytes go through Rust (desktop/src-tauri/src/printer.rs):
// 'usb' opens the printer's USB printer-class interface directly (two-way, no print queue),
// 'bluetooth' holds the COM port open, and 'spooler' is the Windows print queue fallback
// (write-only). Each route reopens the connection if a write fails before any data went out.
export const IS_NATIVE = !!(globalThis.__TAURI__ && globalThis.__TAURI__.core);
const invoke = (cmd, args, opts) => globalThis.__TAURI__.core.invoke(cmd, args, opts);

// [{ kind: 'usb'|'bluetooth'|'serial', address, name, detail }]
export function listNativePrinters() { return invoke('printer_list'); }

export async function connectNative(p) {
  await invoke('printer_connect', { target: { kind: p.kind, address: p.address } });
  return {
    kind: { usb: 'USB', bluetooth: 'Bluetooth', spooler: 'Windows queue' }[p.kind] || 'Serial',
    name: p.name, native: true,
    canRead: p.kind !== 'spooler', // the Windows print queue is write-only
    async write(bytes) { await invoke('printer_write', bytes); },
    async read(n, ms) { const r = await invoke('printer_read', { n, ms }); return r ? new Uint8Array(r) : null; },
    async close() { try { await invoke('printer_close'); } catch { } },
  };
}

export async function connectSerial() {
  if (!('serial' in navigator)) throw new Error('This browser has no Web Serial. Use Chrome or Edge on a desktop computer.');
  const port = await navigator.serial.requestPort({ allowedBluetoothServiceClassIds: [SPP_UUID] });
  await port.open({ baudRate: 115200, bufferSize: 65536 });
  const info = port.getInfo ? port.getInfo() : {};
  return {
    kind: info.bluetoothServiceClassId ? 'Bluetooth' : 'Serial', name: info.bluetoothServiceClassId ? 'Bluetooth printer' : 'Serial port',
    async write(bytes) {
      const w = port.writable.getWriter();
      try { for (let i = 0; i < bytes.length; i += 512) { await w.ready; await w.write(bytes.slice(i, i + 512)); } }
      finally { w.releaseLock(); }
    },
    async read(n, ms) {
      if (!port.readable) return null;
      const reader = port.readable.getReader();
      const buf = [];
      const timer = setTimeout(() => reader.cancel().catch(() => { }), ms);
      try {
        while (buf.length < n) { const { value, done } = await reader.read(); if (done) break; if (value) buf.push(...value); }
      } catch { } finally { clearTimeout(timer); reader.releaseLock(); }
      return buf.length ? new Uint8Array(buf.slice(0, n)) : null;
    },
    async close() { try { await port.close(); } catch { } },
  };
}
