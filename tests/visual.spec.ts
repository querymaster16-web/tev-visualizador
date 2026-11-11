/** Prueba visual: abre dist/index.html (ejecuta `npm run build` antes) y hace capturas en capturas/. */
import { expect, test } from '@playwright/test';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const URL_APP = pathToFileURL(resolve('dist/index.html')).href;
const CASOS: [string, number[]][] = [
  ['CH4', [1, 3, 4, 6, 8]], ['NH3', [5, 6, 8]], ['SF4', [4, 5, 8]], ['XeF4', [3, 5, 8]], ['C2H4', [6, 7, 8]], ['C6H6', [7, 8]],
];

for (const [mol, pasos] of CASOS) {
  test(`captura ${mol}`, async ({ page }) => {
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await page.setViewportSize({ width: 1280, height: 860 });
    for (const p of pasos) {
      await page.goto(`${URL_APP}#mol=${encodeURIComponent(mol)}&paso=${p}`);
      await page.reload();
      await page.waitForSelector('#chips .chip');
      await page.waitForTimeout(900);
      await page.screenshot({ path: `capturas/${mol}-paso${p}.png` });
    }
    expect(errores).toEqual([]);
  });
}

test('móvil y tema oscuro', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${URL_APP}#mol=SF4&paso=5`);
  await page.waitForSelector('#chips .chip');
  await page.screenshot({ path: 'capturas/movil-oscuro.png', fullPage: true });
});

test('buscador, errores didácticos y reproductor', async ({ page }) => {
  await page.goto(URL_APP);
  await page.fill('#q', 'Fe2O3');
  await page.press('#q', 'Enter');
  await expect(page.locator('#aviso')).toContainText('metal de transición');
  await page.fill('#q', 'C2H6O');
  await page.press('#q', 'Enter');
  await expect(page.locator('#aviso')).toContainText('Etanol');
  await page.fill('#q', 'ion sulfato');
  await page.press('#q', 'Enter');
  await expect(page.locator('#p-datos h3')).toBeVisible();
  await page.fill('#q', 'agua');
  await page.press('#q', 'Enter');
  await page.click('#b-anim');
  await page.waitForTimeout(800);
  await expect(page.locator('#l-etq')).toContainText('Etapa');
  await page.keyboard.press('ArrowRight');
  await page.click('#l-salir');
  await expect(page.locator('#b-anim')).toBeVisible();
});

test('práctica y comparador se abren', async ({ page }) => {
  await page.goto(URL_APP);
  await page.click('#b-menu');
  await page.click('text=Modo práctica');
  await expect(page.locator('.quiz')).toBeVisible();
  await page.screenshot({ path: 'capturas/quiz.png' });
  await page.keyboard.press('Escape');
  await page.click('#b-menu');
  await page.click('text=Comparar dos moléculas');
  await expect(page.locator('.comp')).toBeVisible();
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'capturas/comparador.png' });
});
