/**
 * Marcos de referencia derivados de la geometría final: direcciones de los híbridos,
 * ejes de los orbitales π y orientación de los orbitales atómicos de cada átomo.
 */
import type { Analisis } from '../chem/analisis';
import { plantillaDominios } from '../chem/geometria3d';
import { vecinos } from '../chem/tipos';
import type { Vec3 } from '../chem/vec';
import { add, cross, dot, len, mul, norm, perpendicular, sub } from '../chem/vec';
import type { Marco } from './campos';

export interface Dominios {
  tipos: ('par' | 'sigma' | 'radical')[];
  vecino: (number | undefined)[];
  finales: Vec3[];
  ideales: Vec3[];
}

/** Rotación (por mínimos de dos vectores) que lleva el conjunto `a` sobre `b`. */
export function alinearConjuntos(a: Vec3[], b: Vec3[]): Vec3[] {
  if (!a.length || a.length !== b.length) return a;
  let par: [number, number] | null = null;
  outer: for (let i = 0; i < a.length; i++)
    for (let j = i + 1; j < a.length; j++)
      if (len(cross(a[i], a[j])) > 0.3 && len(cross(b[i], b[j])) > 0.3) { par = [i, j]; break outer; }
  const base = (v1: Vec3, v2: Vec3): Vec3[] => {
    const e1 = norm(v1);
    const e2 = norm(sub(v2, mul(e1, dot(v2, e1))));
    return [e1, e2, cross(e1, e2)];
  };
  if (!par) {
    // todos colineales o un solo vector: alinear solo el primero
    const ang = Math.acos(Math.max(-1, Math.min(1, dot(norm(a[0]), norm(b[0])))));
    const eje = len(cross(a[0], b[0])) < 1e-6 ? perpendicular(a[0]) : norm(cross(a[0], b[0]));
    return a.map((v) => {
      const c = Math.cos(ang), s = Math.sin(ang), kv = cross(eje, v), kd = dot(eje, v) * (1 - c);
      return [v[0] * c + kv[0] * s + eje[0] * kd, v[1] * c + kv[1] * s + eje[1] * kd, v[2] * c + kv[2] * s + eje[2] * kd] as Vec3;
    });
  }
  const A = base(a[par[0]], a[par[1]]), B = base(b[par[0]], b[par[1]]);
  return a.map((v) => {
    const c = [dot(v, A[0]), dot(v, A[1]), dot(v, A[2])];
    return add(add(mul(B[0], c[0]), mul(B[1], c[1])), mul(B[2], c[2]));
  });
}

/** Dominios (híbridos) del átomo en el mismo orden que `tev.hibridacion.contenido`. */
export function dominiosAtomo(an: Analisis, c: number): Dominios {
  const t = an.tev.atomos[c];
  const dom = an.geometria.dominios[c];
  const enl = dom.filter((d) => d.tipo === 'enlace');
  const pares = dom.filter((d) => d.tipo === 'par');
  const rads = dom.filter((d) => d.tipo === 'radical');
  const tipos: Dominios['tipos'] = [];
  const vecino: Dominios['vecino'] = [];
  const finales: Vec3[] = [];
  const contenido = t.hibridacion?.contenido ?? [
    ...enl.map((d) => ({ tipo: 'sigma' as const, vecino: d.vecino })),
  ];
  let ip = 0, ir = 0;
  for (const k of contenido) {
    tipos.push(k.tipo);
    vecino.push(k.vecino);
    if (k.tipo === 'par') finales.push(pares[ip++]?.dir ?? [0, 1, 0]);
    else if (k.tipo === 'radical') finales.push(rads[ir++]?.dir ?? pares[ip++]?.dir ?? [0, 1, 0]);
    else finales.push(enl.find((d) => d.vecino === k.vecino)?.dir ?? [1, 0, 0]);
  }
  // Ideales: plantilla RPECV (pares en sus posiciones) rotada a la geometría real
  const N = finales.length;
  let ideales = finales;
  if (N >= 2 && t.hibridacion) {
    const nE = tipos.filter((x) => x !== 'sigma').length;
    const pl = plantillaDominios(N, nE);
    const slotsPar = pl.dirs.filter((_, k) => pl.esPar[k]);
    const slotsEnl = pl.dirs.filter((_, k) => !pl.esPar[k]);
    let a = 0, b = 0;
    const idealRaw = tipos.map((tp) => (tp === 'sigma' ? slotsEnl[b++] : slotsPar[a++]));
    ideales = alinearConjuntos(idealRaw, finales);
  }
  return { tipos, vecino, finales, ideales };
}

/** Ejes de los orbitales π por enlace (orden − 1 vectores ⟂ al enlace). */
export function ejesPi(an: Analisis): Map<number, Vec3[]> {
  const est = an.estructura;
  const P = an.geometria.pos;
  const res = new Map<number, Vec3[]>();
  const REF: Vec3 = norm([0.31, 0.88, 0.37]);
  const dirB = (k: number) => norm(sub(P[est.enlaces[k].b], P[est.enlaces[k].a]));
  est.enlaces.forEach((e, k) => {
    const npi = Math.round(e.orden) - 1;
    if (npi < 1) return;
    const d = dirB(k);
    let a1: Vec3 | null = null;
    // 1) normal al plano formado por el enlace y un sustituyente no colineal
    for (const [x, y] of [[e.a, e.b], [e.b, e.a]] as [number, number][]) {
      for (const v of vecinos(est, x)) {
        if (v.j === y) continue;
        const c = cross(d, norm(sub(P[v.j], P[x])));
        if (len(c) > 0.25) { a1 = norm(c); break; }
      }
      if (a1) break;
    }
    // 2) enlaces colineales (cumulenos): perpendicular al π del enlace vecino
    if (!a1) {
      for (const m of res.keys()) {
        const em = est.enlaces[m];
        if (![em.a, em.b].some((x) => x === e.a || x === e.b)) continue;
        if (Math.abs(dot(d, dirB(m))) > 0.95) { a1 = norm(cross(d, res.get(m)![0])); break; }
      }
    }
    if (!a1) a1 = perpendicular(d);
    if (dot(a1, REF) < 0) a1 = mul(a1, -1);
    const lista: Vec3[] = [a1];
    if (npi >= 2) lista.push(norm(cross(d, a1)));
    res.set(k, lista);
  });
  return res;
}

const IDX_P: Record<string, number> = { px: 0, py: 1, pz: 2 };

/** Marco (px, py, pz) del átomo tal que los orbitales π y el σ del p puro apunten donde deben. */
export function marcoAtomo(an: Analisis, c: number, pis: Map<number, Vec3[]>): Marco {
  const t = an.tev.atomos[c];
  const est = an.estructura;
  const P = an.geometria.pos;
  const eje: (Vec3 | null)[] = [null, null, null];
  // σ de un átomo no hibridado (p puro): sobre el enlace
  if (!t.hibridado) {
    for (const [j, o] of Object.entries(t.porVecino)) {
      if (o.sigma in IDX_P) eje[IDX_P[o.sigma]] = norm(sub(P[+j], P[c]));
    }
  }
  vecinos(est, c).forEach(({ j, e }) => {
    const k = est.enlaces.indexOf(e);
    const ax = pis.get(k);
    const ids = t.porVecino[j]?.pis ?? [];
    ids.forEach((id, m) => {
      if (id in IDX_P && ax?.[m]) eje[IDX_P[id]] = ax[m];
    });
  });
  // par del N conjugado / electrón de un radical plano: p perpendicular al plano de los enlaces
  if (t.hibridacion) {
    const dirs = an.geometria.dominios[c].filter((d) => d.tipo === 'enlace').map((d) => d.dir);
    const N0 = t.hibridacion.n;
    t.fundamental.forEach((o, k) => {
      const rol = t.roles[o.id]?.rol;
      if (k >= N0 && (rol === 'par' || rol === 'radical') && o.id in IDX_P && dirs.length >= 2) eje[IDX_P[o.id]] = norm(cross(dirs[0], dirs[1]));
    });
  }
  const asig = eje.map((v, i) => (v ? i : -1)).filter((i) => i >= 0);
  const out: Vec3[] = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  if (asig.length === 0) return [out[0], out[1], out[2]];
  if (asig.length === 1) {
    const a = asig[0];
    const u = eje[a]!;
    const v = perpendicular(u);
    const w = cross(u, v);
    const otros = [0, 1, 2].filter((i) => i !== a);
    out[a] = u; out[otros[0]] = v; out[otros[1]] = w;
    return [out[0], out[1], out[2]];
  }
  const [a, b] = asig;
  const u = eje[a]!;
  let v = eje[b]!;
  v = norm(sub(v, mul(u, dot(v, u))));
  if (len(v) < 1e-6) v = perpendicular(u);
  const w = cross(u, v);
  const r = [0, 1, 2].find((i) => i !== a && i !== b)!;
  out[a] = u; out[b] = v; out[r] = w;
  return [out[0], out[1], out[2]];
}
