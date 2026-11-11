/** «Recorrer todos los centros»: cajas, diagrama de niveles, Energía, selector y texto siguen al centro que se anima. */
import { expect, test } from '@playwright/test';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { analizar } from '../src/chem/analisis';
import { hibridoTexto } from '../src/chem/formato';

const URL_APP = pathToFileURL(resolve('dist/index.html')).href;
const ESPECIES = ['C3H4', 'CH3COOH', 'C2H5OH', 'CH4N2O', 'HNO3', 'CH3CN', 'C3H6', 'C4H6', 'H2O2', 'N2H4'];

for (const mol of ESPECIES) {
  for (const estilo of (mol === 'C3H4' || mol === 'CH3COOH' ? ['libro', 'webgl'] : ['libro']) as ('libro' | 'webgl')[]) {
    test(`centros de ${mol} (${estilo}): paneles coherentes en ambos sentidos y al saltar`, async ({ page }) => {
      test.setTimeout(estilo === 'webgl' ? 400000 : 90000);
      const r = analizar(mol);
      if (r.tipo !== 'ok') throw new Error('ambiguo');
      const a = r.analisis;
      const errores: string[] = [];
      page.on('pageerror', (e) => errores.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${URL_APP}#mol=${encodeURIComponent(mol)}`);
      await page.reload();
      await page.waitForSelector('#p-datos table');
      if (estilo === 'webgl') { await page.click('#b-vista'); await page.click('#estilo button[data-v="webgl"]'); await page.mouse.click(2, 880); }
      await page.click('#b-anim');
      await page.click('#lt >> text=Paso a paso').catch(() => {});
      await page.check('#secu');
      await page.waitForSelector('#chips .chip');
      const n = await page.locator('#chips .chip').count();
      const comprobar = async (i: number) => {
        const txt = (await page.locator('#chips .chip').nth(i).innerText()).trim();
        const m = txt.match(/^(\d+)\. .*· ([A-Za-z]+)(\d+)$/);
        expect(m, txt).not.toBeNull();
        const etapa = +m![1];
        const c = +m![3] - 1;
        const t = a.tev.atomos[c];
        const ctx = `${mol} chip ${txt}`;
        await expect(page.locator('#p-pasos h4').first(), ctx).toHaveText(`Cajas de orbitales de ${t.etiqueta}`);
        await expect(page.locator('#centro'), ctx).toHaveValue(String(c));
        if (t.hibridacion && etapa >= 6) {
          const h = hibridoTexto(t.hibridacion.tipo);
          await expect(page.locator('#p-pasos .svgbox').first(), ctx).toContainText(h);
          await expect(page.locator('#clase-box'), ctx).toContainText(t.rpecv.geometriaMolecular);
          await expect(page.locator('#clase-box'), ctx).toContainText(h);
        }
        if (etapa >= 6) await expect(page.locator('#clase-box'), ctx).toContainText(t.rpecv.geometriaElectronica);
        if (etapa === 5 && t.hibridacion) await expect(page.locator('#p-pasos .texto-paso').first(), ctx).toContainText(t.rpecv.notacion.replace(/[₀-₉]/g, (d) => d));
      };
      for (let i = 0; i < n; i++) { await page.locator('#chips .chip').nth(i).click(); await page.waitForTimeout(120); await comprobar(i); }
      for (let i = n - 1; i >= 0; i--) { await page.locator('#chips .chip').nth(i).click(); await page.waitForTimeout(120); await comprobar(i); }
      // salto con la barra de progreso
      for (const f of [0.95, 0.5, 0.12, 0.7]) {
        await page.locator('#l-rango').evaluate((el, v) => { (el as HTMLInputElement).value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); }, Math.round(f * 1000));
        await page.waitForTimeout(150);
        const etq = await page.locator('#l-etq').innerText();
        expect(etq).toContain('Etapa');
        const centroSel = +(await page.locator('#centro').inputValue());
        await expect(page.locator('#p-pasos h4').first()).toHaveText(`Cajas de orbitales de ${a.tev.atomos[centroSel].etiqueta}`);
      }
      // siguiente / anterior
      for (let k = 0; k < 6; k++) await page.click('#l-sig');
      for (let k = 0; k < 12; k++) await page.click('#l-ant');
      expect(errores).toEqual([]);
    });
  }
}
