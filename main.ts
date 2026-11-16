// Hands in Office Hours (Node 22, standard library only). The game is game/: static ES modules
// the browser loads with three.js 0.187.0 from one import map. This program copies game/ and
// screenshots/ to the output directory and writes dossier.json, the summary the judge reads, with
// the vendored make.fun library, so the same commit always produces the same bytes.
//
// Play it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader, MAKEFUN_OUTPUT_DIR replaces /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const output = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(output, { recursive: true });
cpSync(join(root, 'game'), join(output, 'game'), { recursive: true });
mkdirSync(join(output, 'screenshots'), { recursive: true });
if (existsSync(join(root, 'screenshots'))) {
  cpSync(join(root, 'screenshots'), join(output, 'screenshots'), { recursive: true });
}

// The scorer's limits: 160 KiB of source text for the judge, at most four screenshots of 256 KiB
// each, and at most 993 files or 48 MiB under game/.
const limits = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
};
writeFileSync(join(output, 'dossier.json'), buildDossier(output, limits));
