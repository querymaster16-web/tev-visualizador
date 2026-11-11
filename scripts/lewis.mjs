import { chromium } from 'playwright';
import { pathToFileURL } from 'url';
const base = pathToFileURL('dist/index.html').href;
const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
const p = await ctx.newPage();
const lista = process.argv.slice(2);
let html = '<body style="margin:0;background:#fff;display:flex;flex-wrap:wrap;gap:6px;padding:6px;width:1300px">';
for (const m of lista) {
  await p.goto(base + '#mol=' + encodeURIComponent(m)); await p.reload(); await p.waitForTimeout(700);
  await p.click('[data-t=lewis]'); await p.waitForTimeout(250);
  html += `<div style="border:1px solid #ccc;font:12px sans-serif">${m}${await p.locator('#p-lewis .res-fila .forma-res').first().innerHTML()}</div>`;
}
const q = await ctx.newPage(); await q.setContent(html + '</body>'); await q.screenshot({ path: 'capturas/ui/lewis.png', fullPage: true });
await b.close();
