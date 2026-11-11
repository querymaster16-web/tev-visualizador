/** Capturas de revisión: propino con «Recorrer todos los centros» (segundo centro) en claro/oscuro y en las dos vistas. */
import { test } from '@playwright/test';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
import { analizar } from '../src/chem/analisis';

const URL_APP = pathToFileURL(resolve('dist/index.html')).href;
for (const tema of ['claro', 'oscuro'] as const) for (const estilo of ['libro']) for (const etapa of [5, 6, 7]) {
  test(`propino 2.º centro etapa ${etapa} ${estilo} ${tema}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
    await page.addInitScript((t) => { try { localStorage.setItem('tev-tema', t); } catch { /* */ } }, tema);
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${URL_APP}#mol=C3H4`);
    await page.reload();
    await page.waitForSelector('#p-datos table');
    await page.click('#b-anim');
    await page.check('#secu');
    const r: any = analizar('C3H4');
    const c2 = r.analisis.centros[1] + 1;
    await page.locator('#chips .chip').filter({ hasText: new RegExp(`^${etapa}\\. .*· [A-Za-z]+${c2}$`) }).click();
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `capturas/correcciones/propino-c2-etapa${etapa}-${estilo}-${tema}.png` });
  });
}
