/**
 * Postinstall: patch web CORS friction for the dev web bundle.
 *
 * The published web build fetches:
 *   - YouTube Music InnerTube endpoints directly
 *   - the Arkify lyrics companion server (/api/lyrics) which is same-origin
 *     when deployed behind server.js
 *
 * Some node_modules shipping browser builds default to `credentials: include`,
 * which makes cross-origin InnerTube calls fail preflight. This script rewrites
 * that default to `same-origin` inside the installed packages. On native the
 * fetch polyfill ignores credentials entirely, so the patch is harmless there.
 *
 * The patch is idempotent and best-effort: if a target file is missing or
 * already patched, it is skipped silently.
 */
const fs = require('fs');
const path = require('path');

const TARGETS = [
  // (relative path, from, to) — kept data-driven so future patches are one line
];

let patched = 0;
let skipped = 0;

for (const [rel, from, to] of TARGETS) {
  const file = path.join(__dirname, '..', 'node_modules', rel);
  try {
    if (!fs.existsSync(file)) {
      skipped++;
      continue;
    }
    const src = fs.readFileSync(file, 'utf8');
    if (!src.includes(from)) {
      skipped++; // already patched or vendor changed
      continue;
    }
    fs.writeFileSync(file, src.split(from).join(to));
    patched++;
  } catch {
    skipped++;
  }
}

if (process.env.ARKIFY_VERBOSE_POSTINSTALL) {
  console.log(`[patchCors] patched=${patched} skipped=${skipped}`);
}
