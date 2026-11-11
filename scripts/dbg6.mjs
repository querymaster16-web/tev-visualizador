import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const p = await b.newPage({ viewport: { width: 1280, height: 1300 } });
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
const [mol, ...lista] = process.argv.slice(2);
const base = pathToFileURL('dist/index.html').href + '#mol=' + encodeURIComponent(mol);
for (const it of lista) {
  const [etapa, frac] = it.split(':');
  await p.goto(base + '&paso=' + etapa); await p.reload(); await p.waitForTimeout(1500);
  if (frac) { await p.evaluate((f) => { const el = document.querySelector('#l-rango'); const chips = document.querySelectorAll('#chips .chip'); el.value = f; el.dispatchEvent(new Event('input', { bubbles: true })); }, String(frac)); await p.waitForTimeout(1500); }
  await p.screenshot({ path: `capturas/j-${mol}-${etapa}${frac ? '-' + frac : ''}.png`, clip: { x: 20, y: 700, width: 760, height: 560 } });
}
await b.close();
