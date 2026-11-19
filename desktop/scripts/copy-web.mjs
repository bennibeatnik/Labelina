// Copies the web studio (repo root) into desktop/dist for Tauri to bundle.
// Only the files the page needs are copied; tests, docs and the desktop folder stay out.
import { cpSync, rmSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..', '..');
const dist = join(here, '..', 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
for (const item of ['index.html', 'css', 'js', 'vendor']) {
  cpSync(join(root, item), join(dist, item), { recursive: true });
}
console.log(`Copied the studio into ${dist}`);
