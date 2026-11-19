// Fastener reference data. Dimensions are nominal values from the ISO / DIN
// standards named alongside them; check a supplier datasheet before relying
// on them for engineering work.

// Metric: coarse pitch, fine pitches, stocked length range, hex across-flats
// (ISO 4032 nut / ISO 4017 bolt), nut heights, hex key sizes per head type,
// ISO 7089 + DIN 9021 washer ID x OD x thickness.
export const METRIC_SIZES = [
  { id: 'M1.6', d: 1.6, p: 0.35, fine: [0.2], len: [2, 12], af: 3.2, nutH: 1.3, jamH: 1, key: { shcs: 1.5 }, ph: 'PH0', tx: 'T5', w: [1.7, 4, 0.3] },
  { id: 'M2', d: 2, p: 0.4, fine: [0.25], len: [3, 20], af: 4, nutH: 1.6, jamH: 1.2, key: { shcs: 1.5, set: 0.9 }, ph: 'PH0', tx: 'T6', w: [2.2, 5, 0.3], wl: [2.2, 6, 0.5] },
  { id: 'M2.5', d: 2.5, p: 0.45, fine: [0.35], len: [3, 25], af: 5, nutH: 2, jamH: 1.6, key: { shcs: 2, bhcs: 1.5, fhcs: 1.5, set: 1.3 }, ph: 'PH1', tx: 'T8', w: [2.7, 6, 0.5], wl: [2.7, 8, 0.5] },
  { id: 'M3', d: 3, p: 0.5, fine: [0.35], len: [3, 40], af: 5.5, nutH: 2.4, jamH: 1.8, nylH: 4, key: { shcs: 2.5, bhcs: 2, fhcs: 2, set: 1.5, lhcs: 2 }, ph: 'PH1', tx: 'T10', w: [3.2, 7, 0.5], wl: [3.2, 9, 0.8] },
  { id: 'M3.5', d: 3.5, p: 0.6, fine: [0.35], len: [5, 40], af: 6, nutH: 2.8, jamH: 2, ph: 'PH2', w: [3.7, 8, 0.5] },
  { id: 'M4', d: 4, p: 0.7, fine: [0.5], len: [4, 50], af: 7, nutH: 3.2, jamH: 2.2, nylH: 5, key: { shcs: 3, bhcs: 2.5, fhcs: 2.5, set: 2, lhcs: 2.5 }, ph: 'PH2', tx: 'T20', w: [4.3, 9, 0.8], wl: [4.3, 12, 1] },
  { id: 'M5', d: 5, p: 0.8, fine: [0.5], len: [5, 60], af: 8, nutH: 4.7, jamH: 2.7, nylH: 5, key: { shcs: 4, bhcs: 3, fhcs: 3, set: 2.5, lhcs: 3 }, ph: 'PH2', tx: 'T25', w: [5.3, 10, 1], wl: [5.3, 15, 1.2] },
  { id: 'M6', d: 6, p: 1, fine: [0.75], len: [6, 80], af: 10, nutH: 5.2, jamH: 3.2, nylH: 6, key: { shcs: 5, bhcs: 4, fhcs: 4, set: 3, lhcs: 4 }, ph: 'PH3', tx: 'T30', w: [6.4, 12, 1.6], wl: [6.4, 18, 1.6] },
  { id: 'M8', d: 8, p: 1.25, fine: [1, 0.75], len: [8, 100], af: 13, nutH: 6.8, jamH: 4, nylH: 8, key: { shcs: 6, bhcs: 5, fhcs: 5, set: 4, lhcs: 5 }, ph: 'PH4', tx: 'T45', w: [8.4, 16, 1.6], wl: [8.4, 24, 2] },
  { id: 'M10', d: 10, p: 1.5, fine: [1.25, 1], len: [10, 120], af: 16, nutH: 8.4, jamH: 5, nylH: 10, key: { shcs: 8, bhcs: 6, fhcs: 6, set: 5, lhcs: 7 }, tx: 'T50', w: [10.5, 20, 2], wl: [10.5, 30, 2.5] },
  { id: 'M12', d: 12, p: 1.75, fine: [1.5, 1.25], len: [12, 120], af: 18, nutH: 10.8, jamH: 6, nylH: 12, key: { shcs: 10, bhcs: 8, fhcs: 8, set: 6, lhcs: 8 }, tx: 'T55', w: [13, 24, 2.5], wl: [13, 37, 3] },
  { id: 'M14', d: 14, p: 2, fine: [1.5], len: [16, 120], af: 21, nutH: 12.8, jamH: 7, key: { shcs: 12 }, w: [15, 28, 2.5] },
  { id: 'M16', d: 16, p: 2, fine: [1.5], len: [16, 120], af: 24, nutH: 14.8, jamH: 8, nylH: 16, key: { shcs: 14, bhcs: 10, fhcs: 10, set: 8 }, w: [17, 30, 3], wl: [17, 50, 3] },
  { id: 'M20', d: 20, p: 2.5, fine: [1.5, 2], len: [20, 120], af: 30, nutH: 18, jamH: 10, key: { shcs: 17, fhcs: 12, set: 10 }, w: [21, 37, 3], wl: [22, 60, 4] },
  { id: 'M24', d: 24, p: 3, fine: [2], len: [30, 120], af: 36, nutH: 21.5, jamH: 12, key: { shcs: 19, set: 12 }, w: [25, 44, 4] },
];

export const METRIC_LENGTHS = [2, 2.5, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 25, 28, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 90, 100, 110, 120];

// Unified (inch): UNC / UNF threads per inch, length range in inches,
// hex nut across-flats, SHCS key.
export const INCH_SIZES = [
  { id: '#0', unc: null, unf: 80, len: [0.125, 0.5], key: '0.050"' },
  { id: '#1', unc: 64, unf: 72, len: [0.125, 0.5], key: '1/16"' },
  { id: '#2', unc: 56, unf: 64, len: [0.125, 0.75], af: '3/16"', key: '5/64"' },
  { id: '#4', unc: 40, unf: 48, len: [0.125, 1], af: '1/4"', key: '3/32"' },
  { id: '#6', unc: 32, unf: 40, len: [0.125, 1.5], af: '5/16"', key: '7/64"' },
  { id: '#8', unc: 32, unf: 36, len: [0.25, 2], af: '11/32"', key: '9/64"' },
  { id: '#10', unc: 24, unf: 32, len: [0.25, 2], af: '3/8"', key: '5/32"' },
  { id: '1/4', unc: 20, unf: 28, len: [0.25, 3], af: '7/16"', key: '3/16"' },
  { id: '5/16', unc: 18, unf: 24, len: [0.375, 3], af: '1/2"', key: '1/4"' },
  { id: '3/8', unc: 16, unf: 24, len: [0.375, 4], af: '9/16"', key: '5/16"' },
  { id: '7/16', unc: 14, unf: 20, len: [0.5, 4], af: '11/16"', key: '3/8"' },
  { id: '1/2', unc: 13, unf: 20, len: [0.5, 4], af: '3/4"', key: '3/8"' },
  { id: '5/8', unc: 11, unf: 18, len: [0.75, 4], af: '15/16"', key: '1/2"' },
  { id: '3/4', unc: 10, unf: 16, len: [1, 4], af: '1-1/8"', key: '5/8"' },
];

export const INCH_LENGTHS = ['1/8', '3/16', '1/4', '5/16', '3/8', '7/16', '1/2', '5/8', '3/4', '7/8', '1', '1-1/4', '1-1/2', '1-3/4', '2', '2-1/4', '2-1/2', '3', '3-1/2', '4'];

export function inchValue(s) {
  const m = String(s).match(/^(?:(\d+)-)?(\d+)\/(\d+)$/);
  if (m) return (+(m[1] || 0)) + (+m[2]) / (+m[3]);
  return parseFloat(s);
}

const FRACTIONS = { '1/8': '⅛', '1/4': '¼', '3/8': '⅜', '1/2': '½', '5/8': '⅝', '3/4': '¾', '7/8': '⅞' };
// '1-1/4' -> '1¼"', '3/16' -> '3/16"'
export function prettyInch(s, quote = true) {
  const m = String(s).match(/^(?:(\d+)-)?(\d+\/\d+)$/);
  let out = String(s);
  if (m) out = (m[1] || '') + (FRACTIONS[m[2]] || (m[1] ? '-' : '') + m[2]);
  return quote ? out + '"' : out;
}
export const prettyInchSize = id => id.startsWith('#') ? id : prettyInch(id, true);

// Decimal formatting that drops trailing zeros: 5.70 -> 5.7, 3.0 -> 3
export const num = v => String(+(+v).toFixed(3));

export const MATERIALS = [
  { id: 'a2', name: 'A2 stainless (304)', short: 'A2 SS' },
  { id: 'a4', name: 'A4 stainless (316)', short: 'A4 SS' },
  { id: 'zinc', name: 'Zinc-plated steel', short: 'Zinc' },
  { id: '8.8', name: 'Steel class 8.8', short: '8.8' },
  { id: '10.9', name: 'Steel class 10.9', short: '10.9' },
  { id: '12.9', name: 'Alloy steel 12.9 black oxide', short: '12.9' },
  { id: 'black', name: 'Black oxide steel', short: 'Black ox.' },
  { id: 'brass', name: 'Brass', short: 'Brass' },
  { id: 'nylon', name: 'Nylon', short: 'Nylon' },
  { id: 'alu', name: 'Aluminium', short: 'Alu' },
  { id: 'ti', name: 'Titanium', short: 'Ti' },
  { id: 'none', name: 'Not specified', short: '' },
];

export const DRIVES = {
  hex: { name: 'Hex socket', short: 'Hex', icon: 'd-hex' },
  torx: { name: 'Torx (hexalobular)', short: 'Torx', icon: 'd-torx' },
  phillips: { name: 'Phillips', short: 'Phillips', icon: 'd-phillips' },
  pozi: { name: 'Pozidriv', short: 'Pozi', icon: 'd-pozi' },
  slot: { name: 'Slotted', short: 'Slotted', icon: 'd-slot' },
  square: { name: 'Square (Robertson)', short: 'Square', icon: 'd-square' },
  ext: { name: 'External hex', short: '', icon: 'd-ext' },
  none: { name: 'None', short: '', icon: '' },
};

export const SCREW_HEADS = [
  { id: 'shcs', name: 'Socket head cap screw', short: 'Socket head', std: 'ISO 4762', din: 'DIN 912', icon: 'shcs', drives: ['hex', 'torx'], key: 'shcs' },
  { id: 'lhcs', name: 'Low-profile socket head', short: 'Low head', std: 'DIN 7984', icon: 'lowhead', drives: ['hex'], key: 'lhcs' },
  { id: 'bhcs', name: 'Button head', short: 'Button head', std: 'ISO 7380', icon: 'button', drives: ['hex', 'torx'], key: 'bhcs' },
  { id: 'fhcs', name: 'Flat head (countersunk)', short: 'Flat head', std: 'ISO 10642', din: 'DIN 7991', icon: 'flat', drives: ['hex', 'torx', 'phillips', 'pozi', 'slot'], key: 'fhcs' },
  { id: 'pan', name: 'Pan head', short: 'Pan head', std: 'ISO 7045', icon: 'pan', drives: ['phillips', 'pozi', 'torx', 'slot'] },
  { id: 'cheese', name: 'Cheese head', short: 'Cheese head', std: 'ISO 1207', din: 'DIN 84', icon: 'cheese', drives: ['slot', 'phillips'] },
  { id: 'hex', name: 'Hex head bolt', short: 'Hex bolt', std: 'ISO 4017', din: 'DIN 933', icon: 'hexbolt', drives: ['ext'], wrench: true },
  { id: 'flange', name: 'Flange hex bolt', short: 'Flange bolt', std: 'DIN 6921', icon: 'flangebolt', drives: ['ext'], wrench: true },
  { id: 'set', name: 'Set screw', short: 'Set screw', std: 'ISO 4029', icon: 'setscrew', drives: ['hex'], key: 'set', points: true },
  { id: 'shoulder', name: 'Shoulder screw', short: 'Shoulder', std: 'ISO 7379', icon: 'shoulder', drives: ['hex'] },
  { id: 'thumb', name: 'Thumb screw', short: 'Thumb screw', std: 'DIN 464', icon: 'thumbscrew', drives: ['none'] },
  { id: 'carriage', name: 'Carriage bolt', short: 'Carriage', std: 'DIN 603', icon: 'carriage', drives: ['none'] },
  { id: 'wood', name: 'Wood screw', short: 'Wood screw', std: '', icon: 'woodscrew', drives: ['pozi', 'phillips', 'torx', 'square'], wood: true },
  { id: 'sheet', name: 'Sheet metal screw', short: 'Self-tapping', std: 'ISO 7049', icon: 'sheetscrew', drives: ['phillips', 'pozi', 'torx'], wood: true },
  { id: 'rod', name: 'Threaded rod', short: 'Threaded rod', std: 'DIN 975', icon: 'threadrod', drives: ['none'] },
];

export const SET_POINTS = ['Cup point', 'Flat point', 'Cone point', 'Dog point'];

export const NUT_TYPES = [
  { id: 'hex', name: 'Hex nut', std: 'ISO 4032', din: 'DIN 934', icon: 'hexnut', h: 'nutH' },
  { id: 'nyloc', name: 'Nylon lock nut', std: 'ISO 10511', din: 'DIN 985', icon: 'nyloc', h: 'nylH' },
  { id: 'jam', name: 'Jam nut (thin)', std: 'ISO 4035', din: 'DIN 439', icon: 'jamnut', h: 'jamH' },
  { id: 'flange', name: 'Flange nut', std: 'DIN 6923', icon: 'flangenut' },
  { id: 'square', name: 'Square nut', std: 'DIN 557', icon: 'squarenut' },
  { id: 'square-thin', name: 'Thin square nut', std: 'DIN 562', icon: 'squarenut' },
  { id: 'wing', name: 'Wing nut', std: 'DIN 315', icon: 'wingnut' },
  { id: 'acorn', name: 'Acorn nut', std: 'DIN 1587', icon: 'acornnut' },
  { id: 'coupling', name: 'Coupling nut', std: 'DIN 6334', icon: 'couplingnut' },
  { id: 'tslot', name: 'T-slot nut', std: '', icon: 'tslotnut', slots: true },
  { id: 'knurled', name: 'Knurled thumb nut', std: 'DIN 466', icon: 'knurlnut' },
  { id: 'rivnut', name: 'Rivet nut', std: '', icon: 'rivnut' },
];

export const TSLOT_PROFILES = ['2020 (slot 6)', '3030 (slot 8)', '4040 (slot 8)', '4040 (slot 10)', '4545 (slot 10)'];

export const WASHER_TYPES = [
  { id: 'flat', name: 'Flat washer', std: 'ISO 7089', din: 'DIN 125', icon: 'washer', dims: 'w' },
  { id: 'fender', name: 'Large flat washer', std: 'DIN 9021', icon: 'fender', dims: 'wl' },
  { id: 'split', name: 'Split lock washer', std: 'DIN 127', icon: 'splitlock' },
  { id: 'tooth-ext', name: 'External tooth washer', std: 'DIN 6797 A', icon: 'toothwasher' },
  { id: 'tooth-int', name: 'Internal tooth washer', std: 'DIN 6797 J', icon: 'toothwasher' },
  { id: 'wave', name: 'Wave spring washer', std: 'DIN 137', icon: 'washer' },
  { id: 'nylon', name: 'Nylon washer', std: '', icon: 'washer' },
];

export const INSERT_TYPES = [
  { id: 'heatset', name: 'Heat-set insert', icon: 'insert', lengths: { 'M2': [3, 4], 'M2.5': [4, 5.7], 'M3': [3, 4, 5.7, 6], 'M4': [4, 8.1], 'M5': [5.8, 9.5], 'M6': [12.7], 'M8': [12.7] } },
  { id: 'coil', name: 'Thread repair coil', icon: 'helicoil', lengthsD: [1, 1.5, 2, 2.5] },
  { id: 'press', name: 'Press-fit insert', icon: 'insert', lengths: { 'M2': [3], 'M2.5': [4], 'M3': [4, 5], 'M4': [6], 'M5': [7], 'M6': [8] } },
  { id: 'wood', name: 'Wood insert', icon: 'insert', lengths: { 'M4': [8, 10], 'M5': [10], 'M6': [13], 'M8': [15], 'M10': [18] } },
];

export const STANDOFF_TYPES = [
  { id: 'ff', name: 'Standoff F-F', icon: 'standoff-ff' },
  { id: 'mf', name: 'Standoff M-F', icon: 'standoff-mf' },
  { id: 'mm', name: 'Standoff M-M', icon: 'standoff-mm' },
  { id: 'spacer', name: 'Round spacer', icon: 'spacer' },
];
export const STANDOFF_LENGTHS = [3, 4, 5, 6, 8, 10, 12, 15, 16, 18, 20, 25, 30, 35, 40];

export const PIN_TYPES = [
  { id: 'dowel', name: 'Dowel pin', std: 'ISO 8734', icon: 'dowel', dias: [1.5, 2, 2.5, 3, 4, 5, 6, 8, 10], lengths: [4, 5, 6, 8, 10, 12, 16, 20, 25, 30, 40] },
  { id: 'roll', name: 'Roll pin', std: 'ISO 8752', icon: 'rollpin', dias: [1.5, 2, 2.5, 3, 4, 5, 6, 8], lengths: [6, 8, 10, 12, 16, 20, 25, 30] },
  { id: 'cotter', name: 'Cotter pin', std: 'ISO 1234', icon: 'cotter', dias: [1, 1.6, 2, 2.5, 3.2, 4, 5], lengths: [10, 16, 20, 25, 32, 40, 50] },
  { id: 'circlip-ext', name: 'External circlip', std: 'DIN 471', icon: 'circlip', dias: [3, 4, 5, 6, 8, 10, 12, 15, 17, 20, 25, 30], shaft: true },
  { id: 'circlip-int', name: 'Internal circlip', std: 'DIN 472', icon: 'circlip', dias: [8, 10, 12, 15, 19, 22, 26, 30, 35, 40], bore: true },
  { id: 'eclip', name: 'E-clip', std: 'DIN 6799', icon: 'eclip', dias: [1.2, 1.5, 1.9, 2.3, 3.2, 4, 5, 6, 7, 8, 9, 10], groove: true },
  { id: 'rivet', name: 'Blind rivet', std: 'ISO 15983', icon: 'poprivet', dias: [2.4, 3.2, 4, 4.8, 6.4], lengths: [4, 6, 8, 10, 12, 14, 16, 20] },
];
