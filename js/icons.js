// Icon library. Every icon lives on a 24 x 24 grid.
// Part types: f = fill, e = even-odd fill, s = stroke (ink), d = dashed stroke,
// w = stroke in paper colour (knock-out), wf = fill in paper colour.
// Optional third value is the stroke width in grid units (default 1.6).

const circ = (cx, cy, r) => `M${cx + r} ${cy}a${r} ${r} 0 1 0 ${-2 * r} 0a${r} ${r} 0 1 0 ${2 * r} 0Z`;
const poly = pts => 'M' + pts.map(p => p.map(n => +n.toFixed(2)).join(' ')).join('L') + 'Z';
const rect = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}Z`;
const ngon = (cx, cy, r, n, rotDeg) => poly(Array.from({ length: n }, (_, k) => {
  const a = (rotDeg + (360 / n) * k) * Math.PI / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}));
const hexagon = (cx, cy, r, rot = -90) => ngon(cx, cy, r, 6, rot);
const star = (cx, cy, rOut, rIn, n, rot = -90) => poly(Array.from({ length: n * 2 }, (_, k) => {
  const a = (rot + (180 / n) * k) * Math.PI / 180, r = k % 2 ? rIn : rOut;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}));
// Toothed outline: n teeth between radius rIn and rOut.
const toothed = (cx, cy, rOut, rIn, n) => {
  const pts = [], step = (Math.PI * 2) / n;
  for (let k = 0; k < n; k++) {
    const a = k * step - Math.PI / 2;
    [[rIn, -0.5], [rOut, -0.3], [rOut, 0.3], [rIn, 0.5]].forEach(([r, f]) =>
      pts.push([cx + r * Math.cos(a + f * step * 0.5), cy + r * Math.sin(a + f * step * 0.5)]));
  }
  return poly(pts);
};
const threads = (x1, x2, y1, y2, step = 2.6) => {
  let d = '';
  for (let y = y1; y <= y2 + 0.01; y += step) d += `M${x1} ${(y + 0.9).toFixed(2)}L${x2} ${(y - 0.6).toFixed(2)}`;
  return d;
};
const shank = (top, bottom = 22) => [
  ['s', `M9.5 ${top}V${bottom}H14.5V${top}`],
  ['s', threads(9.5, 14.5, top + 2.4, bottom - 1.2), 1.1],
];
const cross = (cx, cy, L, w) => poly([[cx - w, cy - L], [cx + w, cy - L], [cx + w, cy - w], [cx + L, cy - w], [cx + L, cy + w],
  [cx + w, cy + w], [cx + w, cy + L], [cx - w, cy + L], [cx - w, cy + w], [cx - L, cy + w], [cx - L, cy - w], [cx - w, cy - w]]);
const knurl = (x1, x2, y1, y2, step = 4) => {
  let d = '';
  for (let y = y1; y < y2 - 0.01; y += step) d += `M${x1} ${y}L${x2} ${y + step}M${x2} ${y}L${x1} ${y + step}`;
  return d;
};

const I = (id, name, cat, parts, tags = '') => ({ id, name, cat, parts, tags });

export const ICONS = [
  // ---- Screws & bolts (side view, head up) ----
  I('shcs', 'Socket head cap screw', 'Screws & bolts', [['f', 'M8 2H16Q17 2 17 3V9H7V3Q7 2 8 2Z'], ...shank(9)], 'cap allen'),
  I('lowhead', 'Low-profile socket head', 'Screws & bolts', [['f', 'M7.5 4H16.5Q17 4 17 4.6V8H7V4.6Q7 4 7.5 4Z'], ...shank(8)]),
  I('button', 'Button head', 'Screws & bolts', [['f', 'M5.5 9A6.5 5.5 0 0 1 18.5 9Z'], ...shank(9)]),
  I('flat', 'Flat head (countersunk)', 'Screws & bolts', [['f', 'M5 3H19L14.5 8.5H9.5Z'], ...shank(8.5)], 'csk countersunk'),
  I('pan', 'Pan head', 'Screws & bolts', [['f', 'M6 9V6Q6 3 9 3H15Q18 3 18 6V9Z'], ...shank(9)]),
  I('cheese', 'Cheese head', 'Screws & bolts', [['f', 'M7 3H17V9H7Z'], ['w', 'M12 3V5.4', 1.5], ...shank(9)]),
  I('hexbolt', 'Hex head bolt', 'Screws & bolts', [['f', 'M5.5 3H18.5V9H5.5Z'], ['w', 'M9.8 3.7V8.3M14.2 3.7V8.3', 1.1], ...shank(9)]),
  I('flangebolt', 'Flange bolt', 'Screws & bolts', [['f', 'M7.5 2.5H16.5V7H7.5Z'], ['f', 'M4.5 7H19.5V9.2H4.5Z'], ['w', 'M10.5 3.1V6.4M13.5 3.1V6.4', 1], ...shank(9.2)]),
  I('shoulder', 'Shoulder screw', 'Screws & bolts', [['f', 'M7.5 2H16.5V7H7.5Z'], ['s', 'M8.5 7V16H15.5V7'], ['s', 'M10 16V22H14V16'], ['s', threads(10, 14, 17.5, 20.5, 2.4), 1.1]]),
  I('setscrew', 'Set screw', 'Screws & bolts', [['s', 'M9.5 3H14.5V21H9.5Z'], ['f', 'M10.9 3H13.1V5.4H10.9Z'], ['s', threads(9.5, 14.5, 7.5, 19.5), 1.1]], 'grub'),
  I('woodscrew', 'Wood screw', 'Screws & bolts', [['f', 'M4.5 3H19.5L14 7.5H10Z'], ['s', 'M10 7.5V15.5L12 21.8L14 15.5V7.5'], ['s', 'M10 10.6L14 9.1M10 13.4L14 11.9M10.2 16.2L13.8 14.7', 1.1]]),
  I('sheetscrew', 'Sheet metal screw', 'Screws & bolts', [['f', 'M6 9V6Q6 3 9 3H15Q18 3 18 6V9Z'], ['s', 'M9.5 9V16.5L12 21.8L14.5 16.5V9'], ['s', 'M9.5 12.2L14.5 10.7M9.5 15L14.5 13.5M10.3 17.8L13.7 16.6', 1.1]], 'self tapping'),
  I('carriage', 'Carriage bolt', 'Screws & bolts', [['f', 'M4.5 7A7.5 4.5 0 0 1 19.5 7Z'], ['f', 'M9 7H15V10H9Z'], ...shank(10)]),
  I('thumbscrew', 'Thumb screw', 'Screws & bolts', [['s', 'M6 2.5H18V9H6Z'], ['s', 'M8.4 2.5V9M10.8 2.5V9M13.2 2.5V9M15.6 2.5V9', 1], ...shank(9)]),
  I('threadrod', 'Threaded rod', 'Screws & bolts', [['s', 'M9.5 2V22M14.5 2V22'], ['s', threads(9.5, 14.5, 3.5, 21), 1.1]], 'stud'),

  // ---- Drives (top view) ----
  I('d-hex', 'Hex socket drive', 'Drives', [['e', circ(12, 12, 10) + hexagon(12, 12, 4.8, 0)]], 'allen'),
  I('d-torx', 'Torx drive', 'Drives', [['e', circ(12, 12, 10) + star(12, 12, 5.4, 3.1, 6)]], 'star hexalobular'),
  I('d-phillips', 'Phillips drive', 'Drives', [['e', circ(12, 12, 10) + cross(12, 12, 5.6, 1.3)]], 'cross'),
  I('d-pozi', 'Pozidriv drive', 'Drives', [['e', circ(12, 12, 10) + cross(12, 12, 5.6, 1.3)], ['w', 'M15.2 8.8L16.6 7.4M8.8 8.8L7.4 7.4M15.2 15.2L16.6 16.6M8.8 15.2L7.4 16.6', 0.9]]),
  I('d-slot', 'Slotted drive', 'Drives', [['e', circ(12, 12, 10) + rect(4, 10.6, 16, 2.8)]], 'flat'),
  I('d-square', 'Square drive', 'Drives', [['e', circ(12, 12, 10) + rect(9, 9, 6, 6)]], 'robertson'),
  I('d-ext', 'External hex', 'Drives', [['f', hexagon(12, 12, 10, 0)], ['w', hexagon(12, 12, 6.2, 0), 1]]),

  // ---- Nuts ----
  I('hexnut', 'Hex nut', 'Nuts', [['e', hexagon(12, 12, 10) + circ(12, 12, 4.6)]]),
  I('nyloc', 'Nylon lock nut', 'Nuts', [['f', 'M4 11H20V20H4Z'], ['w', 'M9.3 11.6V19.4M14.7 11.6V19.4', 1.1], ['f', 'M6 10V7.5Q6 5 8.5 5H15.5Q18 5 18 7.5V10Z']], 'nylock locknut'),
  I('jamnut', 'Jam nut (thin)', 'Nuts', [['f', 'M4 9H20V15H4Z'], ['w', 'M9.3 9.6V14.4M14.7 9.6V14.4', 1.1]]),
  I('flangenut', 'Flange nut', 'Nuts', [['f', 'M6 5H18V14H6Z'], ['f', 'M3 14H21V17.5H3Z'], ['w', 'M10 5.6V13.4M14 5.6V13.4', 1.1]]),
  I('squarenut', 'Square nut', 'Nuts', [['e', rect(3, 3, 18, 18) + circ(12, 12, 4.6)]]),
  I('wingnut', 'Wing nut', 'Nuts', [['f', 'M9 10H15V19H9Z'], ['f', 'M9 11L3 5V13.5L9 16Z'], ['f', 'M15 11L21 5V13.5L15 16Z']], 'butterfly'),
  I('acornnut', 'Acorn (cap) nut', 'Nuts', [['f', 'M4 12H20V20H4Z'], ['w', 'M9.3 12.6V19.4M14.7 12.6V19.4', 1.1], ['f', 'M5.5 11.4A6.5 6.5 0 0 1 18.5 11.4Z']], 'dome'),
  I('couplingnut', 'Coupling nut', 'Nuts', [['f', 'M7 2H17V22H7Z'], ['w', 'M12 2.8V21.2', 1.1]]),
  I('tslotnut', 'T-slot nut', 'Nuts', [['f', 'M3 13H21V19H3Z'], ['f', 'M8 6H16V13H8Z'], ['w', 'M12 7V18', 1.6]], 'extrusion'),
  I('knurlnut', 'Knurled thumb nut', 'Nuts', [['e', toothed(12, 12, 10.5, 9, 18) + circ(12, 12, 4)]]),
  I('rivnut', 'Rivet nut', 'Nuts', [['f', 'M5 3H19V6H5Z'], ['s', 'M8 6V21H16V6'], ['s', threads(8, 16, 8.5, 19.5, 3), 1.1]], 'nutsert'),
  I('insert', 'Heat-set insert', 'Nuts', [['s', rect(7, 4, 10, 16)], ['s', knurl(7, 17, 4, 20), 1]], 'threaded insert brass'),
  I('helicoil', 'Thread repair coil', 'Nuts', [['s', 'M8 4L16 6.5L8 9L16 11.5L8 14L16 16.5L8 19L16 21.5', 1.6]]),

  // ---- Washers ----
  I('washer', 'Flat washer', 'Washers', [['e', circ(12, 12, 10) + circ(12, 12, 4.4)]]),
  I('fender', 'Fender washer', 'Washers', [['e', circ(12, 12, 10.5) + circ(12, 12, 2.8)]], 'large penny'),
  I('splitlock', 'Split lock washer', 'Washers', [['s', 'M14.57 4.95A7.5 7.5 0 1 0 17.3 6.7', 3.6]], 'spring'),
  I('toothwasher', 'Tooth lock washer', 'Washers', [['e', toothed(12, 12, 10.5, 8.4, 12) + circ(12, 12, 4.4)]], 'star serrated'),
  I('oring', 'O-ring', 'Washers', [['e', circ(12, 12, 9.5) + circ(12, 12, 6.5)]], 'seal gasket'),

  // ---- Standoffs, pins, clips, rivets ----
  I('standoff-mf', 'Standoff M-F', 'Pins, standoffs & rivets', [['s', rect(8, 2, 8, 13)], ['s', 'M12 2V15', 1.1], ['s', 'M10.5 15V22H13.5V15'], ['s', threads(10.5, 13.5, 16.5, 20.5, 2.2), 1]], 'spacer'),
  I('standoff-ff', 'Standoff F-F', 'Pins, standoffs & rivets', [['s', rect(8, 3, 8, 18)], ['s', 'M12 3V21', 1.1], ['d', 'M10.5 3V8M13.5 3V8M10.5 16V21M13.5 16V21', 1]]),
  I('standoff-mm', 'Standoff M-M', 'Pins, standoffs & rivets', [['s', rect(8, 7, 8, 10)], ['s', 'M12 7V17', 1.1], ['s', 'M10.5 7V2H13.5V7M10.5 17V22H13.5V17']]),
  I('spacer', 'Spacer / sleeve', 'Pins, standoffs & rivets', [['s', rect(7, 4, 10, 16)], ['d', 'M10 4V20M14 4V20', 1]], 'bushing'),
  I('dowel', 'Dowel pin', 'Pins, standoffs & rivets', [['s', 'M9 3.5Q9 2 10.5 2H13.5Q15 2 15 3.5V20.5Q15 22 13.5 22H10.5Q9 22 9 20.5Z']]),
  I('rollpin', 'Roll pin', 'Pins, standoffs & rivets', [['s', 'M9.5 2H14.5L15 3V21L14.5 22H9.5L9 21V3Z'], ['s', 'M12 2V22', 1]], 'spring pin'),
  I('cotter', 'Cotter pin', 'Pins, standoffs & rivets', [['s', 'M10.2 18V6A1.8 1.8 0 0 1 13.8 6V21.5'], ['s', 'M12 7.8V19', 1.1]], 'split pin'),
  I('circlip', 'Circlip (external)', 'Pins, standoffs & rivets', [['s', 'M15.5 5.94A7 7 0 1 1 8.5 5.94', 2.6], ['e', circ(16.6, 4.4, 2.1) + circ(16.6, 4.4, 0.9)], ['e', circ(7.4, 4.4, 2.1) + circ(7.4, 4.4, 0.9)]], 'retaining ring snap'),
  I('eclip', 'E-clip', 'Pins, standoffs & rivets', [['s', 'M7.76 16.24A6 6 0 1 1 16.24 16.24', 2.6], ['s', 'M12 6V9.5', 2.2]], 'retaining ring'),
  I('poprivet', 'Blind rivet', 'Pins, standoffs & rivets', [['f', 'M6 8A6 4 0 0 1 18 8Z'], ['s', 'M9.5 8H14.5V18H9.5Z'], ['s', 'M12 1.5V4.5', 1.6]], 'pop'),
  I('nail', 'Nail', 'Pins, standoffs & rivets', [['f', 'M6 2H18V4.5H6Z'], ['f', 'M10.9 4.5H13.1V18L12 22.5L10.9 18Z']]),

  // ---- Mechanical ----
  I('spring', 'Compression spring', 'Mechanical', [['s', 'M6 3H18M6 21H18'], ['s', 'M7 3L17 6L7 9L17 12L7 15L17 18L7 21', 1.5]]),
  I('extspring', 'Extension spring', 'Mechanical', [['s', 'M8 8H16M8 10H16M8 12H16M8 14H16M8 16H16', 1.4], ['s', 'M12 8V5.5A2 2 0 1 0 10 3.5M12 16V18.5A2 2 0 1 1 14 20.5']]),
  I('bearing', 'Ball bearing', 'Mechanical', [['e', circ(12, 12, 10) + circ(12, 12, 7.6)], ['e', circ(12, 12, 4.4) + circ(12, 12, 2.4)],
    ['f', Array.from({ length: 8 }, (_, k) => { const a = k * Math.PI / 4; return circ(+(12 + 6 * Math.cos(a)).toFixed(2), +(12 + 6 * Math.sin(a)).toFixed(2), 1.25); }).join('')]]),
  I('gear', 'Gear', 'Mechanical', [['e', toothed(12, 12, 10.5, 8, 10) + circ(12, 12, 3.2)]], 'cog sprocket'),
  I('magnet', 'Magnet', 'Mechanical', [['s', 'M6 5V12A6 6 0 0 0 18 12V5', 4], ['w', 'M3.8 7.2H8.2M15.8 7.2H20.2', 1]], 'neodymium'),
  I('hinge', 'Hinge', 'Mechanical', [['s', rect(3, 5, 7.5, 14) + rect(13.5, 5, 7.5, 14)], ['f', 'M10.5 4H13.5V20H10.5Z'], ['f', circ(6.7, 9, 1) + circ(6.7, 15, 1) + circ(17.3, 9, 1) + circ(17.3, 15, 1)]]),
  I('bracket', 'Angle bracket', 'Mechanical', [['s', 'M5 3V19H21', 3], ['w', 'M5 8V8.01M5 13V13.01M10 19H10.01M15 19H15.01', 1.4]], 'corner'),
  I('ziptie', 'Cable tie', 'Mechanical', [['s', 'M18 12A7 7 0 1 1 11 5'], ['f', 'M10 2.5H17V7.5H10Z'], ['s', 'M17 5H22', 1.4]], 'zip tie'),
  I('pulley', 'Pulley', 'Mechanical', [['e', circ(12, 12, 10) + circ(12, 12, 7.5)], ['e', circ(12, 12, 4) + circ(12, 12, 1.6)]], 'belt idler'),

  // ---- Tools ----
  I('drillbit', 'Drill bit', 'Tools', [['f', 'M10.5 2H13.5V10H10.5Z'], ['s', 'M10.5 10V19L12 22L13.5 19V10'], ['s', 'M10.5 12L13.5 14M10.5 15.5L13.5 17.5', 1.1]]),
  I('hexbit', 'Driver bit', 'Tools', [['f', 'M9 2H15V13H9Z'], ['w', 'M9 8H15', 1.2], ['f', 'M10.5 13H13.5V19L12 22L10.5 19Z']]),
  I('hexkey', 'Hex key', 'Tools', [['s', 'M7 3V17A3 3 0 0 0 10 20H20', 2.6]], 'allen wrench'),
  I('screwdriver', 'Screwdriver', 'Tools', [['f', 'M9.5 2H14.5V10H9.5Z'], ['s', 'M12 10V19.5', 1.8], ['f', 'M11 19H13L12.6 22.5H11.4Z']]),
  I('wrench', 'Wrench', 'Tools', [['s', 'M6 18L14.5 9.5', 3], ['e', circ(16.5, 7.5, 4.8) + 'M15.2 2.6L20 2.6L21.4 6.2L18 7.6L15.6 6.2Z'], ['f', circ(5.5, 18.5, 2.2)]], 'spanner'),
  I('tape', 'Tape roll', 'Tools', [['e', circ(12, 12, 10) + circ(12, 12, 5)]], 'adhesive'),
  I('glue', 'Glue / adhesive', 'Tools', [['f', 'M8 9H16V21H8Z'], ['f', 'M10 5H14V9H10Z'], ['s', 'M12 5V2', 1.4]]),

  // ---- Electronics ----
  I('resistor', 'Resistor', 'Electronics', [['s', 'M1.5 12H6M18 12H22.5'], ['f', 'M6 8.5H18V15.5H6Z'], ['w', 'M9 8.5V15.5M12 8.5V15.5M15 8.5V15.5', 1.4]]),
  I('capacitor', 'Capacitor', 'Electronics', [['s', 'M2 12H9.5M14.5 12H22'], ['f', 'M9 5H11V19H9ZM13 5H15V19H13Z']]),
  I('electrolytic', 'Electrolytic capacitor', 'Electronics', [['s', rect(7, 3, 10, 15)], ['f', 'M14 3H17V18H14Z'], ['s', 'M10 18V22.5M14 18V21']], 'elko'),
  I('inductor', 'Inductor', 'Electronics', [['s', 'M2 13H5M19 13H22'], ['s', 'M5 13A2.33 2.33 0 0 1 9.67 13A2.33 2.33 0 0 1 14.33 13A2.33 2.33 0 0 1 19 13']], 'coil choke'),
  I('diode', 'Diode', 'Electronics', [['s', 'M2 12H22'], ['f', 'M8 6L16 12L8 18Z'], ['f', 'M16 6H18V18H16Z']], 'rectifier schottky'),
  I('zener', 'Zener diode', 'Electronics', [['s', 'M2 12H22'], ['f', 'M8 6L16 12L8 18Z'], ['f', 'M16 6H17.6V18H16Z'], ['s', 'M17 6L18.8 4.6M16.6 18L14.8 19.4', 1.4]]),
  I('led', 'LED', 'Electronics', [['s', 'M7 18V10A5 5 0 0 1 17 10V18'], ['s', 'M5.5 18H18.5'], ['s', 'M10 18V22.5M14 18V21'], ['s', 'M18.6 4.2L21.2 1.8M20 7.4L23 6.4', 1.3]]),
  I('transistor', 'Transistor TO-92', 'Electronics', [['f', 'M6.5 13V8A5.5 5.5 0 0 1 17.5 8V13Z'], ['s', 'M9 13V22M12 13V22M15 13V22']], 'bjt mosfet'),
  I('to220', 'TO-220 package', 'Electronics', [['e', 'M5 2H19V9H5Z' + circ(12, 5.4, 1.7)], ['f', 'M5 9.8H19V16H5Z'], ['s', 'M8 16V22M12 16V22M16 16V22']], 'regulator mosfet'),
  I('dip', 'IC (DIP)', 'Electronics', [['f', 'M6.5 4H17.5V20H6.5Z'], ['s', 'M3 7H6.5M3 10.3H6.5M3 13.7H6.5M3 17H6.5M17.5 7H21M17.5 10.3H21M17.5 13.7H21M17.5 17H21'], ['wf', circ(9.3, 6.8, 1.1)]], 'chip'),
  I('qfp', 'IC (SMD)', 'Electronics', [['f', 'M6 6H18V18H6Z'], ['s', 'M8.5 6V3M12 6V3M15.5 6V3M8.5 18V21M12 18V21M15.5 18V21M6 8.5H3M6 12H3M6 15.5H3M18 8.5H21M18 12H21M18 15.5H21'], ['wf', circ(8.6, 8.6, 1)]], 'chip microcontroller'),
  I('crystal', 'Crystal', 'Electronics', [['s', 'M6.5 5H17.5A3.5 3.5 0 0 1 17.5 12H6.5A3.5 3.5 0 0 1 6.5 5Z'], ['s', 'M9 12V21M15 12V21']], 'oscillator'),
  I('fuse', 'Fuse', 'Electronics', [['s', 'M1.5 12H5M19 12H22.5'], ['s', rect(5, 8, 14, 8)], ['f', 'M5 8H8V16H5ZM16 8H19V16H16Z'], ['s', 'M8 12C10 10 14 14 16 12', 1.1]]),
  I('battery', 'Battery', 'Electronics', [['s', rect(2.5, 7, 17, 10)], ['f', 'M19.5 10H21.5V14H19.5Z'], ['s', 'M6.5 12H11.5M9 9.5V14.5', 1.4]], 'cell'),
  I('coincell', 'Coin cell', 'Electronics', [['e', circ(12, 12, 10) + circ(12, 12, 8.4)], ['s', 'M8.5 12H15.5M12 8.5V15.5', 1.8]], 'cr2032'),
  I('switch', 'Toggle switch', 'Electronics', [['s', 'M2 16H6M18 16H22'], ['f', circ(7, 16, 1.6) + circ(17, 16, 1.6)], ['s', 'M7 16L16 10']]),
  I('button-sw', 'Push button', 'Electronics', [['s', rect(4, 4, 16, 16)], ['f', circ(12, 12, 4.5)], ['f', 'M2 7H4V9H2ZM20 7H22V9H20ZM2 15H4V17H2ZM20 15H22V17H20Z']], 'tactile'),
  I('pot', 'Potentiometer', 'Electronics', [['s', circ(12, 14, 7)], ['f', 'M10.5 2H13.5V10H10.5Z'], ['w', 'M12 3V9', 0.8]], 'trimmer knob'),
  I('header', 'Pin header', 'Electronics', [['f', 'M3 13H21V18H3Z'], ['s', 'M6 4V13M10 4V13M14 4V13M18 4V13', 1.6], ['s', 'M6 18V21M10 18V21M14 18V21M18 18V21', 1.6]], 'dupont'),
  I('jst', 'Wire connector', 'Electronics', [['s', rect(3, 6, 18, 13)], ['f', 'M6 9H9V13H6ZM10.5 9H13.5V13H10.5ZM15 9H18V13H15Z'], ['s', 'M7.5 19V22.5M12 19V22.5M16.5 19V22.5']], 'jst housing plug'),
  I('terminal', 'Terminal block', 'Electronics', [['s', rect(3, 8, 18, 12)], ['s', circ(7.5, 14, 2.3) + circ(16.5, 14, 2.3)], ['s', 'M6 14H9M15 14H18', 1.1], ['f', 'M5 4H10V8H5ZM14 4H19V8H14Z']], 'screw'),
  I('usb', 'USB connector', 'Electronics', [['s', 'M7 7H17A5 5 0 0 1 17 17H7A5 5 0 0 1 7 7Z'], ['f', 'M7.5 11H16.5V13H7.5Z']], 'usb-c'),
  I('barrel', 'Barrel jack', 'Electronics', [['s', circ(12, 12, 9)], ['e', circ(12, 12, 5.5) + circ(12, 12, 2.2)]], 'dc power'),
  I('cable', 'Cable', 'Electronics', [['s', 'M2 19C7 19 7 12 12 12H15', 1.8], ['f', 'M15 8H19V16H15Z'], ['s', 'M19 10H22M19 14H22', 1.4]], 'wire lead'),
  I('spool', 'Wire spool', 'Electronics', [['e', circ(12, 12, 10) + circ(12, 12, 3)], ['w', circ(12, 12, 6.5), 0.9]], 'solder filament'),
  I('heatshrink', 'Heat shrink', 'Electronics', [['s', 'M3 8H15L19 10V14L15 16H3Z'], ['s', 'M19 12H22.5', 1.2]], 'tube sleeve'),
  I('relay', 'Relay', 'Electronics', [['s', rect(4, 5, 16, 14)], ['s', 'M6.5 12H8M16 12H17.5M8 12A2 2 0 0 1 12 12A2 2 0 0 1 16 12', 1.4]]),
  I('buzzer', 'Buzzer', 'Electronics', [['s', circ(12, 12, 9)], ['s', circ(12, 12, 5.5), 1.1], ['f', circ(12, 12, 2.5)]], 'speaker piezo'),
  I('module', 'Circuit module', 'Electronics', [['s', rect(3, 5, 18, 14)], ['f', 'M8 9H14V15H8Z'], ['f', circ(5.6, 7.6, 1) + circ(18.4, 7.6, 1) + circ(5.6, 16.4, 1) + circ(18.4, 16.4, 1)], ['s', 'M17 10.5V13.5', 1.6]], 'pcb board breakout'),
  I('motor', 'Motor', 'Electronics', [['s', circ(12, 12, 9)], ['s', 'M8.5 15.5V8.5L12 13L15.5 8.5V15.5', 1.5]]),
  I('sensor', 'Sensor', 'Electronics', [['s', rect(5, 8, 14, 12)], ['s', 'M8.5 8A3.5 3.5 0 0 1 15.5 8', 1.4], ['s', 'M6 4.5A8 8 0 0 1 18 4.5', 1.2]], 'detector'),

  // ---- General ----
  I('box', 'Box / bin', 'General', [['s', 'M4 8L12 4L20 8V16L12 20L4 16ZM4 8L12 12L20 8M12 12V20']], 'storage parts'),
  I('tag', 'Tag', 'General', [['s', 'M3 12L11 4H20V13L12 21Z'], ['f', circ(16, 8, 1.6)]], 'label price'),
  I('warning', 'Warning', 'General', [['s', 'M12 3L22 20H2Z'], ['s', 'M12 9V14', 2], ['f', circ(12, 17, 1.2)]], 'caution'),
  I('bolt', 'Electrical', 'General', [['f', 'M13 2L5 13H11L10 22L19 10H13Z']], 'lightning power'),
  I('drop', 'Liquid', 'General', [['f', 'M12 2C12 2 5 10 5 14.5A7 7 0 0 0 19 14.5C19 10 12 2 12 2Z']], 'oil fluid'),
  I('flame', 'Flammable', 'General', [['f', 'M12 2C13 6 18 8 18 14A6 6 0 0 1 6 14C6 11 8 9.5 9 8C9.5 10 10.5 11 11.5 11C11 8 11 5 12 2Z']], 'fire heat'),
  I('recycle', 'Spare / reuse', 'General', [['s', 'M5.5 9A7 7 0 0 1 18 7M18.5 15A7 7 0 0 1 6 17'], ['f', 'M18.5 3.5V8.5H13.5ZM5.5 20.5V15.5H10.5Z']], 'refresh'),
  I('star', 'Favourite', 'General', [['f', star(12, 12.6, 10, 4.3, 5)]]),
  I('check', 'Check', 'General', [['s', 'M4 12.5L9.5 18L20 6', 2.4]], 'done ok'),
];

export const ICON_MAP = Object.fromEntries(ICONS.map(i => [i.id, i]));
export const ICON_CATS = [...new Set(ICONS.map(i => i.cat))];

const pathCache = new Map();
function cachedPath(d) {
  let p = pathCache.get(d);
  if (!p) { p = new Path2D(d); pathCache.set(d, p); }
  return p;
}

// Draw icon `id` into a 2D context at (x, y) with side length `side`.
// customImages maps custom icon ids to loaded HTMLImageElements.
export function paintIcon(ctx, id, x, y, side, ink, paper, customImages) {
  if (id && id.startsWith('img-')) {
    const img = customImages && customImages.get(id);
    if (!img || !img.complete || !img.naturalWidth) return;
    const r = Math.min(side / img.naturalWidth, side / img.naturalHeight);
    const w = img.naturalWidth * r, h = img.naturalHeight * r;
    ctx.drawImage(img, x + (side - w) / 2, y + (side - h) / 2, w, h);
    return;
  }
  const icon = ICON_MAP[id];
  if (!icon) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(side / 24, side / 24);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [type, d, w] of icon.parts) {
    const p = cachedPath(d);
    const col = type === 'w' || type === 'wf' ? paper : ink;
    ctx.fillStyle = col; ctx.strokeStyle = col;
    if (type === 'f' || type === 'wf') ctx.fill(p);
    else if (type === 'e') ctx.fill(p, 'evenodd');
    else {
      ctx.lineWidth = w || 1.6;
      ctx.setLineDash(type === 'd' ? [1.6, 1.4] : []);
      ctx.stroke(p);
    }
  }
  ctx.restore();
}

// Ink extent of an icon as fractions of its square box: { x0, x1, y0, y1 }.
// Layout uses it so an icon takes only the room its drawing needs and can fill the height.
const boundsCache = new Map();
const FULL = { x0: 0, x1: 1, y0: 0, y1: 1 };
export function iconInkBounds(id, customImages) {
  const img = id && id.startsWith('img-') ? customImages && customImages.get(id) : null;
  if (id && id.startsWith('img-')) {
    if (!img || !img.complete || !img.naturalWidth) return FULL;
    const w = Math.min(1, img.naturalWidth / img.naturalHeight), h = Math.min(1, img.naturalHeight / img.naturalWidth); // drawn "contain", centred
    return { x0: (1 - w) / 2, x1: (1 + w) / 2, y0: (1 - h) / 2, y1: (1 + h) / 2 };
  }
  let b = boundsCache.get(id);
  if (b) return b;
  b = FULL;
  if (ICON_MAP[id] && typeof document !== 'undefined') {
    const N = 96;
    const c = document.createElement('canvas'); c.width = c.height = N;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    paintIcon(ctx, id, 0, 0, N, '#000', 'rgba(0,0,0,0)');
    const a = ctx.getImageData(0, 0, N, N).data;
    let x0 = N, x1 = -1, y0 = N, y1 = -1;
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (a[(y * N + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 >= x0) b = { x0: x0 / N, x1: (x1 + 1) / N, y0: y0 / N, y1: (y1 + 1) / N };
  }
  boundsCache.set(id, b);
  return b;
}

// SVG markup for an icon (used by the SVG exporter).
export function iconSVG(id, x, y, side, ink, paper, customSrc) {
  if (id && id.startsWith('img-')) {
    return customSrc ? `<image href="${customSrc}" x="${x}" y="${y}" width="${side}" height="${side}" preserveAspectRatio="xMidYMid meet"/>` : '';
  }
  const icon = ICON_MAP[id];
  if (!icon) return '';
  const k = side / 24;
  const body = icon.parts.map(([type, d, w]) => {
    const col = type === 'w' || type === 'wf' ? paper : ink;
    if (type === 'f' || type === 'wf') return `<path d="${d}" fill="${col}"/>`;
    if (type === 'e') return `<path d="${d}" fill="${col}" fill-rule="evenodd"/>`;
    const dash = type === 'd' ? ' stroke-dasharray="1.6 1.4"' : '';
    return `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w || 1.6}" stroke-linecap="round" stroke-linejoin="round"${dash}/>`;
  }).join('');
  return `<g transform="translate(${+x.toFixed(3)} ${+y.toFixed(3)}) scale(${+k.toFixed(5)})">${body}</g>`;
}
