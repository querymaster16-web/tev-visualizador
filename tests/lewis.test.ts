/** Estructuras de Lewis 2D: sin puntos, cargas, símbolos ni enlaces solapados en toda la biblioteca. */
import { describe, expect, it } from 'vitest';
import { analizar } from '../src/chem/analisis';
import { BIBLIOTECA } from '../src/chem/biblioteca';
import { TEMA_CLARO } from '../src/diagramas/comun';
import { fantasmasLewis, lewisSVG } from '../src/diagramas/lewis2d';

type P = [number, number];
const num = (s: string, k: string) => +(s.match(new RegExp(`${k}="(-?[\\d.]+)"`))?.[1] ?? NaN);
function distSeg(p: P, a: P, b: P) {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

export function problemasLewis(f: string): string[] {
  const r = analizar(f);
  if (r.tipo !== 'ok') return [];
  const a = r.analisis;
  const out: string[] = [];
  a.resonancia.forEach((est, k) => {
    const svg = lewisSVG(est, a.geometria.pos, TEMA_CLARO, { ancho: 230, alto: 190, fantasmas: fantasmasLewis(a) });
    const dots = [...svg.matchAll(/<circle [^>]*r="2\.[46]"[^>]*>/g)].map((m): P => [num(m[0], 'cx'), num(m[0], 'cy')]);
    const bonds = [...svg.matchAll(/<line [^>]*>/g)].map((m): [P, P] => [[num(m[0], 'x1'), num(m[0], 'y1')], [num(m[0], 'x2'), num(m[0], 'y2')]]);
    const syms = [...svg.matchAll(/<text x="([\d.-]+)" y="([\d.-]+)" text-anchor="middle" font-size="(14|19)"/g)].map((m): P => [+m[1], +m[2] - 5]);
    const cargas = [...svg.matchAll(/<circle [^>]*r="6\.6"[^>]*>/g)].map((m): P => [num(m[0], 'cx'), num(m[0], 'cy')]);
    const tag = `${f} forma ${k + 1}`;
    dots.forEach((d, i) => {
      bonds.forEach(([p, q]) => { if (distSeg(d, p, q) < 3.6) out.push(`${tag}: punto sobre un enlace`); });
      syms.forEach((s) => { if (Math.hypot(d[0] - s[0], d[1] - s[1]) < 8.5) out.push(`${tag}: punto sobre un símbolo`); });
      cargas.forEach((c) => { if (Math.hypot(d[0] - c[0], d[1] - c[1]) < 9) out.push(`${tag}: punto sobre una carga`); });
      dots.slice(i + 1).forEach((e) => { if (Math.hypot(d[0] - e[0], d[1] - e[1]) < 3.2) out.push(`${tag}: puntos superpuestos`); });
    });
    cargas.forEach((c) => syms.forEach((s) => { if (Math.hypot(c[0] - s[0], c[1] - s[1]) < 6) out.push(`${tag}: carga sobre un símbolo`); }));
    // enlaces que atraviesan un símbolo ajeno
    syms.forEach((s) => bonds.forEach(([p, q]) => { const d = distSeg(s, p, q); if (d < 4 && Math.min(Math.hypot(p[0] - s[0], p[1] - s[1]), Math.hypot(q[0] - s[0], q[1] - s[1])) > 12) out.push(`${tag}: enlace atraviesa un símbolo`); }));
  });
  return [...new Set(out)];
}

describe('Lewis 2D sin solapes', () => {
  it('toda la biblioteca', () => {
    const malos = BIBLIOTECA.flatMap((e) => problemasLewis(e.formula));
    expect(malos).toEqual([]);
  });
});
