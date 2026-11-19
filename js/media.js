// Media profiles. kind:
//  tape        Brother P-touch TZe tape. Fixed printable height (pins), length varies. Direct print supported.
//  continuous  Roll media of fixed width, length varies.
//  diecut      Pre-cut labels of a fixed size on a roll.
//  sheet       Labels on a printer sheet (PDF export places them on the template).
// Sizes are in mm. Labels are always laid out landscape (width >= height when it matters).

// Brother 128-pin, 180 dpi heads (PT-D610BT, P710BT, P750W, E550W): printable pins and the
// pin offset for each tape, from Brother's Raster Command Reference (2.3.2 and 2.3.5).
// TZe tape can also print in high resolution: 180 dpi across the tape, 360 dpi along it.
const TZE = [
  [3.5, 4, 24, 52], [6, 6, 32, 48], [9, 9, 50, 39], [12, 12, 70, 29], [18, 18, 112, 8], [24, 24, 128, 0],
];
// Heat-shrink tube: [designation mm, flat width mm, pins, offset, media type]. HS 2:1 = 0x11, HS 3:1 = 0x17.
// No high resolution. The reference gives no width code for tubes, so the job skips the width check.
const HSE = [
  [5.8, 5.6, 28, 50, 0x11], [8.8, 8.7, 48, 40, 0x11], [11.7, 11.6, 66, 31, 0x11], [17.7, 17.8, 106, 11, 0x11], [23.6, 23.7, 128, 0, 0x11],
  [5.2, 5.1, 20, 54, 0x17], [9.0, 9.0, 44, 42, 0x17], [11.2, 11.3, 50, 39, 0x17], [21.0, 20.9, 120, 4, 0x17],
];

export const MEDIA = [
  ...TZE.map(([mm, code, pins, offset]) => ({
    id: `tze-${mm}`, group: 'Brother P-touch tape (TZe)', name: `${mm} mm tape`, kind: 'tape', dpi: 180,
    tapeMm: mm, widthCode: code, mediaType: 0x01, pins, pinOffset: offset, direct: 'ptouch', hdCapable: true,
  })),
  ...HSE.map(([mm, flat, pins, offset, type]) => ({
    id: `hse-${mm}`, group: 'Brother heat-shrink tube (HSe)', name: `HS ${mm} mm tube (${type === 0x17 ? '3:1' : '2:1'})`, kind: 'tape', dpi: 180,
    tapeMm: flat, widthCode: 0, mediaType: type, pins, pinOffset: offset, direct: 'ptouch', hdCapable: false,
  })),
  { id: 'ql-62', group: 'Brother QL rolls (300 dpi)', name: '62 mm continuous', kind: 'continuous', dpi: 300, heightMm: 58 },
  { id: 'ql-29', group: 'Brother QL rolls (300 dpi)', name: '29 mm continuous', kind: 'continuous', dpi: 300, heightMm: 25.9 },
  { id: 'ql-12', group: 'Brother QL rolls (300 dpi)', name: '12 mm continuous', kind: 'continuous', dpi: 300, heightMm: 10 },
  { id: 'ql-62x29', group: 'Brother QL rolls (300 dpi)', name: '62 × 29 mm die-cut', kind: 'diecut', dpi: 300, widthMm: 62, heightMm: 29 },
  { id: 'ql-29x90', group: 'Brother QL rolls (300 dpi)', name: '90 × 29 mm die-cut', kind: 'diecut', dpi: 300, widthMm: 90, heightMm: 29 },
  { id: 'ql-17x54', group: 'Brother QL rolls (300 dpi)', name: '54 × 17 mm die-cut', kind: 'diecut', dpi: 300, widthMm: 54, heightMm: 17 },
  { id: 'dymo-89x28', group: 'Dymo LabelWriter (300 dpi)', name: '89 × 28 mm address', kind: 'diecut', dpi: 300, widthMm: 89, heightMm: 28 },
  { id: 'dymo-54x25', group: 'Dymo LabelWriter (300 dpi)', name: '54 × 25 mm multipurpose', kind: 'diecut', dpi: 300, widthMm: 54, heightMm: 25 },
  { id: 'dymo-57x32', group: 'Dymo LabelWriter (300 dpi)', name: '57 × 32 mm multipurpose', kind: 'diecut', dpi: 300, widthMm: 57, heightMm: 32 },
  { id: 'dymo-51x19', group: 'Dymo LabelWriter (300 dpi)', name: '51 × 19 mm multipurpose', kind: 'diecut', dpi: 300, widthMm: 51, heightMm: 19 },
  { id: 'th-25x10', group: 'Thermal printer (203 dpi, ZPL)', name: '25 × 10 mm', kind: 'diecut', dpi: 203, widthMm: 25, heightMm: 10 },
  { id: 'th-40x12', group: 'Thermal printer (203 dpi, ZPL)', name: '40 × 12 mm', kind: 'diecut', dpi: 203, widthMm: 40, heightMm: 12 },
  { id: 'th-50x25', group: 'Thermal printer (203 dpi, ZPL)', name: '50 × 25 mm', kind: 'diecut', dpi: 203, widthMm: 50, heightMm: 25 },
  { id: 'th-57x32', group: 'Thermal printer (203 dpi, ZPL)', name: '57 × 32 mm', kind: 'diecut', dpi: 203, widthMm: 57, heightMm: 32 },
  { id: 'th-100x50', group: 'Thermal printer (203 dpi, ZPL)', name: '100 × 50 mm', kind: 'diecut', dpi: 203, widthMm: 100, heightMm: 50 },
  { id: 'sh-5167', group: 'Paper sheets (300 dpi PDF)', name: 'Letter 80-up · 44.5 × 12.7 mm (5167 size)', kind: 'sheet', dpi: 300, widthMm: 44.45, heightMm: 12.7,
    sheet: { page: 'letter', cols: 4, rows: 20, top: 12.7, left: 7.62, pitchX: 52.07, pitchY: 12.7 } },
  { id: 'sh-5160', group: 'Paper sheets (300 dpi PDF)', name: 'Letter 30-up · 66.7 × 25.4 mm (5160 size)', kind: 'sheet', dpi: 300, widthMm: 66.675, heightMm: 25.4,
    sheet: { page: 'letter', cols: 3, rows: 10, top: 12.7, left: 4.7625, pitchX: 69.85, pitchY: 25.4 } },
  { id: 'sh-l7651', group: 'Paper sheets (300 dpi PDF)', name: 'A4 65-up · 38.1 × 21.2 mm (L7651 size)', kind: 'sheet', dpi: 300, widthMm: 38.1, heightMm: 21.2,
    sheet: { page: 'a4', cols: 5, rows: 13, top: 10.7, left: 4.75, pitchX: 40.64, pitchY: 21.2 } },
  { id: 'sh-l7160', group: 'Paper sheets (300 dpi PDF)', name: 'A4 21-up · 63.5 × 38.1 mm (L7160 size)', kind: 'sheet', dpi: 300, widthMm: 63.5, heightMm: 38.1,
    sheet: { page: 'a4', cols: 3, rows: 7, top: 15.15, left: 7.21, pitchX: 66.04, pitchY: 38.1 } },
  { id: 'sh-a4-24', group: 'Paper sheets (300 dpi PDF)', name: 'A4 24-up · 70 × 37 mm', kind: 'sheet', dpi: 300, widthMm: 70, heightMm: 37,
    sheet: { page: 'a4', cols: 3, rows: 8, top: 0.5, left: 0, pitchX: 70, pitchY: 37 } },
  { id: 'custom', group: 'Custom', name: 'Custom size', kind: 'diecut', dpi: 300, widthMm: 60, heightMm: 20, custom: true },
];

export const MEDIA_MAP = Object.fromEntries(MEDIA.map(m => [m.id, m]));

// Length presets for tape and continuous rolls. `tight` presets also pick the smallest
// margins: the printer's 2 mm minimum feed at each end, no padding and no tape edge, and
// cut after each label, so every piece comes out at exactly `mm`.
export const LENGTH_PRESETS = [
  { id: 'slicc-33', group: 'SLICC', name: 'SLICC 33 mm', mm: 33, tight: true },
  { id: 'slicc-63', group: 'SLICC', name: 'SLICC 63 mm', mm: 63, tight: true },
  { id: 'len-25', group: 'Common lengths', name: '25 mm', mm: 25 },
  { id: 'len-30', group: 'Common lengths', name: '30 mm', mm: 30 },
  { id: 'len-40', group: 'Common lengths', name: '40 mm', mm: 40 },
  { id: 'len-50', group: 'Common lengths', name: '50 mm', mm: 50 },
  { id: 'len-75', group: 'Common lengths', name: '75 mm', mm: 75 },
  { id: 'len-100', group: 'Common lengths', name: '100 mm', mm: 100 },
];
export const LENGTH_PRESET_MAP = Object.fromEntries(LENGTH_PRESETS.map(p => [p.id, p]));

// Brother's minimum feed margin for the 128-pin printers (Raster Command Reference 2.3.3).
export const PTOUCH_MIN_MARGIN_MM = 2;

export const PAGE_SIZES = { a4: [210, 297], letter: [215.9, 279.4] };

// Preview colours for TZe tapes (Brother status byte codes where known).
export const TAPE_COLORS = [
  { id: 'bw', name: 'Black on white', tape: '#f7f7f3', ink: '#151515', code: 0x01, text: 0x08 },
  { id: 'by', name: 'Black on yellow', tape: '#f2cd2f', ink: '#151515', code: 0x06, text: 0x08 },
  { id: 'bc', name: 'Black on clear', tape: '#e4e8ea', ink: '#151515', code: 0x03, text: 0x08 },
  { id: 'wb', name: 'White on black', tape: '#1c1c1c', ink: '#f3f3f3', code: 0x08, text: 0x01 },
  { id: 'br', name: 'Black on red', tape: '#d23a33', ink: '#151515', code: 0x04, text: 0x08 },
  { id: 'wbl', name: 'White on blue', tape: '#2154b8', ink: '#ffffff', code: 0x05, text: 0x01 },
  { id: 'bg', name: 'Black on green', tape: '#3e9e58', ink: '#151515', code: 0x07, text: 0x08 },
  { id: 'bs', name: 'Black on matte silver', tape: '#c4c8cc', ink: '#151515', code: 0x22, text: 0x08 },
  { id: 'gb', name: 'Gold on black', tape: '#1c1c1c', ink: '#cfab4f', code: 0x08, text: 0x0a },
];
