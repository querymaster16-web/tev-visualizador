import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
const [mol, ...pasos] = process.argv.slice(2);
for (const n of pasos) { await p.goto(pathToFileURL('dist/index.html').href + '#mol=' + mol + '&paso=' + n); await p.reload(); await p.waitForTimeout(2200); await p.screenshot({ path: `capturas/h-${mol}-${n}.png`, clip: { x: 20, y: 100, width: 740, height: 600 } }); }
await b.close();
