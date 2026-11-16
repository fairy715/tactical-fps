// Takes the screenshots: serves game/, opens each scene of shots.json (?shot=...) in headless
// Chromium at 1280 x 720 and saves it as a JPEG under screenshots/. A page error fails the run.
//   node tools/shoot.mjs [out dir, default screenshots]
import { createServer } from 'node:http';
import { createReadStream, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('..', import.meta.url));
const game = join(root, 'game');
const outDir = resolve(root, process.argv[2] || 'screenshots');
const shots = JSON.parse(readFileSync(join(root, 'shots.json'), 'utf8'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };

const server = createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = join(game, p);
  try {
    statSync(file);
  } catch {
    res.writeHead(404).end();
    return;
  }
  res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream' });
  createReadStream(file).pipe(res);
}).listen(0);
const port = server.address().port;

mkdirSync(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
for (const shot of shots) {
  await page.goto(`http://localhost:${port}/${shot.query}`);
  await page.waitForFunction(() => window.LK_SHOT_READY === true, null, { timeout: 120000 });
  const file = join(outDir, shot.name);
  await page.screenshot({ path: file, type: 'jpeg', quality: shot.quality || 82 });
  console.log(`${shot.name}  ${statSync(file).size} bytes`);
}
await browser.close();
server.close();
if (errors.length) {
  console.error('page errors:\n' + errors.join('\n'));
  process.exit(1);
}
