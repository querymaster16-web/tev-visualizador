/**
 * Biblioteca de especies. Para añadir una molécula basta con una línea nueva en `DATOS`:
 *   [categoría, nombre, fórmula ASCII (con ^carga si es ion), SMILES opcional, alias opcionales]
 * Sin SMILES, el esqueleto se deduce solo (un átomo central, oxoácidos…) y Lewis lo calcula el algoritmo.
 * Con SMILES, se usan los órdenes de enlace y cargas escritos (moléculas orgánicas o de varios centros).
 */
export type Categoria = 'AXₙ simples' | 'Octeto expandido' | 'Iones' | 'Oxoácidos' | 'Orgánicas' | 'Radicales' | 'Casos especiales';

export interface EntradaBiblioteca {
  id: string;
  categoria: Categoria;
  nombre: string;
  formula: string;
  smiles?: string;
  alias: string[];
}

const S = 'AXₙ simples', E = 'Octeto expandido', I = 'Iones', O = 'Oxoácidos', G = 'Orgánicas', R = 'Radicales', X = 'Casos especiales';
type Fila = [Categoria, string, string, (string | null)?, string?];

const DATOS: Fila[] = [
  // AXₙ simples
  [S, 'Metano', 'CH4'], [S, 'Amoniaco', 'NH3', null, 'azano'], [S, 'Agua', 'H2O', null, 'oxidano'],
  [S, 'Fluoruro de hidrógeno', 'HF', null, 'fluorano,acido fluorhidrico'], [S, 'Cloruro de hidrógeno', 'HCl', null, 'acido clorhidrico'],
  [S, 'Sulfuro de hidrógeno', 'H2S', null, 'acido sulfhidrico'], [S, 'Fosfina', 'PH3', null, 'fosfano'], [S, 'Arsina', 'AsH3', null, 'arsano'], [S, 'Cloruro de tionilo', 'SOCl2', null, 'dicloruro de azufre y oxigeno'],
  [S, 'Dicloruro de berilio', 'BeCl2', null, 'cloruro de berilio'], [S, 'Hidruro de berilio', 'BeH2'],
  [S, 'Trifluoruro de boro', 'BF3'], [S, 'Tricloruro de boro', 'BCl3'], [S, 'Borano', 'BH3'],
  [S, 'Tricloruro de aluminio', 'AlCl3'], [S, 'Dióxido de carbono', 'CO2', null, 'anhidrido carbonico'],
  [S, 'Disulfuro de carbono', 'CS2'], [S, 'Tetracloruro de carbono', 'CCl4'], [S, 'Triclorometano', 'CHCl3', null, 'cloroformo'],
  [S, 'Diclorometano', 'CH2Cl2'], [S, 'Clorometano', 'CH3Cl'], [S, 'Silano', 'SiH4'], [S, 'Tetrafluoruro de silicio', 'SiF4'],
  [S, 'Seleniuro de hidrógeno', 'H2Se'], [S, 'Difluoruro de oxígeno', 'OF2'], [S, 'Trifluoruro de nitrógeno', 'NF3'],
  [S, 'Tricloruro de fósforo', 'PCl3'], [S, 'Dicloruro de azufre', 'SCl2'], [S, 'Dióxido de azufre', 'SO2'],
  [S, 'Trióxido de azufre', 'SO3'], [S, 'Cianuro de hidrógeno', 'HCN', null, 'acido cianhidrico'], [S, 'Metanal', 'H2CO', null, 'formaldehido,CH2O'],
  // Octeto expandido
  [E, 'Pentacloruro de fósforo', 'PCl5'], [E, 'Pentafluoruro de fósforo', 'PF5'], [E, 'Tetrafluoruro de azufre', 'SF4'],
  [E, 'Hexafluoruro de azufre', 'SF6'], [E, 'Trifluoruro de cloro', 'ClF3'], [E, 'Pentafluoruro de cloro', 'ClF5'],
  [E, 'Trifluoruro de bromo', 'BrF3'], [E, 'Pentafluoruro de bromo', 'BrF5'], [E, 'Pentafluoruro de yodo', 'IF5'],
  [E, 'Heptafluoruro de yodo', 'IF7'], [E, 'Difluoruro de xenón', 'XeF2'], [E, 'Tetrafluoruro de xenón', 'XeF4'],
  [E, 'Hexafluoruro de xenón', 'XeF6'], [E, 'Tetrafluoruro de selenio', 'SeF4'], [E, 'Hexafluoruro de selenio', 'SeF6'],
  [E, 'Pentafluoruro de arsénico', 'AsF5'], [E, 'Trióxido de xenón', 'XeO3'], [E, 'Oxitetrafluoruro de xenón', 'XeOF4'], [E, 'Tetraóxido de xenón', 'XeO4'],
  // Iones
  [I, 'Ion amonio', 'NH4^+', null, 'amonio'], [I, 'Ion hidronio', 'H3O^+', null, 'oxonio,hidronio'], [I, 'Ion tetrafluoroborato', 'BF4^-', null, 'tetrafluoroborato'],
  [I, 'Ion tetracloroaluminato', 'AlCl4^-'], [I, 'Ion carbonato', 'CO3^2-', null, 'carbonato'], [I, 'Ion nitrato', 'NO3^-', null, 'nitrato'],
  [I, 'Ion nitrito', 'NO2^-', null, 'nitrito'], [I, 'Ion nitronio', 'NO2^+', null, 'nitronio'], [I, 'Ion sulfato', 'SO4^2-', null, 'sulfato'],
  [I, 'Ion sulfito', 'SO3^2-', null, 'sulfito'], [I, 'Ion fosfato', 'PO4^3-', null, 'fosfato'], [I, 'Ion perclorato', 'ClO4^-', null, 'perclorato'],
  [I, 'Ion clorato', 'ClO3^-', null, 'clorato'], [I, 'Ion clorito', 'ClO2^-', null, 'clorito'], [I, 'Ion hipoclorito', 'ClO^-', null, 'hipoclorito'],
  [I, 'Ion tetracloroyodato', 'ICl4^-', null, 'tetracloroyodato'], [I, 'Ion diclorroyodato', 'ICl2^-'], [I, 'Ion triyoduro', 'I3^-', null, 'triyoduro'],
  [I, 'Ion tetrafluorobromato', 'BrF4^-'], [I, 'Ion hexafluorofosfato', 'PF6^-'], [I, 'Ion hexafluorosilicato', 'SiF6^2-'],
  [I, 'Ion tetracloruro de fósforo(+)', 'PCl4^+'], [I, 'Ion cianuro', 'CN^-', null, 'cianuro'], [I, 'Ion hidróxido', 'OH^-', null, 'hidroxido,oxhidrilo'],
  [I, 'Ion amiduro', 'NH2^-', null, 'amiduro'], [I, 'Ion tiocianato', 'SCN^-', null, 'tiocianato'], [I, 'Ion nitrosilo', 'NO^+'],
  [I, 'Ion hidrogenocarbonato', 'HCO3^-', 'OC(=O)[O-]', 'bicarbonato'], [I, 'Ion acetato', 'CH3COO^-', 'CC(=O)[O-]', 'acetato,etanoato'],
  [I, 'Ion azida', 'N3^-', '[N-]=[N+]=[N-]', 'azida'], [I, 'Ion peróxido', 'O2^2-', '[O-][O-]', 'peroxido'],
  // Oxoácidos
  [O, 'Ácido sulfúrico', 'H2SO4'], [O, 'Ácido nítrico', 'HNO3'], [O, 'Ácido fosfórico', 'H3PO4'], [O, 'Ácido perclórico', 'HClO4'],
  [O, 'Ácido sulfuroso', 'H2SO3'], [O, 'Ácido nitroso', 'HNO2'], [O, 'Ácido hipocloroso', 'HClO'], [O, 'Ácido clórico', 'HClO3'],
  [O, 'Ácido cloroso', 'HClO2'], [O, 'Ácido bórico', 'H3BO3'], [O, 'Ácido carbónico', 'H2CO3', 'OC(=O)O'],
  // Orgánicas
  [G, 'Etano', 'C2H6', 'CC'], [G, 'Eteno', 'C2H4', 'C=C', 'etileno'], [G, 'Etino', 'C2H2', 'C#C', 'acetileno'],
  [G, 'Benceno', 'C6H6', 'c1ccccc1'], [G, 'Metanol', 'CH3OH', 'CO', 'alcohol metilico'], [G, 'Etanol', 'C2H5OH', 'CCO', 'alcohol etilico,CH3CH2OH'],
  [G, 'Ácido etanoico', 'CH3COOH', 'CC(=O)O', 'acido acetico,etanoico'], [G, 'Ácido metanoico', 'HCOOH', 'C(=O)O', 'acido formico,metanoico'],
  [G, 'Propano', 'C3H8', 'CCC'], [G, 'Butano', 'C4H10', 'CCCC'], [G, 'Propeno', 'C3H6', 'C=CC', 'propileno'], [G, 'Propino', 'C3H4', 'C#CC'],
  [G, 'Etanal', 'CH3CHO', 'CC=O', 'acetaldehido'], [G, 'Propanona', 'C3H6O', 'CC(=O)C', 'acetona'], [G, 'Metanoamina', 'CH3NH2', 'CN', 'metilamina'],
  [G, 'Etanonitrilo', 'CH3CN', 'CC#N', 'acetonitrilo'], [G, 'Ciclohexano', 'C6H12', 'C1CCCCC1'], [G, 'Urea', 'CH4N2O', 'NC(=O)N', 'carbamida'],
  [G, 'Éter dimetílico', 'CH3OCH3', 'COC', 'metoximetano,dimetil eter'], [G, 'Fenol', 'C6H5OH', 'Oc1ccccc1'], [G, 'Ácido benzoico', 'C6H5COOH', 'OC(=O)c1ccccc1'],
  [G, 'Tolueno', 'C7H8', 'Cc1ccccc1', 'metilbenceno'], [G, '1,3-Butadieno', 'C4H6', 'C=CC=C', 'butadieno'], [G, 'Etanamida', 'CH3CONH2', 'CC(N)=O', 'acetamida'],
  [G, 'Anilina', 'C6H5NH2', 'Nc1ccccc1', 'fenilamina'],
  // Radicales
  [R, 'Monóxido de nitrógeno', 'NO', null, 'oxido nitrico,oxido de nitrogeno(II)'], [R, 'Dióxido de nitrógeno', 'NO2'],
  [R, 'Dióxido de cloro', 'ClO2'], [R, 'Radical hidroxilo', 'OH', '[OH]', 'hidroxilo'], [R, 'Radical metilo', 'CH3', '[CH3]', 'metilo'],
  // Casos especiales
  [X, 'Oxígeno', 'O2', null, 'dioxigeno,oxigeno molecular'], [X, 'Nitrógeno', 'N2', null, 'dinitrogeno,nitrogeno molecular'], [X, 'Ozono', 'O3'],
  [X, 'Monóxido de carbono', 'CO'], [X, 'Peróxido de hidrógeno', 'H2O2', 'OO', 'agua oxigenada'], [X, 'Hidracina', 'N2H4', 'NN', 'diazano'],
  [X, 'Óxido de dinitrógeno', 'N2O', 'N#[N+][O-]', 'oxido nitroso,protoxido de nitrogeno'], [X, 'Hidrógeno', 'H2', null, 'dihidrogeno'],
  [X, 'Flúor', 'F2', null, 'difluor'], [X, 'Cloro', 'Cl2', null, 'dicloro'], [X, 'Ozono (O₃)', 'O3', null, 'trioxigeno'],
];

import { formulaUnicode, plano } from './formato';
import { hill, parseFormula, separarCarga } from './parser';

export const BIBLIOTECA: EntradaBiblioteca[] = [];
const vistos = new Set<string>();
for (const [categoria, nombre, formula, smiles, alias] of DATOS) {
  const id = formula + (vistos.has(formula) ? '_2' : '');
  if (vistos.has(formula)) continue; // evita duplicados (p. ej. ozono)
  vistos.add(formula);
  BIBLIOTECA.push({ id, categoria, nombre, formula, smiles: smiles ?? undefined, alias: alias ? alias.split(',') : [] });
}

export const CATEGORIAS: Categoria[] = ['AXₙ simples', 'Octeto expandido', 'Iones', 'Oxoácidos', 'Orgánicas', 'Radicales', 'Casos especiales'];

export const etiquetaFormula = (e: EntradaBiblioteca) => formulaUnicode(e.formula);

/** Clave de Hill + carga de una entrada (para encontrar isómeros). */
export function claveHill(e: EntradaBiblioteca): string {
  const p = separarCarga(e.formula);
  return hill(parseFormula(p.cuerpo), p.carga);
}

const indice = new Map<string, EntradaBiblioteca>();
for (const e of BIBLIOTECA) {
  for (const k of [e.nombre, e.formula, ...e.alias, formulaUnicode(e.formula), e.formula.replace('^', '')]) indice.set(plano(k), e);
  // «ion sulfato» → también «sulfato»
  indice.set(plano(e.nombre.replace(/^ion /i, '')), e);
}

export function buscarExacto(texto: string): EntradaBiblioteca | undefined {
  return indice.get(plano(texto));
}

/** Autocompletado: coincidencia por inicio de palabra en nombre, alias o fórmula. */
export function sugerir(texto: string, max = 8): EntradaBiblioteca[] {
  const q = plano(texto);
  if (!q) return [];
  const puntuar = (e: EntradaBiblioteca) => {
    const claves = [e.nombre, e.formula, ...e.alias].map(plano);
    let mejor = 99;
    for (const c of claves) {
      if (c === q) mejor = Math.min(mejor, 0);
      else if (c.startsWith(q)) mejor = Math.min(mejor, 1);
      else if (c.split(' ').some((w) => w.startsWith(q))) mejor = Math.min(mejor, 2);
      else if (c.includes(q)) mejor = Math.min(mejor, 3);
    }
    return mejor;
  };
  return BIBLIOTECA.map((e) => ({ e, p: puntuar(e) }))
    .filter((x) => x.p < 99)
    .sort((a, b) => a.p - b.p || a.e.nombre.localeCompare(b.e.nombre))
    .slice(0, max)
    .map((x) => x.e);
}

/** Entradas con la misma fórmula molecular y carga (isómeros). */
export function isomeros(clave: string): EntradaBiblioteca[] {
  return BIBLIOTECA.filter((e) => claveHill(e) === clave);
}
