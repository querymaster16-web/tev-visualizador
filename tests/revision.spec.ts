/** Revisión amplia: 32 especies variadas recorren las 8 etapas (hacia delante y atrás, con y sin «todos los centros») sin errores de consola ni etiquetas solapadas. */
import { expect, test } from '@playwright/test';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { analizar } from '../src/chem/analisis';

const URL_APP = pathToFileURL(resolve('dist/index.html')).href;
const ESPECIES = ['H2O', 'NH3', 'CH4', 'BF3', 'BeCl2', 'SO2', 'SO3', 'SF4', 'SF6', 'ClF3', 'XeF4', 'XeF2', 'IF7', 'PCl5', 'NH4^+', 'SO4^2-', 'NO3^-', 'CO3^2-', 'H2SO4', 'H3PO4', 'HNO3', 'C2H4', 'C2H2', 'C6H6', 'CH3COOH', 'CH3NH2', 'NO', 'NO2', 'O2', 'N2', 'CO', 'H2'];

for (const mol of ESPECIES) {
  test(`revisión de ${mol}`, async ({ page }) => {
    const r = analizar(mol);
    if (r.tipo !== 'ok') throw new Error('ambiguo');
    const a = r.analisis;
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
    await page.setViewportSize({ width: 1366, height: 800 });
    await page.goto(`${URL_APP}#mol=${encodeURIComponent(mol)}`);
    await page.reload();
    await page.waitForSelector('#p-datos table');
    await page.click('#b-anim');
    for (const secuencia of [false, true]) {
      if (secuencia) await page.check('#secu');
      await page.waitForSelector('#chips .chip');
      const n = await page.locator('#chips .chip').count();
      const orden = [...Array(n).keys()];
      for (const i of [...orden, ...orden.slice().reverse()]) {
        await page.locator('#chips .chip').nth(i).click();
        await page.waitForTimeout(90);
        const solapes = await page.locator('canvas[data-etq-pi]').getAttribute('data-etq-solapes');
        expect(solapes, `${mol} chip ${i}`).toBe('0');
        const c = +(await page.locator('#centro').inputValue());
        await expect(page.locator('#p-pasos h4').first()).toHaveText(`Cajas de orbitales de ${a.tev.atomos[c].etiqueta}`);
      }
    }
    expect(errores).toEqual([]);
  });
}
