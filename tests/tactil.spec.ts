/** Táctil: dentro del visor la página no se mueve; fuera sí. El pellizco hace zoom de la molécula, no de la página. */
import { devices, expect, test, type Page } from '@playwright/test';
import { resolve } from 'path';
import { pathToFileURL } from 'url';

const URL_APP = pathToFileURL(resolve('dist/index.html')).href;
const { defaultBrowserType: _a, ...iphone } = devices['iPhone 13'];
const { defaultBrowserType: _b, ...pixel } = devices['Pixel 5'];

type Punto = { x: number; y: number };
/** Gestos táctiles reales (CDP): pasan por el mismo filtro de touch-action que un dedo de verdad. */
async function gesto(page: Page, trazos: Punto[][], pasos = 8) {
  const cdp = await page.context().newCDPSession(page);
  const envia = (type: 'touchStart' | 'touchMove' | 'touchEnd', pts: Punto[]) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts.map((p, id) => ({ x: p.x, y: p.y, id })) });
  await envia('touchStart', trazos.map((t) => t[0]));
  for (let i = 1; i <= pasos; i++) {
    await envia('touchMove', trazos.map((t) => ({ x: t[0].x + ((t[1].x - t[0].x) * i) / pasos, y: t[0].y + ((t[1].y - t[0].y) * i) / pasos })));
    await page.waitForTimeout(16);
  }
  await envia('touchEnd', []);
  await page.waitForTimeout(80);
  await cdp.detach();
}
const estado = (page: Page) => page.evaluate(() => {
  const cv = document.querySelector('canvas.lienzo2d') as HTMLCanvasElement;
  return { y: window.scrollY, x: window.scrollX, rot: cv.dataset.rot, zoom: +(cv.dataset.zoom ?? 0), vv: window.visualViewport?.scale ?? 1 };
});

for (const [nombre, disp] of [['iPhone', iphone], ['Android', pixel]] as const) {
  test.describe(nombre, () => {
    test.use({ ...disp });

    test(`${nombre}: arrastrar dentro del visor gira la molécula y la página no se mueve`, async ({ page }) => {
      await page.goto(URL_APP);
      await page.waitForSelector('#p-datos table');
      await page.evaluate(() => window.scrollTo(0, 120));
      const before = await estado(page);
      const bb = (await page.locator('canvas.lienzo2d').boundingBox())!;
      const c = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
      await gesto(page, [[{ ...c }, { x: c.x, y: c.y + 70 }]]); // vertical
      let s = await estado(page);
      expect(s.y).toBe(before.y);
      // el arrastre completo (70 px ≈ 0,7 rad) debe llegar a la molécula: si el navegador se queda el gesto para hacer scroll, lo cancela a los pocos píxeles
      expect(Math.max(...s.rot!.split(',').map((v, i) => Math.abs(+v - +before.rot!.split(',')[i])))).toBeGreaterThan(0.3);
      const rot1 = s.rot;
      await gesto(page, [[{ x: c.x - 40, y: c.y }, { x: c.x + 40, y: c.y - 20 }]]); // horizontal y diagonal
      s = await estado(page);
      expect(s.y).toBe(before.y);
      expect(s.x).toBe(0);
      expect(s.rot).not.toBe(rot1);
    });

    test(`${nombre}: arrastrar fuera del visor desplaza la página`, async ({ page }) => {
      await page.goto(URL_APP);
      await page.waitForSelector('#p-datos table');
      const vp = page.viewportSize()!;
      const visor = (await page.locator('#visor').boundingBox())!;
      expect(visor.height, 'el visor no ocupa más del 60 % del alto').toBeLessThanOrEqual(vp.height * 0.6 + 1);
      // zona de la página libre de visor: por debajo si cabe en pantalla y, si no, la cabecera de encima
      const debajo = visor.y + visor.height + 20;
      const y0 = debajo < vp.height - 40 ? debajo : visor.y - 30;
      expect(y0 > visor.y + visor.height || y0 < visor.y, 'hay una zona de la página fuera del visor').toBe(true);
      expect(y0).toBeGreaterThan(5);
      const antes = await estado(page);
      await gesto(page, [[{ x: vp.width / 2, y: y0 }, { x: vp.width / 2, y: y0 - 150 }]]);
      expect((await estado(page)).y).toBeGreaterThan(antes.y + 20);
    });

    test(`${nombre}: pellizcar dentro del visor hace zoom de la molécula, no de la página`, async ({ page }) => {
      await page.goto(URL_APP);
      await page.waitForSelector('#p-datos table');
      const antes = await estado(page);
      const bb = (await page.locator('canvas.lienzo2d').boundingBox())!;
      const c = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
      await gesto(page, [[{ x: c.x - 20, y: c.y }, { x: c.x - 90, y: c.y }], [{ x: c.x + 20, y: c.y }, { x: c.x + 90, y: c.y }]]);
      const s = await estado(page);
      expect(s.zoom).toBeGreaterThan(antes.zoom * 1.3);
      expect(s.vv).toBe(antes.vv);
      expect(s.y).toBe(antes.y);
    });

    test(`${nombre}: doble toque en el visor centra la molécula y no amplía la página`, async ({ page }) => {
      await page.goto(URL_APP);
      await page.waitForSelector('#p-datos table');
      const bb = (await page.locator('canvas.lienzo2d').boundingBox())!;
      const c = { x: bb.x + 20, y: bb.y + 20 }; // esquina del visor: sin átomo
      await gesto(page, [[{ x: bb.x + bb.width / 2 - 20, y: bb.y + bb.height / 2 }, { x: bb.x + bb.width / 2 + 60, y: bb.y + bb.height / 2 }], [{ x: bb.x + bb.width / 2 + 20, y: bb.y + bb.height / 2 }, { x: bb.x + bb.width / 2 + 120, y: bb.y + bb.height / 2 }]]);
      expect((await estado(page)).zoom).toBeGreaterThan(1.2);
      await page.touchscreen.tap(c.x, c.y);
      await page.waitForTimeout(80);
      await page.touchscreen.tap(c.x, c.y);
      await page.waitForTimeout(200);
      const s = await estado(page);
      expect(s.zoom).toBeCloseTo(1, 2);
      expect(s.vv).toBe(1);
    });

    test(`${nombre}: tocar un átomo lo selecciona`, async ({ page }) => {
      await page.goto(`${URL_APP}#mol=${encodeURIComponent('H2O')}`);
      await page.reload();
      await page.waitForSelector('#p-datos table');
      expect(await page.locator('#centro').inputValue()).toBe('0');
      // busca un hidrógeno barriendo el lienzo y toca hasta que cambie el átomo analizado
      const bb = (await page.locator('canvas.lienzo2d').boundingBox())!;
      let cambiado = false;
      for (let fy = 0.2; fy < 0.8 && !cambiado; fy += 0.06) for (let fx = 0.2; fx < 0.8 && !cambiado; fx += 0.06) {
        await page.touchscreen.tap(bb.x + bb.width * fx, bb.y + bb.height * fy);
        await page.waitForTimeout(40);
        if ((await page.locator('#centro').inputValue()) !== '0' || (await page.locator('#aviso p').count())) cambiado = true;
      }
      expect(cambiado).toBe(true);
    });

    test(`${nombre}: el comparador (dos visores) tampoco deja mover la página`, async ({ page }) => {
      await page.goto(URL_APP);
      await page.waitForSelector('#p-datos table');
      await page.click('#b-menu');
      await page.click('#pop-menu button[data-k=mc]');
      await page.waitForSelector('.comp .visor canvas');
      const caja = page.locator('.modal > div');
      const vis = page.locator('.comp .visor').first();
      await vis.scrollIntoViewIfNeeded();
      const antes = await caja.evaluate((e) => e.scrollTop);
      const bb = (await vis.boundingBox())!;
      expect(bb.height).toBeLessThanOrEqual(page.viewportSize()!.height * 0.6 + 1);
      await gesto(page, [[{ x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 }, { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 - 80 }]]);
      expect(await caja.evaluate((e) => e.scrollTop)).toBe(antes);
    });
  });
}

test.describe('escritorio (ratón)', () => {
  test('ratón: arrastrar gira, la rueda hace zoom y el clic selecciona', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(URL_APP);
    await page.waitForSelector('#p-datos table');
    const bb = (await page.locator('canvas.lienzo2d').boundingBox())!;
    const c = { x: bb.x + bb.width / 2, y: bb.y + bb.height / 2 };
    const a = await estado(page);
    await page.mouse.move(c.x, c.y); await page.mouse.down(); await page.mouse.move(c.x + 80, c.y + 40, { steps: 6 }); await page.mouse.up();
    const b = await estado(page);
    expect(b.rot).not.toBe(a.rot);
    await page.mouse.wheel(0, -300);
    await page.waitForTimeout(100);
    expect((await estado(page)).zoom).toBeGreaterThan(b.zoom);
    await page.click('#b-centrar');
    expect((await estado(page)).zoom).toBeCloseTo(1, 2);
  });
});
