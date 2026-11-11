import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(pathToFileURL('dist/index.html').href + '#mol=C2H4'); await p.waitForTimeout(1500);
console.log(await p.evaluate(() => [...document.querySelectorAll('#visor canvas, #visor .capa-etiquetas')].map((e) => e.className + ':' + e.style.display)));
await b.close();
