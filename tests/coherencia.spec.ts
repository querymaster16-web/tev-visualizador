/** Coherencia entre pestañas: Datos, animación, cajas, diagrama de energía y diagrama de clase salen del mismo análisis. */
import { expect, test } from '@playwright/test';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { analizar } from '../src/chem/analisis';
import { hibridoTexto } from '../src/chem/formato';

const URL_APP = pathToFileURL(resolve('dist/index.html')).href;
const ESPECIES = ['H2O', 'NH3', 'CH4', 'SO2', 'SF4', 'XeF4', 'C2H4', 'SO4^2-', 'CH3', 'CH3CONH2', 'XeF6', 'H2', 'NO2'];

for (const f of ESPECIES) {
  test(`coherencia ${f}`, async ({ page }) => {
    const r = analizar(f);
    if (r.tipo !== 'ok') throw new Error('ambiguo');
    const a = r.analisis;
    const c = a.centros[0];
    const t = a.tev.atomos[c];
    const hib = t.hibridacion ? hibridoTexto(t.hibridacion.tipo) : t.simbolo === 'H' ? '1s' : 'p puro';
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`${URL_APP}#mol=${encodeURIComponent(f)}`);
    await page.reload();
    await page.waitForSelector('#p-datos table');
    // Pestaña Resultado / Datos
    const datos = await page.locator('#p-datos').innerText();
    expect(datos).toContain(t.rpecv.notacion);
    expect(datos).toContain(t.rpecv.geometriaMolecular);
    expect(datos).toContain(hib);
    expect(datos).toMatch(new RegExp(`${a.tev.sigma} / ${a.tev.pi}`));
    // Pestaña Enlaces: tantas filas como enlaces
    expect(await page.locator('#p-enlaces .fila-enl').count()).toBe(a.estructura.enlaces.length);
    // Pestaña Energía: diagrama de clase y de 4 columnas con el mismo híbrido
    await page.click('[data-t=energia]');
    const en = await page.locator('#p-energia').innerText();
    if (t.hibridacion) {
      expect(en).toContain(hibridoTexto(t.hibridacion.tipo));
      expect(en).toContain(`Híbridos ${hibridoTexto(t.hibridacion.tipo)}`);
    }
    expect(en).not.toMatch(/\d[spd]\d(?![⁰-⁹])/); // nunca «3d1»
    // Paso a paso: etapa de hibridación
    await page.click('#b-anim');
    const chips = page.locator('#chips .chip');
    const etapaHib = a.tev.atomos[c].hibridacion ? 'Hibridación' : 'Hibridación';
    await chips.filter({ hasText: etapaHib }).first().click();
    const pasos = await page.locator('#p-pasos').innerText();
    if (t.hibridacion) {
      expect(pasos).toContain(`${t.hibridacion.n} orbitales híbridos ${hibridoTexto(t.hibridacion.tipo)}`);
      expect(pasos).toContain(t.hibridacion.composicionTexto);
      expect(await page.locator('#p-pasos svg').first().innerHTML()).toContain(`${t.hibridacion.n} × ${hibridoTexto(t.hibridacion.tipo)}`);
    }
    // Diagrama de clase (debajo del visor) con el mismo nivel híbrido
    await page.locator('#chips .chip').last().click();
    const clase = await page.locator('#clase-box').innerText();
    if (t.hibridacion) expect(clase).toContain(hibridoTexto(t.hibridacion.tipo));
    expect(clase).toContain(t.rpecv.geometriaMolecular);
    expect(errores).toEqual([]);
  });
}

test('«Vista»: solo estilo libro y todas las opciones dibujan sin errores en cualquier molécula', async ({ page }) => {
  const errores: string[] = [];
  page.on('pageerror', (e) => errores.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  await page.setViewportSize({ width: 1280, height: 860 });
  await page.goto(URL_APP);
  await page.click('#b-vista');
  await expect(page.locator('#estilo')).toHaveCount(0);
  await expect(page.locator('#modo')).toHaveCount(0);
  await expect(page.locator('#b-medir')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await page.mouse.click(10, 500);
  for (const mol of ['agua', 'metano', 'benceno', 'SF4', 'etileno', 'CO2']) {
    await page.fill('#q', mol);
    await page.press('#q', 'Enter');
    await page.waitForSelector('#p-datos table');
    await page.click('#b-vista');
    for (const k of ['angulos', 'ejes', 'dipolo', 'paresTodos']) { const c = page.locator(`#pop-vista input[data-k=${k}]`); if (!(await c.isChecked())) await c.check(); }
    await page.keyboard.press('Escape');
    await page.mouse.click(10, 500);
    await page.waitForTimeout(150);
    const px = await page.evaluate(() => {
      const cv = document.querySelector('canvas.lienzo2d') as HTMLCanvasElement;
      const d = cv.getContext('2d')!.getImageData(0, 0, cv.width, cv.height).data;
      const cuenta = (r: number, g: number, b: number) => { let n = 0; for (let i = 0; i < d.length; i += 4) if (Math.abs(d[i] - r) < 6 && Math.abs(d[i + 1] - g) < 6 && Math.abs(d[i + 2] - b) < 6) n++; return n; };
      return { rojo: cuenta(239, 68, 68), verde: cuenta(34, 197, 94), azul: cuenta(59, 130, 246), ambar: cuenta(245, 158, 11) };
    });
    expect(px.rojo, `eje x en ${mol}`).toBeGreaterThan(20);
    expect(px.verde, `eje y en ${mol}`).toBeGreaterThan(20);
    expect(px.azul, `eje z en ${mol}`).toBeGreaterThan(20);
    expect(px.ambar, `ángulos/dipolo en ${mol}`).toBeGreaterThan(20);
  }
  expect(errores).toEqual([]);
});

// ───────── Etiquetas π de la etapa 7 (estilo libro, 2D) ─────────
for (const [mol, esperadas] of [['C2H2', ['π₁(2p–2p)', 'π₂(2p–2p)']], ['C2H4', ['π(2p–2p)']], ['CO2', ['π(2p–2p)', 'π(2p–2p)']], ['N2', ['π₁(2p–2p)', 'π₂(2p–2p)']]] as [string, string[]][]) {
  for (const tema of ['light', 'dark'] as const) {
    test(`etapa 7 de ${mol} (${tema}): una etiqueta π por enlace π y las σ siguen visibles`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: tema });
      await page.setViewportSize({ width: 1280, height: 860 });
      await page.goto(`${URL_APP}#mol=${encodeURIComponent(mol)}&paso=7`);
      await page.reload();
      await page.waitForSelector('#chips .chip');
      await page.waitForTimeout(1500);
      const pi = JSON.parse((await page.locator('canvas[data-etq-pi]').getAttribute('data-etq-pi')) ?? '[]') as string[];
      expect(pi.sort()).toEqual([...esperadas].sort());
      const sg = JSON.parse((await page.locator('canvas[data-etq-pi]').getAttribute('data-etq-sigma')) ?? '[]') as string[];
      expect(sg.length, 'etiquetas σ visibles (opacas) en la etapa 7').toBeGreaterThan(0);
    });
  }
}

test('μ experimental en la pestaña Resultado y nota de XeF₆', async ({ page }) => {
  await page.goto(`${URL_APP}#mol=H2O2`);
  await page.reload();
  await page.waitForSelector('#p-datos table');
  await expect(page.locator('#p-datos')).toContainText('μ = 2,26 D (experimental)');
  await page.goto(`${URL_APP}#mol=XeF6`);
  await page.reload();
  await page.waitForSelector('#p-datos table');
  await expect(page.locator('#p-datos')).toContainText('apolar');
  await expect(page.locator('#p-datos')).toContainText('fluxional');
});
