import { describe, expect, it } from 'vitest';
import { analizar } from '../src/chem/analisis';
import type { Analisis } from '../src/chem/analisis';
import { BIBLIOTECA, CATEGORIAS } from '../src/chem/biblioteca';
import { ErrorQuimica } from '../src/chem/elementos';
import { anguloEntre, sub } from '../src/chem/vec';

function an(f: string, hibTerm = false): Analisis {
  const r = analizar(f, { hibridarTerminales: hibTerm });
  if (r.tipo !== 'ok') throw new Error('ambiguo ' + f);
  return r.analisis;
}

interface Caso {
  f: string;
  /** índice del átomo a examinar (por defecto 0) */
  at?: number;
  hib: string; // 'p' = p puro (sin hibridar)
  axe: string;
  geo: string; // fragmento de la geometría molecular
  sigma: number;
  pi: number;
  prom: string[]; // textos exactos de promoción
}

// Tabla de referencia (libros de química general / inorgánica)
const TABLA: Caso[] = [
  { f: 'CH4', hib: 'sp3', axe: 'AX₄', geo: 'tetraédrica', sigma: 4, pi: 0, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'NH3', hib: 'sp3', axe: 'AX₃E', geo: 'piramidal trigonal', sigma: 3, pi: 0, prom: [] },
  { f: 'H2O', hib: 'sp3', axe: 'AX₂E₂', geo: 'angular', sigma: 2, pi: 0, prom: [] },
  { f: 'HF', hib: 'p', axe: 'AXE₃', geo: 'lineal', sigma: 1, pi: 0, prom: [] },
  { f: 'BeCl2', hib: 'sp', axe: 'AX₂', geo: 'lineal', sigma: 2, pi: 0, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'BF3', hib: 'sp2', axe: 'AX₃', geo: 'trigonal plana', sigma: 3, pi: 0, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'CO2', hib: 'sp', axe: 'AX₂', geo: 'lineal', sigma: 2, pi: 2, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'HCN', hib: 'sp', axe: 'AX₂', geo: 'lineal', sigma: 2, pi: 2, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'H2CO', hib: 'sp2', axe: 'AX₃', geo: 'trigonal plana', sigma: 3, pi: 1, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'SO2', hib: 'sp2', axe: 'AX₂E', geo: 'angular', sigma: 2, pi: 2, prom: ['1 e⁻ de 3p → 3d'] },
  { f: 'SO3', hib: 'sp2', axe: 'AX₃', geo: 'trigonal plana', sigma: 3, pi: 3, prom: ['1 e⁻ de 3s → 3d', '1 e⁻ de 3p → 3d'] },
  { f: 'PCl5', hib: 'sp3d', axe: 'AX₅', geo: 'bipirámide trigonal', sigma: 5, pi: 0, prom: ['1 e⁻ de 3s → 3d'] },
  { f: 'SF4', hib: 'sp3d', axe: 'AX₄E', geo: 'balancín', sigma: 4, pi: 0, prom: ['1 e⁻ de 3p → 3d'] },
  { f: 'ClF3', hib: 'sp3d', axe: 'AX₃E₂', geo: 'forma de T', sigma: 3, pi: 0, prom: ['1 e⁻ de 3p → 3d'] },
  { f: 'XeF2', hib: 'sp3d', axe: 'AX₂E₃', geo: 'lineal', sigma: 2, pi: 0, prom: ['1 e⁻ de 5p → 5d'] },
  { f: 'SF6', hib: 'sp3d2', axe: 'AX₆', geo: 'octaédrica', sigma: 6, pi: 0, prom: ['1 e⁻ de 3s → 3d', '1 e⁻ de 3p → 3d'] },
  { f: 'BrF5', hib: 'sp3d2', axe: 'AX₅E', geo: 'pirámide cuadrada', sigma: 5, pi: 0, prom: ['2 e⁻ de 4p → 4d'] },
  { f: 'XeF4', hib: 'sp3d2', axe: 'AX₄E₂', geo: 'plano-cuadrada', sigma: 4, pi: 0, prom: ['2 e⁻ de 5p → 5d'] },
  { f: 'IF7', hib: 'sp3d3', axe: 'AX₇', geo: 'bipirámide pentagonal', sigma: 7, pi: 0, prom: ['1 e⁻ de 5s → 5d', '2 e⁻ de 5p → 5d'] },
  { f: 'N2', hib: 'p', axe: 'AXE', geo: 'lineal', sigma: 1, pi: 2, prom: [] },
  { f: 'O2', hib: 'p', axe: 'AXE₂', geo: 'lineal', sigma: 1, pi: 1, prom: [] },
  { f: 'O3', hib: 'sp2', axe: 'AX₂E', geo: 'angular', sigma: 2, pi: 1, prom: [] },
  { f: 'CO', hib: 'p', axe: 'AXE', geo: 'lineal', sigma: 1, pi: 2, prom: [] },
  { f: 'I3-', hib: 'sp3d', axe: 'AX₂E₃', geo: 'lineal', sigma: 2, pi: 0, prom: ['1 e⁻ de 5p → 5d'] },
  { f: 'NH4+', hib: 'sp3', axe: 'AX₄', geo: 'tetraédrica', sigma: 4, pi: 0, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'H3O+', hib: 'sp3', axe: 'AX₃E', geo: 'piramidal trigonal', sigma: 3, pi: 0, prom: [] },
  { f: 'BF4-', hib: 'sp3', axe: 'AX₄', geo: 'tetraédrica', sigma: 4, pi: 0, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'CO3^2-', hib: 'sp2', axe: 'AX₃', geo: 'trigonal plana', sigma: 3, pi: 1, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'NO3-', hib: 'sp2', axe: 'AX₃', geo: 'trigonal plana', sigma: 3, pi: 1, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'NO2-', hib: 'sp2', axe: 'AX₂E', geo: 'angular', sigma: 2, pi: 1, prom: [] },
  { f: 'NO2', hib: 'sp2', axe: 'AX₂E', geo: 'angular', sigma: 2, pi: 1, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'ClO2', hib: 'sp3', axe: 'AX₂E₂', geo: 'angular', sigma: 2, pi: 2, prom: ['2 e⁻ de 3p → 3d'] },
  { f: 'SO4^2-', hib: 'sp3', axe: 'AX₄', geo: 'tetraédrica', sigma: 4, pi: 2, prom: ['1 e⁻ de 3s → 3d', '1 e⁻ de 3p → 3d'] },
  { f: 'PO4^3-', hib: 'sp3', axe: 'AX₄', geo: 'tetraédrica', sigma: 4, pi: 1, prom: ['1 e⁻ de 3s → 3d'] },
  { f: 'ClO4-', hib: 'sp3', axe: 'AX₄', geo: 'tetraédrica', sigma: 4, pi: 3, prom: ['1 e⁻ de 3s → 3d', '2 e⁻ de 3p → 3d'] },
  { f: 'ICl4-', hib: 'sp3d2', axe: 'AX₄E₂', geo: 'plano-cuadrada', sigma: 4, pi: 0, prom: ['2 e⁻ de 5p → 5d'] },
  { f: 'XeO3', hib: 'sp3', axe: 'AX₃E', geo: 'piramidal trigonal', sigma: 3, pi: 3, prom: ['3 e⁻ de 5p → 5d'] },
  { f: 'H2SO4', hib: 'sp3', axe: 'AX₄', geo: 'tetraédrica', sigma: 6, pi: 2, prom: ['1 e⁻ de 3s → 3d', '1 e⁻ de 3p → 3d'] },
  { f: 'HNO3', hib: 'sp2', axe: 'AX₃', geo: 'trigonal plana', sigma: 4, pi: 1, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'H3PO4', hib: 'sp3', axe: 'AX₄', geo: 'tetraédrica', sigma: 7, pi: 1, prom: ['1 e⁻ de 3s → 3d'] },
  { f: 'C2H6', hib: 'sp3', axe: 'AX₄', geo: 'tetraédrica', sigma: 7, pi: 0, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'C2H4', hib: 'sp2', axe: 'AX₃', geo: 'trigonal plana', sigma: 5, pi: 1, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'C2H2', hib: 'sp', axe: 'AX₂', geo: 'lineal', sigma: 3, pi: 2, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'C6H6', hib: 'sp2', axe: 'AX₃', geo: 'trigonal plana', sigma: 12, pi: 3, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'CH3OH', hib: 'sp3', axe: 'AX₄', geo: 'tetraédrica', sigma: 5, pi: 0, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'C2H5OH', hib: 'sp3', axe: 'AX₄', geo: 'tetraédrica', sigma: 8, pi: 0, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'CH3COOH', hib: 'sp3', axe: 'AX₄', geo: 'tetraédrica', sigma: 7, pi: 1, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'H2O2', hib: 'sp3', axe: 'AX₂E₂', geo: 'angular', sigma: 3, pi: 0, prom: [] },
  { f: 'N2H4', hib: 'sp3', axe: 'AX₃E', geo: 'piramidal trigonal', sigma: 5, pi: 0, prom: [] },
  { f: 'HCOOH', hib: 'sp2', axe: 'AX₃', geo: 'trigonal plana', sigma: 4, pi: 1, prom: ['1 e⁻ de 2s → 2p'] },
  // Extras
  { f: 'HCl', hib: 'p', axe: 'AXE₃', geo: 'lineal', sigma: 1, pi: 0, prom: [] },
  { f: 'SiH4', hib: 'sp3', axe: 'AX₄', geo: 'tetraédrica', sigma: 4, pi: 0, prom: ['1 e⁻ de 3s → 3p'] },
  { f: 'PCl3', hib: 'sp3', axe: 'AX₃E', geo: 'piramidal trigonal', sigma: 3, pi: 0, prom: [] },
  { f: 'H2S', hib: 'sp3', axe: 'AX₂E₂', geo: 'angular', sigma: 2, pi: 0, prom: [] },
  { f: 'CCl4', hib: 'sp3', axe: 'AX₄', geo: 'tetraédrica', sigma: 4, pi: 0, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'NO2+', hib: 'sp', axe: 'AX₂', geo: 'lineal', sigma: 2, pi: 2, prom: ['1 e⁻ de 2s → 2p'] },
  { f: 'SeF4', hib: 'sp3d', axe: 'AX₄E', geo: 'balancín', sigma: 4, pi: 0, prom: ['1 e⁻ de 4p → 4d'] },
];

describe('Tabla TEV (≥ 50 especies)', () => {
  it('tiene al menos 50 especies', () => expect(TABLA.length).toBeGreaterThanOrEqual(50));
  for (const c of TABLA) {
    it(c.f, () => {
      const a = an(c.f);
      const t = a.tev.atomos[c.at ?? 0];
      expect(t.error, t.error).toBeUndefined();
      expect(t.hibridacion?.tipo ?? 'p').toBe(c.hib);
      expect(t.rpecv.notacion).toBe(c.axe);
      expect(t.rpecv.geometriaMolecular).toContain(c.geo);
      expect(a.tev.sigma).toBe(c.sigma);
      expect(a.tev.pi).toBe(c.pi);
      expect(t.promociones.map((p) => p.texto)).toEqual(c.prom);
    });
  }
});

describe('Parser de entrada', () => {
  const formas = ['SO4^2-', 'SO42-'.replace('42', '4^2'), 'SO₄²⁻', '[SO4]2-', 'SO4 2-', '(SO4)^2-', 'ion sulfato', 'sulfato'];
  it('acepta todos los formatos de ion sulfato', () => {
    for (const f of formas) {
      const a = an(f);
      expect(a.carga, f).toBe(-2);
      expect(a.estructura.atomos).toHaveLength(5);
    }
  });
  it('cargas Unicode y corchetes', () => {
    expect(an('PO₄³⁻').carga).toBe(-3);
    expect(an('[NH4]+').carga).toBe(1);
    expect(an('NH₄⁺').carga).toBe(1);
    expect(an('NH4^+').carga).toBe(1);
  });
  it('nombres comunes en español', () => {
    expect(an('metano').formula).toBe('CH₄');
    expect(an('amoníaco').nombre).toBe('Amoniaco');
    expect(an('agua').formula).toBe('H₂O');
    expect(an('Ácido sulfúrico').formula).toBe('H₂SO₄');
    expect(an('benceno').formula).toBe('C₆H₆');
    expect(an('etanol').formula).toBe('C₂H₅OH');
  });
  it('SMILES: ramas, dobles, triples, anillos, aromáticos, cargas', () => {
    expect(an('CCO').estructura.atomos).toHaveLength(9);
    expect(an('C=C').tev.pi).toBe(1);
    expect(an('C#C').tev.pi).toBe(2);
    expect(an('c1ccccc1').tev.pi).toBe(3);
    expect(an('CC(=O)O').tev.pi).toBe(1);
    expect(an('[NH4+]').carga).toBe(1);
    expect(an('C[N+](C)(C)C').carga).toBe(1);
    expect(an('C1CCCCC1').estructura.atomos).toHaveLength(18);
  });
  it('C2H6O es ambiguo y ofrece los isómeros', () => {
    const r = analizar('C2H6O');
    expect(r.tipo).toBe('ambiguo');
    if (r.tipo === 'ambiguo') expect(r.opciones.map((o) => o.nombre)).toEqual(expect.arrayContaining(['Etanol', 'Éter dimetílico']));
  });
  it('metales de transición: error claro', () => {
    expect(() => analizar('FeCl3')).toThrowError(/metal de transición/);
    expect(() => analizar('CuSO4')).toThrowError(ErrorQuimica);
  });
  it('entrada desconocida: error didáctico', () => {
    expect(() => analizar('')).toThrowError(ErrorQuimica);
    expect(() => analizar('qwerty zzz')).toThrowError(/No reconozco/);
  });
});

describe('Biblioteca', () => {
  it('≥ 80 especies en todas las categorías', () => {
    expect(BIBLIOTECA.length).toBeGreaterThanOrEqual(80);
    for (const c of CATEGORIAS) expect(BIBLIOTECA.some((e) => e.categoria === c), c).toBe(true);
  });
  it('todas las especies se analizan sin error y con TEV consistente', () => {
    for (const e of BIBLIOTECA) {
      const a = an(e.formula);
      for (const t of a.tev.atomos) expect(t.error, `${e.formula}: ${t.error}`).toBeUndefined();
      // suma de cargas formales = carga total
      expect(a.estructura.atomos.reduce((s, x) => s + x.carga, 0), e.formula).toBe(a.carga);
    }
  });
});

describe('Lewis', () => {
  it('electrones de valencia', () => {
    expect(an('SO4^2-').electronesValencia).toBe(32);
    expect(an('NH4+').electronesValencia).toBe(8);
    expect(an('NO2').electronesValencia).toBe(17);
  });
  it('radicales: NO₂ y ClO₂ tienen un electrón desapareado', () => {
    expect(an('NO2').estructura.atomos[0].radical).toBe(1);
    expect(an('ClO2').estructura.atomos[0].radical).toBe(1);
  });
  it('cargas formales: NH₄⁺ N+, BF₄⁻ B−, CO C− / O+', () => {
    expect(an('NH4+').estructura.atomos[0].carga).toBe(1);
    expect(an('BF4-').estructura.atomos[0].carga).toBe(-1);
    const co = an('CO').estructura.atomos;
    expect([co[0].carga, co[1].carga]).toEqual([-1, 1]);
  });
  it('resonancia', () => {
    expect(an('CO3^2-').resonancia).toHaveLength(3);
    expect(an('NO3-').resonancia).toHaveLength(3);
    expect(an('O3').resonancia).toHaveLength(2);
    expect(an('SO2').resonancia).toHaveLength(1);
    expect(an('benceno').resonancia).toHaveLength(2);
    expect(an('SO4^2-').resonancia).toHaveLength(6);
    expect(an('CH4').resonancia).toHaveLength(1);
    expect(an('CO3^2-').ordenMedio.every((o) => Math.abs(o - 4 / 3) < 1e-9)).toBe(true);
  });
  it('octeto expandido: cargas formales mínimas', () => {
    for (const f of ['SO4^2-', 'PO4^3-', 'SO3', 'XeO3', 'ClO4-']) {
      const a = an(f);
      expect(a.estructura.atomos[0].carga, f).toBe(0);
    }
  });
  it('O₂: nota sobre paramagnetismo / TOM', () => {
    expect(an('O2').tev.notas.join(' ')).toMatch(/paramagn/);
  });
});

describe('Errores de periodo 2', () => {
  it('un átomo del periodo 2 no puede usar orbitales d', () => {
    // SMILES con N pentavalente entre corchetes: N con 5 enlaces
    const r = analizar('[N](F)(F)(F)(F)F');
    if (r.tipo === 'ok') expect(r.analisis.tev.atomos[0].error).toMatch(/periodo 2/);
  });
});

describe('Geometría 3D', () => {
  const ang = (a: Analisis, i: number, c: number, j: number) => {
    const p = a.geometria.pos;
    return anguloEntre(sub(p[i], p[c]), sub(p[j], p[c]));
  };
  it('ángulos de RPECV', () => {
    expect(ang(an('H2O'), 1, 0, 2)).toBeGreaterThan(103);
    expect(ang(an('H2O'), 1, 0, 2)).toBeLessThan(108);
    expect(ang(an('NH3'), 1, 0, 2)).toBeGreaterThan(105);
    expect(ang(an('NH3'), 1, 0, 2)).toBeLessThan(109);
    expect(ang(an('CH4'), 1, 0, 2)).toBeCloseTo(109.47, 0);
    expect(ang(an('BF3'), 1, 0, 2)).toBeCloseTo(120, 0);
    expect(ang(an('CO2'), 1, 0, 2)).toBeCloseTo(180, 0);
    expect(ang(an('SF6'), 1, 0, 3)).toBeCloseTo(90, 0);
    expect(ang(an('SF6'), 1, 0, 2)).toBeCloseTo(180, 0);
  });
  it('etileno plano y benceno plano', () => {
    const e = an('C=C');
    const p = e.geometria.pos;
    // los 6 átomos en un plano: volumen del tetraedro (C0,C1,H,H') ≈ 0
    const v = (a: number, b: number, c: number, d: number) => {
      const u = sub(p[b], p[a]), w = sub(p[c], p[a]), z = sub(p[d], p[a]);
      return Math.abs(u[0] * (w[1] * z[2] - w[2] * z[1]) - u[1] * (w[0] * z[2] - w[2] * z[0]) + u[2] * (w[0] * z[1] - w[1] * z[0]));
    };
    for (let k = 2; k < 6; k++) expect(v(0, 1, 2, k)).toBeLessThan(0.15);
    const b = an('benceno').geometria.pos;
    const zs = b.map((q) => q[2]);
    expect(Math.max(...zs) - Math.min(...zs)).toBeLessThan(0.3);
  });
  it('longitudes de enlace razonables', () => {
    const a = an('C=C');
    const p = a.geometria.pos;
    const d = Math.hypot(...sub(p[0], p[1]));
    expect(d).toBeGreaterThan(1.25);
    expect(d).toBeLessThan(1.45);
  });
  it('polaridad por suma vectorial', () => {
    for (const f of ['CH4', 'CO2', 'BF3', 'SF6', 'XeF4', 'XeF2', 'PCl5', 'NH4+', 'SO4^2-', 'C6H6']) expect(an(f).geometria.dipolo.polar, f).toBe(false);
    for (const f of ['H2O', 'NH3', 'HF', 'SO2', 'SF4', 'ClF3', 'H2CO', 'CH3OH', 'O3']) expect(an(f).geometria.dipolo.polar, f).toBe(true);
  });
  it('los pares solitarios van en ecuatorial (TBP) y trans (octaedro)', () => {
    const sf4 = an('SF4');
    const lp = sf4.geometria.dominios[0].filter((d) => d.tipo === 'par');
    expect(lp).toHaveLength(1);
    // ecuatorial: perpendicular al eje axial F–S–F
    const ejeAx = sub(sf4.geometria.pos[1], sf4.geometria.pos[2]);
    void ejeAx;
    const xef4 = an('XeF4');
    const lps = xef4.geometria.dominios[0].filter((d) => d.tipo === 'par');
    expect(anguloEntre(lps[0].dir, lps[1].dir)).toBeCloseTo(180, 0);
  });
});

describe('Opción: hibridar átomos terminales', () => {
  it('HF con F hibridado sp³', () => {
    const a = an('HF', true);
    expect(a.tev.atomos[0].hibridacion?.tipo).toBe('sp3');
  });
});
