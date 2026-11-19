// Media profiles. kind:
//  tape        Brother P-touch TZe tape. Fixed printable height (pins), length varies. Direct print supported.
//  continuous  Roll media of fixed width, length varies.
//  diecut      Pre-cut labels of a fixed size on a roll.
//  sheet       Labels on a printer sheet (PDF export places them on the template).
// Sizes are in mm. Labels are always laid out landscape (width >= height when it matters).

// Brother 128-pin, 180 dpi heads: printable pins and the pin offset for each tape width.
const TZE = [
  [3.5, 4, 24, 52], [6, 6, 32, 48], [9, 9, 50, 39], [12, 12, 70, 29], [18, 18, 112, 8], [24, 24, 128, 0],
];

export const MEDIA = [
  ...TZE.map(([mm, code, pins, offset]) => ({
    id: `tze-${mm}`, group: 'Brother P-touch tape (TZe)', name: `${mm} mm tape`, kind: 'tape', dpi: 180,
    tapeMm: mm, widthCode: code, pins, pinOffset: offset, direct: 'ptouch',
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
