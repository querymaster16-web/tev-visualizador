import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 860 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
for (const m of ['H2SO4', 'C2H4']) { await p.goto(pathToFileURL('dist/index.html').href + '#mol=' + m); await p.reload(); await p.waitForTimeout(2500); await p.screenshot({ path: `capturas/g-${m}.png`, clip: { x: 20, y: 100, width: 740, height: 600 } }); }
await b.close();
