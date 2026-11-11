/** Entrada de usuario: fórmulas con carga, SMILES y esqueletos automáticos. */
import { ELEMENTOS, ErrorQuimica, elemento, en } from './elementos';
import type { Esqueleto } from './lewis';
import type { Atomo, Estructura } from './tipos';
import { actualizarCargas } from './lewis';

// ───────────────────────── Fórmulas ─────────────────────────
const SUP_MAP: Record<string, string> = { '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' };
const SUB_MAP: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9' };

export interface FormulaParseada {
  cuerpo: string;
  carga: number;
}

/** Separa «SO4^2-», «CO3 2-», «PO₄³⁻», «[NH4]+»… en cuerpo y carga. */
export function separarCarga(entrada: string): FormulaParseada {
  let s = entrada.trim().replace(/[−–—]/g, "-");
  let carga = 0;
  let m: RegExpMatchArray | null;
  if ((m = s.match(/([⁰¹²³⁴⁵⁶⁷⁸⁹]*)([⁺⁻])$/))) {
    const n = m[1] ? +[...m[1]].map((c) => SUP_MAP[c]).join("") : 1;
    carga = m[2] === "⁺" ? n : -n;
    s = s.slice(0, m.index);
  } else if ((m = s.match(/^(.*?)\s*\^\s*([+-])\s*(\d+)\s*$/))) {
    carga = (m[2] === "+" ? 1 : -1) * +m[3];
    s = m[1];
  } else if ((m = s.match(/^(.*?)\s*(?:\^|\s)\s*(\d*)\s*([+-])\s*$/))) {
    carga = (m[3] === "+" ? 1 : -1) * (m[2] ? +m[2] : 1);
    s = m[1];
  } else if ((m = s.match(/^(.*[\])])\s*(\d*)([+-])$/))) {
    carga = (m[3] === "+" ? 1 : -1) * (m[2] ? +m[2] : 1);
    s = m[1];
  } else if ((m = s.match(/^(.*[A-Za-z0-9₀-₉])([+-])$/))) {
    carga = m[2] === "+" ? 1 : -1;
    s = m[1];
  }
  s = s.replace(/[₀-₉]/g, (c) => SUB_MAP[c]).replace(/\s+/g, "");
  const env = s.match(/^[\[(](.*)[\])]$/);
  if (env) s = env[1];
  return { cuerpo: s, carga };
}

export interface Conteo {
  simbolo: string;
  n: number;
}

/** Analiza «H2SO4» o «Ca(OH)2» → lista ordenada de elementos con su multiplicidad. */
export function parseFormula(f: string): Conteo[] {
  let i = 0;
  const grupo = (): Map<string, number> => {
    const m = new Map<string, number>();
    while (i < f.length && f[i] !== ')') {
      if (f[i] === '(' || f[i] === '[') {
        i++;
        const sub = grupo();
        i++; // )
        const mult = numero();
        for (const [k, v] of sub) m.set(k, (m.get(k) ?? 0) + v * mult);
      } else {
        const mm = f.slice(i).match(/^([A-Z][a-z]?)/);
        if (!mm) throw new ErrorQuimica(`No entiendo «${f}» como fórmula. Escríbela así: H2SO4, NH4+ o SO4^2-.`, [], "sintaxis");
        i += mm[1].length;
        elemento(mm[1]); // valida / lanza error didáctico
        m.set(mm[1], (m.get(mm[1]) ?? 0) + numero());
      }
    }
    return m;
  };
  const numero = () => {
    const mm = f.slice(i).match(/^\d+/);
    if (!mm) return 1;
    i += mm[0].length;
    return +mm[0];
  };
  const res = grupo();
  if (i < f.length) throw new ErrorQuimica(`No entiendo «${f}» como fórmula.`, [], "sintaxis");
  return [...res].map(([simbolo, n]) => ({ simbolo, n }));
}

/** Fórmula de Hill (C, H, resto alfabético) + carga: clave para buscar isómeros. */
export function hill(c: Conteo[], carga: number): string {
  const orden = (s: string) => (s === 'C' ? 0 : s === 'H' ? 1 : 2);
  const hayC = c.some((x) => x.simbolo === 'C');
  const l = [...c].sort((a, b) => (hayC ? orden(a.simbolo) - orden(b.simbolo) || a.simbolo.localeCompare(b.simbolo) : a.simbolo.localeCompare(b.simbolo)));
  return l.map((x) => x.simbolo + (x.n > 1 ? x.n : '')).join('') + (carga ? `^${carga > 0 ? '+' : '-'}${Math.abs(carga)}` : '');
}

// ───────────────────────── Esqueleto automático ─────────────────────────
const COORD_MAX = (periodo: number) => (periodo <= 2 ? 4 : periodo === 3 ? 6 : 7);

/**
 * Esqueleto con un único átomo central (o cadena homonuclear X₂, X₃).
 * Devuelve null si la fórmula no admite un esqueleto inequívoco.
 */
export function esqueletoAutomatico(c: Conteo[], carga: number): Esqueleto | null {
  const atomos = c.flatMap((x) => Array(x.n).fill(ELEMENTOS[x.simbolo]) as Atomo['el'][]);
  if (atomos.length > 40) return null;
  const noH = c.filter((x) => x.simbolo !== 'H');
  // Un solo elemento
  if (c.length === 1) {
    const n = c[0].n;
    const el = ELEMENTOS[c[0].simbolo];
    if (n === 1) return { atomos: [el], enlaces: [], carga };
    if (n === 2) return { atomos: [el, el], enlaces: [[0, 1]], carga };
    if (n === 3) return { atomos: [el, el, el], enlaces: [[0, 1], [0, 2]], carga }; // O₃, I₃⁻ (central = 0)
    return null;
  }
  if (!noH.length) return null;
  const candidatos = noH.filter((x) => x.n === 1);
  if (!candidatos.length) return null;
  candidatos.sort((a, b) => en(ELEMENTOS[a.simbolo]) - en(ELEMENTOS[b.simbolo]));
  const cen = candidatos[0];
  const elC = ELEMENTOS[cen.simbolo];
  // El central debe ser el menos electronegativo de los átomos distintos de H
  if (noH.some((x) => x !== cen && en(ELEMENTOS[x.simbolo]) < en(elC))) return null;
  const terminales: Atomo['el'][] = [];
  for (const x of c) if (x !== cen) for (let k = 0; k < x.n; k++) terminales.push(ELEMENTOS[x.simbolo]);
  const nH = c.find((x) => x.simbolo === 'H')?.n ?? 0;
  const oxigenos = terminales.filter((t) => t.simbolo === 'O').length;
  const lista = [elC, ...terminales];
  const enlaces: [number, number][] = [];
  // Oxoácido: los H se unen a átomos de O (no al central)
  const esOxoacido = nH > 0 && oxigenos >= nH && elC.simbolo !== 'O' && elC.simbolo !== 'H';
  if (esOxoacido) {
    const idxO = lista.map((e, i) => (i > 0 && e.simbolo === 'O' ? i : -1)).filter((i) => i > 0);
    const idxH = lista.map((e, i) => (i > 0 && e.simbolo === 'H' ? i : -1)).filter((i) => i > 0);
    for (let i = 1; i < lista.length; i++) if (lista[i].simbolo !== 'H') enlaces.push([0, i]);
    idxH.forEach((h, k) => enlaces.push([idxO[k], h]));
  } else {
    if (terminales.length > COORD_MAX(elC.periodo)) return null;
    for (let i = 1; i < lista.length; i++) enlaces.push([0, i]);
  }
  return { atomos: lista, enlaces, carga };
}

// ───────────────────────── SMILES ─────────────────────────
interface AtomoSmiles {
  simbolo: string;
  arom: boolean;
  carga: number;
  hExpl: number | null; // null → hidrógenos implícitos
  corchete: boolean;
}

const VALENCIAS_ORG: Record<string, number[]> = {
  B: [3], C: [4], N: [3, 5], O: [2], P: [3, 5], S: [2, 4, 6], F: [1], Cl: [1], Br: [1], I: [1],
};

/** Parser SMILES propio: ramas, =, #, anillos, aromáticos, corchetes con H y carga. */
export function parseSmiles(smi: string): Estructura {
  const at: AtomoSmiles[] = [];
  const bonds: { a: number; b: number; o: number; arom: boolean }[] = [];
  const pila: number[] = [];
  const anillos = new Map<number, { atomo: number; o: number | null }>();
  let prev = -1;
  let ordenPend: number | null = null;
  let i = 0;
  const pegar = (idx: number) => {
    if (prev >= 0) {
      const arom = at[prev].arom && at[idx].arom && ordenPend === null;
      bonds.push({ a: prev, b: idx, o: ordenPend ?? 1, arom });
    }
    ordenPend = null;
    prev = idx;
  };
  while (i < smi.length) {
    const c = smi[i];
    if (c === '(') { pila.push(prev); i++; continue; }
    if (c === ')') { prev = pila.pop() ?? -1; i++; continue; }
    if (c === '-') { ordenPend = 1; i++; continue; }
    if (c === '=') { ordenPend = 2; i++; continue; }
    if (c === '#') { ordenPend = 3; i++; continue; }
    if (c === ':') { ordenPend = null; i++; continue; }
    if (c === '.') { prev = -1; i++; continue; }
    if (/[0-9%]/.test(c)) {
      let n: number;
      if (c === '%') { n = +smi.slice(i + 1, i + 3); i += 3; } else { n = +c; i++; }
      const ab = anillos.get(n);
      if (!ab) anillos.set(n, { atomo: prev, o: ordenPend });
      else {
        const o = ordenPend ?? ab.o ?? 1;
        bonds.push({ a: ab.atomo, b: prev, o, arom: at[ab.atomo].arom && at[prev].arom && ordenPend === null && ab.o === null });
        anillos.delete(n);
      }
      ordenPend = null;
      continue;
    }
    if (c === '[') {
      const fin = smi.indexOf(']', i);
      if (fin < 0) throw new ErrorQuimica('El SMILES tiene un corchete sin cerrar.');
      const m = smi.slice(i + 1, fin).match(/^(\d*)([A-Za-z][a-z]?)(@*)(?:H(\d*))?([+-]+\d*|)?(?::\d+)?$/);
      if (!m) throw new ErrorQuimica(`No entiendo el átomo «${smi.slice(i, fin + 1)}» del SMILES.`);
      const arom = /^[a-z]/.test(m[2]);
      const simbolo = arom ? m[2][0].toUpperCase() + m[2].slice(1) : m[2];
      elemento(simbolo);
      const h = smi.slice(i, fin).includes('H') ? (m[4] ? +m[4] : 1) : 0;
      let q = 0;
      const cs = m[5] ?? '';
      if (cs) q = (cs[0] === '+' ? 1 : -1) * (/\d/.test(cs) ? +cs.replace(/\D/g, '') : cs.length);
      at.push({ simbolo, arom, carga: q, hExpl: h, corchete: true });
      pegar(at.length - 1);
      i = fin + 1;
      continue;
    }
    const mm = smi.slice(i).match(/^(Cl|Br|[BCNOPSFI]|[bcnops])/);
    if (!mm) throw new ErrorQuimica(`No entiendo el carácter «${c}» en el SMILES.`, ['Ejemplos válidos: CCO, C=C, c1ccccc1, CC(=O)O']);
    const arom = /^[a-z]/.test(mm[1]);
    at.push({ simbolo: arom ? mm[1].toUpperCase() : mm[1], arom, carga: 0, hExpl: null, corchete: false });
    pegar(at.length - 1);
    i += mm[1].length;
  }
  if (anillos.size) throw new ErrorQuimica('El SMILES tiene un anillo sin cerrar.');
  if (!at.length) throw new ErrorQuimica('El SMILES está vacío.');
  kekulizar(at, bonds);

  // Hidrógenos implícitos y estructura final
  const est: Estructura = { atomos: [], enlaces: [], cargaTotal: 0 };
  at.forEach((a) =>
    est.atomos.push({ el: elemento(a.simbolo), carga: a.carga, pares: 0, radical: 0, aromatico: a.arom }),
  );
  for (const b of bonds) est.enlaces.push({ a: b.a, b: b.b, orden: b.o, aromatico: b.arom });
  const ordenes = at.map((_, k) => bonds.filter((b) => b.a === k || b.b === k).reduce((s, b) => s + b.o, 0));
  const nHeavy = at.length;
  for (let k = 0; k < nHeavy; k++) {
    const a = at[k];
    const el = est.atomos[k].el;
    let nH: number;
    if (a.hExpl !== null && a.corchete) nH = a.hExpl;
    else {
      const vals = VALENCIAS_ORG[a.simbolo];
      if (!vals) throw new ErrorQuimica(`El átomo ${a.simbolo} debe escribirse entre corchetes en SMILES, por ejemplo [${a.simbolo}H3].`);
      const v = vals.find((x) => x >= ordenes[k]) ?? ordenes[k];
      nH = v - ordenes[k];
    }
    for (let h = 0; h < nH; h++) {
      est.atomos.push({ el: ELEMENTOS.H, carga: 0, pares: 0, radical: 0 });
      est.enlaces.push({ a: k, b: est.atomos.length - 1, orden: 1 });
    }
    // Electrones no enlazantes = valencia − carga − enlaces (con H)
    const bondSum = ordenes[k] + nH;
    const nonb = el.valencia - a.carga - bondSum;
    est.atomos[k].pares = Math.max(0, Math.floor(nonb / 2));
    est.atomos[k].radical = nonb % 2 === 1 ? 1 : 0;
  }
  est.cargaTotal = at.reduce((s, a) => s + a.carga, 0);
  actualizarCargas(est);
  return est;
}

/** Kekulización: asigna dobles enlaces alternos a los enlaces aromáticos (1.5 → 1/2). */
function kekulizar(at: AtomoSmiles[], bonds: { a: number; b: number; o: number; arom: boolean }[]) {
  const aro = bonds.filter((b) => b.arom);
  if (!aro.length) return;
  const necesita = new Set<number>();
  for (const b of aro) { necesita.add(b.a); necesita.add(b.b); }
  // Un átomo aromático con heteroátomo con pares (o, s, [nH]) no aporta doble enlace
  for (const k of [...necesita]) {
    const a = at[k];
    const conDoble = bonds.some((b) => !b.arom && b.o === 2 && (b.a === k || b.b === k));
    if (a.simbolo === 'O' || a.simbolo === 'S' && !a.corchete) {
      // o/s aromáticos de anillos de 5 (furano, tiofeno) no llevan doble
      necesita.delete(k);
    } else if (a.simbolo === 'N' && a.corchete && (a.hExpl ?? 0) > 0) necesita.delete(k);
    else if (conDoble) necesita.delete(k);
  }
  const usados = new Set<number>();
  const doble = new Set<number>();
  const rec = (): boolean => {
    const libre = [...necesita].find((k) => !usados.has(k));
    if (libre === undefined) return true;
    for (let j = 0; j < aro.length; j++) {
      const b = aro[j];
      if ((b.a !== libre && b.b !== libre) || usados.has(b.a) || usados.has(b.b)) continue;
      if (!necesita.has(b.a) || !necesita.has(b.b)) continue;
      usados.add(b.a); usados.add(b.b); doble.add(j);
      if (rec()) return true;
      usados.delete(b.a); usados.delete(b.b); doble.delete(j);
    }
    return false;
  };
  if (!rec()) throw new ErrorQuimica('No he podido kekulizar el anillo aromático del SMILES. Revisa que los átomos aromáticos estén bien.');
  aro.forEach((b, j) => { b.o = doble.has(j) ? 2 : 1; });
}
