// Baut die Browser-Version: src/ -> js/game.bundle.js (eine Datei, laeuft auch per Doppelklick) und index.html.
// Aufruf: npm run build   (bzw. node tools/bundle.mjs)
import { build } from 'esbuild';
import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

await build({
  entryPoints: [join(WEB, 'src/main.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  target: ['es2020'],
  outfile: join(WEB, 'js/game.bundle.js'),
  loader: { '.glb': 'binary', '.svg': 'text', '.json': 'json' },
  legalComments: 'eof',
  logLevel: 'warning'
});

const page = readFileSync(join(WEB, 'page.html'), 'utf8');
const headEnd = page.indexOf('</style>') + '</style>'.length;
const index = '<!doctype html>\n<html lang="de">\n<head>\n<meta charset="utf-8">\n'
  + '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
  + page.slice(0, headEnd) + '\n</head>\n<body>\n' + page.slice(headEnd).replace(/^\n+/, '') + '</body>\n</html>\n';
writeFileSync(join(WEB, 'index.html'), index);
const kb = (f) => Math.round(statSync(join(WEB, f)).size / 1024);
console.log(`js/game.bundle.js: ${kb('js/game.bundle.js')} KB, index.html erzeugt`);
