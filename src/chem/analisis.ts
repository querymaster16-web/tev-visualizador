/** API de alto nivel: de un texto del usuario a un análisis completo (Lewis + RPECV + TEV + 3D). */
import { BIBLIOTECA, buscarExacto, claveHill, etiquetaFormula, isomeros, sugerir } from './biblioteca';
import type { EntradaBiblioteca } from './biblioteca';
import { ELEMENTOS, ErrorQuimica } from './elementos';
import { formulaUnicode, plano } from './formato';
import { calcularPolaridad } from './dipolos';
import type { Polaridad } from './dipolos';
import { Geometria, generarGeometria } from './geometria3d';
import { formasResonantes, lewisDesdeEsqueleto } from './lewis';
import { esqueletoAutomatico, hill, parseFormula, parseSmiles, separarCarga } from './parser';
import { ResultadoTEV, analizarTEV } from './tev';
import type { OpcionesTEV } from './tev';
import type { Estructura } from './tipos';
import { grado } from './tipos';

export interface Analisis {
  entrada: string;
  nombre: string;
  formula: string;
  categoria?: string;
  estructura: Estructura;
  resonancia: Estructura[];
  ordenMedio: number[];
  electronesValencia: number;
  carga: number;
  /** Átomos que se analizan en la animación (centros), en orden. */
  centros: number[];
  tev: ResultadoTEV;
  geometria: Geometria;
  /** Polaridad final: μ experimental si la especie está en la tabla, si no la estimación 3D. */
  polaridad: Polaridad;
  /** Id de la biblioteca (si procede). */
  id?: string;
  notas: string[];
}
export type Resolucion =
  | { tipo: 'ok'; estructura: Estructura; nombre: string; formula: string; categoria?: string; id?: string }
  | { tipo: 'ambiguo'; opciones: EntradaBiblioteca[]; formula: string };

const PATRON_FORMULA = /^([A-Z][a-z]?\d*|\(|\)\d*|\[|\]\d*)+$/;
const DIATOMICOS = new Set(['H', 'N', 'O', 'F', 'Cl', 'Br', 'I']);

function formulaDeEstructura(est: Estructura): string {
  const cuenta = new Map<string, number>();
  est.atomos.forEach((a) => cuenta.set(a.el.simbolo, (cuenta.get(a.el.simbolo) ?? 0) + 1));
  return formulaUnicode(hill([...cuenta].map(([simbolo, n]) => ({ simbolo, n })), est.cargaTotal).replace(/\^([+-])(\d+)/, (_, s, n) => `^${n === '1' ? '' : n}${s}`));
}

function desdeEntrada(e: EntradaBiblioteca, minimizar = true): Resolucion {
  if (e.smiles) {
    const est = parseSmiles(e.smiles);
    return { tipo: 'ok', estructura: est, nombre: e.nombre, formula: etiquetaFormula(e), categoria: e.categoria, id: e.id };
  }
  const p = separarCarga(e.formula);
  const sk = esqueletoAutomatico(parseFormula(p.cuerpo), p.carga);
  if (!sk) throw new ErrorQuimica(`No he podido deducir el esqueleto de ${e.formula}.`);
  return { tipo: 'ok', estructura: lewisDesdeEsqueleto(sk, { minimizarCargas: minimizar }), nombre: e.nombre, formula: etiquetaFormula(e), categoria: e.categoria, id: e.id };
}

/** Interpreta lo que ha escrito el usuario: nombre, fórmula (con carga) o SMILES. */
export function resolverEntrada(texto: string, minimizar = true): Resolucion {
  const t = texto.trim();
  if (!t) throw new ErrorQuimica('Escribe una molécula o ion: por ejemplo «agua», «SF4», «SO4^2-» o un SMILES como CCO.');
  const exacto = buscarExacto(t);
  if (exacto) return desdeEntrada(exacto, minimizar);

  const p = separarCarga(t);
  let conteo: ReturnType<typeof parseFormula> | null = null;
  if (PATRON_FORMULA.test(p.cuerpo)) {
    try {
      conteo = parseFormula(p.cuerpo); // lanza error didáctico si hay metal de transición
    } catch (e) {
      if (!(e instanceof ErrorQuimica) || e.codigo !== "sintaxis") throw e; // si no es fórmula, se prueba como SMILES
    }
  }
  if (conteo) {
    const clave = hill(conteo, p.carga);
    const iso = isomeros(clave);
    if (iso.length > 1) return { tipo: 'ambiguo', opciones: iso, formula: formulaUnicode(clave) };
    if (iso.length === 1 && iso[0].smiles) return desdeEntrada(iso[0], minimizar);
    const unico = conteo.length === 1 ? conteo[0] : null;
    const permitido = !unico || unico.n >= 2 && (unico.n === 2 ? DIATOMICOS.has(unico.simbolo) : unico.n === 3 && (unico.simbolo === 'O' || unico.simbolo === 'I'));
    const sk = permitido ? esqueletoAutomatico(conteo, p.carga) : null;
    if (sk) {
      const est = lewisDesdeEsqueleto(sk, { minimizarCargas: minimizar });
      return { tipo: 'ok', estructura: est, nombre: p.cuerpo, formula: formulaDeEstructura(est) };
    }
    if (iso.length === 1) return desdeEntrada(iso[0], minimizar);
  }
  // SMILES
  if (!/[\s^]/.test(t) || /[=#()[\]]/.test(t)) {
    try {
      const est = parseSmiles(t);
      return { tipo: 'ok', estructura: est, nombre: `SMILES ${t}`, formula: formulaDeEstructura(est) };
    } catch (e) {
      if (!(e instanceof ErrorQuimica)) throw e;
      if (/[=#()[\]]/.test(t)) throw e; // claramente un SMILES con error
    }
  }
  const sug = sugerir(t, 5);
  throw new ErrorQuimica(
    `No reconozco «${t}». Prueba con el nombre en español (agua, benceno, ion sulfato), una fórmula (SF4, NH4+, SO4^2-) o un SMILES (CCO).`,
    sug.map((s) => s.nombre),
  );
}

export function analizarEstructura(
  est: Estructura, nombre: string, formula: string, opciones: OpcionesTEV, categoria?: string, entrada = '', id?: string,
): Analisis {
  if (est.atomos.length < 2) throw new ErrorQuimica('Hacen falta al menos dos átomos para hablar de enlace. Prueba con una molécula o un ion poliatómico.');
  const resonancia = formasResonantes(est);
  const ordenMedio = est.enlaces.map((_, k) => resonancia.reduce((s, f) => s + f.enlaces[k].orden, 0) / resonancia.length);
  const tev = analizarTEV(est, resonancia, opciones);
  const geometria = generarGeometria(est, ordenMedio);
  let centros = est.atomos.map((a, i) => (a.el.simbolo !== 'H' && grado(est, i) >= 2 ? i : -1)).filter((i) => i >= 0);
  if (!centros.length) centros = est.atomos.map((a, i) => (a.el.simbolo !== 'H' ? i : -1)).filter((i) => i >= 0);
  if (!centros.length) centros = [0];
  // Primero el átomo de mayor número de vecinos
  centros.sort((a, b) => grado(est, b) - grado(est, a) || a - b);
  const notas = [...tev.notas];
  return {
    entrada, nombre, formula, categoria, estructura: est, resonancia, ordenMedio,
    electronesValencia: est.atomos.reduce((s, a) => s + a.el.valencia, 0) - est.cargaTotal,
    carga: est.cargaTotal, centros, tev, geometria, polaridad: calcularPolaridad(id, geometria.dipolo), id, notas,
  };
}

export const OPCIONES_POR_DEFECTO: OpcionesTEV = { hibridarTerminales: false, convenio: 'cargas' };

const piTotal = (e: Estructura) => e.enlaces.reduce((s, x) => s + Math.round(x.orden) - 1, 0);

/** Análisis completo; si la fórmula es ambigua devuelve las opciones para que el usuario elija. */
export function analizar(texto: string, opciones: OpcionesTEV = OPCIONES_POR_DEFECTO):
  | { tipo: 'ok'; analisis: Analisis }
  | { tipo: 'ambiguo'; opciones: EntradaBiblioteca[]; formula: string } {
  const minimizar = opciones.convenio !== 'octeto';
  const r = resolverEntrada(texto, minimizar);
  if (r.tipo === 'ambiguo') return r;
  const an = analizarEstructura(r.estructura, r.nombre, r.formula, opciones, r.categoria, texto, r.id);
  // Nota sobre la otra convención de Lewis, si cambia el número de π
  try {
    const r2 = resolverEntrada(texto, !minimizar);
    if (r2.tipo === 'ok' && piTotal(r2.estructura) !== piTotal(r.estructura)) {
      const alt = analizarEstructura(r2.estructura, r2.nombre, r2.formula, opciones, r2.categoria, texto, r2.id);
      const c = an.centros[0];
      const pa = an.tev.atomos[c], pb = alt.tev.atomos[alt.centros[0]];
      const prom = (x: typeof pa) => x.promociones.map((p) => p.texto).join('; ') || 'sin promoción';
      const nota = minimizar
        ? `Convenio de Lewis: aquí se minimizan las cargas formales (octeto expandido, con orbitales d). Otros libros respetan el octeto (con cargas formales): ${alt.tev.pi} π en lugar de ${an.tev.pi} y promoción «${prom(pb)}». La hibridación (${pa.hibridacion?.tipo ?? 'p'}) y la geometría no cambian; solo cambian el número de π y la promoción.`
        : `Convenio de Lewis: aquí se respeta el octeto (con cargas formales). Otros libros minimizan las cargas formales con octeto expandido: ${alt.tev.pi} π en lugar de ${an.tev.pi} y promoción «${prom(pb)}». La hibridación (${pa.hibridacion?.tipo ?? 'p'}) y la geometría no cambian; solo cambian el número de π y la promoción.`;
      an.tev.notas.push(nota);
      an.notas.push(nota);
    }
  } catch { /* sin alternativa */ }
  return { tipo: 'ok', analisis: an };
}

export { BIBLIOTECA, ELEMENTOS, claveHill, plano };
