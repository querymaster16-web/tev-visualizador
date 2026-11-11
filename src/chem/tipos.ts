import type { Elemento } from './elementos';

export interface Atomo {
  el: Elemento;
  /** Carga formal. */
  carga: number;
  /** Pares solitarios. */
  pares: number;
  /** Electrones desapareados no enlazantes (0 o 1). */
  radical: number;
  aromatico?: boolean;
}
export interface Enlace {
  a: number;
  b: number;
  orden: number;
  aromatico?: boolean;
}
export interface Estructura {
  atomos: Atomo[];
  enlaces: Enlace[];
  cargaTotal: number;
}

export function vecinos(est: Estructura, i: number): { j: number; e: Enlace }[] {
  const r: { j: number; e: Enlace }[] = [];
  for (const e of est.enlaces) {
    if (e.a === i) r.push({ j: e.b, e });
    else if (e.b === i) r.push({ j: e.a, e });
  }
  return r;
}
export const grado = (est: Estructura, i: number) => vecinos(est, i).length;
export const ordenTotal = (est: Estructura, i: number) => vecinos(est, i).reduce((s, v) => s + v.e.orden, 0);
export function clonar(est: Estructura): Estructura {
  return {
    atomos: est.atomos.map((a) => ({ ...a })),
    enlaces: est.enlaces.map((e) => ({ ...e })),
    cargaTotal: est.cargaTotal,
  };
}
export function enlaceEntre(est: Estructura, a: number, b: number): Enlace | undefined {
  return est.enlaces.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
}
/** Carga formal = valencia − electrones no enlazantes − enlaces. */
export function cargaFormal(est: Estructura, i: number): number {
  const a = est.atomos[i];
  return a.el.valencia - (2 * a.pares + a.radical) - ordenTotal(est, i);
}
