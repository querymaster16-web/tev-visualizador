/** RPECV: notación AXₙEₘ, número estérico, geometrías y ángulos. */
import { sub } from './formato';
import type { Estructura } from './tipos';
import { grado, ordenTotal, vecinos } from './tipos';

export interface Rpecv {
  x: number;
  /** Pares solitarios + electrón desapareado no enlazante (cuenta como un dominio). */
  e: number;
  paresSolitarios: number;
  radical: number;
  esterico: number;
  notacion: string;
  geometriaElectronica: string;
  geometriaMolecular: string;
  /** Ángulos ideales, p. ej. «109,5°» o «90° y 120°». */
  angulosIdeales: string;
  /** Ángulo real aproximado (valor principal). */
  anguloReal: number | null;
  anguloRealTexto: string;
  hibrido: string;
  /** El par del N conjugado ocupa un p sin hibridar (amidas, anilina, urea). */
  parConjugado: boolean;
  /** Radical de C con 3 σ: el electrón está en un p sin hibridar (no cuenta como dominio). */
  radicalPlano: boolean;
}

/** Radical alquilo (C con 3 σ, sin pares): plano sp², electrón en el p. */
export function radicalPlano(est: Estructura, i: number): boolean {
  const a = est.atomos[i];
  return a.radical === 1 && a.pares === 0 && a.el.simbolo === 'C' && grado(est, i) === 3;
}
/** N con 3 σ y un par, unido a un átomo con enlace π (C=O, C=N, anillo aromático): sp² plano. */
export function parConjugado(est: Estructura, i: number): boolean {
  const a = est.atomos[i];
  if (a.el.simbolo !== 'N' || grado(est, i) !== 3 || a.pares !== 1 || a.radical !== 0 || ordenTotal(est, i) !== 3) return false;
  return vecinos(est, i).some(({ j }) => vecinos(est, j).some(({ e }) => e.orden >= 2 || !!e.aromatico));
}

/** Ángulos experimentales (central|vecinos|E) que sustituyen al valor genérico. */
const ANG_EXP: Record<string, [number, string]> = {
  'O|H,H|2': [104.5, '≈ 104,5°'], 'N|H,H,H|1': [107, '≈ 107°'], 'C|H,H,H,H|0': [109.5, '109,5°'],
  'N|F,F,F|1': [102, '≈ 102°'], 'O|F,F|2': [103, '≈ 103°'], 'S|Cl,Cl|2': [103, '≈ 103°'],
  'S|H,H|2': [92, '≈ 92°'], 'P|H,H,H|1': [93.5, '≈ 93,5°'], 'Se|H,H|2': [91, '≈ 91°'], 'As|H,H,H|1': [92, '≈ 92°'],
  'S|O,O|1': [119, '≈ 119°'], 'O|O,O|1': [116.8, '≈ 116,8°'], 'N|O,O|1': [115, '≈ 115°'],
  'S|F,F,F,F|1': [102, '≈ 102° (ecuatorial) y ≈ 173° (axial)'], 'Se|F,F,F,F|1': [100, '≈ 100° (ecuatorial) y ≈ 169° (axial)'],
  'Cl|F,F,F|2': [87.5, '≈ 87,5°'], 'Br|F,F,F|2': [86, '≈ 86°'], 'Br|F,F,F,F,F|1': [85, '≈ 85°'], 'I|F,F,F,F,F|1': [82, '≈ 82°'],
  'Xe|F,F,F,F|2': [90, '90°'], 'C|C,H,H|0': [121.3, 'H–C–C ≈ 121,3° (H–C–H ≈ 117°)'], 'O|H,O|2': [94.8, '≈ 94,8° (diedro ≈ 111°)'],
  'O|C,C|2': [111.7, '≈ 111,7°'],
};

export const HIBRIDO_POR_ESTERICO: Record<number, string> = { 1: 's', 2: 'sp', 3: 'sp2', 4: 'sp3', 5: 'sp3d', 6: 'sp3d2', 7: 'sp3d3' };
const ELECTRONICA: Record<number, string> = {
  1: 'lineal', 2: 'lineal', 3: 'trigonal plana', 4: 'tetraédrica', 5: 'bipirámide trigonal', 6: 'octaédrica', 7: 'bipirámide pentagonal',
};
const IDEAL: Record<number, string> = {
  2: '180°', 3: '120°', 4: '109,5°', 5: '90° y 120°', 6: '90°', 7: '72° y 90°',
};
/** [geometría molecular, ángulo real (o null), texto del ángulo] por (esterico, E). */
const MOLECULAR: Record<string, [string, number | null, string]> = {
  '2-0': ['lineal', 180, '180°'],
  '3-0': ['trigonal plana', 120, '120°'],
  '3-1': ['angular', 118, '≈ 118° (< 120°)'],
  '3-2': ['lineal', 180, '180°'],
  '4-0': ['tetraédrica', 109.5, '109,5°'],
  '4-1': ['piramidal trigonal', 107, '≈ 107°'],
  '4-2': ['angular', 104.5, '≈ 104,5°'],
  '4-3': ['lineal', 180, '180°'],
  '5-0': ['bipirámide trigonal', 90, '90° (ax-ec) y 120° (ec-ec)'],
  '5-1': ['balancín (tetraedro distorsionado)', 102, '≈ 173° (ax-ax) y ≈ 102° (ec-ec)'],
  '5-2': ['forma de T', 87.5, '≈ 87,5°'],
  '5-3': ['lineal', 180, '180°'],
  '6-0': ['octaédrica', 90, '90°'],
  '6-1': ['pirámide cuadrada', 84.8, '≈ 85° (< 90°)'],
  '6-2': ['plano-cuadrada', 90, '90°'],
  '6-3': ['forma de T', 90, '90°'],
  '6-4': ['lineal', 180, '180°'],
  '7-0': ['bipirámide pentagonal', 72, '72° (ec-ec) y 90° (ax-ec)'],
  '7-1': ['octaedro distorsionado (estructura fluxional)', 90, '≈ 90° y ≈ 180° (octaedro distorsionado)'],
  '7-2': ['plano-pentagonal', 72, '72°'],
};

const NOMBRE_X: Record<number, string> = {};

export function notacionAXE(x: number, e: number): string {
  return 'AX' + (x > 1 ? sub(x) : '') + (e > 0 ? 'E' + (e > 1 ? sub(e) : '') : '');
}

/** RPECV del átomo `i`. Si hay un solo vecino y ningún dominio extra, devuelve geometría lineal trivial. */
export function rpecvAtomo(est: Estructura, i: number): Rpecv {
  const a = est.atomos[i];
  const x = grado(est, i);
  const rP = radicalPlano(est, i), pC = parConjugado(est, i);
  const e = (pC ? 0 : a.pares) + (rP ? 0 : a.radical);
  const esterico = x + e;
  const key = `${esterico}-${e}`;
  let mol = MOLECULAR[key];
  // Efecto del electrón desapareado: menos repulsión que un par (NO₂ ≈ 134°, ClO₂ ≈ 117,6°)
  if (a.radical && !rP && x === 2) {
    if (esterico === 3) mol = ['angular', 134, '≈ 134° (> 120°)'];
    else if (esterico === 4) mol = ['angular', 117.6, '≈ 117,6°'];
  }
  if (!mol) mol = [x <= 1 ? 'lineal (diatómica)' : 'no estándar', null, '—'];
  if (x === 1 && esterico >= 2) mol = ['lineal (un solo vecino)', null, '—'];
  if (a.el.z <= 2 && x === 1) mol = ['lineal (diatómica)', null, '—'];
  // valores experimentales conocidos
  const clave = `${a.el.simbolo}|${vecinos(est, i).map((v) => est.atomos[v.j].el.simbolo).sort().join(',')}|${e}`;
  const exp = ANG_EXP[clave];
  if (exp && !a.radical) mol = [mol[0], exp[0], exp[1]];
  return {
    x, e, paresSolitarios: a.pares, radical: a.radical, esterico,
    notacion: notacionAXE(x, e),
    geometriaElectronica: ELECTRONICA[Math.min(esterico, 7)] ?? '—',
    geometriaMolecular: mol[0],
    angulosIdeales: IDEAL[esterico] ?? '—',
    anguloReal: mol[1],
    anguloRealTexto: mol[2],
    hibrido: HIBRIDO_POR_ESTERICO[Math.min(esterico, 7)] ?? '—',
    parConjugado: pC,
    radicalPlano: rP,
  };
}
void NOMBRE_X;
