/** Revisión de interfaz: buscador, URL compartible, exportaciones, ficha A4, quiz, comparador y anchos de pantalla, sin errores de consola. */
import { expect, test } from '@playwright/test';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const URL_APP = pathToFileURL(resolve('dist/index.html')).href;

test('buscador: nombres, fórmulas, cargas, SMILES, isómeros y entradas inválidas', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await page.goto(URL_APP);
  const buscar = async (q: string) => { await page.fill('#q', q); await page.press('#q', 'Enter'); await page.waitForTimeout(250); };
  for (const [q, nombre] of [['agua', 'Agua'], ['SF4', 'Tetrafluoruro de azufre'], ['SO4^2-', 'sulfato'], ['ion nitrato', 'nitrato'], ['CCO', 'Etanol|SMILES'], ['acetileno', 'Etino'], ['C6H6', 'Benceno'], ['NH4+', 'amonio']] as const) {
    await buscar(q);
    await expect(page.locator('#p-datos h3'), q).toContainText(new RegExp(nombre, 'i'));
  }
  await buscar('C2H6O');
  await expect(page.locator('#aviso')).toContainText(/Etanol|Éter/i);
  for (const malo of ['xyz!!', 'Fe2O3', '((', 'H', '']) {
    await buscar(malo);
    // no debe romper: la aplicación sigue viva
    await expect(page.locator('#q')).toBeVisible();
  }
  expect(errores).toEqual([]);
});

test('URL compartible: molécula y etapa se restauran', async ({ page }) => {
  await page.goto(`${URL_APP}#mol=${encodeURIComponent('SO4^2-')}&paso=6`);
  await page.reload();
  await page.waitForSelector('#chips .chip');
  await expect(page.locator('#l-etq')).toContainText('Etapa 6');
  await expect(page.locator('#p-pasos h3')).toContainText('Etapa 6');
});

for (const [w, h] of [[1440, 900], [1366, 768], [1280, 800], [390, 844]] as [number, number][]) {
  for (const tema of ['light', 'dark'] as const) {
    test(`sin scroll horizontal ni errores: resultado, Lewis, Energía, Enlaces y animación (${w} px, ${tema})`, async ({ page }) => {
      const errores: string[] = [];
      page.on('pageerror', (e) => errores.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
      await page.emulateMedia({ colorScheme: tema });
      await page.setViewportSize({ width: w, height: h });
      await page.goto(`${URL_APP}#mol=C2H4`);
      await page.reload();
      await page.waitForSelector('#p-datos table');
      for (const t of ['Lewis', 'Energía', 'Enlaces', 'Resultado']) {
        await page.click(`#tabs >> text=${t}`);
        await page.waitForTimeout(150);
        const sx = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        expect(sx, `${t} scroll horizontal`).toBeLessThanOrEqual(1);
      }
      await page.click('#b-anim');
      await page.locator('#chips .chip').nth(6).click();
      await page.waitForTimeout(300);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      expect(errores).toEqual([]);
    });
  }
}

test('exportaciones (PNG del visor, SVG/PNG de Lewis) y ficha A4 no fallan', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await page.goto(`${URL_APP}#mol=H2O2`);
  await page.reload();
  await page.waitForSelector('#p-datos table');
  const d1 = page.waitForEvent('download');
  await page.click('#b-png');
  expect((await d1).suggestedFilename()).toMatch(/\.png$/);
  await page.click('#tabs >> text=Lewis');
  const d2 = page.waitForEvent('download');
  await page.click('#x-lsvg');
  expect((await d2).suggestedFilename()).toMatch(/\.svg$/);
  const d3 = page.waitForEvent('download');
  await page.click('#x-lpng');
  expect((await d3).suggestedFilename()).toMatch(/\.png$/);
  await page.click('#b-menu');
  await page.locator('#pop-menu >> text=Ficha A4').click();
  await expect(page.locator('#ficha')).toContainText('Peróxido de hidrógeno');
  await expect(page.locator('#ficha')).toContainText('μ = 2,26 D (experimental)');
  expect(errores).toEqual([]);
});

test('quiz y comparador sin errores', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await page.goto(URL_APP);
  await page.click('#b-menu');
  await page.click('text=Modo práctica');
  await expect(page.locator('.quiz')).toBeVisible();
  await page.keyboard.press('Escape');
  await page.click('#b-menu');
  await page.click('text=Comparar dos moléculas');
  await expect(page.locator('.comp')).toBeVisible();
  expect(errores).toEqual([]);
});
