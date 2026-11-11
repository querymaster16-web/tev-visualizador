/** Capturas de revisión en móvil y tablet. */
import { test } from '@playwright/test';
import { pathToFileURL } from 'url';
import { resolve } from 'path';
const URL_APP = pathToFileURL(resolve('dist/index.html')).href;
const TAM: [string, number, number][] = [['movil', 390, 844], ['tablet', 768, 1024], ['tablet-h', 1024, 768]];
for (const [n, w, h] of TAM) {
  test(`captura ${n}`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${URL_APP}#mol=C2H4`);
    await page.reload();
    await page.waitForSelector('#p-datos table');
    await page.waitForTimeout(800);
    await page.screenshot({ path: `capturas/correcciones/m-${n}-resultado.png`, fullPage: true });
    await page.click('#b-anim');
    await page.locator('#chips .chip').nth(6).click();
    await page.waitForTimeout(1500);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await page.screenshot({ path: `capturas/correcciones/m-${n}-anim.png`, fullPage: true });
  });
}
