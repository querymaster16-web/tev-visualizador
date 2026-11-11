import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
const [,, mol, etapas = '8', tema = 'light', ancho = '1280', alto = '860'] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +ancho, height: +alto } });
p.on('console', (m) => ['error', 'warning'].includes(m.type()) && console.log('CONSOLA', m.type(), m.text().slice(0, 200)));
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.emulateMedia({ colorScheme: tema });
await p.goto(pathToFileURL('dist/index.html').href + '#mol=' + encodeURIComponent(mol));
await p.waitForTimeout(1200);
for (const e of etapas.split(',')) {
  await p.goto(pathToFileURL('dist/index.html').href + '#mol=' + encodeURIComponent(mol) + '&paso=' + e); await p.reload(); await p.waitForTimeout(1500);
  await p.screenshot({ path: `capturas/${mol.replace(/[^\w]/g, '_')}-${e}-${tema}-${ancho}.png` });
}
await b.close();
