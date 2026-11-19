// Electronics reference data and value helpers.

export const E_SERIES = {
  E3: [1.0, 2.2, 4.7],
  E6: [1.0, 1.5, 2.2, 3.3, 4.7, 6.8],
  E12: [1.0, 1.2, 1.5, 1.8, 2.2, 2.7, 3.3, 3.9, 4.7, 5.6, 6.8, 8.2],
  E24: [1.0, 1.1, 1.2, 1.3, 1.5, 1.6, 1.8, 2.0, 2.2, 2.4, 2.7, 3.0, 3.3, 3.6, 3.9, 4.3, 4.7, 5.1, 5.6, 6.2, 6.8, 7.5, 8.2, 9.1],
};

const PREFIX = { p: 1e-12, n: 1e-9, u: 1e-6, 'µ': 1e-6, m: 1e-3, '': 1, k: 1e3, K: 1e3, M: 1e6, G: 1e9 };

// Parses '4k7', '4.7k', '220', '100n', '10uF', '2M2', '0R5', '1.5 MΩ' into a number.
export function parseValue(raw) {
  let s = String(raw).trim().replace(/\s+/g, '').replace(/(Ω|ohms?|F|H|Hz)$/i, '');
  if (!s) return NaN;
  let m = s.match(/^(\d+)([pnuµmkKMGR])(\d+)$/); // 4k7, 0R5
  if (m) return parseFloat(`${m[1]}.${m[3]}`) * (m[2] === 'R' ? 1 : PREFIX[m[2]]);
  m = s.match(/^(\d*\.?\d+)([pnuµmkKMG]?)$/);
  if (m) return parseFloat(m[1]) * PREFIX[m[2]];
  return NaN;
}

const STEPS = [[1e9, 'G'], [1e6, 'M'], [1e3, 'k'], [1, ''], [1e-3, 'm'], [1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']];
export function formatValue(v, unit, opts = {}) {
  if (!isFinite(v)) return '?';
  const steps = opts.capStyle ? [[1e-6, 'µ'], [1e-9, 'n'], [1e-12, 'p']] : STEPS;
  for (const [mult, pre] of steps) {
    if (Math.abs(v) >= mult * 0.9999 || mult === steps[steps.length - 1][0]) {
      return `${+(v / mult).toPrecision(3)} ${pre}${unit}`;
    }
  }
  return `${v} ${unit}`;
}
// Capacitors read most naturally as pF below 1 nF, nF below 1 µF, then µF.
export function formatCap(f) {
  if (f < 1e-9) return `${+(f / 1e-12).toPrecision(3)} pF`;
  if (f < 1e-6) return `${+(f / 1e-9).toPrecision(3)} nF`;
  return `${+(f / 1e-6).toPrecision(3)} µF`;
}

export function seriesValues(series, fromV, toV) {
  const base = E_SERIES[series] || E_SERIES.E12, out = [];
  for (let dec = Math.floor(Math.log10(fromV)) - 1; dec <= Math.ceil(Math.log10(toV)); dec++) {
    for (const b of base) {
      const v = +(b * Math.pow(10, dec)).toPrecision(3);
      if (v >= fromV * 0.9999 && v <= toV * 1.0001) out.push(v);
    }
  }
  return [...new Set(out)];
}

const COLORS = ['BLK', 'BRN', 'RED', 'ORG', 'YEL', 'GRN', 'BLU', 'VIO', 'GRY', 'WHT'];
// Two significant digits + multiplier (4-band). Returns e.g. 'BRN BLK ORG'.
export function resistorBands(ohms, digits = 2) {
  if (!(ohms > 0)) return '';
  let exp = Math.floor(Math.log10(ohms)) - (digits - 1);
  let sig = Math.round(ohms / Math.pow(10, exp));
  if (sig >= Math.pow(10, digits)) { sig /= 10; exp += 1; }
  const ds = String(sig).padStart(digits, '0').split('').map(d => COLORS[+d]);
  const mult = exp >= 0 && exp <= 9 ? COLORS[exp] : exp === -1 ? 'GLD' : exp === -2 ? 'SLV' : '?';
  return [...ds, mult].join(' ');
}
// SMD 3-digit code: 10k -> 103, 4.7 -> 4R7
export function smdCode(ohms) {
  if (!(ohms > 0)) return '';
  if (ohms < 10) return String(+ohms.toPrecision(2)).replace('.', 'R');
  const exp = Math.floor(Math.log10(ohms)) - 1;
  return `${Math.round(ohms / Math.pow(10, exp))}${exp}`;
}
// Ceramic capacitor code in pF: 100 nF -> 104
export function capCode(farads) {
  const pf = farads / 1e-12;
  if (pf < 10) return String(+pf.toPrecision(2)).replace('.', 'R');
  const exp = Math.floor(Math.log10(pf)) - 1;
  return `${Math.round(pf / Math.pow(10, exp))}${exp}`;
}

export const RES_PACKAGES = ['Axial THT', '0402', '0603', '0805', '1206', '2512', 'Network SIP'];
export const RES_POWER = ['⅛ W', '¼ W', '½ W', '1 W', '2 W', '5 W'];
export const RES_TOL = ['1%', '5%', '0.1%', '2%'];

export const CAP_TYPES = [
  { id: 'mlcc', name: 'Ceramic (MLCC)', icon: 'capacitor' },
  { id: 'disc', name: 'Ceramic disc', icon: 'capacitor' },
  { id: 'elec', name: 'Electrolytic', icon: 'electrolytic' },
  { id: 'film', name: 'Film', icon: 'capacitor' },
  { id: 'tant', name: 'Tantalum', icon: 'capacitor' },
  { id: 'super', name: 'Supercapacitor', icon: 'electrolytic' },
];
export const CAP_VOLTAGES = ['6.3 V', '10 V', '16 V', '25 V', '35 V', '50 V', '63 V', '100 V', '250 V', '400 V'];
export const CAP_DIELECTRIC = ['C0G/NP0', 'X7R', 'X5R', 'Y5V'];
export const CAP_PACKAGES = ['THT', '0402', '0603', '0805', '1206', 'Radial 5 mm', 'SMD can'];

export const PARTS = {
  diodes: [
    ['1N4148', 'Signal diode · DO-35'], ['1N4007', 'Rectifier 1 A 1000 V'], ['1N4001', 'Rectifier 1 A 50 V'],
    ['1N5819', 'Schottky 1 A 40 V'], ['1N5822', 'Schottky 3 A 40 V'], ['SS34', 'Schottky 3 A · SMA'],
    ['BAT54', 'Schottky · SOT-23'], ['1N4733A', 'Zener 5.1 V 1 W'], ['1N4742A', 'Zener 12 V 1 W'],
    ['BZX55C3V3', 'Zener 3.3 V'], ['BZX55C5V1', 'Zener 5.1 V'], ['P6KE6.8A', 'TVS 6.8 V'], ['KBP307', 'Bridge rectifier 3 A'],
  ],
  transistors: [
    ['2N2222A', 'NPN · TO-92'], ['2N3904', 'NPN · TO-92'], ['2N3906', 'PNP · TO-92'], ['BC547', 'NPN · TO-92'],
    ['BC557', 'PNP · TO-92'], ['S8050', 'NPN · TO-92'], ['S8550', 'PNP · TO-92'], ['TIP120', 'Darlington · TO-220'],
    ['2N7000', 'N-MOSFET · TO-92'], ['IRLZ44N', 'N-MOSFET logic · TO-220'], ['IRF540N', 'N-MOSFET · TO-220'],
    ['IRF9540N', 'P-MOSFET · TO-220'], ['AO3400', 'N-MOSFET · SOT-23'], ['AO3401', 'P-MOSFET · SOT-23'],
  ],
  ics: [
    ['NE555', 'Timer · DIP-8'], ['LM358', 'Dual op-amp · DIP-8'], ['LM393', 'Dual comparator · DIP-8'],
    ['TL072', 'JFET op-amp · DIP-8'], ['LM386', 'Audio amp · DIP-8'], ['74HC595', 'Shift register · DIP-16'],
    ['74HC165', 'PISO shift register · DIP-16'], ['CD4017', 'Decade counter · DIP-16'], ['ULN2003', 'Darlington array · DIP-16'],
    ['L293D', 'Motor driver · DIP-16'], ['PCF8574', 'I²C expander · DIP-16'], ['ATmega328P', 'MCU · DIP-28'],
    ['ATtiny85', 'MCU · DIP-8'], ['ESP32-WROOM', 'Wi-Fi MCU module'], ['RP2040', 'MCU · QFN-56'], ['CH340G', 'USB-UART · SOP-16'],
  ],
  regulators: [
    ['LM7805', '5 V 1.5 A · TO-220'], ['LM7812', '12 V 1.5 A · TO-220'], ['LM7833', '3.3 V · TO-220'],
    ['LM317', 'Adjustable · TO-220'], ['AMS1117-3.3', '3.3 V LDO · SOT-223'], ['AMS1117-5.0', '5 V LDO · SOT-223'],
    ['MCP1700-3302', '3.3 V LDO · TO-92'], ['LM2596', 'Buck module'], ['MT3608', 'Boost module'], ['TP4056', 'Li-ion charger module'],
  ],
  switches: [
    ['Tactile 6×6', 'Push button'], ['Tactile 12×12', 'Push button'], ['Slide SPDT', 'Slide switch'],
    ['Toggle SPDT', 'Toggle switch'], ['Rocker SPST', 'Rocker switch'], ['Microswitch', 'Limit switch'],
    ['DIP switch 4P', 'DIP switch'], ['DIP switch 8P', 'DIP switch'], ['Rotary encoder', 'EC11'], ['Reed switch', 'Magnetic'],
  ],
  batteries: [
    ['AA', 'Alkaline 1.5 V'], ['AAA', 'Alkaline 1.5 V'], ['9 V', 'PP3'], ['CR2032', 'Lithium coin 3 V'],
    ['CR2025', 'Lithium coin 3 V'], ['CR1220', 'Lithium coin 3 V'], ['LR44', 'Alkaline button'], ['18650', 'Li-ion 3.7 V'],
    ['21700', 'Li-ion 3.7 V'], ['LiPo 1S', '3.7 V pouch'],
  ],
};

export const LED_SIZES = ['3 mm', '5 mm', '10 mm', '0603', '0805', '1206', '5050', 'WS2812B'];
export const LED_COLORS = ['Red', 'Green', 'Blue', 'Yellow', 'Orange', 'White', 'Warm white', 'RGB', 'UV', 'IR'];

export const CONNECTORS = [
  { id: 'jst-xh', name: 'JST-XH', pitch: '2.5 mm' }, { id: 'jst-ph', name: 'JST-PH', pitch: '2.0 mm' },
  { id: 'jst-sh', name: 'JST-SH', pitch: '1.0 mm' }, { id: 'jst-gh', name: 'JST-GH', pitch: '1.25 mm' },
  { id: 'jst-zh', name: 'JST-ZH', pitch: '1.5 mm' }, { id: 'jst-vh', name: 'JST-VH', pitch: '3.96 mm' },
  { id: 'dupont', name: 'Dupont', pitch: '2.54 mm' }, { id: 'kk254', name: 'Molex KK', pitch: '2.54 mm' },
  { id: 'microfit', name: 'Micro-Fit', pitch: '3.0 mm' }, { id: 'jst-sm', name: 'JST-SM', pitch: '2.5 mm' },
  { id: 'xt30', name: 'XT30', pitch: 'power' }, { id: 'xt60', name: 'XT60', pitch: 'power' }, { id: 'xt90', name: 'XT90', pitch: 'power' },
  { id: 'pp', name: 'Anderson PP', pitch: 'power' }, { id: 'screw', name: 'Screw terminal', pitch: '5.08 mm' },
];
export const CONNECTOR_PARTS = ['Housing', 'Crimp terminal', 'Header straight', 'Header right-angle', 'Pigtail'];

export const AWG = [30, 28, 26, 24, 22, 20, 18, 16, 14, 12, 10];
export const WIRE_TYPES = ['Stranded', 'Solid', 'Silicone', 'Ribbon', 'Shielded'];
export const WIRE_COLORS = ['Black', 'Red', 'White', 'Yellow', 'Green', 'Blue', 'Orange', 'Brown', 'Purple', 'Grey'];
export const HEATSHRINK = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16, 20, 25];
export const CRYSTALS = ['32.768 kHz', '4 MHz', '8 MHz', '12 MHz', '16 MHz', '20 MHz', '24 MHz', '25 MHz'];
export const FUSE_TYPES = ['5×20 mm glass', '6×30 mm glass', 'Blade (ATO)', 'Mini blade', 'Micro blade', 'PTC resettable', 'SMD 1206'];
export const FUSE_RATINGS = [0.1, 0.25, 0.5, 1, 1.5, 2, 3, 4, 5, 7.5, 10, 15, 20, 25, 30];
