/** Etiquetas de los enlaces π de la animación: una por cada π del átomo central (y una por la nube de un anillo aromático). */
import type { Analisis } from '../chem/analisis';
import { vecinos } from '../chem/tipos';
import type { Vec3 } from '../chem/vec';
import { add, mul } from '../chem/vec';

export interface EtiquetaPi {
  /** Vecino del centro con el que forma el enlace (null en la nube de un anillo). */
  j: number | null;
  /** Índice del π dentro del enlace (0 o 1). */
  m: number;
  texto: string;
  /** Posición relativa al centro, junto a la zona de solapamiento lateral. */
  pos: Vec3;
}

const sinAtomo = (s: string) => s.replace(/ [A-Z][a-z]?$/, '');
export const SUB_PI = ['π₁', 'π₂'];

/** Texto «π(2p–2p)» con el orbital del centro primero; π₁/π₂ si el enlace es triple. */
export function textoPi(an: Analisis, c: number, j: number, m: number, total: number): string {
  const est = an.estructura;
  const e = an.tev.enlaces.find((x) => (x.a === c && x.b === j) || (x.b === c && x.a === j));
  const base = total > 1 ? SUB_PI[m] : 'π';
  if (!e) return base;
  if (e.deslocalizado) return `${base} deslocalizado`;
  const mt = (e.pis[m] ?? '').match(/^π\((.*) – (.*)\)$/);
  if (!mt) return base;
  const [oa, ob] = e.a === c ? [mt[1], mt[2]] : [mt[2], mt[1]];
  void est;
  return `${base}(${sinAtomo(oa)}–${sinAtomo(ob)})`;
}

/**
 * @param P posiciones de los átomos relativas al centro
 * @param pis ejes π por índice de enlace (ver `ejesPi`)
 * @param anillo nube π de un anillo aromático (centro, eje y número de átomos), si lo hay
 */
export function etiquetasPi(
  an: Analisis, c: number, P: Vec3[], pis: Map<number, Vec3[]>, anillo: { centro: Vec3; eje: Vec3; n: number } | null,
): EtiquetaPi[] {
  const est = an.estructura;
  const out: EtiquetaPi[] = [];
  vecinos(est, c).forEach(({ j, e }) => {
    if (e.aromatico && anillo) return;
    const ejes = pis.get(est.enlaces.indexOf(e));
    if (!ejes) return;
    const mid = mul(P[j], 0.5);
    ejes.forEach((ax, m) => out.push({ j, m, texto: textoPi(an, c, j, m, ejes.length), pos: add(mid, mul(ax, 1.15)) }));
  });
  if (anillo) out.push({ j: null, m: 0, texto: `π deslocalizado (${anillo.n} × 2p)`, pos: add(anillo.centro, mul(anillo.eje, 1.45)) });
  return out;
}
