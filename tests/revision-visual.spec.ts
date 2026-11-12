/**
 * Revisión visual automática: textos que se pisan, textos cortados o fuera de su recuadro / de la pantalla,
 * en todas las moléculas, pestañas y etapas, y en el comparador. 1440, 1366 y 390 px, en claro y oscuro.
 * Versión recortada (≈ 6 min con 4 procesos): casos difíciles en las 6 combinaciones de tamaño y tema, y toda la biblioteca
 * en la molécula final. `TEV_COMPLETO=1` recorre los 21 casos difíciles y TODAS las etapas de TODA la biblioteca (≈ 30 min).
 */
import { expect, test } from '@playwright/test';
import { resolve } from 'path';
import { pathToFileURL } from 'url';
import { BIBLIOTECA } from '../src/chem/biblioteca';
import { auditar } from './utils/auditoria-visual';
import { abrirComparadorTest, barrerMolecula, cajaDibujo, escribirEnComparador, plano } from './utils/barrido';

const URL_APP = pathToFileURL(resolve('dist/index.html')).href;
const COMBOS: [number, 'light' | 'dark'][] = [[1440, 'light'], [1440, 'dark'], [1366, 'light'], [1366, 'dark'], [390, 'light'], [390, 'dark']];
const existentes = new Set(BIBLIOTECA.map((e) => e.formula));
// casos difíciles: pares solitarios, octeto expandido, radicales, iones, orgánicas grandes y varios centros
const TODOS_DUROS = ['H2O', 'NH3', 'CO2', 'SO2', 'SF4', 'ClF3', 'XeF4', 'IF7', 'SF6', 'SO4^2-', 'NO2', 'CH3', 'C6H6', 'CH3COOH', 'C6H5COOH', 'C2H4', 'HCN', 'ClO4^-', 'XeOF4', 'CN^-', 'C6H5NH2'];
const RECORTADOS = ['H2O', 'SF4', 'XeOF4', 'SO4^2-', 'C6H5COOH', 'C2H4'];
const DUROS = (process.env.TEV_COMPLETO ? TODOS_DUROS : RECORTADOS).filter((m) => existentes.has(m));
const informe = (res: { donde: string; fallos: { tipo: string; texto: string; detalle?: string }[] }[]) => res.map((r) => `${r.donde}: ${r.fallos.map((f) => `${f.tipo} ${f.texto}${f.detalle ? ` (${f.detalle})` : ''}`).join(' | ')}`).join('\n');

async function preparar(page: import('@playwright/test').Page, w: number, tema: 'light' | 'dark') {
  await page.emulateMedia({ colorScheme: tema });
  await page.setViewportSize({ width: w, height: w < 500 ? 800 : 900 });
  await page.goto(URL_APP);
  await page.waitForSelector('#p-datos table');
}

const GRUPO = process.env.TEV_COMPLETO ? 4 : 3; // moléculas por test: así los tests se reparten entre los procesos y un fallo señala pocas moléculas
for (const [w, tema] of COMBOS) {
  for (let i = 0; i < DUROS.length; i += GRUPO) {
    const lote = DUROS.slice(i, i + GRUPO);
    test(`casos difíciles sin textos solapados ni cortados: ${lote.join(', ')} (${w} px, ${tema})`, async ({ page }) => {
      test.setTimeout(600000);
      await preparar(page, w, tema);
      const res = [];
      for (const m of lote) res.push(...(await barrerMolecula(page, m)));
      expect(res, informe(res)).toEqual([]);
    });
  }
}

// Toda la biblioteca: pestañas y molécula final (con TEV_COMPLETO=1, todas las etapas)
const LOTE = 14;
for (const [w, tema] of [[1440, 'light'], [390, 'dark']] as const) {
  for (let i = 0; i < BIBLIOTECA.length; i += LOTE) {
    test(`biblioteca ${i + 1}–${Math.min(i + LOTE, BIBLIOTECA.length)} sin fallos de texto (${w} px, ${tema})`, async ({ page }) => {
      test.setTimeout(900000);
      await preparar(page, w, tema);
      const res = [];
      const etapas = process.env.TEV_COMPLETO ? [1, 2, 3, 4, 5, 6, 7, 8] : w > 500 ? [8] : [];
      for (const e of BIBLIOTECA.slice(i, i + LOTE)) res.push(...(await barrerMolecula(page, e.formula, { etapas, centros: !!process.env.TEV_COMPLETO })));
      expect(res, informe(res)).toEqual([]);
    });
  }
}

// El propio detector se comprueba con fallos fabricados: si dejara de verlos, los demás tests pasarían sin comprobar nada
test('el detector ve un solape, un texto cortado y una caja desbordada (y no da falsos avisos)', async ({ page }) => {
  await preparar(page, 1440, 'light');
  await page.evaluate(() => {
    const d = document.createElement('div');
    d.id = 'sintetico';
    d.style.cssText = 'position:fixed;left:20px;top:200px;z-index:99;background:#fff;font:14px sans-serif';
    d.innerHTML = `<span style="position:absolute;left:0;top:0">solapado uno</span><span style="position:absolute;left:10px;top:4px">solapado dos</span>
      <div style="position:absolute;left:0;top:60px;width:40px;height:20px;overflow:hidden;white-space:nowrap">texto muy largo cortado</div>
      <div style="position:absolute;left:0;top:100px;width:30px;height:20px;border:1px solid #000;white-space:nowrap">desbordada de su caja</div>
      <div style="position:absolute;left:0;top:140px;width:60px;height:20px;overflow:auto;white-space:nowrap"><span style="position:absolute;left:100px">fuera por scroll</span></div>`;
    document.body.appendChild(d);
  });
  const f = await auditar(page, '#sintetico');
  const tipos = f.map((x) => x.tipo);
  expect(tipos).toContain('solape');
  expect(tipos).toContain('cortado');
  expect(tipos).toContain('fuera-recuadro');
  expect(f.some((x) => x.texto.includes('fuera por scroll')), 'lo desplazable por scroll no es un fallo').toBe(false);
});

// ───────────── Comparador ─────────────
const PAREJAS: [string, string][] = [['NH3', 'BF3'], ['CO2', 'SO2'], ['H2O', 'H2O'], ['SF4', 'XeF4'], ['SO4^2-', 'NH4^+'], ['C6H5COOH', 'CH3COOH'], ['NO2', 'CH3'], ['IF7', 'SF6'], ['C6H6', 'C2H4']];
for (const [w, tema] of COMBOS) {
  test(`comparador (${w} px, ${tema}): moléculas enteras, datos de cada una, sin restos y sin textos solapados`, async ({ page }) => {
    test.setTimeout(600000);
    const errores: string[] = [];
    page.on('pageerror', (e) => errores.push(e.message));
    await preparar(page, w, tema);
    await abrirComparadorTest(page);
    const fallos: string[] = [];
    const revisar = async (donde: string, a: string, b: string) => {
      await page.waitForTimeout(450);
      for (const [lado, mol] of [[0, a], [1, b]] as const) {
        const celda = await page.locator(`#d${lado} td`).first().innerText();
        if (plano(celda) !== plano(mol)) fallos.push(`${donde}: el lado ${lado + 1} muestra «${celda}» y debería ser «${mol}»`);
        const c = await cajaDibujo(page, lado);
        if (c.vacio) fallos.push(`${donde}: el lado ${lado + 1} no dibuja nada`);
        else if (c.x0 < 2 || c.y0 < 2 || c.x1 > c.w - 3 || c.y1 > c.h - 3) fallos.push(`${donde}: ${mol} sale del visor (${c.x0},${c.y0})–(${c.x1},${c.y1}) de ${c.w}×${c.h}`);
      }
      for (const f of await auditar(page, '.modal')) fallos.push(`${donde}: ${f.tipo} ${f.texto} ${f.detalle ?? ''}`);
    };
    for (const [a, b] of PAREJAS) {
      await escribirEnComparador(page, 0, a);
      await escribirEnComparador(page, 1, b);
      await revisar(`${a} frente a ${b}`, a, b);
      for (const etapa of [1, 4]) {
        await page.locator('#cs').evaluate((e: HTMLInputElement, v) => { e.value = String(v); e.dispatchEvent(new Event('input', { bubbles: true })); }, etapa);
        await page.waitForTimeout(500);
        for (const f of await auditar(page, '.modal')) fallos.push(`${a}/${b} etapa ${etapa}: ${f.tipo} ${f.texto} ${f.detalle ?? ''}`);
      }
      await page.locator('#cs').evaluate((e: HTMLInputElement) => { e.value = '8'; e.dispatchEvent(new Event('input', { bubbles: true })); });
    }
    // cambiar una molécula varias veces seguidas: solo debe quedar la última, sin restos de las anteriores
    for (const m of ['SF4', 'NH3', 'C6H6', 'CO2', 'H2O']) { await page.fill('#c0', m); await page.press('#c0', 'Enter'); }
    await revisar('cambios seguidos', 'H2O', 'C2H4');
    // entrada no válida: el lado se vacía (nada de la molécula anterior) y vuelve a funcionar después
    await escribirEnComparador(page, 0, 'xxxqqq');
    await page.waitForTimeout(300);
    if (!(await cajaDibujo(page, 0)).vacio) fallos.push('entrada no válida: queda dibujada la molécula anterior');
    if (!(await page.locator('#d0 .msg').count())) fallos.push('entrada no válida: no hay mensaje');
    await escribirEnComparador(page, 0, 'CH4');
    await revisar('tras una entrada no válida', 'CH4', 'C2H4');
    expect(fallos, fallos.join('\n')).toEqual([]);
    expect(errores).toEqual([]);
  });
}
