/** Capturas de revisión de las correcciones finales (claro y oscuro). Ejecuta `npm run build` antes. */
import { test } from '@playwright/test';
import { pathToFileURL } from 'url';
import { resolve } from 'path';

const URL_APP = pathToFileURL(resolve('dist/index.html')).href;
const CASOS: [string, string, number | null][] = [
  ['C2H2', 'etapa7', 7], ['C2H4', 'etapa7', 7], ['CO2', 'etapa7', 7],
  ['H2O2', 'ficha', null], ['N2H4', 'ficha', null], ['H3BO3', 'ficha', null],
  ['SF4', 'lewis', null], ['CH4', 'etapa8', 8],
];

for (const tema of ['claro', 'oscuro'] as const) {
  for (const [mol, nombre, paso] of CASOS) {
    test(`captura ${mol} ${nombre} ${tema}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema === 'oscuro' ? 'dark' : 'light' });
      await page.addInitScript((t) => { try { localStorage.setItem('tev-tema', t); } catch { /* */ } }, tema);
      await page.setViewportSize({ width: 1280, height: 860 });
      await page.goto(`${URL_APP}#mol=${encodeURIComponent(mol)}${paso ? `&paso=${paso}` : ''}`);
      await page.reload();
      await page.waitForSelector(paso ? '#chips .chip' : '#p-datos table');
      if (nombre === 'lewis') await page.click('#tabs >> text=Lewis');
      await page.waitForTimeout(1200);
      await page.screenshot({ path: `capturas/correcciones/${mol}-${nombre}-${tema}.png` });
    });
  }
}
