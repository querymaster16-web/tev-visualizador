/**
 * Detector de fallos visuales de texto: rectángulos de texto que se cruzan, textos cortados por su contenedor
 * o que se salen de su recuadro / de la pantalla. Se ejecuta dentro de la página (todo el DOM visible, SVG incluido)
 * y revisa además las etiquetas dibujadas en el lienzo 2D (que exponen sus datos en atributos data-*).
 */
import type { Page } from '@playwright/test';

export interface Fallo { tipo: 'solape' | 'cortado' | 'fuera-recuadro' | 'fuera-pantalla' | 'lienzo' | 'desborde-pagina'; texto: string; detalle?: string }

export async function auditar(page: Page, raiz = ''): Promise<Fallo[]> {
  return page.evaluate((raiz) => {
    const out: { tipo: string; texto: string; detalle?: string }[] = [];
    interface It { el: Element; txt: string; r: DOMRect; svg: boolean; scroller: Element | null; fuera: boolean; rv: DOMRect | null }
    const items: It[] = [];
    const SKIP = new Set(['SCRIPT', 'STYLE', 'TITLE', 'OPTION', 'SELECT', 'TEXTAREA', 'INPUT', 'CANVAS']);
    const visible = (el: Element) => (el as HTMLElement).checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) ?? true;
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let n = w.nextNode(); n; n = w.nextNode()) {
      const t = (n.nodeValue ?? '').replace(/\s+/g, ' ').trim();
      const el = n.parentElement;
      if (!t || !el || SKIP.has(el.tagName) || el.closest('select,.pop[hidden],[hidden]')) continue;
      if (raiz && !el.closest(raiz)) continue;
      if (!visible(el)) continue;
      const svg = el instanceof SVGElement;
      // textos con opacidad casi nula (en transición) no cuentan
      let op = 1; for (let e: Element | null = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity || '1');
      if (op < 0.35) continue;
      // un rectángulo por línea de texto (el rectángulo envolvente de un texto en varias líneas daría falsos solapes)
      let rs: DOMRect[];
      if (svg) rs = [(el.closest('text') ?? el).getBoundingClientRect()];
      else { const rg = document.createRange(); rg.selectNodeContents(n); rs = Array.from(rg.getClientRects()); }
      // lo recortado (overflow hidden/clip) y fuera de su contenedor no se ve y no cuenta; lo que está fuera de un contenedor con scroll
      // se alcanza desplazándolo: solo se compara con lo que comparte contenedor
      let scroller: Element | null = null, recortado = false, fuera = false;
      for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
        if (e instanceof SVGElement) continue;
        const cs = getComputedStyle(e);
        if (!scroller && (cs.overflowX === 'auto' || cs.overflowX === 'scroll' || cs.overflowY === 'auto' || cs.overflowY === 'scroll')) scroller = e;
      }
      for (const r of rs) {
        if (r.width < 1 || r.height < 1) continue;
        recortado = false; fuera = false;
        for (let e: Element | null = el; e && e !== document.body; e = e.parentElement) {
          if (e instanceof SVGElement) continue;
          const cs = getComputedStyle(e), ar = e.getBoundingClientRect();
          const sale = r.right < ar.left || r.left > ar.right || r.bottom < ar.top || r.top > ar.bottom;
          if (sale && (cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.overflowY === 'hidden' || cs.overflowY === 'clip')) recortado = true;
          if (sale && e === scroller) fuera = true;
        }
        if (recortado) continue;
        // parte realmente visible del texto (recortada por los contenedores con scroll u overflow): con otros textos de fuera del contenedor solo cuenta lo visible
        let v: { l: number; t: number; r: number; b: number } | null = { l: r.left, t: r.top, r: r.right, b: r.bottom };
        for (let e: Element | null = el; e && e !== document.body && v; e = e.parentElement) {
          if (e instanceof SVGElement) continue;
          const cs = getComputedStyle(e);
          if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
          const ar = e.getBoundingClientRect();
          v = { l: Math.max(v.l, ar.left), t: Math.max(v.t, ar.top), r: Math.min(v.r, ar.right), b: Math.min(v.b, ar.bottom) };
          if (v.r - v.l < 1 || v.b - v.t < 1) v = null;
        }
        items.push({ el, txt: t.slice(0, 40), r, svg, scroller, fuera, rv: v ? new DOMRect(v.l, v.t, v.r - v.l, v.b - v.t) : null });
      }
    }
    const caja = (a: DOMRect, b: DOMRect) => ({ ix: Math.min(a.right, b.right) - Math.max(a.left, b.left), iy: Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) });
    // 1) solapes entre textos de elementos distintos
    for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) {
      const a = items[i], b = items[j];
      if (a.el === b.el || a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const mismo = a.scroller === b.scroller;
      const ra = mismo ? a.r : a.rv, rb = mismo ? b.r : b.rv; // de contenedores distintos solo se compara lo visible
      if (!ra || !rb) continue;
      const { ix, iy } = caja(ra, rb);
      if (ix <= 2 || iy <= 3) continue;
      const min = Math.min(ra.width * ra.height, rb.width * rb.height);
      if ((ix * iy) / min < 0.15) continue;
      out.push({ tipo: 'solape', texto: `«${a.txt}» × «${b.txt}»`, detalle: `${ix.toFixed(0)}×${iy.toFixed(0)}px` });
    }
    // 2) textos cortados por un contenedor que recorta o que se salen de la pantalla / de su recuadro
    for (const it of items) {
      const r = it.r;
      let scrollX = false, cortado = '';
      for (let e: Element | null = it.el; e && e !== document.documentElement; e = e.parentElement) {
        const cs = getComputedStyle(e);
        if (e instanceof SVGSVGElement) {
          const sr = e.getBoundingClientRect();
          if (r.left < sr.left - 1.5 || r.right > sr.right + 1.5 || r.top < sr.top - 1.5 || r.bottom > sr.bottom + 1.5) cortado = cortado || `cortado por su SVG (texto ${r.left.toFixed(0)}–${r.right.toFixed(0)} × ${r.top.toFixed(0)}–${r.bottom.toFixed(0)}, svg ${sr.left.toFixed(0)}–${sr.right.toFixed(0)} × ${sr.top.toFixed(0)}–${sr.bottom.toFixed(0)})`;
        }
        if (e === document.body || e instanceof SVGElement) continue;
        const ox = cs.overflowX, oy = cs.overflowY;
        if (ox === 'auto' || ox === 'scroll') { scrollX = true; continue; }
        if (ox === 'hidden' || ox === 'clip' || oy === 'hidden' || oy === 'clip') {
          const er = e.getBoundingClientRect();
          if (r.left < er.left - 1.5 || r.right > er.right + 1.5 || r.top < er.top - 1.5 || r.bottom > er.bottom + 1.5) cortado = cortado || `cortado por ${e.tagName.toLowerCase()}.${(e as HTMLElement).className}`;
        }
      }
      if (cortado) out.push({ tipo: 'cortado', texto: `«${it.txt}»`, detalle: cortado });
      if (!scrollX && (r.left < -1.5 || r.right > innerWidth + 1.5)) out.push({ tipo: 'fuera-pantalla', texto: `«${it.txt}»`, detalle: `x ${r.left.toFixed(0)}–${r.right.toFixed(0)} de ${innerWidth}` });
      // recuadro propio (fondo o borde visibles): el texto debe caber dentro
      if (!it.svg) {
        for (let e: Element | null = it.el; e && e !== document.body; e = e.parentElement) {
          const cs = getComputedStyle(e);
          const fondo = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' && cs.backgroundColor !== 'transparent';
          const borde = parseFloat(cs.borderTopWidth) > 0 && cs.borderTopStyle !== 'none';
          if (!fondo && !borde) continue;
          if (cs.display === 'inline') continue;
          if (it.scroller && e !== it.scroller && e.contains(it.scroller)) break; // el recuadro envuelve a un contenedor con scroll: lo que se sale es solo lo desplazado
          const er = e.getBoundingClientRect();
          if (er.width < 4 || er.height < 4) break;
          if (r.left < er.left - 1.5 || r.right > er.right + 1.5) out.push({ tipo: 'fuera-recuadro', texto: `«${it.txt}»`, detalle: `texto ${r.left.toFixed(0)}–${r.right.toFixed(0)} · recuadro ${er.left.toFixed(0)}–${er.right.toFixed(0)}` });
          break;
        }
      }
    }
    // 3) desborde horizontal de la página
    if (document.documentElement.scrollWidth > innerWidth + 1) out.push({ tipo: 'desborde-pagina', texto: 'página', detalle: `${document.documentElement.scrollWidth} > ${innerWidth}` });
    // 4) lienzo 2D: etiquetas solapadas o fuera del lienzo
    document.querySelectorAll<HTMLCanvasElement>('canvas.lienzo2d').forEach((c) => {
      if (!c.offsetParent || (raiz && !c.closest(raiz))) return;
      if (c.dataset.etqSolapes && c.dataset.etqSolapes !== '0') out.push({ tipo: 'lienzo', texto: 'etiquetas solapadas', detalle: c.dataset.etqSolapes });
      if (c.dataset.etqFuera && c.dataset.etqFuera !== '0') out.push({ tipo: 'lienzo', texto: 'etiquetas fuera del lienzo', detalle: c.dataset.etqFuera });
      if (c.dataset.etqExtrasSolapes && c.dataset.etqExtrasSolapes !== '0') out.push({ tipo: 'lienzo', texto: 'etiquetas de ángulos/μ/ejes solapadas', detalle: c.dataset.etqExtrasSolapes });
    });
    // duplicados (mismo fallo en varios nodos)
    const vistos = new Set<string>();
    return out.filter((f) => { const k = f.tipo + f.texto; if (vistos.has(k)) return false; vistos.add(k); return true; }) as never;
  }, raiz) as Promise<Fallo[]>;
}
