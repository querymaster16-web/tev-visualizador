import type { Page } from '@playwright/test';
import { auditar, type Fallo } from './auditoria-visual';

export const PESTANAS = ['datos', 'lewis', 'energia', 'enlaces', 'pasos'] as const;
export interface Resultado { donde: string; fallos: Fallo[] }

/** Carga la molécula (por el hash, sin recargar) y espera a que la interfaz se asiente. */
export async function cargarMol(page: Page, mol: string, paso?: number) {
  await page.evaluate((h) => { location.hash = h; }, `#mol=${encodeURIComponent(mol)}${paso ? `&paso=${paso}` : ''}`);
  await page.waitForFunction((m) => document.querySelector('#p-datos table') && true, mol);
  await page.waitForTimeout(paso ? 900 : 250);
}

/** Revisa todas las pestañas y todas las etapas de la animación de una molécula. */
export async function barrerMolecula(page: Page, mol: string, opciones: { etapas?: number[]; centros?: boolean } = {}): Promise<Resultado[]> {
  const res: Resultado[] = [];
  // un fallo cuenta solo si sigue ahí tras esperar un momento: así no salen falsos avisos por una transición a medias (equipos lentos o muy cargados)
  const anota = async (donde: string) => {
    let f = await auditar(page);
    if (f.length) { await page.waitForTimeout(900); const g = await auditar(page); f = f.filter((x) => g.some((y) => y.tipo === x.tipo && y.texto === x.texto)); }
    if (f.length) res.push({ donde: `${mol} · ${donde}`, fallos: f });
  };
  await cargarMol(page, mol);
  for (const t of PESTANAS) { await page.click(`#tabs button[data-t=${t}]`); await page.waitForTimeout(80); await anota(`pestaña ${t}`); }
  const n = await page.locator('#centro option').count();
  for (const paso of opciones.etapas ?? [1, 2, 3, 4, 5, 6, 7, 8]) {
    await cargarMol(page, mol, paso);
    await anota(`etapa ${paso}`);
    if (opciones.centros !== false && n > 1 && (paso === 3 || paso === 8)) {
      for (let k = 1; k < n; k++) { await page.selectOption('#centro', { index: k }); await page.waitForTimeout(500); await anota(`etapa ${paso}, centro ${k + 1}`); }
    }
  }
  return res;
}

// ───────────── Comparador ─────────────
const SUB: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-', '−': '-' };
export const plano = (t: string) => t.replace(/[₀-₉⁰-⁹⁺⁻−¹²³]/g, (c) => SUB[c] ?? c).replace(/[\s^]/g, '');

export async function abrirComparadorTest(page: Page) {
  await page.click('#b-menu');
  await page.click('#pop-menu button[data-k=mc]');
  await page.waitForSelector('.comp .visor canvas');
  await page.waitForTimeout(500);
}
/** Cambia una molécula del comparador como lo haría una persona (escribir y pulsar Intro). */
export async function escribirEnComparador(page: Page, lado: 0 | 1, txt: string) {
  await page.fill(`#c${lado}`, txt);
  await page.press(`#c${lado}`, 'Enter');
}
/** Recuadro de lo dibujado en el lienzo WebGL de un visor (píxeles bastante opacos: sin la sombra suave del suelo). */
export async function cajaDibujo(page: Page, lado: 0 | 1) {
  return page.evaluate((k) => {
    const cv = document.querySelector(`#v${k} canvas.lienzo3d`) as HTMLCanvasElement;
    const tmp = document.createElement('canvas'); tmp.width = cv.width; tmp.height = cv.height;
    const g = tmp.getContext('2d')!; g.drawImage(cv, 0, 0);
    const d = g.getImageData(0, 0, tmp.width, tmp.height).data;
    let x0 = tmp.width, y0 = tmp.height, x1 = -1, y1 = -1;
    for (let y = 0; y < tmp.height; y++) for (let x = 0; x < tmp.width; x++) if (d[(y * tmp.width + x) * 4 + 3] > 70) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    return { vacio: x1 < 0, x0, y0, x1, y1, w: tmp.width, h: tmp.height };
  }, lado);
}
