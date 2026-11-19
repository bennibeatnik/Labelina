// Checks that Labelina's P-touch jobs are byte-for-byte what Brother's own Windows driver sends.
//
// The .prn files in tests/brother-driver/ were made by printing through the "Brother PT-D610BT"
// driver to a file (no tape used). This test takes the label image out of each capture, builds
// a job for it with Labelina's buildRasterJob, and compares every byte after the driver's own
// header. Run: node tests/brother-match.mjs
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildRasterJob } from '../js/ptouch.js';
import { MEDIA_MAP } from '../js/media.js';

const here = dirname(fileURLToPath(import.meta.url));
const CASES = [['tze12-sd.prn', 'tze-12', false], ['tze12-hd.prn', 'tze-12', true], ['tze24-sd.prn', 'tze-24', false]];
let failed = 0;
for (const [file, mediaId, hd] of CASES) {
  const b = readFileSync(join(here, 'brother-driver', file));
  // Brother's job starts at its first ESC i a; the bytes before are a header for Brother's port software.
  const start = b.indexOf(Buffer.from([0x1b, 0x69, 0x61]));
  const brother = b.subarray(start);
  const u = brother.indexOf(Buffer.from([0x1b, 0x69, 0x55]));
  const jobId = brother[u + 3 + 11];
  const lines = [];
  let i = brother.indexOf(Buffer.from([0x4d, 0x00])) + 2;
  while (brother[i] === 0x47) { lines.push(brother.subarray(i + 3, i + 19)); i += 19; }
  const media = { ...MEDIA_MAP[mediaId], hd };
  const W = lines.length, H = media.pins, bits = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    const p = media.pinOffset + y;
    if ((lines[x][p >> 3] >> (7 - (p & 7))) & 1) bits[y * W + x] = 1;
  }
  const ours = Buffer.from(buildRasterJob([{ bits, W, H }], { media, marginMm: 2, autoCut: true, chain: false, jobId })).subarray(100);
  let d = -1;
  for (let k = 0; k < Math.max(ours.length, brother.length); k++) if (ours[k] !== brother[k]) { d = k; break; }
  if (d < 0) console.log(`ok   ${file}: ${ours.length} bytes identical to Brother's driver`);
  else { failed++; console.log(`FAIL ${file}: differs at byte ${d}: Brother ${brother.subarray(d, d + 8).toString('hex')} vs Labelina ${ours.subarray(d, d + 8).toString('hex')}`); }
}
process.exit(failed ? 1 : 0);
