/** Utilidades comunes de los diagramas SVG. */
import { COLORES } from '../viz/orbitales3d';

export interface TemaSVG {
  tinta: string;
  suave: string;
  linea: string;
  fondo: string;
  caja: string;
  acento: string;
}
export const TEMA_CLARO: TemaSVG = { tinta: '#1a1d24', suave: '#5c6270', linea: '#cfc9b9', fondo: '#fbfaf6', caja: '#ffffff', acento: '#1f4fd8' };
export const TEMA_OSCURO: TemaSVG = { tinta: '#e9ecf3', suave: '#98a1b3', linea: '#2f3850', fondo: '#161b27', caja: '#1d2433', acento: '#7aa2ff' };

export const ROL: Record<string, string> = {
  par: COLORES.par, sigma: COLORES.sigma, pi: COLORES.pi, radical: COLORES.radical, promo: COLORES.promo, vecino: COLORES.vecino, neutro: '#8a93a8', vacio: '#8a93a8',
};
export const ROL_NOMBRE: Record<string, string> = {
  par: 'Par solitario', sigma: 'Enlace σ', pi: 'Enlace π', radical: 'Electrón desapareado', promo: 'Electrón promocionado', vecino: 'Electrón del vecino',
};

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);

/** Flecha de espín (↑ si arriba) centrada en (cx, cy). */
export function flecha(cx: number, cy: number, arriba: boolean, color: string, h = 8, cls = ''): string {
  const a = arriba ? -1 : 1;
  const y0 = cy - a * h, y1 = cy + a * h; // cola → punta
  const cabeza = `M${cx - 3.2},${y1 - a * 4.4} L${cx},${y1} L${cx + 3.2},${y1 - a * 4.4}`;
  return `<path class="${cls}" d="M${cx},${y0} L${cx},${y1} ${cabeza}" fill="none" stroke="${color}" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/>`;
}

export function descargar(nombre: string, blob: Blob) {
  const a = document.createElement('a');
  a.download = nombre;
  a.href = URL.createObjectURL(blob);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
export function exportarSVG(svg: SVGElement | string, nombre: string) {
  const txt = typeof svg === 'string' ? svg : new XMLSerializer().serializeToString(svg);
  const doc = txt.startsWith('<?xml') ? txt : `<?xml version="1.0" encoding="UTF-8"?>\n${txt}`;
  descargar(nombre.endsWith('.svg') ? nombre : nombre + '.svg', new Blob([doc], { type: 'image/svg+xml' }));
}
export async function exportarPNGdeSVG(svg: SVGElement | string, nombre: string, fondo = '#ffffff', escala = 2) {
  const txt = typeof svg === 'string' ? svg : new XMLSerializer().serializeToString(svg);
  const m = txt.match(/viewBox="([\d.\s-]+)"/);
  const [, , w, h] = m ? m[1].split(/\s+/).map(Number) : [0, 0, 600, 400];
  const img = new Image();
  const url = URL.createObjectURL(new Blob([txt], { type: 'image/svg+xml' }));
  await new Promise<void>((ok, ko) => {
    img.onload = () => ok();
    img.onerror = () => ko(new Error('No se pudo rasterizar el SVG'));
    img.src = url;
  });
  const cv = document.createElement('canvas');
  cv.width = w * escala;
  cv.height = h * escala;
  const g = cv.getContext('2d')!;
  g.fillStyle = fondo;
  g.fillRect(0, 0, cv.width, cv.height);
  g.drawImage(img, 0, 0, cv.width, cv.height);
  URL.revokeObjectURL(url);
  cv.toBlob((b) => b && descargar(nombre.endsWith('.png') ? nombre : nombre + '.png', b));
}

/** Etiqueta de un orbital: 3s, 2px, 3d (nunca «3d1»). */
export const etqOrb = (capa: number, id: string) => (id === 's' ? `${capa}s` : id[0] === 'p' ? `${capa}${id}` : `${capa}d`);
