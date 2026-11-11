/**
 * Estructura de Lewis: reparto de electrones, octetos, octeto expandido, resonancia.
 * Funciones puras sobre `Estructura`.
 */
import { EXENTOS_OCTETO, en } from './elementos';
import type { Atomo, Enlace, Estructura } from './tipos';
import { cargaFormal, clonar, grado, ordenTotal, vecinos } from './tipos';

/** Esqueleto: átomos + enlaces simples (conectividad σ). */
export interface Esqueleto {
  atomos: Atomo['el'][];
  enlaces: [number, number][];
  carga: number;
}

const PREFERENCIA_PI: Record<string, number> = { O: 0, S: 1, N: 2, C: 3 };
const HALOGENOS = new Set(['F', 'Cl', 'Br', 'I', 'At']);

/** Objetivo de electrones (alrededor del átomo) en la capa de valencia. */
function objetivo(a: Atomo): number {
  const s = a.el.simbolo;
  if (s === 'H' || s === 'Li' || s === 'He') return 2;
  if (s === 'Be' || s === 'Mg') return 4;
  if (s === 'B' || s === 'Al' || s === 'Ga') return 6;
  return 8;
}
const electronesAlrededor = (est: Estructura, i: number) =>
  2 * est.atomos[i].pares + est.atomos[i].radical + 2 * ordenTotal(est, i);

/** Calcula la estructura de Lewis principal a partir de un esqueleto σ. */
export interface OpcionesLewis {
  /** true (por defecto): minimiza cargas formales con octeto expandido en periodo ≥ 3; false: respeta el octeto. */
  minimizarCargas?: boolean;
}

export function lewisDesdeEsqueleto(sk: Esqueleto, op: OpcionesLewis = {}): Estructura {
  const est: Estructura = {
    atomos: sk.atomos.map((el) => ({ el, carga: 0, pares: 0, radical: 0 })),
    enlaces: sk.enlaces.map(([a, b]) => ({ a, b, orden: 1 })),
    cargaTotal: sk.carga,
  };
  const n = est.atomos.length;
  // 2. Electrones de valencia totales
  const V = est.atomos.reduce((s, a) => s + a.el.valencia, 0) - sk.carga;
  // 3. Restar 2 e⁻ por enlace σ
  let R = V - 2 * est.enlaces.length;
  if (n === 1) {
    // Átomo o ion aislado
    est.atomos[0].pares = Math.floor(V / 2);
    est.atomos[0].radical = V % 2;
    actualizarCargas(est);
    return est;
  }

  // Terminales (grado 1, no H): menor grado primero, a igual grado mayor electronegatividad
  const gr = (i: number) => grado(est, i);
  const terminales = [...Array(n).keys()].filter((i) => gr(i) === 1 && est.atomos[i].el.simbolo !== 'H');
  terminales.sort((a, b) => en(est.atomos[b].el) - en(est.atomos[a].el));
  for (const i of terminales) {
    const necesita = Math.max(0, objetivo(est.atomos[i]) - 2);
    const p = Math.min(Math.floor(R / 2), necesita / 2);
    est.atomos[i].pares += p;
    R -= 2 * p;
  }
  // Centrales (grado ≥ 2): los más electronegativos completan octeto primero; el resto, al menos electronegativo
  const centrales = [...Array(n).keys()].filter((i) => gr(i) >= 2);
  centrales.sort((a, b) => en(est.atomos[b].el) - en(est.atomos[a].el));
  for (const i of centrales) {
    const necesita = Math.max(0, objetivo(est.atomos[i]) - 2 * gr(i));
    const p = Math.min(Math.floor(R / 2), necesita / 2);
    est.atomos[i].pares += p;
    R -= 2 * p;
  }
  const ultimo = centrales.length ? centrales[centrales.length - 1] : terminales[terminales.length - 1];
  // Sobrante: pares al central menos electronegativo (octeto expandido natural: XeF₄, I₃⁻…)
  if (ultimo !== undefined) {
    const p = Math.floor(R / 2);
    est.atomos[ultimo].pares += p;
    R -= 2 * p;
    if (R === 1) est.atomos[ultimo].radical = 1; // electrón desapareado (radical)
  }
  // Diatómica homonuclear (grado 1 ambos): nada más que hacer aquí
  completarOctetos(est);
  if (op.minimizarCargas !== false) expandirOcteto(est);
  actualizarCargas(est);
  return est;
}

/** 4. Convierte pares solitarios de vecinos en enlaces múltiples hasta completar octetos. */
function completarOctetos(est: Estructura) {
  let cambio = true;
  let guardia = 50;
  while (cambio && guardia-- > 0) {
    cambio = false;
    for (let i = 0; i < est.atomos.length; i++) {
      const a = est.atomos[i];
      if (EXENTOS_OCTETO.has(a.el.simbolo)) continue;
      const falta = objetivo(a) - electronesAlrededor(est, i);
      if (falta < (a.radical ? 2 : 1)) continue;
      const cand = candidatoPi(est, i);
      if (cand === undefined) continue;
      subirOrden(est, i, cand);
      cambio = true;
    }
  }
}

/** Mejor vecino para formar un π con `i`: con pares solitarios, no halógeno; O > S > N > C. */
function candidatoPi(est: Estructura, i: number, estricto = false): number | undefined {
  const cands = vecinos(est, i).filter(({ j, e }) => {
    const v = est.atomos[j];
    if (v.pares < 1 || HALOGENOS.has(v.el.simbolo) || v.el.simbolo === 'H') return false;
    if (e.orden >= 3) return false;
    if (EXENTOS_OCTETO.has(v.el.simbolo)) return false;
    // Solo si el vecino queda mejor: un terminal con carga negativa cede un par (O⁻ → O=)
    if (cargaFormal(est, j) >= 0 && (estricto || grado(est, j) > 1)) return false;
    return true;
  });
  if (!cands.length) return undefined;
  cands.sort((p, q) => {
    const d = (PREFERENCIA_PI[est.atomos[p.j].el.simbolo] ?? 9) - (PREFERENCIA_PI[est.atomos[q.j].el.simbolo] ?? 9);
    // a igual preferencia, reparte los π entre vecinos distintos (orden de enlace menor primero)
    return d !== 0 ? d : p.e.orden - q.e.orden || p.j - q.j;
  });
  return cands[0].j;
}

function subirOrden(est: Estructura, i: number, j: number) {
  const e = est.enlaces.find((x) => (x.a === i && x.b === j) || (x.a === j && x.b === i))!;
  e.orden += 1;
  est.atomos[j].pares -= 1;
}

/**

 * 5. Octeto expandido: un central del periodo ≥ 3 sube el orden de enlace con los terminales
 * cargados negativamente mientras su carga formal sea > 0, tenga o no pares solitarios
 * (SO₂, SO₃²⁻, SOCl₂, ClO₂⁻, XeOF₄, SO₄²⁻, PO₄³⁻, SO₃, XeO₃…). Es el tratamiento de los
 * libros de bachillerato; la alternativa (respetar el octeto) se activa con `minimizarCargas: false`.
 */
function expandirOcteto(est: Estructura) {
  for (let i = 0; i < est.atomos.length; i++) {
    const a = est.atomos[i];
    if (a.el.periodo < 3 || grado(est, i) < 2 || EXENTOS_OCTETO.has(a.el.simbolo)) continue;
    const fc = cargaFormal(est, i);
    if (fc <= 0) continue;
    let g = 20;
    while (cargaFormal(est, i) > 0 && g-- > 0) {
      const cand = candidatoPi(est, i, true);
      if (cand === undefined) break;
      subirOrden(est, i, cand);
    }
  }
}

export function actualizarCargas(est: Estructura) {
  for (let i = 0; i < est.atomos.length; i++) est.atomos[i].carga = cargaFormal(est, i);
}

// ───────────────────────── Resonancia ─────────────────────────

/** Genera todas las formas resonantes equivalentes (terminales idénticos que se reparten los π). */
export function formasResonantes(base: Estructura, max = 12): Estructura[] {
  let formas: Estructura[] = [base];
  // 1) Terminales equivalentes alrededor de un mismo átomo
  for (let c = 0; c < base.atomos.length; c++) {
    const term = vecinos(base, c).filter(({ j }) => grado(base, j) === 1 && base.atomos[j].el.simbolo !== 'H');
    const grupos = new Map<string, number[]>();
    for (const { j } of term) {
      const k = base.atomos[j].el.simbolo;
      grupos.set(k, [...(grupos.get(k) ?? []), j]);
    }
    for (const idxs of grupos.values()) {
      if (idxs.length < 2) continue;
      const ordenes = idxs.map((j) => enlaceOrden(base, c, j));
      if (new Set(ordenes).size < 2) continue;
      const perms = permutacionesUnicas(ordenes);
      const nuevas: Estructura[] = [];
      for (const f of formas) {
        for (const p of perms) {
          const g = clonar(f);
          idxs.forEach((j, k) => reasignarTerminal(g, c, j, p[k]));
          nuevas.push(g);
        }
      }
      formas = unicas(nuevas);
    }
  }
  // 2) Anillos aromáticos (formas de Kekulé)
  const kek = formasKekule(base);
  if (kek.length > 1) {
    const nuevas: Estructura[] = [];
    for (const f of formas) for (const k of kek) nuevas.push(aplicarKekule(f, k));
    formas = unicas(nuevas);
  }
  formas = formas.slice(0, max);
  formas.forEach(actualizarCargas);
  return formas;
}

const enlaceOrden = (est: Estructura, a: number, b: number) =>
  est.enlaces.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))!.orden;

function reasignarTerminal(est: Estructura, c: number, t: number, orden: number) {
  const e = est.enlaces.find((x) => (x.a === c && x.b === t) || (x.a === t && x.b === c))!;
  e.orden = orden;
  // El terminal conserva octeto: 8 − 2·orden electrones no enlazantes
  est.atomos[t].pares = (8 - 2 * orden) / 2;
}

function permutacionesUnicas(arr: number[]): number[][] {
  const res = new Set<string>();
  const out: number[][] = [];
  const rec = (resto: number[], acc: number[]) => {
    if (!resto.length) {
      const k = acc.join(',');
      if (!res.has(k)) {
        res.add(k);
        out.push(acc);
      }
      return;
    }
    const vistos = new Set<number>();
    resto.forEach((x, i) => {
      if (vistos.has(x)) return;
      vistos.add(x);
      rec([...resto.slice(0, i), ...resto.slice(i + 1)], [...acc, x]);
    });
  };
  rec(arr, []);
  return out;
}

const firma = (e: Estructura) => e.enlaces.map((x) => `${x.a}-${x.b}:${x.orden}`).join('|');
const unicas = (l: Estructura[]) => {
  const vistos = new Set<string>();
  return l.filter((e) => (vistos.has(firma(e)) ? false : (vistos.add(firma(e)), true)));
};

/** Enumera las asignaciones de dobles enlaces (Kekulé) en los enlaces aromáticos. */
function formasKekule(est: Estructura): Set<number>[] {
  const aro = est.enlaces.map((e, i) => (e.aromatico ? i : -1)).filter((i) => i >= 0);
  if (!aro.length) return [];
  const atomosAro = new Set<number>();
  aro.forEach((i) => {
    atomosAro.add(est.enlaces[i].a);
    atomosAro.add(est.enlaces[i].b);
  });
  // Átomos que aportan un π: los que hoy tienen algún doble aromático
  const necesitan = new Set<number>();
  aro.forEach((i) => {
    if (est.enlaces[i].orden === 2) {
      necesitan.add(est.enlaces[i].a);
      necesitan.add(est.enlaces[i].b);
    }
  });
  const res: Set<number>[] = [];
  const rec = (usados: Set<number>, dobles: Set<number>) => {
    if (res.length >= 8) return;
    const libre = [...necesitan].find((a) => !usados.has(a));
    if (libre === undefined) {
      res.push(new Set(dobles));
      return;
    }
    for (const i of aro) {
      const e = est.enlaces[i];
      if ((e.a !== libre && e.b !== libre) || usados.has(e.a) || usados.has(e.b)) continue;
      if (!necesitan.has(e.a) || !necesitan.has(e.b)) continue;
      usados.add(e.a);
      usados.add(e.b);
      dobles.add(i);
      rec(usados, dobles);
      dobles.delete(i);
      usados.delete(e.a);
      usados.delete(e.b);
    }
  };
  rec(new Set(), new Set());
  return res;
}
function aplicarKekule(est: Estructura, dobles: Set<number>): Estructura {
  const g = clonar(est);
  g.enlaces.forEach((e, i) => {
    if (e.aromatico) e.orden = dobles.has(i) ? 2 : 1;
  });
  return g;
}

/** ¿La estructura tiene resonancia deslocalizada? (≥ 2 formas) */
export const tieneResonancia = (formas: Estructura[]) => formas.length > 1;

/** Átomos y enlaces implicados en la deslocalización π (enlaces cuyo orden cambia entre formas). */
export function enlacesDeslocalizados(formas: Estructura[]): Set<number> {
  const s = new Set<number>();
  if (formas.length < 2) return s;
  formas[0].enlaces.forEach((e, i) => {
    if (formas.some((f) => f.enlaces[i].orden !== e.orden)) s.add(i);
  });
  return s;
}

export type { Enlace };
