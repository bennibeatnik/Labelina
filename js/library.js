// Parts library. Each category describes a form (fields) and a build() that turns the form
// values into parts. A part is a set of named pieces of information (`parts`, e.g. size,
// type, material, standard) plus icons. Which piece goes on which label line is decided by
// the category's line templates (`tpl`), which the user can edit: "{type} · {drive}" puts the
// head type and drive on that line, and any other text is printed as typed.
//
// Field types:
//   select  single choice        chips  multi choice
//   text    free text            check  checkbox        icon  icon picker select
//   lines   the line template editor (added to every category)
// `options` and `show` may be functions of the current values.

import * as F from './fasteners.js';
import * as E from './electronics.js';

const opt = (v, t = v) => ({ v, t });
const join = a => a.filter(Boolean).join(' · ');
const csvList = s => String(s || '').split(/[,;\n]+/).map(x => x.trim()).filter(Boolean);

const metricById = Object.fromEntries(F.METRIC_SIZES.map(s => [s.id, s]));
const inchById = Object.fromEntries(F.INCH_SIZES.map(s => [s.id, s]));

export const LINE_COUNT = 5;

const systemField = { id: 'system', label: 'Thread system', type: 'select', options: [opt('metric', 'Metric (ISO)'), opt('inch', 'Inch (UNC / UNF)')], def: 'metric' };
const sizesField = (def = ['M3'], filter) => ({
  id: 'sizes', label: 'Thread sizes', type: 'chips', def, wide: true,
  options: v => v.system === 'inch'
    ? F.INCH_SIZES.map(s => opt(s.id, F.prettyInchSize(s.id)))
    : F.METRIC_SIZES.filter(s => !filter || filter(s)).map(s => opt(s.id)),
});
// The options show the actual pitch for the chosen sizes, e.g. "Coarse · M5 0.8", so it's clear
// what will be printed.
const pitchField = {
  id: 'pitch', label: 'Thread pitch', type: 'select', def: 'coarse',
  options: v => {
    if (v.system === 'inch') return [opt('coarse', 'UNC (coarse)'), opt('fine', 'UNF (fine)')];
    const sz = (v.sizes || []).map(id => metricById[id]).filter(Boolean).slice(0, 4);
    const list = pick => sz.map(s => `${s.id} ${F.num(pick(s))}`).join(', ');
    const more = (v.sizes || []).length > 4 ? ', …' : '';
    return [
      opt('coarse', sz.length ? `Coarse · ${list(s => s.p)}${more}` : 'Coarse (standard)'),
      opt('fine', sz.length ? `Fine · ${list(s => (s.fine && s.fine[0]) || s.p)}${more}` : 'Fine'),
    ];
  },
};
const materialField = (def = 'a2', ids) => ({
  id: 'material', label: 'Material', type: 'select', def,
  options: (ids ? F.MATERIALS.filter(m => ids.includes(m.id)) : F.MATERIALS).map(m => opt(m.id, m.name)),
});
const stdField = { id: 'std', label: 'Standard number', type: 'select', def: 'iso', options: [opt('iso', 'ISO'), opt('din', 'DIN')] };

const matShort = id => (F.MATERIALS.find(m => m.id === id) || {}).short || '';
const stdOf = (item, mode) => mode === 'din' ? (item.din || item.std || '') : (item.std || '');

// Thread designation for a size: 'M3', 'M8×1', '#4-40', '¼"-20'
function threadName(sys, sizeId, pitch, forcePitch) {
  if (sys === 'inch') {
    const s = inchById[sizeId];
    const tpi = pitch === 'fine' || !s.unc ? s.unf : s.unc;
    return { name: `${F.prettyInchSize(sizeId)}-${tpi}`, pitchText: pitch === 'fine' || !s.unc ? 'UNF' : 'UNC', size: s };
  }
  const s = metricById[sizeId];
  const fine = pitch === 'fine' && s.fine && s.fine.length;
  const p = fine ? s.fine[0] : s.p;
  return { name: fine || forcePitch ? `${s.id}×${F.num(p)}` : s.id, pitchText: `Pitch ${F.num(p)}`, size: s, p };
}

// ---------------------------------------------------------------- fasteners
const screws = {
  id: 'screws', group: 'Fasteners', name: 'Screws & bolts', icon: 'shcs',
  tokens: [['size', 'Size'], ['thread', 'Thread'], ['length', 'Length'], ['type', 'Head type'], ['drive', 'Drive'], ['material', 'Material'], ['standard', 'Standard'], ['pitch', 'Pitch'], ['key', 'Key / wrench']],
  tpl: ['{size}', '{type} · {drive} · {material}', '{standard} · {key}', '', ''],
  fields: [
    systemField, sizesField(['M3']), pitchField,
    { id: 'head', label: 'Head', type: 'select', def: 'shcs', options: F.SCREW_HEADS.map(h => opt(h.id, h.name)) },
    { id: 'drive', label: 'Drive', type: 'select', def: 'hex', options: v => (F.SCREW_HEADS.find(h => h.id === v.head) || F.SCREW_HEADS[0]).drives.map(d => opt(d, F.DRIVES[d].name)) },
    { id: 'point', label: 'Point', type: 'select', def: 'Cup point', options: F.SET_POINTS.map(p => opt(p)), show: v => v.head === 'set' },
    {
      id: 'lengths', label: 'Lengths', type: 'chips', def: ['6', '8', '10', '12'], wide: true,
      options: v => {
        if (v.system === 'inch') {
          const sz = (v.sizes || []).map(id => inchById[id]).filter(Boolean);
          const lo = Math.min(...sz.map(s => s.len[0]), 99), hi = Math.max(...sz.map(s => s.len[1]), 0);
          return F.INCH_LENGTHS.filter(l => !sz.length || (F.inchValue(l) >= lo && F.inchValue(l) <= hi)).map(l => opt(l, F.prettyInch(l)));
        }
        const sz = (v.sizes || []).map(id => metricById[id]).filter(Boolean);
        const lo = Math.min(...sz.map(s => s.len[0]), 999), hi = Math.max(...sz.map(s => s.len[1]), 0);
        return F.METRIC_LENGTHS.filter(l => !sz.length || (l >= lo && l <= hi)).map(l => opt(String(l)));
      },
    },
    { id: 'customLen', label: 'Other lengths', type: 'text', def: '', placeholder: 'e.g. 7, 13' },
    materialField('a2'),
    stdField,
    { id: 'fmt', label: 'Size format', type: 'select', def: 'short', options: v => v.system === 'inch' ? [opt('short', '#4-40 × ½"')] : [opt('short', 'M3×10'), opt('pitch', 'M3×0.5×10'), opt('long', 'M3 × 10 mm')] },
    { id: 'driveIcon', label: 'Add drive symbol next to the icon', type: 'check', def: true },
  ],
  build(v) {
    const head = F.SCREW_HEADS.find(h => h.id === v.head) || F.SCREW_HEADS[0];
    const drive = head.drives.includes(v.drive) ? v.drive : head.drives[0];
    const inch = v.system === 'inch';
    const out = [];
    for (const sizeId of v.sizes || []) {
      const t = threadName(v.system, sizeId, v.pitch, v.fmt === 'pitch');
      const s = t.size;
      if (!s) continue;
      let lens;
      if (inch) lens = (v.lengths || []).filter(l => F.inchValue(l) >= s.len[0] && F.inchValue(l) <= s.len[1]);
      else lens = (v.lengths || []).filter(l => +l >= s.len[0] && +l <= s.len[1]);
      lens = [...lens, ...csvList(v.customLen)];
      if (head.id === 'rod' && !lens.length) lens = [''];
      for (const L of lens) {
        const inchLen = L && (/^[\d.]+$/.test(L) ? L + '"' : F.prettyInch(L));
        const size = inch ? (L ? `${t.name} × ${inchLen}` : t.name) : !L ? t.name : v.fmt === 'long' ? `${t.name} × ${L} mm` : `${t.name}×${L}`;
        let key = '';
        if (head.wrench) key = s.af ? `AF ${typeof s.af === 'number' ? F.num(s.af) : s.af}` : '';
        else if (drive === 'hex') { const kz = inch ? s.key : s.key && s.key[head.key]; key = kz ? `Key ${kz}` : ''; }
        else if (drive === 'torx' && s.tx) key = s.tx;
        else if ((drive === 'phillips' || drive === 'pozi') && s.ph) key = drive === 'pozi' ? s.ph.replace('PH', 'PZ') : s.ph;
        out.push({
          parts: {
            size, thread: t.name, length: L ? (inch ? inchLen : `${L} mm`) : '',
            type: head.id === 'set' ? `Set screw, ${(v.point || 'Cup point').replace(' point', '').toLowerCase()} pt` : head.short,
            drive: F.DRIVES[drive].short, material: matShort(v.material), standard: inch ? '' : stdOf(head, v.std), pitch: t.pitchText, key,
          },
          icon: head.icon, icon2: v.driveIcon && F.DRIVES[drive].icon && drive !== 'ext' ? F.DRIVES[drive].icon : '',
        });
      }
    }
    return out;
  },
};

const nuts = {
  id: 'nuts', group: 'Fasteners', name: 'Nuts', icon: 'hexnut',
  tokens: [['size', 'Size'], ['type', 'Nut type'], ['material', 'Material'], ['standard', 'Standard'], ['pitch', 'Pitch'], ['dims', 'Wrench / height']],
  tpl: ['{size}', '{type} · {material}', '{standard} · {dims}', '', ''],
  fields: [
    systemField, sizesField(['M3', 'M4', 'M5']), pitchField,
    { id: 'type', label: 'Nut type', type: 'select', def: 'hex', options: F.NUT_TYPES.map(n => opt(n.id, n.name)) },
    { id: 'profile', label: 'Extrusion profile', type: 'select', def: F.TSLOT_PROFILES[0], options: F.TSLOT_PROFILES.map(p => opt(p)), show: v => v.type === 'tslot' },
    materialField('a2'), stdField,
  ],
  build(v) {
    const type = F.NUT_TYPES.find(n => n.id === v.type) || F.NUT_TYPES[0];
    return (v.sizes || []).map(sizeId => {
      const t = threadName(v.system, sizeId, v.pitch);
      const s = t.size;
      let dims = '';
      if (v.system === 'metric' && ['hex', 'nyloc', 'jam'].includes(type.id)) dims = join([s.af && `AF ${F.num(s.af)}`, s[type.h] && `${F.num(s[type.h])} thick`]);
      if (v.system === 'inch' && s.af) dims = `AF ${s.af}`;
      return {
        parts: { size: t.name, type: type.id === 'tslot' ? `T-nut ${v.profile}` : type.name, material: matShort(v.material), standard: v.system === 'inch' ? '' : stdOf(type, v.std), pitch: t.pitchText, dims },
        icon: type.icon,
      };
    });
  },
};

const washers = {
  id: 'washers', group: 'Fasteners', name: 'Washers', icon: 'washer',
  tokens: [['size', 'Size'], ['type', 'Washer type'], ['material', 'Material'], ['standard', 'Standard'], ['dims', 'ID × OD × thickness']],
  tpl: ['{size}', '{type} · {material}', '{standard} · {dims}', '', ''],
  fields: [
    systemField, sizesField(['M3', 'M4', 'M5', 'M6']),
    { id: 'type', label: 'Washer type', type: 'select', def: 'flat', options: F.WASHER_TYPES.map(w => opt(w.id, w.name)) },
    materialField('a2'), stdField,
  ],
  build(v) {
    const type = F.WASHER_TYPES.find(w => w.id === v.type) || F.WASHER_TYPES[0];
    return (v.sizes || []).map(sizeId => {
      const s = v.system === 'inch' ? inchById[sizeId] : metricById[sizeId];
      const d = type.dims && s && s[type.dims];
      return {
        parts: { size: v.system === 'inch' ? F.prettyInchSize(sizeId) : sizeId, type: type.name, material: matShort(v.material), standard: v.system === 'inch' ? '' : stdOf(type, v.std), dims: d ? d.map(F.num).join('×') : '' },
        icon: type.icon,
      };
    });
  },
};

const inserts = {
  id: 'inserts', group: 'Fasteners', name: 'Threaded inserts', icon: 'insert',
  tokens: [['size', 'Size'], ['thread', 'Thread'], ['length', 'Length'], ['type', 'Insert type'], ['material', 'Material'], ['depth', 'Length × D']],
  tpl: ['{size}', '{type} · {material}', '{depth}', '', ''],
  fields: [
    { id: 'type', label: 'Insert type', type: 'select', def: 'heatset', options: F.INSERT_TYPES.map(t => opt(t.id, t.name)) },
    { id: 'sizes', label: 'Thread sizes', type: 'chips', def: ['M3'], wide: true, options: v => { const t = F.INSERT_TYPES.find(x => x.id === v.type) || F.INSERT_TYPES[0]; return (t.lengths ? Object.keys(t.lengths) : ['M2', 'M2.5', 'M3', 'M4', 'M5', 'M6', 'M8', 'M10', 'M12']).map(s => opt(s)); } },
    {
      id: 'lengths', label: 'Lengths', type: 'chips', def: ['3', '4', '5.7', '1.5'], wide: true,
      options: v => {
        const t = F.INSERT_TYPES.find(x => x.id === v.type) || F.INSERT_TYPES[0];
        if (t.lengthsD) return t.lengthsD.map(d => opt(String(d), `${d}×D`));
        const all = new Set();
        (v.sizes || []).forEach(s => (t.lengths[s] || []).forEach(l => all.add(l)));
        return [...all].sort((a, b) => a - b).map(l => opt(String(l)));
      },
    },
    materialField('brass', ['brass', 'a2', 'zinc', 'none']),
  ],
  build(v) {
    const t = F.INSERT_TYPES.find(x => x.id === v.type) || F.INSERT_TYPES[0];
    const out = [];
    for (const sz of v.sizes || []) {
      const s = metricById[sz];
      const lens = t.lengthsD ? (v.lengths || []).filter(l => t.lengthsD.includes(+l)) : (v.lengths || []).filter(l => (t.lengths[sz] || []).includes(+l));
      for (const L of lens) {
        const len = t.lengthsD ? F.num(+L * s.d) : L;
        out.push({ parts: { size: `${sz}×${len}`, thread: sz, length: `${len} mm`, type: t.name, material: matShort(v.material), depth: t.lengthsD ? `${L}×D` : '' }, icon: t.icon });
      }
    }
    return out;
  },
};

const standoffs = {
  id: 'standoffs', group: 'Fasteners', name: 'Standoffs & spacers', icon: 'standoff-ff',
  tokens: [['size', 'Size'], ['thread', 'Thread'], ['length', 'Length'], ['type', 'Type'], ['material', 'Material'], ['extra', 'Male thread length']],
  tpl: ['{size}', '{type} · {material}', '{extra}', '', ''],
  fields: [
    { id: 'sizes', label: 'Thread sizes', type: 'chips', def: ['M3'], options: ['M2', 'M2.5', 'M3', 'M4', 'M5', 'M6'].map(s => opt(s)) },
    { id: 'type', label: 'Type', type: 'select', def: 'ff', options: F.STANDOFF_TYPES.map(t => opt(t.id, t.name)) },
    { id: 'lengths', label: 'Body lengths (mm)', type: 'chips', def: ['5', '10', '15', '20'], wide: true, options: F.STANDOFF_LENGTHS.map(l => opt(String(l))) },
    materialField('brass', ['brass', 'nylon', 'alu', 'a2', 'none']),
  ],
  build(v) {
    const t = F.STANDOFF_TYPES.find(x => x.id === v.type) || F.STANDOFF_TYPES[0];
    const out = [];
    for (const sz of v.sizes || []) for (const L of v.lengths || []) {
      const s = metricById[sz];
      out.push({ parts: { size: `${sz}×${L}`, thread: sz, length: `${L} mm`, type: t.name, material: matShort(v.material), extra: t.id === 'mf' ? `+ ${F.num(Math.max(3, s.d * 1.6))} mm thread` : '' }, icon: t.icon });
    }
    return out;
  },
};

const pins = {
  id: 'pins', group: 'Fasteners', name: 'Pins, clips & rivets', icon: 'dowel',
  tokens: [['size', 'Size'], ['type', 'Type'], ['material', 'Material'], ['fit', 'Shaft / bore'], ['standard', 'Standard']],
  tpl: ['{size}', '{type} · {material}', '{fit} · {standard}', '', ''],
  fields: [
    { id: 'type', label: 'Type', type: 'select', def: 'dowel', options: F.PIN_TYPES.map(t => opt(t.id, t.name)) },
    { id: 'dias', label: 'Diameters (mm)', type: 'chips', def: ['3', '4'], wide: true, options: v => (F.PIN_TYPES.find(t => t.id === v.type) || F.PIN_TYPES[0]).dias.map(d => opt(String(d), `Ø${d}`)) },
    { id: 'lengths', label: 'Lengths (mm)', type: 'chips', def: ['10', '16', '20'], wide: true, options: v => ((F.PIN_TYPES.find(t => t.id === v.type) || {}).lengths || []).map(l => opt(String(l))), show: v => !!(F.PIN_TYPES.find(t => t.id === v.type) || {}).lengths },
    materialField('a2'), stdField,
  ],
  build(v) {
    const t = F.PIN_TYPES.find(x => x.id === v.type) || F.PIN_TYPES[0];
    const valid = new Set((t.dias || []).map(String));
    const dias = (v.dias || []).filter(d => valid.has(d));
    const out = [];
    for (const d of dias) {
      const fit = t.shaft ? 'for shaft' : t.bore ? 'for bore' : t.groove ? 'groove' : '';
      const lens = t.lengths ? (v.lengths || []).filter(l => t.lengths.includes(+l)) : [null];
      for (const L of lens) out.push({ parts: { size: L ? `Ø${d}×${L}` : `Ø${d}`, type: t.name, material: matShort(v.material), fit, standard: stdOf(t, v.std) }, icon: t.icon });
    }
    return out;
  },
};

// ------------------------------------------------------------- electronics
const valueFields = (defList, unitLabel) => [
  { id: 'mode', label: 'Values', type: 'select', def: 'list', options: [opt('list', 'Type a list'), opt('series', 'Standard series range')] },
  { id: 'list', label: `Values (${unitLabel})`, type: 'text', def: defList, wide: true, show: v => v.mode !== 'series', placeholder: 'Comma separated' },
  { id: 'series', label: 'Series', type: 'select', def: 'E12', options: Object.keys(E.E_SERIES).map(s => opt(s)), show: v => v.mode === 'series' },
  { id: 'from', label: 'From', type: 'text', def: '', show: v => v.mode === 'series' },
  { id: 'to', label: 'To', type: 'text', def: '', show: v => v.mode === 'series' },
];
function collectValues(v, fallbackFrom, fallbackTo) {
  if (v.mode === 'series') {
    const a = E.parseValue(v.from || fallbackFrom), b = E.parseValue(v.to || fallbackTo);
    if (!(a > 0) || !(b > 0)) return [];
    return E.seriesValues(v.series, Math.min(a, b), Math.max(a, b));
  }
  return csvList(v.list).map(E.parseValue).filter(x => x > 0);
}

const resistors = {
  id: 'resistors', group: 'Electronics', name: 'Resistors', icon: 'resistor',
  tokens: [['value', 'Value'], ['power', 'Power'], ['tol', 'Tolerance'], ['pkg', 'Package'], ['bands', 'Colour bands'], ['smd', 'SMD code']],
  tpl: ['{value}', '{power} · {tol} · {pkg}', '{bands}', '', ''],
  fields: [
    ...valueFields('10, 100, 220, 330, 1k, 4.7k, 10k, 47k, 100k', 'Ω, k, M'),
    { id: 'power', label: 'Power', type: 'select', def: '¼ W', options: E.RES_POWER.map(p => opt(p)) },
    { id: 'tol', label: 'Tolerance', type: 'select', def: '1%', options: E.RES_TOL.map(p => opt(p)) },
    { id: 'pkg', label: 'Package', type: 'select', def: 'Axial THT', options: E.RES_PACKAGES.map(p => opt(p)) },
  ],
  build(v) {
    return collectValues(v, '10', '1M').map(ohms => ({
      parts: { value: E.formatValue(ohms, 'Ω'), power: v.power, tol: v.tol, pkg: v.pkg, bands: E.resistorBands(ohms), smd: `SMD ${E.smdCode(ohms)}` },
      icon: 'resistor',
    }));
  },
};

const capacitors = {
  id: 'capacitors', group: 'Electronics', name: 'Capacitors', icon: 'capacitor',
  tokens: [['value', 'Value'], ['type', 'Type'], ['volt', 'Voltage'], ['diel', 'Dielectric'], ['pkg', 'Package'], ['code', 'Marking code']],
  tpl: ['{value}', '{type} · {volt}', '{diel} · {pkg} · {code}', '', ''],
  fields: [
    { id: 'type', label: 'Type', type: 'select', def: 'mlcc', options: E.CAP_TYPES.map(t => opt(t.id, t.name)) },
    ...valueFields('10p, 22p, 100p, 1n, 10n, 100n, 1u, 10u, 100u', 'p, n, u'),
    { id: 'volt', label: 'Voltage', type: 'select', def: '50 V', options: E.CAP_VOLTAGES.map(p => opt(p)) },
    { id: 'diel', label: 'Dielectric', type: 'select', def: 'X7R', options: E.CAP_DIELECTRIC.map(p => opt(p)), show: v => v.type === 'mlcc' || v.type === 'disc' },
    { id: 'pkg', label: 'Package', type: 'select', def: '0805', options: E.CAP_PACKAGES.map(p => opt(p)) },
  ],
  build(v) {
    const type = E.CAP_TYPES.find(t => t.id === v.type) || E.CAP_TYPES[0];
    const ceramic = v.type === 'mlcc' || v.type === 'disc';
    return collectValues(v, '10p', '100u').map(f => ({
      parts: { value: E.formatCap(f), type: type.name, volt: v.volt, diel: ceramic ? v.diel : '', pkg: v.pkg, code: ceramic ? `Code ${E.capCode(f)}` : '' },
      icon: type.icon,
    }));
  },
};

const inductors = {
  id: 'inductors', group: 'Electronics', name: 'Inductors', icon: 'inductor',
  tokens: [['value', 'Value'], ['current', 'Current'], ['pkg', 'Package']],
  tpl: ['{value}', 'Inductor · {current}', '{pkg}', '', ''],
  fields: [
    ...valueFields('1u, 2.2u, 4.7u, 10u, 22u, 47u, 100u', 'n, u, m'),
    { id: 'current', label: 'Current rating', type: 'text', def: '', placeholder: 'e.g. 2 A' },
    { id: 'pkg', label: 'Package', type: 'select', def: 'SMD power', options: ['SMD power', 'Radial THT', 'Axial THT', '0805', '1206', 'Toroid'].map(p => opt(p)) },
  ],
  build(v) {
    return collectValues(v, '1u', '100u').map(h => ({ parts: { value: E.formatValue(h, 'H'), current: v.current, pkg: v.pkg }, icon: 'inductor' }));
  },
};

const partsCategory = (id, name, icon, key, iconFor) => ({
  id, group: 'Electronics', name, icon,
  tokens: [['part', 'Part number'], ['desc', 'Description']],
  tpl: ['{part}', '{desc}', '', '', ''],
  fields: [
    { id: 'parts', label: 'Parts', type: 'chips', def: E.PARTS[key].slice(0, 4).map(p => p[0]), wide: true, options: E.PARTS[key].map(p => opt(p[0])) },
    { id: 'custom', label: 'Other part numbers', type: 'text', def: '', wide: true, placeholder: 'Part | description, comma separated' },
  ],
  build(v) {
    const map = Object.fromEntries(E.PARTS[key]);
    const out = (v.parts || []).map(p => ({ parts: { part: p, desc: map[p] || '' }, icon: iconFor ? iconFor(map[p] || '') : icon }));
    for (const c of csvList(v.custom)) { const [p, d = ''] = c.split('|').map(x => x.trim()); out.push({ parts: { part: p, desc: d }, icon: iconFor ? iconFor(d) : icon }); }
    return out;
  },
});

const leds = {
  id: 'leds', group: 'Electronics', name: 'LEDs', icon: 'led',
  tokens: [['size', 'Size'], ['color', 'Colour'], ['note', 'Note']],
  tpl: ['{size} {color}', 'LED · {note}', '', '', ''],
  fields: [
    { id: 'sizes', label: 'Sizes', type: 'chips', def: ['5 mm'], options: E.LED_SIZES.map(s => opt(s)) },
    { id: 'colors', label: 'Colours', type: 'chips', def: ['Red', 'Green', 'Blue'], wide: true, options: E.LED_COLORS.map(s => opt(s)) },
    { id: 'extra', label: 'Note', type: 'text', def: '', placeholder: 'e.g. diffused, 20 mA' },
  ],
  build(v) {
    const out = [];
    for (const s of v.sizes || []) for (const c of v.colors || []) out.push({ parts: { size: s, color: c, note: v.extra }, icon: 'led' });
    return out;
  },
};

const connectors = {
  id: 'connectors', group: 'Electronics', name: 'Connectors', icon: 'jst',
  tokens: [['name', 'Connector'], ['family', 'Family'], ['positions', 'Positions'], ['part', 'Part'], ['pitch', 'Pitch']],
  tpl: ['{name}', '{part} · {pitch}', '', '', ''],
  fields: [
    { id: 'families', label: 'Families', type: 'chips', def: ['jst-xh'], wide: true, options: E.CONNECTORS.map(c => opt(c.id, c.name)) },
    { id: 'pins', label: 'Positions', type: 'chips', def: ['2', '3', '4'], wide: true, options: Array.from({ length: 12 }, (_, i) => opt(String(i + 1), `${i + 1}P`)) },
    { id: 'parts', label: 'Parts', type: 'chips', def: ['Housing'], wide: true, options: E.CONNECTOR_PARTS.map(p => opt(p)) },
  ],
  build(v) {
    const out = [];
    for (const fid of v.families || []) {
      const fam = E.CONNECTORS.find(c => c.id === fid);
      if (!fam) continue;
      const power = fam.pitch === 'power';
      const pinList = power ? [null] : (v.pins || []);
      for (const p of pinList) for (const part of v.parts || []) {
        out.push({ parts: { name: p ? `${fam.name} ${p}P` : fam.name, family: fam.name, positions: p ? `${p}P` : '', part, pitch: power ? '' : fam.pitch }, icon: part.startsWith('Header') ? 'header' : part === 'Crimp terminal' ? 'cable' : 'jst' });
      }
    }
    return out;
  },
};

const headers = {
  id: 'headers', group: 'Electronics', name: 'Pin headers', icon: 'header',
  tokens: [['name', 'Rows × pins + gender'], ['pitch', 'Pitch'], ['angle', 'Orientation']],
  tpl: ['{name}', 'Header · {pitch} · {angle}', '', '', ''],
  fields: [
    { id: 'pitch', label: 'Pitch', type: 'select', def: '2.54 mm', options: ['2.54 mm', '2.0 mm', '1.27 mm'].map(p => opt(p)) },
    { id: 'rows', label: 'Rows', type: 'select', def: '1', options: [opt('1', 'Single row'), opt('2', 'Double row')] },
    { id: 'pins', label: 'Pins per row', type: 'chips', def: ['40'], wide: true, options: [2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 40].map(n => opt(String(n))) },
    { id: 'gender', label: 'Gender', type: 'chips', def: ['Male', 'Female'], options: ['Male', 'Female'].map(g => opt(g)) },
    { id: 'angle', label: 'Orientation', type: 'select', def: 'Straight', options: ['Straight', 'Right-angle', 'SMD'].map(p => opt(p)) },
  ],
  build(v) {
    const out = [];
    for (const n of v.pins || []) for (const g of v.gender || []) out.push({ parts: { name: `${v.rows}×${n} ${g}`, pitch: v.pitch, angle: v.angle.toLowerCase() }, icon: 'header' });
    return out;
  },
};

const AWG_MM2 = { 30: 0.05, 28: 0.08, 26: 0.13, 24: 0.2, 22: 0.33, 20: 0.52, 18: 0.82, 16: 1.31, 14: 2.08, 12: 3.31, 10: 5.26 };
const wire = {
  id: 'wire', group: 'Electronics', name: 'Wire & heat shrink', icon: 'spool',
  tokens: [['name', 'Gauge / diameter'], ['kind', 'Wire type / item'], ['ratio', 'Shrink ratio'], ['color', 'Colour'], ['area', 'Cross-section']],
  tpl: ['{name}', '{kind} · {ratio} · {color}', '{area}', '', ''],
  fields: [
    { id: 'kind', label: 'Item', type: 'select', def: 'wire', options: [opt('wire', 'Hook-up wire'), opt('shrink', 'Heat shrink tube')] },
    { id: 'awg', label: 'Gauge', type: 'chips', def: ['22', '24'], wide: true, options: E.AWG.map(a => opt(String(a), `${a} AWG`)), show: v => v.kind === 'wire' },
    { id: 'wtype', label: 'Type', type: 'select', def: 'Stranded', options: E.WIRE_TYPES.map(p => opt(p)), show: v => v.kind === 'wire' },
    { id: 'dias', label: 'Diameters (mm)', type: 'chips', def: ['2', '3', '5'], wide: true, options: E.HEATSHRINK.map(d => opt(String(d), `Ø${d}`)), show: v => v.kind === 'shrink' },
    { id: 'ratio', label: 'Shrink ratio', type: 'select', def: '2:1', options: ['2:1', '3:1', '4:1'].map(p => opt(p)), show: v => v.kind === 'shrink' },
    { id: 'colors', label: 'Colours (optional)', type: 'chips', def: [], wide: true, options: E.WIRE_COLORS.map(c => opt(c)) },
  ],
  build(v) {
    const colors = (v.colors && v.colors.length) ? v.colors : [''];
    const out = [];
    if (v.kind === 'shrink') {
      for (const d of v.dias || []) for (const c of colors) out.push({ parts: { name: `Ø${d} mm`, kind: 'Heat shrink', ratio: v.ratio, color: c, area: '' }, icon: 'heatshrink' });
    } else {
      for (const a of v.awg || []) for (const c of colors) out.push({ parts: { name: `${a} AWG`, kind: v.wtype, ratio: '', color: c, area: AWG_MM2[a] ? `≈ ${AWG_MM2[a]} mm²` : '' }, icon: 'spool' });
    }
    return out;
  },
};

const misc = {
  id: 'misc-elec', group: 'Electronics', name: 'Crystals & fuses', icon: 'crystal',
  tokens: [['name', 'Frequency / rating'], ['kind', 'Item / fuse type'], ['detail', 'Package / speed']],
  tpl: ['{name}', '{kind} · {detail}', '', '', ''],
  fields: [
    { id: 'kind', label: 'Item', type: 'select', def: 'crystal', options: [opt('crystal', 'Crystals'), opt('fuse', 'Fuses')] },
    { id: 'freqs', label: 'Frequencies', type: 'chips', def: ['16 MHz'], wide: true, options: E.CRYSTALS.map(c => opt(c)), show: v => v.kind === 'crystal' },
    { id: 'xpkg', label: 'Package', type: 'select', def: 'HC-49S', options: ['HC-49S', 'HC-49U', 'SMD 3225', 'SMD 5032', 'Cylinder 2×6'].map(p => opt(p)), show: v => v.kind === 'crystal' },
    { id: 'ftype', label: 'Fuse type', type: 'select', def: E.FUSE_TYPES[0], options: E.FUSE_TYPES.map(p => opt(p)), show: v => v.kind === 'fuse' },
    { id: 'ratings', label: 'Ratings (A)', type: 'chips', def: ['1', '2', '5'], wide: true, options: E.FUSE_RATINGS.map(r => opt(String(r), `${r} A`)), show: v => v.kind === 'fuse' },
    { id: 'speed', label: 'Speed', type: 'select', def: 'Fast', options: ['Fast', 'Slow (T)', 'Medium'].map(p => opt(p)), show: v => v.kind === 'fuse' },
  ],
  build(v) {
    if (v.kind === 'fuse') return (v.ratings || []).map(r => ({ parts: { name: `${r} A`, kind: v.ftype, detail: v.speed }, icon: 'fuse' }));
    return (v.freqs || []).map(f => ({ parts: { name: f, kind: 'Crystal', detail: v.xpkg }, icon: 'crystal' }));
  },
};

// ----------------------------------------------------------------- general
const textList = {
  id: 'text-list', group: 'General', name: 'Text list', icon: 'tag',
  tokens: [['l1', 'Part 1'], ['l2', 'Part 2'], ['l3', 'Part 3'], ['l4', 'Part 4'], ['l5', 'Part 5']],
  tpl: ['{l1}', '{l2}', '{l3}', '{l4}', '{l5}'],
  fields: [
    { id: 'text', label: 'One label per line. Use | to split it into parts (one per label line).', type: 'textarea', def: 'Spare fuses | car\nZip ties | 100 mm\nGlue sticks', wide: true },
    { id: 'icon', label: 'Icon', type: 'icon', def: 'box' },
  ],
  build(v) {
    return String(v.text || '').split(/\n/).map(s => s.trim()).filter(Boolean).map(s => {
      const p = s.split('|').map(x => x.trim());
      return { parts: { l1: p[0] || '', l2: p[1] || '', l3: p[2] || '', l4: p[3] || '', l5: p[4] || '' }, icon: v.icon || '' };
    });
  },
};

const sequence = {
  id: 'sequence', group: 'General', name: 'Numbered series', icon: 'box',
  tokens: [['name', 'Prefix + number'], ['number', 'Number only'], ['sub', 'Second line text']],
  tpl: ['{name}', '{sub}', '', '', ''],
  fields: [
    { id: 'prefix', label: 'Prefix', type: 'text', def: 'Drawer A' },
    { id: 'start', label: 'Start', type: 'text', def: '1' },
    { id: 'end', label: 'End', type: 'text', def: '12' },
    { id: 'pad', label: 'Digits', type: 'select', def: '2', options: ['1', '2', '3', '4'].map(p => opt(p)) },
    { id: 'sub', label: 'Second line', type: 'text', def: '', placeholder: 'Optional' },
    { id: 'icon', label: 'Icon', type: 'icon', def: '' },
  ],
  build(v) {
    const a = parseInt(v.start, 10) || 0, b = parseInt(v.end, 10) || 0;
    const out = [];
    const step = a <= b ? 1 : -1;
    for (let i = a; step > 0 ? i <= b : i >= b; i += step) {
      if (out.length >= 500) break;
      const num = String(i).padStart(+v.pad || 1, '0');
      out.push({ parts: { name: `${v.prefix || ''}${num}`, number: num, sub: v.sub || '' }, icon: v.icon || '' });
    }
    return out;
  },
};

// ------------------------------------------------------------ line templates
// Fills one line template. Pieces that come out empty are dropped together with their
// " · " separator, and leftover separators at the ends are trimmed.
export function fillLine(tpl, parts) {
  const s = String(tpl || '').replace(/\{(\w+)\}/g, (_, k) => (parts[k] ?? '').toString().trim());
  return s.split(/\s*·\s*/).map(x => x.trim()).filter(Boolean).join(' · ')
    .replace(/^[\s,|/–-]+|[\s,|/–-]+$/g, '').replace(/\s{2,}/g, ' ');
}
const linesTemplateField = { id: 'tpl', label: 'Label lines', type: 'lines', wide: true };

// Each category's build() returns parts; the exported build() also composes the lines from
// the user's templates (v.tpl) or the category defaults.
const RAW = [
  screws, nuts, washers, inserts, standoffs, pins,
  resistors, capacitors, inductors,
  partsCategory('diodes', 'Diodes', 'diode', 'diodes', d => /zener/i.test(d) ? 'zener' : 'diode'),
  partsCategory('transistors', 'Transistors', 'transistor', 'transistors', d => /TO-220/.test(d) ? 'to220' : /SOT/.test(d) ? 'qfp' : 'transistor'),
  partsCategory('ics', 'ICs & modules', 'dip', 'ics', d => /DIP/.test(d) ? 'dip' : /module/i.test(d) ? 'module' : 'qfp'),
  partsCategory('regulators', 'Regulators & power', 'to220', 'regulators', d => /module/i.test(d) ? 'module' : /TO-220/.test(d) ? 'to220' : /TO-92/.test(d) ? 'transistor' : 'qfp'),
  leds, connectors, headers, wire, misc,
  partsCategory('switches', 'Switches', 'button-sw', 'switches', d => /toggle|slide|rocker/i.test(d) ? 'switch' : 'button-sw'),
  partsCategory('batteries', 'Batteries', 'battery', 'batteries', d => /coin|button/i.test(d) ? 'coincell' : 'battery'),
  textList, sequence,
];
export const CATEGORIES = RAW.map(cat => ({
  ...cat,
  fields: [...cat.fields, { ...linesTemplateField, def: [...cat.tpl] }],
  build(v) {
    const tpl = Array.isArray(v.tpl) && v.tpl.length ? v.tpl : cat.tpl;
    return cat.build(v).map(it => ({
      ...it,
      lines: Array.from({ length: LINE_COUNT }, (_, i) => fillLine(tpl[i] ?? '', it.parts)),
    }));
  },
}));

export const COMMON_FIELDS = [
  { id: 'codeType', label: 'Add a code', type: 'select', def: 'none', options: [opt('none', 'No code'), opt('qr', 'QR code'), opt('code128', 'Code 128')] },
  { id: 'codeFrom', label: 'Code content', type: 'select', def: 'text', options: [opt('text', 'Label text'), opt('sku', 'Running part number')], show: v => v.codeType !== 'none' },
  { id: 'skuPrefix', label: 'Part number prefix', type: 'text', def: 'P-', show: v => v.codeType !== 'none' && v.codeFrom === 'sku' },
  { id: 'skuStart', label: 'First number', type: 'text', def: '1', show: v => v.codeType !== 'none' && v.codeFrom === 'sku' },
];

export function defaultsFor(cat) {
  const v = {};
  for (const f of [...cat.fields, ...COMMON_FIELDS]) v[f.id] = Array.isArray(f.def) ? [...f.def] : f.def;
  return v;
}
