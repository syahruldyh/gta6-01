// AURELIA DELTA — entry program (Node 22, standard library only).
// Hands in the game: copies game/ and screenshots/ from beside this file to
// /output and writes /output/dossier.json with the vendored make.fun library.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Validate the inputs before copying: a missing game/ used to fail with a
// cryptic cpSync error, and a missing screenshots/ silently skipped the
// entry's cover. Fail now with a clear message naming the missing folder.
const gameDir = join(here, 'game');
const shotsDir = join(here, 'screenshots');
for (const [dir, label] of [[gameDir, 'game/'], [shotsDir, 'screenshots/']]) {
  if (!existsSync(dir)) throw new Error(`AURELIA DELTA: ${label} not found beside main.ts (looked in ${dir})`);
}

mkdirSync(out, { recursive: true });
cpSync(gameDir, join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

// The scorer's own caps: only text_max_bytes shapes the bytes; the others
// refuse an entry the scorer would refuse (more than 4 screenshots or one
// over 256 KiB; more than 993 files in game/ or 48 MiB of game files, or a
// path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
