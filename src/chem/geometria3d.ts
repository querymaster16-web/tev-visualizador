/**
 * Geometría 3D: plantillas RPECV, construcción a partir del grafo, relajación con campo de
 * fuerzas sencillo, direcciones de pares solitarios y momento dipolar.
 */
import { en } from './elementos';
import { Rpecv, rpecvAtomo } from './rpecv';
import type { Estructura } from './tipos';
import { grado, vecinos } from './tipos';
import type { Vec3 } from './vec';
import { add, anguloEntre, cross, dist, dot, len, mul, norm, perpendicular, rotacionEntre, rotar, sub } from './vec';

export interface Dominio {
  tipo: 'enlace' | 'par' | 'radical';
  vecino?: number;
  /** Dirección unitaria desde el núcleo. */
  dir: Vec3;
}
export interface Geometria {
  pos: Vec3[];
  dominios: Dominio[][];
  dipolo: { vector: Vec3; magnitud: number; polar: boolean };
  /** Longitudes de enlace (Å) por enlace de la estructura. */
  longitudes: number[];
}

/** Peso de repulsión de un par solitario frente a uno enlazante (calibrado: NH₃ ≈ 107°, H₂O ≈ 104–105°). */
export const PESO_PAR = 1.17;
/** El electrón desapareado repele menos que un par (NO₂ ≈ 134°, ClO₂ ≈ 118°). */
export const PESO_RADICAL = 0.55;
const pesoE = (a: { pares: number; radical: number }) => (a.pares + a.radical ? (a.pares * PESO_PAR + a.radical * PESO_RADICAL) / (a.pares + a.radical) : PESO_PAR);

// ───────────────────────── Plantillas ─────────────────────────
const s3 = Math.sqrt(3) / 2;
const TEMPLATES: Record<number, Vec3[]> = {
  1: [[1, 0, 0]],
  2: [[1, 0, 0], [-1, 0, 0]],
  3: [[1, 0, 0], [-0.5, s3, 0], [-0.5, -s3, 0]],
  4: ([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]] as Vec3[]).map(norm),
  5: [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-0.5, s3, 0], [-0.5, -s3, 0]],
  6: [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]],
  7: [[0, 0, 1], [0, 0, -1], ...[0, 1, 2, 3, 4].map((k): Vec3 => [Math.cos((2 * Math.PI * k) / 5), Math.sin((2 * Math.PI * k) / 5), 0])],
};
/** Posiciones (índices de plantilla) que ocupan los pares solitarios, por número estérico. */
const POS_PARES: Record<number, number[]> = {
  1: [], 2: [1, 0], 3: [2, 1], 4: [3, 2, 1],
  5: [2, 3, 4], // ecuatoriales en la bipirámide trigonal
  6: [1, 0, 4, 5], // trans en el octaedro
  7: [0, 1, 2],
};

/** Direcciones ideales de los dominios: los pares solitarios en las posiciones favorecidas. */
export function plantillaDominios(esterico: number, nPares: number): { dirs: Vec3[]; esPar: boolean[] } {
  const N = Math.max(1, Math.min(7, esterico));
  // AX₆E (XeF₆): octaedro con el par solitario sobre una cara (octaedro distorsionado)
  if (N === 7 && nPares === 1) return { dirs: [...TEMPLATES[6].map((v) => [...v] as Vec3), norm([1, 1, 1])], esPar: [false, false, false, false, false, false, true] };
  const dirs = TEMPLATES[N].map((v) => [...v] as Vec3);
  const esPar = dirs.map(() => false);
  POS_PARES[N].slice(0, nPares).forEach((k) => (esPar[k] = true));
  return { dirs, esPar };
}

/** Relaja dominios sobre la esfera: repulsión ∝ producto de pesos / d². */
export function relajarEsfera(dirs: Vec3[], pesos: number[], fijos: boolean[] = [], iter = 600): Vec3[] {
  const d = dirs.map((v) => norm(v));
  for (let it = 0; it < iter; it++) {
    const paso = 0.04 * (1 - it / iter) + 0.004;
    const f = d.map(() => [0, 0, 0] as Vec3);
    for (let i = 0; i < d.length; i++)
      for (let j = i + 1; j < d.length; j++) {
        const r = sub(d[i], d[j]);
        const l = Math.max(len(r), 1e-3);
        const w = pesos[i] * pesos[j];
        const fo = mul(r, w / (l * l * l));
        f[i] = add(f[i], fo);
        f[j] = sub(f[j], fo);
      }
    for (let i = 0; i < d.length; i++) {
      if (fijos[i]) continue;
      // componente tangencial
      const t = sub(f[i], mul(d[i], dot(f[i], d[i])));
      d[i] = norm(add(d[i], mul(t, paso)));
    }
  }
  return d;
}

/** Direcciones relajadas con pesos (pares solitarios empujan más). */
export function dominiosRelajados(esterico: number, nPares: number, wPar = PESO_PAR) {
  const { dirs, esPar } = plantillaDominios(esterico, nPares);
  const rel = relajarEsfera(dirs, esPar.map((p) => (p ? wPar : 1)));
  return { dirs: rel, esPar, ideales: dirs };
}

// ───────────────────────── Longitudes ─────────────────────────
function factorOrden(o: number) {
  if (o <= 1) return 1;
  if (o <= 2) return 1 - 0.12 * (o - 1);
  return 0.88 - 0.09 * (o - 2);
}
export function longitudEnlace(est: Estructura, a: number, b: number, orden: number): number {
  const r = (est.atomos[a].el.radio + est.atomos[b].el.radio) / 100;
  return r * factorOrden(orden);
}

// ───────────────────────── Ángulos objetivo ─────────────────────────
function anguloObjetivo(est: Estructura, i: number): number | null {
  const rp = rpecvAtomo(est, i);
  if (rp.x < 2 || rp.x > 4) return null;
  if (rp.esterico === 2) return 180;
  if (rp.esterico === 3) return rp.x === 3 ? (rp.anguloReal === 121.3 ? 121.3 : 120) : (rp.anguloReal ?? 118);
  if (rp.esterico === 4) return rp.x === 4 ? 109.5 : rp.x === 3 ? 107 : (rp.anguloReal ?? 104.5);
  if (rp.esterico === 5 && rp.x === 3) return 100;
  return null;
}

// ───────────────────────── Anillos ─────────────────────────
function encontrarAnillos(est: Estructura): number[][] {
  const n = est.atomos.length;
  const ady = est.atomos.map((_, i) => vecinos(est, i).map((v) => v.j));
  const padre = Array(n).fill(-2);
  const prof = Array(n).fill(0);
  const anillos: number[][] = [];
  for (let s = 0; s < n; s++) {
    if (padre[s] !== -2) continue;
    padre[s] = -1;
    const cola = [s];
    const visto = new Set<string>();
    while (cola.length) {
      const u = cola.shift()!;
      for (const v of ady[u]) {
        if (padre[v] === -2) {
          padre[v] = u;
          prof[v] = prof[u] + 1;
          cola.push(v);
        } else if (padre[u] !== v && padre[v] !== u) {
          const k = u < v ? `${u}-${v}` : `${v}-${u}`;
          if (visto.has(k)) continue;
          visto.add(k);
          // camino u → LCA ← v
          const A = [u], B = [v];
          let x = u, y = v;
          while (x !== y) {
            if (prof[x] >= prof[y]) { x = padre[x]; A.push(x); } else { y = padre[y]; B.push(y); }
          }
          anillos.push([...A, ...B.reverse().slice(1)]);
        }
      }
    }
  }
  // Quitar duplicados (mismo conjunto)
  const vistos = new Set<string>();
  return anillos.filter((r) => {
    const k = [...r].sort((a, b) => a - b).join(',');
    return vistos.has(k) ? false : (vistos.add(k), true);
  });
}

// ───────────────────────── Construcción ─────────────────────────
function esEstrella(est: Estructura): number | null {
  const n = est.atomos.length;
  if (n < 2) return null;
  for (let c = 0; c < n; c++) {
    if (grado(est, c) !== n - 1) continue;
    if (n === 2) return grado(est, 0) >= 1 ? mejorCentroDiatomica(est) : null;
    return c;
  }
  return null;
}
const mejorCentroDiatomica = (est: Estructura) => (en(est.atomos[0].el) <= en(est.atomos[1].el) ? 0 : 1);

export function generarGeometria(est: Estructura, ordenes: number[]): Geometria {
  const n = est.atomos.length;
  const L = est.enlaces.map((e, k) => longitudEnlace(est, e.a, e.b, ordenes[k] ?? e.orden));
  const longDe = (a: number, b: number) => L[est.enlaces.findIndex((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))];
  const pos: (Vec3 | null)[] = Array(n).fill(null);
  const ideales: Record<number, Vec3[]> = {};

  if (n === 1) {
    pos[0] = [0, 0, 0];
  } else {
    const centro = esEstrella(est);
    if (centro !== null) {
      construirEstrella(est, centro, pos, longDe);
    } else {
      construirGeneral(est, pos, longDe);
    }
  }
  let P = pos.map((p) => p ?? ([0, 0, 0] as Vec3));
  if (esEstrella(est) === null) P = relajarCampoFuerzas(est, P, L);
  // Centrar
  const cm = mul(P.reduce((s, p) => add(s, p), [0, 0, 0] as Vec3), 1 / n);
  P = P.map((p) => sub(p, cm));
  void ideales;
  const dominios = calcularDominios(est, P);
  return { pos: P, dominios, dipolo: calcularDipolo(est, P, dominios), longitudes: L };
}

/**
 * Direcciones de enlace con el ángulo experimental (RPECV real) para los casos con pares solitarios:
 * angular, pirámide trigonal, balancín, forma de T y pirámide cuadrada.
 */
function dirsExperimentales(rp: Rpecv, x: number): Vec3[] | null {
  const th = rp.anguloReal;
  if (th === null) return null;
  const rad = (th * Math.PI) / 180;
  const N = rp.esterico, e = rp.e;
  if (x === 2 && e >= 1 && (N === 3 || N === 4)) return [[Math.cos(rad / 2), Math.sin(rad / 2), 0], [Math.cos(rad / 2), -Math.sin(rad / 2), 0]];
  if (N === 4 && e === 1 && x === 3) {
    const c2 = (2 * Math.cos(rad) + 1) / 3, cb = Math.sqrt(Math.max(0, c2)), sb = Math.sqrt(Math.max(0, 1 - c2));
    return [0, 1, 2].map((k): Vec3 => [sb * Math.cos((2 * Math.PI * k) / 3), sb * Math.sin((2 * Math.PI * k) / 3), -cb]);
  }
  if (N === 5 && e === 1 && x === 4) {
    const ps = rad / 2, d = (3.5 * Math.PI) / 180; // el par ecuatorial (+x) cierra los ecuatoriales y dobla un poco los axiales
    return [[-Math.sin(d), 0, Math.cos(d)], [-Math.sin(d), 0, -Math.cos(d)], [-Math.cos(ps), Math.sin(ps), 0], [-Math.cos(ps), -Math.sin(ps), 0]];
  }
  if (N === 5 && e === 2 && x === 3) return [[Math.cos(rad), 0, Math.sin(rad)], [Math.cos(rad), 0, -Math.sin(rad)], [1, 0, 0]];
  if (N === 6 && e === 1 && x === 5) return [[0, 0, 1], ...[0, 1, 2, 3].map((k): Vec3 => [Math.sin(rad) * Math.cos((Math.PI * k) / 2), Math.sin(rad) * Math.sin((Math.PI * k) / 2), Math.cos(rad)])];
  return null;
}

function construirEstrella(est: Estructura, c: number, pos: (Vec3 | null)[], longDe: (a: number, b: number) => number) {
  pos[c] = [0, 0, 0];
  const rp = rpecvAtomo(est, c);
  const nb = vecinos(est, c).map((v) => v.j).sort((a, b) => a - b);
  const N = Math.max(2, rp.esterico);
  const { dirs, esPar } = dominiosRelajados(N, Math.min(rp.e, N - nb.length), pesoE(est.atomos[c]));
  const bonds = rp.esterico === 7 && rp.e === 1 ? TEMPLATES[6].map((v) => [...v] as Vec3) : dirsExperimentales(rp, nb.length) ?? dirs.filter((_, k) => !esPar[k]);
  nb.forEach((j, k) => {
    pos[j] = mul(bonds[k] ?? ([1, 0, 0] as Vec3), longDe(c, j));
  });
  if (nb.length === 1) pos[nb[0]] = [longDe(c, nb[0]), 0, 0];
}

function plantillaAtomo(est: Estructura, i: number) {
  const rp = rpecvAtomo(est, i);
  const N = Math.max(2, Math.min(7, rp.esterico));
  const d = dominiosRelajados(N, Math.min(rp.e, N - rp.x), pesoE(est.atomos[i]));
  return { rp, ...d };
}

function construirGeneral(est: Estructura, pos: (Vec3 | null)[], longDe: (a: number, b: number) => number) {
  const n = est.atomos.length;
  // Raíz: átomo pesado de mayor grado
  let raiz = 0, mejor = -1;
  for (let i = 0; i < n; i++) {
    const s = (est.atomos[i].el.simbolo === "H" ? 0 : 10) + grado(est, i);
    if (s > mejor) { mejor = s; raiz = i; }
  }
  const anillos = encontrarAnillos(est);
  const enAnillo = new Map<number, number>();
  anillos.forEach((r) => r.forEach((a) => enAnillo.set(a, (enAnillo.get(a) ?? 0) + 1)));
  // Anillos aislados: polígono plano o silla (los fusionados se resuelven con el campo de fuerzas)
  for (const r of anillos) if (!r.some((a) => enAnillo.get(a)! > 1)) colocarAnillo(est, r, pos, longDe);
  if (!pos.some((p) => p)) pos[raiz] = [0, 0, 0];
  const cola = pos.map((p, i) => (p ? i : -1)).filter((i) => i >= 0);
  expandir(est, pos, longDe, cola);
  // Componentes desconectados (SMILES con «.»): se colocan desplazados
  pos.forEach((p, i) => { if (!p) pos[i] = [3 * (i + 1), 0, 0]; });
}

/** Coloca los vecinos pendientes de cada átomo ya posicionado (recorrido en anchura). */
function expandir(est: Estructura, pos: (Vec3 | null)[], longDe: (a: number, b: number) => number, cola: number[]) {
  const hecho = new Set<number>();
  while (cola.length) {
    const i = cola.shift()!;
    if (hecho.has(i)) continue;
    hecho.add(i);
    const pi = pos[i]!;
    const vs = vecinos(est, i).map((v) => v.j);
    const colocados = vs.filter((j) => pos[j]);
    const pend = vs.filter((j) => !pos[j]).sort((x, y) => x - y);
    if (pend.length) {
      const t = plantillaAtomo(est, i);
      let dirs = t.dirs.filter((_, k) => !t.esPar[k]);
      if (colocados.length >= 1) {
        const a = norm(sub(pos[colocados[0]]!, pi));
        const r = rotacionEntre(dirs[0], a);
        dirs = dirs.map((d) => rotar(d, r.eje, r.ang));
        if (colocados.length >= 2 && dirs.length > 1) {
          // Ajusta el giro para coincidir con el segundo vecino ya colocado
          const b = norm(sub(pos[colocados[1]]!, pi));
          let mejorAng = 0, mejorD = Infinity;
          for (let g = 0; g < 360; g += 5) {
            const dd = len(sub(rotar(dirs[1], a, (g * Math.PI) / 180), b));
            if (dd < mejorD) { mejorD = dd; mejorAng = g; }
          }
          dirs = dirs.map((d) => rotar(d, a, (mejorAng * Math.PI) / 180));
        } else {
          dirs = elegirGiro(est, pos, i, colocados[0], a, dirs, pend, longDe);
        }
      }
      pend.forEach((j, k) => {
        const d = dirs[Math.min(colocados.length + k, dirs.length - 1)];
        pos[j] = add(pi, mul(d, longDe(i, j)));
        cola.push(j);
      });
    }
  }
}

/** Elige el giro alrededor del enlace al padre: planar si ambos sp², si no, alternado (máx. distancia mínima). */
function elegirGiro(
  est: Estructura, pos: (Vec3 | null)[], i: number, ref: number, eje: Vec3, dirs: Vec3[], pend: number[],
  longDe: (a: number, b: number) => number,
): Vec3[] {
  const pi = pos[i]!;
  const rpI = rpecvAtomo(est, i), rpR = rpecvAtomo(est, ref);
  const planar = rpI.esterico === 3 && rpR.esterico === 3;
  const otros = pos.map((p, k) => (p && k !== i ? k : -1)).filter((k) => k >= 0);
  // normal del plano del padre
  let nref: Vec3 | null = null;
  const vr = vecinos(est, ref).map((v) => v.j).filter((j) => pos[j]);
  if (planar && vr.length >= 3) nref = cross(sub(pos[vr[0]]!, pos[ref]!), sub(pos[vr[1]]!, pos[ref]!));
  else if (planar && vr.length === 2) nref = cross(sub(pos[vr[0]]!, pos[ref]!), sub(pos[vr[1]]!, pos[ref]!));
  // Conformaciones reales de los grupos O–H / N–N (ver `puntuacionConformacion`)
  const conf = conformacionEspecial(est, pos, i, ref, pend);
  let mejorAng = 0, mejorPunt = -Infinity;
  for (let g = 0; g < 360; g += conf ? 1 : 15) {
    const rr = dirs.map((d) => rotar(d, eje, (g * Math.PI) / 180));
    let punt = 0;
    if (conf) punt += conf(rr, g);
    if (nref && rr.length >= 2) {
      const nc = cross(rr[0], rr[1]);
      punt += 100 * Math.abs(dot(norm(nc), norm(nref)));
    }
    let md = Infinity;
    pend.forEach((j, k) => {
      const q = add(pi, mul(rr[Math.min(1 + k, rr.length - 1)], longDe(i, j)));
      for (const o of otros) if (o !== ref) md = Math.min(md, dist(q, pos[o]!));
    });
    punt += Math.min(md, 5);
    if (punt > mejorPunt + 1e-9) { mejorPunt = punt; mejorAng = g; }
  }
  return dirs.map((d) => rotar(d, eje, (mejorAng * Math.PI) / 180));
}

/** Ángulo diedro (grados, 0–180 en valor absoluto) a–b–c–d. */
function diedro(a: Vec3, b: Vec3, c: Vec3, d: Vec3): number {
  const b1 = sub(b, a), b2 = sub(c, b), b3 = sub(d, c);
  const n1 = norm(cross(b1, b2)), n2 = norm(cross(b2, b3));
  return (Math.acos(Math.max(-1, Math.min(1, dot(n1, n2)))) * 180) / Math.PI;
}

/**
 * Conformaciones reales que el criterio «máxima distancia» no reproduce:
 *  · X–Y con pares solitarios en ambos (H₂O₂: diedro H–O–O–H ≈ 111°; N₂H₄: gauche, pares a ≈ 90°).
 *  · Grupo –OH sobre un centro plano (B(OH)₃ con simetría C₃ₕ, ácidos carboxílicos, fenol…): H en el plano.
 * Devuelve una función de puntuación (mayor = mejor) o null si no procede.
 */
function conformacionEspecial(
  est: Estructura, pos: (Vec3 | null)[], i: number, ref: number, pend: number[],
): ((rr: Vec3[], g: number) => number) | null {
  const pi = pos[i]!, pr = pos[ref]!;
  const rpI = rpecvAtomo(est, i), rpR = rpecvAtomo(est, ref);
  const aI = est.atomos[i], aR = est.atomos[ref];
  // (a) dos átomos sp³ con pares solitarios enlazados entre sí
  if (rpI.esterico === 4 && rpR.esterico === 4 && aI.pares >= 1 && aR.pares >= 1 && aI.pares === aR.pares && pend.length >= 1) {
    const subsR = vecinos(est, ref).map((v) => v.j).filter((j) => j !== i && pos[j]);
    if (!subsR.length) return null;
    if (aI.pares === 2) {
      // peróxido: diedro R–O–O–R' ≈ 111° (H₂O₂)
      return (rr) => {
        const q = add(pi, rr[1] ?? rr[rr.length - 1]);
        return -((diedro(pos[subsR[0]]!, pr, pi, q) - 111) ** 2);
      };
    }
    if (aI.pares === 1) {
      // hidracina: gauche, los pares solitarios a ≈ 90°
      const lpR = norm(mul(subsR.reduce((s, j) => add(s, norm(sub(pos[j]!, pr))), norm(sub(pi, pr))), -1));
      return (rr) => {
        const sumI = rr.reduce((s, d) => add(s, d), [0, 0, 0] as Vec3);
        const lpI = norm(mul(sumI, -1));
        const axis = norm(sub(pi, pr));
        const u = norm(sub(lpR, mul(axis, dot(lpR, axis)))), w = norm(sub(lpI, mul(axis, dot(lpI, axis))));
        const ang = (Math.acos(Math.max(-1, Math.min(1, dot(u, w)))) * 180) / Math.PI;
        return -((ang - 90) ** 2);
      };
    }
  }
  // (b) –O–H sobre un centro plano con ≥ 2 vecinos: el H queda en el plano
  if (rpR.esterico === 3 && rpR.x >= 2 && rpI.esterico === 4 && aI.pares === 2 && pend.length === 1 && aI.el.simbolo !== 'H') {
    const vr = vecinos(est, ref).map((v) => v.j).sort((x, y) => x - y);
    const placed = vr.filter((j) => pos[j]);
    if (placed.length < 2) return null;
    const nrm = norm(cross(sub(pos[placed[0]]!, pr), sub(pos[placed[1]]!, pr)));
    // Objetivo: sin (carbonilo/oxo) del mismo centro; si no hay, el siguiente vecino en orden cíclico (→ C₃ₕ)
    const oxo = vecinos(est, ref).find((v) => v.j !== i && v.e.orden >= 2 && grado(est, v.j) === 1);
    const otros = vr.filter((j) => j !== i);
    const k = vr.indexOf(i);
    const objetivo = oxo ? oxo.j : otros.length ? vr[(k + 1) % vr.length] : null;
    if (objetivo === null || !pos[objetivo]) return null;
    const tgt = norm(sub(pos[objetivo]!, pr));
    return (rr) => {
      const h = rr[1] ?? rr[rr.length - 1];
      const enPlano = Math.abs(dot(h, nrm));
      const sinPlano = norm(sub(h, mul(nrm, dot(h, nrm))));
      const hacia = dot(sinPlano, tgt);
      return -200 * enPlano + 20 * hacia;
    };
  }
  return null;
}

function colocarAnillo(est: Estructura, r: number[], pos: (Vec3 | null)[], longDe: (a: number, b: number) => number) {
  const n = r.length;
  const Lm = r.reduce((s, a, k) => s + longDe(a, r[(k + 1) % n]), 0) / n;
  const rps = r.map((a) => rpecvAtomo(est, a));
  const planar = rps.every((p) => p.esterico <= 3);
  const silla = !planar && n === 6;
  const R = silla ? Math.sqrt(Math.max(Lm * Lm - 0.25, 0.5)) : Lm / (2 * Math.sin(Math.PI / n));
  r.forEach((a, k) => {
    const th = (2 * Math.PI * k) / n;
    const z = silla ? (k % 2 === 0 ? 0.25 : -0.25) : 0;
    pos[a] = [R * Math.cos(th), R * Math.sin(th), z];
  });
  r.forEach((a, k) => {
    const th = (2 * Math.PI * k) / n;
    const rad: Vec3 = [Math.cos(th), Math.sin(th), 0];
    const exo = vecinos(est, a).map((v) => v.j).filter((j) => !r.includes(j)).sort((x, y) => x - y);
    const up = k % 2 === 0 ? 1 : -1;
    exo.forEach((j, m) => {
      let d: Vec3;
      if (exo.length === 1) d = rad;
      else if (silla) d = m === 0 ? ([0, 0, up] as Vec3) : norm([rad[0] * 0.94, rad[1] * 0.94, -up * 0.33]);
      else d = norm([rad[0] * 0.58, rad[1] * 0.58, m === 0 ? 0.82 : -0.82]);
      pos[j] = add(pos[a]!, mul(d, longDe(a, j)));
    });
  });
}

// ───────────────────────── Campo de fuerzas ─────────────────────────
interface Terminos {
  enlaces: [number, number, number][];
  angulos: [number, number, number, number][]; // a, centro, b, θ0 (rad)
  planos: [number, number[]][]; // centro y sus 3 vecinos (planaridad)
  torsiones: [number, number, number, number][]; // a-b=c-d (dobles enlaces)
  diedros: [number, number, number, number, number][]; // a, b, c, d, diedro objetivo (rad): H–O–O–H ≈ 111°
  nb: [number, number][];
}

function terminos(est: Estructura, L: number[]): Terminos {
  const t: Terminos = { enlaces: [], angulos: [], planos: [], torsiones: [], diedros: [], nb: [] };
  est.enlaces.forEach((e, k) => t.enlaces.push([e.a, e.b, L[k]]));
  const n = est.atomos.length;
  const ady = Array.from({ length: n }, (_, i) => vecinos(est, i).map((v) => v.j));
  const vecino13 = new Set<string>();
  for (let c = 0; c < n; c++) {
    const th = anguloObjetivo(est, c);
    const vs = ady[c];
    for (let a = 0; a < vs.length; a++)
      for (let b = a + 1; b < vs.length; b++) {
        vecino13.add(`${Math.min(vs[a], vs[b])}-${Math.max(vs[a], vs[b])}`);
        if (th !== null) {
          // CH₂= (eteno, propeno, butadieno): H–C–C ≈ 121,3° y H–C–H ≈ 117,4° (suman 360°)
          const hh = th === 121.3 && est.atomos[vs[a]].el.simbolo === 'H' && est.atomos[vs[b]].el.simbolo === 'H';
          t.angulos.push([vs[a], c, vs[b], ((hh ? 360 - 2 * th : th) * Math.PI) / 180]);
        }
      }
    const rp = rpecvAtomo(est, c);
    if (rp.x === 3 && rp.esterico === 3) t.planos.push([c, vs]);
  }
  est.enlaces.forEach((e) => {
    if (e.orden < 2 || e.aromatico) {
      if (!(e.aromatico)) return;
    }
    const ra = ady[e.a].filter((j) => j !== e.b), rb = ady[e.b].filter((j) => j !== e.a);
    if (ra.length && rb.length) t.torsiones.push([ra[0], e.a, e.b, rb[0]]);
  });
  // peróxidos (X–O–O–Y): diedro ≈ 111° en lugar de la conformación trans de mínima repulsión
  est.enlaces.forEach((e) => {
    if (e.orden !== 1 || est.atomos[e.a].pares !== 2 || est.atomos[e.b].pares !== 2) return;
    const ra = ady[e.a].filter((j) => j !== e.b), rb = ady[e.b].filter((j) => j !== e.a);
    if (ra.length === 1 && rb.length === 1) t.diedros.push([ra[0], e.a, e.b, rb[0], (111 * Math.PI) / 180]);
  });
  const enlaceSet = new Set(est.enlaces.map((e) => `${Math.min(e.a, e.b)}-${Math.max(e.a, e.b)}`));
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      const k = `${i}-${j}`;
      if (enlaceSet.has(k) || vecino13.has(k)) continue;
      t.nb.push([i, j]);
    }
  return t;
}

function energia(P: Vec3[], t: Terminos, est: Estructura): number {
  let E = 0;
  for (const [a, b, l] of t.enlaces) {
    const d = dist(P[a], P[b]) - l;
    E += 6 * d * d;
  }
  for (const [a, c, b, th] of t.angulos) {
    const u = norm(sub(P[a], P[c])), v = norm(sub(P[b], P[c]));
    const d = Math.acos(Math.max(-1, Math.min(1, dot(u, v)))) - th;
    E += 1.2 * d * d;
  }
  for (const [c, vs] of t.planos) {
    const nrm = norm(cross(sub(P[vs[1]], P[vs[0]]), sub(P[vs[2]], P[vs[0]])));
    const h = dot(sub(P[c], P[vs[0]]), nrm);
    E += 3 * h * h;
  }
  for (const [a, b, c, d] of t.torsiones) {
    const b1 = sub(P[b], P[a]), b2 = sub(P[c], P[b]), b3 = sub(P[d], P[c]);
    const n1 = cross(b1, b2), n2 = cross(b2, b3);
    const cosf = dot(norm(n1), norm(n2));
    E += 0.6 * (1 - cosf * cosf); // favorece 0° y 180°
  }
  for (const [a, b, c, d, f0] of t.diedros) {
    const b1 = sub(P[b], P[a]), b2 = sub(P[c], P[b]), b3 = sub(P[d], P[c]);
    const cosf = dot(norm(cross(b1, b2)), norm(cross(b2, b3)));
    E += 1.5 * (cosf - Math.cos(f0)) ** 2;
  }
  for (const [i, j] of t.nb) {
    const d0 = est.atomos[i].el.simbolo === 'H' && est.atomos[j].el.simbolo === 'H' ? 2.0 : 2.5;
    const d = dist(P[i], P[j]);
    if (d < d0) E += 0.5 * (d0 - d) * (d0 - d);
  }
  return E;
}

function relajarCampoFuerzas(est: Estructura, P0: Vec3[], L: number[]): Vec3[] {
  const t = terminos(est, L);
  const P = P0.map((p) => [...p] as Vec3);
  let E = energia(P, t, est);
  let paso = 0.05;
  const h = 1e-4;
  for (let it = 0; it < 250; it++) {
    const g: Vec3[] = P.map(() => [0, 0, 0]);
    for (let i = 0; i < P.length; i++)
      for (let c = 0; c < 3; c++) {
        const o = P[i][c];
        P[i][c] = o + h;
        const e1 = energia(P, t, est);
        P[i][c] = o - h;
        const e2 = energia(P, t, est);
        P[i][c] = o;
        g[i][c] = (e1 - e2) / (2 * h);
      }
    const nuevo = P.map((p, i) => sub(p, mul(g[i], paso)) as Vec3);
    const En = energia(nuevo, t, est);
    if (En < E) {
      for (let i = 0; i < P.length; i++) P[i] = nuevo[i];
      paso *= 1.15;
      if (E - En < 1e-9) { E = En; break; }
      E = En;
    } else paso *= 0.5;
    if (paso < 1e-6) break;
  }
  return P;
}

// ───────────────────────── Pares solitarios y dipolo ─────────────────────────
function calcularDominios(est: Estructura, P: Vec3[]): Dominio[][] {
  const n = est.atomos.length;
  const star = esEstrella(est);
  return est.atomos.map((a, i) => {
    const nb = vecinos(est, i);
    const dom: Dominio[] = nb.map((v) => ({ tipo: 'enlace', vecino: v.j, dir: norm(sub(P[v.j], P[i])) }));
    const nE = a.pares + a.radical;
    if (nE === 0) return dom;
    const rp = rpecvAtomo(est, i);
    const total = dom.length + nE;
    // Resto: minimización de la repulsión con los enlaces fijos
    const bondDirs = dom.map((d) => d.dir);
    const libres = puntosIniciales(bondDirs, nE, est, i, P);
    const dirs = [...bondDirs, ...libres];
    const pesos = dirs.map((_, k) => (k < bondDirs.length ? 1 : pesoE(a)));
    const fijos = dirs.map((_, k) => k < bondDirs.length);
    const rel = relajarEsfera(dirs, pesos, fijos, 500);
    let libresR = rel.slice(bondDirs.length);
    if (dom.length === 1 && total >= 3) libresR = orientarEnPlano(est, i, P, bondDirs[0], libresR);
    libresR.forEach((d, k) => dom.push({ tipo: k < a.pares ? 'par' : 'radical', dir: d }));
    return dom;
  });
}

/** Muestreo del punto más alejado (esfera de Fibonacci) para la posición inicial de los pares. */
function puntosIniciales(bonds: Vec3[], k: number, est: Estructura, i: number, P: Vec3[]): Vec3[] {
  void est; void i; void P;
  const cand: Vec3[] = [];
  const M = 120;
  for (let m = 0; m < M; m++) {
    const y = 1 - (2 * (m + 0.5)) / M, r = Math.sqrt(1 - y * y), ph = m * Math.PI * (3 - Math.sqrt(5));
    cand.push([Math.cos(ph) * r, y, Math.sin(ph) * r]);
  }
  const elegidos: Vec3[] = [...bonds];
  const res: Vec3[] = [];
  for (let q = 0; q < k; q++) {
    let mejor = cand[0], md = -1;
    for (const c of cand) {
      const m = elegidos.length ? Math.min(...elegidos.map((e) => anguloEntre(e, c))) : 180;
      if (m > md + 1e-9) { md = m; mejor = c; }
    }
    elegidos.push(mejor);
    res.push(mejor);
  }
  return res;
}

/** Gira los pares de un átomo terminal alrededor del enlace para que queden en el plano molecular. */
function orientarEnPlano(est: Estructura, i: number, P: Vec3[], eje: Vec3, libres: Vec3[]): Vec3[] {
  const j = vecinos(est, i)[0].j;
  const otro = vecinos(est, j).map((v) => v.j).find((k) => k !== i);
  if (otro === undefined) return libres;
  const ref = sub(P[otro], P[j]);
  const refp = norm(sub(ref, mul(eje, dot(ref, eje))));
  if (len(refp) < 1e-6) return libres;
  let mejor = 0, mp = -Infinity;
  for (let g = 0; g < 360; g += 5) {
    const rr = libres.map((d) => rotar(d, eje, (g * Math.PI) / 180));
    const p = rr.reduce((s, d) => s + dot(d, refp) ** 2, 0);
    if (p > mp) { mp = p; mejor = g; }
  }
  return libres.map((d) => rotar(d, eje, (mejor * Math.PI) / 180));
}

/** Devuelve una rotación que lleva la plantilla (dos primeros enlaces) sobre los enlaces reales. */
function alinear(plantilla: Vec3[], reales: Vec3[]): (v: Vec3) => Vec3 {
  if (!plantilla.length || !reales.length) return (v) => v;
  const r1 = rotacionEntre(plantilla[0], reales[0]);
  const giro1 = (v: Vec3) => rotar(v, r1.eje, r1.ang);
  if (plantilla.length < 2) return giro1;
  const p2 = giro1(plantilla[1]);
  const a = reales[0];
  const proy = (v: Vec3) => sub(v, mul(a, dot(v, a)));
  const u = norm(proy(p2)), w = norm(proy(reales[1]));
  let ang = Math.acos(Math.max(-1, Math.min(1, dot(u, w))));
  if (dot(cross(u, w), a) < 0) ang = -ang;
  return (v) => rotar(giro1(v), a, ang);
}

/**
 * Momento dipolar aproximado: suma vectorial de dipolos de enlace (∝ ΔEN, hacia el más
 * electronegativo) más una pequeña contribución de los pares solitarios de los átomos
 * con ≥ 2 vecinos (apuntan hacia fuera del núcleo).
 */
function calcularDipolo(est: Estructura, P: Vec3[], dom: Dominio[][]): Geometria['dipolo'] {
  let v: Vec3 = [0, 0, 0];
  for (const e of est.enlaces) {
    const ea = en(est.atomos[e.a].el), eb = en(est.atomos[e.b].el);
    const u = norm(sub(P[e.b], P[e.a])); // de a hacia b
    v = add(v, mul(u, eb - ea)); // positivo si b es más electronegativo
  }
  est.atomos.forEach((a, i) => {
    if (a.pares === 0 || grado(est, i) < 2) return;
    dom[i].filter((d) => d.tipo === 'par').forEach((d) => (v = add(v, mul(d.dir, 0.35))));
  });
  const magnitud = len(v);
  return { vector: v, magnitud, polar: magnitud > 0.15 };
}
void perpendicular;
