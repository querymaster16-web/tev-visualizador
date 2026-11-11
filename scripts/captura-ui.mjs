import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
import { mkdirSync } from 'fs';
const tag = process.argv[2] || 'antes';
const solo = process.argv[3]; // caso opcional
const dir = `capturas/ui/${tag}`;
mkdirSync(dir, { recursive: true });
const base = pathToFileURL('dist/index.html').href;
const ANCHOS = [[1440, 900], [1366, 768], [390, 844]];
const CASOS = {
  biblioteca: async (p) => { await p.goto(base); await p.waitForSelector('#b-bib'); await p.click('#b-bib'); await p.waitForTimeout(500); },
  sf4: async (p) => { await p.goto(base + '#mol=SF4'); await p.reload(); await p.waitForTimeout(1500); },
  sf4energia: async (p) => { await p.goto(base + '#mol=SF4'); await p.reload(); await p.waitForTimeout(1200); await p.click('[data-t=energia]'); await p.waitForTimeout(500); },
  ch4_8: async (p) => { await p.goto(base + '#mol=CH4&paso=8'); await p.reload(); await p.waitForTimeout(2200); },
  oh_8: async (p) => { await p.goto(base + '#mol=OH&paso=8'); await p.reload(); await p.waitForTimeout(2200); },
  oh: async (p) => { await p.goto(base + '#mol=OH'); await p.reload(); await p.waitForTimeout(1500); },
  eteno3d: async (p) => { await p.goto(base + '#mol=C2H4'); await p.reload(); await p.waitForTimeout(1200); await p.click('#b-vista'); await p.click('#estilo button[data-v=webgl]'); await p.mouse.click(5, 300); await p.waitForTimeout(1500); },
  nh3anim: async (p) => { await p.goto(base + '#mol=NH3&paso=4'); await p.reload(); await p.waitForTimeout(2200); },
  menu: async (p) => { await p.goto(base); await p.waitForSelector('#b-menu'); await p.click('#b-menu'); await p.waitForTimeout(400); },
  vista: async (p) => { await p.goto(base); await p.waitForSelector('#b-vista'); await p.click('#b-vista'); await p.waitForTimeout(400); },
};
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [nombre, fn] of Object.entries(CASOS)) {
  if (solo && solo !== nombre) continue;
  for (const [w, h] of ANCHOS) for (const tema of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, colorScheme: tema });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('PAGEERROR', nombre, w, e.message));
    try { await fn(p); await p.screenshot({ path: `${dir}/${nombre}-${w}-${tema}.png` }); const sx = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth); if (sx > 1) console.log('SCROLL-X', nombre, w, tema, sx); } catch (e) { console.log('FALLO', nombre, w, tema, e.message.split('\n')[0]); }
    await ctx.close();
  }
}
await b.close();
