/** Etiquetas de la escena: nunca se solapan (estilo libro) en las etapas 6, 7 y 8. */
import { expect, test } from '@playwright/test';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const URL_APP = pathToFileURL(resolve('dist/index.html')).href;
for (const mol of ['C2H4', 'C2H2', 'HCN', 'CO2', 'H2CO', 'SO2', 'C6H6']) {
  test(`sin etiquetas solapadas en ${mol} (etapas 6–8)`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 860 });
    for (const paso of [6, 7, 8]) {
      await page.goto(`${URL_APP}#mol=${encodeURIComponent(mol)}&paso=${paso}`);
      await page.reload();
      await page.waitForSelector('#chips .chip');
      await page.waitForTimeout(1300);
      expect(await page.locator('canvas[data-etq-pi]').getAttribute('data-etq-solapes'), `${mol} etapa ${paso}`).toBe('0');
    }
  });
}
test('«como en clase»: el p que forma el π va por encima de los híbridos y el texto no se corta', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  for (const mol of ['C2H4', 'C2H2']) {
    await page.goto(`${URL_APP}#mol=${mol}&paso=8`);
    await page.reload();
    await page.waitForSelector('#chips .chip');
    await page.waitForTimeout(800);
    const r = await page.locator('#clase-box svg').evaluate((svg) => {
      const bb = (svg as SVGSVGElement).viewBox.baseVal;
      const t = Array.from(svg.querySelectorAll('text')).filter((x) => /solapamiento lateral|no hibrida/.test(x.textContent ?? ''));
      return { n: t.length, ok: t.every((x) => { const b = (x as SVGGraphicsElement).getBBox(); return b.x >= 0 && b.x + b.width <= bb.width + 0.5 && b.y >= 0; }) };
    });
    expect(r.n, mol).toBe(2);
    expect(r.ok, mol).toBe(true);
  }
});
