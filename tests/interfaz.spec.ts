/** Interfaz: biblioteca modal, menús dentro de pantalla, sin scroll horizontal y diagramas que caben. */
import { expect, test } from '@playwright/test';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const URL_APP = pathToFileURL(resolve('dist/index.html')).href;
const ANCHOS: [number, number][] = [[1440, 900], [1366, 768], [390, 844]];

test('Biblioteca: ventana modal centrada, con filtro y cierre por ✕, Esc y clic fuera', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await page.goto(URL_APP);
  await page.click('#b-bib');
  const caja = page.locator('.modal-caja');
  await expect(caja).toBeVisible();
  await expect(caja.locator('h3')).toHaveText('Biblioteca de moléculas');
  const r = (await caja.boundingBox())!;
  expect(Math.abs(r.x + r.width / 2 - 1366 / 2)).toBeLessThan(4); // centrada
  expect(r.width).toBeLessThanOrEqual(900);
  expect(r.height).toBeLessThanOrEqual(768 * 0.8 + 2);
  // todas las categorías con su título completo
  for (const c of ['AXₙ simples', 'Octeto expandido', 'Iones', 'Oxoácidos', 'Orgánicas', 'Radicales', 'Casos especiales']) await expect(caja.locator('h5', { hasText: c })).toHaveCount(1);
  // filtro
  const antes = await caja.locator('.chip:visible').count();
  await caja.locator('.filtro-bib').fill('sulfat');
  const despues = await caja.locator('.chip:visible').count();
  expect(despues).toBeGreaterThan(0);
  expect(despues).toBeLessThan(antes);
  await caja.locator('.filtro-bib').fill('zzzz');
  await expect(caja.locator('.vacio')).toBeVisible();
  // cierre con ✕
  await caja.locator('.cerrar-x').click();
  await expect(caja).toHaveCount(0);
  // cierre con Esc
  await page.click('#b-bib');
  await page.keyboard.press('Escape');
  await expect(page.locator('.modal-caja')).toHaveCount(0);
  // cierre con clic fuera
  await page.click('#b-bib');
  await page.mouse.click(5, 5);
  await expect(page.locator('.modal-caja')).toHaveCount(0);
  // elegir una molécula cierra y la carga
  await page.click('#b-bib');
  await page.locator('.modal-caja .chip[data-f="SF6"]').click();
  await expect(page.locator('.modal-caja')).toHaveCount(0);
  await expect(page.locator('#p-datos h3')).toContainText('Hexafluoruro de azufre');
});

for (const [w, h] of ANCHOS) {
  test(`menús dentro de la pantalla y sin scroll horizontal (${w} px)`, async ({ page }) => {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${URL_APP}#mol=SF4`);
    await page.reload();
    await page.waitForSelector('#p-datos table');
    for (const id of ['#b-menu', '#b-vista']) {
      await page.click(id);
      const pop = page.locator(id === '#b-menu' ? '#pop-menu' : '#pop-vista');
      await expect(pop).toBeVisible();
      const b = (await pop.boundingBox())!;
      expect(b.x, `${id} izquierda`).toBeGreaterThanOrEqual(0);
      expect(b.x + b.width, `${id} derecha`).toBeLessThanOrEqual(w + 0.5);
      expect(b.y + b.height, `${id} abajo`).toBeLessThanOrEqual(h + 0.5);
      await page.mouse.click(2, h - 2);
    }
    await page.click('#b-bib');
    const m = (await page.locator('.modal-caja').boundingBox())!;
    expect(m.x).toBeGreaterThanOrEqual(0);
    expect(m.x + m.width).toBeLessThanOrEqual(w + 0.5);
    await page.keyboard.press('Escape');
    // animación: sin scroll horizontal y el diagrama de clase cabe en su contenedor
    await page.click('#b-anim');
    await page.locator('#chips .chip').last().click();
    await page.waitForTimeout(300);
    const sx = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sx, 'scroll horizontal').toBeLessThanOrEqual(1);
    const cont = (await page.locator('#clase-box').boundingBox())!;
    const svg = (await page.locator('#clase-box svg').boundingBox())!;
    // cabe en el recuadro o, si no, el recuadro se desplaza en horizontal (el texto nunca baja del ≈ 85 % de su tamaño)
    const desplazable = await page.locator('#clase-box').evaluate((el) => el.scrollWidth > el.clientWidth + 1);
    if (!desplazable) expect(svg.x + svg.width).toBeLessThanOrEqual(cont.x + cont.width + 1);
    if (!desplazable) expect(svg.x).toBeGreaterThanOrEqual(cont.x - 1);
    const vb = await page.locator('#clase-box svg').evaluate((el) => (el as SVGSVGElement).viewBox.baseVal.width);
    expect(svg.width / vb, 'escala mínima del texto').toBeGreaterThanOrEqual(0.84);
    // cabecera: título en una línea (más la línea pequeña de autoría) y botones dentro
    const t = (await page.locator('.marca').boundingBox())!;
    expect(t.height).toBeLessThan(56);
    const bt = (await page.locator('#b-tema').boundingBox())!;
    expect(bt.x + bt.width).toBeLessThanOrEqual(w + 0.5);
  });
}

test('reproductor: iconos distintos y con tooltip', async ({ page }) => {
  await page.goto(`${URL_APP}#mol=NH3`);
  await page.click('#b-anim');
  const ids: [string, RegExp][] = [['#l-ini', /inicio/i], ['#l-ant', /anterior/i], ['#l-play', /pausar|reproducir/i], ['#l-sig', /siguiente/i], ['#l-fin', /final/i]];
  const html = new Set<string>();
  for (const [id, re] of ids) {
    await expect(page.locator(id)).toHaveAttribute('title', re);
    html.add(await page.locator(id).innerHTML());
  }
  expect(html.size).toBe(5);
});

test('textos: concordancia con 1 enlace σ y radical sin hibridar', async ({ page }) => {
  await page.goto(`${URL_APP}#mol=OH&paso=8`);
  await page.reload();
  await page.waitForSelector('#p-pasos');
  const t = await page.locator('#p-pasos').innerText();
  expect(t).toContain('1 enlace σ');
  expect(t).not.toContain('1 enlaces');
  expect(t).toContain('ocupa un orbital p');
  expect(t).not.toMatch(/ocupa un híbrido/);
});
