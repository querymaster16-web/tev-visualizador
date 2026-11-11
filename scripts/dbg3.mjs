import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const c = await b.newContext({ reducedMotion: 'reduce', viewport: { width: 1280, height: 860 } });
const p = await c.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(pathToFileURL('dist/index.html').href + '#mol=C2H4'); await p.waitForTimeout(1200);
await p.screenshot({ path: 'capturas/f-resultado.png' });
await p.click('#b-anim');
const v = [];
for (let i = 0; i < 4; i++) { await p.waitForTimeout(1500); v.push(await p.inputValue('#l-rango') + ' ' + await p.textContent('#l-etq')); }
console.log(v.join(' | '));
await p.goto(pathToFileURL('dist/index.html').href + '#mol=C2H4&paso=7'); await p.reload(); await p.waitForTimeout(1500);
await p.screenshot({ path: 'capturas/f-pi.png' });
await b.close();
