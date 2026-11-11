import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
const [mol, ...pasos] = process.argv.slice(2);
for (const n of pasos) { await p.goto(pathToFileURL('dist/index.html').href + '#mol=' + mol + '&paso=' + n); await p.reload(); await p.waitForTimeout(2000); await p.screenshot({ path: `capturas/k-${mol}-${n}.png` }); }
await b.close();
