import { describe, expect, it } from 'vitest';
import { analizar } from '../src/chem/analisis';
import type { Analisis } from '../src/chem/analisis';
import { BIBLIOTECA } from '../src/chem/biblioteca';
import { ELEMENTOS, nucleo } from '../src/chem/elementos';
import { validarAnalisis } from '../src/chem/validar';
import { anguloEntre, sub } from '../src/chem/vec';
import { vecinos } from '../src/chem/tipos';

const an = (f: string, convenio: 'cargas' | 'octeto' = 'cargas', hibTerm = false): Analisis => {
  const r = analizar(f, { hibridarTerminales: hibTerm, convenio });
  if (r.tipo !== 'ok') throw new Error('ambiguo ' + f);
  return r.analisis;
};
/** Ángulos (°) entre los vecinos del átomo `c`. */
const angulos = (a: Analisis, c: number): number[] => {
  const vs = vecinos(a.estructura, c).map((v) => v.j);
  const P = a.geometria.pos;
  const r: number[] = [];
  for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) r.push(anguloEntre(sub(P[vs[i]], P[c]), sub(P[vs[j]], P[c])));
  return r;
};

// ───────── 1. Octeto expandido: minimizar cargas formales por defecto ─────────
interface Fila { f: string; at?: number; hib: string; axe: string; geo: string; sigma: number; pi: number; prom: string[] }
const TABLA_EXPANDIDO: Fila[] = [
  { f: 'SO2', hib: 'sp2', axe: 'AX₂E', geo: 'angular', sigma: 2, pi: 2, prom: ['1 e⁻ de 3p → 3d'] },
  { f: 'SO3^2-', hib: 'sp3', axe: 'AX₃E', geo: 'piramidal trigonal', sigma: 3, pi: 1, prom: ['1 e⁻ de 3p → 3d'] },
  { f: 'SOCl2', hib: 'sp3', axe: 'AX₃E', geo: 'piramidal trigonal', sigma: 3, pi: 1, prom: ['1 e⁻ de 3p → 3d'] },
  { f: 'H2SO3', hib: 'sp3', axe: 'AX₃E', geo: 'piramidal trigonal', sigma: 3, pi: 1, prom: ['1 e⁻ de 3p → 3d'] },
  { f: 'ClO2-', hib: 'sp3', axe: 'AX₂E₂', geo: 'angular', sigma: 2, pi: 1, prom: ['1 e⁻ de 3p → 3d'] },
  { f: 'HClO2', hib: 'sp3', axe: 'AX₂E₂', geo: 'angular', sigma: 2, pi: 1, prom: ['1 e⁻ de 3p → 3d'] },
  { f: 'XeOF4', hib: 'sp3d2', axe: 'AX₅E', geo: 'pirámide cuadrada', sigma: 5, pi: 1, prom: ['3 e⁻ de 5p → 5d'] },
  { f: 'SO3', hib: 'sp2', axe: 'AX₃', geo: 'trigonal plana', sigma: 3, pi: 3, prom: ['1 e⁻ de 3s → 3d', '1 e⁻ de 3p → 3d'] },
  { f: 'SO4^2-', hib: 'sp3', axe: 'AX₄', geo: 'tetraédrica', sigma: 4, pi: 2, prom: ['1 e⁻ de 3s → 3d', '1 e⁻ de 3p → 3d'] },
  { f: 'ClO3-', hib: 'sp3', axe: 'AX₃E', geo: 'piramidal trigonal', sigma: 3, pi: 2, prom: ['2 e⁻ de 3p → 3d'] },
  { f: 'ClO4-', hib: 'sp3', axe: 'AX₄', geo: 'tetraédrica', sigma: 4, pi: 3, prom: ['1 e⁻ de 3s → 3d', '2 e⁻ de 3p → 3d'] },
  { f: 'XeO3', hib: 'sp3', axe: 'AX₃E', geo: 'piramidal trigonal', sigma: 3, pi: 3, prom: ['3 e⁻ de 5p → 5d'] },
  { f: 'PO4^3-', hib: 'sp3', axe: 'AX₄', geo: 'tetraédrica', sigma: 4, pi: 1, prom: ['1 e⁻ de 3s → 3d'] },
];
describe('Convenio de Lewis: minimizar cargas formales (por defecto)', () => {
  for (const c of TABLA_EXPANDIDO) {
    it(c.f, () => {
      const a = an(c.f);
      const t = a.tev.atomos[c.at ?? 0];
      expect(t.hibridacion?.tipo).toBe(c.hib);
      expect(t.rpecv.notacion).toBe(c.axe);
      expect(t.rpecv.geometriaMolecular).toContain(c.geo);
      expect(t.sigma, 'σ del átomo').toBe(c.sigma);
      expect(t.pi, 'π del átomo').toBe(c.pi);
      expect(t.promociones.map((p) => p.texto)).toEqual(c.prom);
      expect(a.estructura.atomos[c.at ?? 0].carga, 'carga formal del central').toBe(0);
    });
  }
  it('los átomos del periodo 2 nunca amplían el octeto (mismo resultado con ambos convenios)', () => {
    for (const f of ['O3', 'NO2-', 'NO3-', 'CO3^2-', 'HNO3', 'NO2', 'HCOOH', 'CH3COOH', 'H2CO3', 'NO2+']) {
      const x = an(f), y = an(f, 'octeto');
      expect(x.tev.pi, f).toBe(y.tev.pi);
      for (const t of x.tev.atomos) expect(t.hibridacion?.composicion.d ?? 0, f).toBe(0);
    }
  });
  it('SO2 con el convenio del octeto: S⁺, 1 π, sin promoción, y la nota explica la alternativa', () => {
    const a = an('SO2', 'octeto');
    expect(a.tev.atomos[0].pi).toBe(1);
    expect(a.tev.atomos[0].promociones).toEqual([]);
    expect(a.tev.atomos[0].hibridacion?.tipo).toBe('sp2');
    expect(a.estructura.atomos[0].carga).toBe(1);
    expect(a.tev.notas.join(' ')).toMatch(/Convenio de Lewis/);
    expect(an('SO2').tev.notas.join(' ')).toMatch(/Convenio de Lewis/);
  });
  it('la hibridación y la geometría no cambian con el convenio', () => {
    for (const f of ['SO2', 'SO3^2-', 'SOCl2', 'ClO2-', 'XeOF4', 'SO4^2-', 'ClO4-', 'XeO3', 'PO4^3-', 'H2SO4']) {
      const x = an(f).tev.atomos[0], y = an(f, 'octeto').tev.atomos[0];
      expect(y.rpecv.geometriaMolecular, f).toBe(x.rpecv.geometriaMolecular);
      expect(y.rpecv.notacion, f).toBe(x.rpecv.notacion);
    }
  });
});

// ───────── 2. Radicales de carbono planos ─────────
describe('Radicales', () => {
  it('CH₃·: plano sp², electrón en el p sin hibridar', () => {
    const a = an('CH3');
    const t = a.tev.atomos[0];
    expect(t.hibridacion?.tipo).toBe('sp2');
    expect(t.rpecv.notacion).toBe('AX₃');
    expect(t.rpecv.geometriaMolecular).toBe('trigonal plana');
    expect(t.hibridacion?.contenido.map((c) => c.tipo)).toEqual(['sigma', 'sigma', 'sigma']);
    expect(Object.values(t.roles).filter((r) => r.rol === 'radical')).toHaveLength(1);
    expect(t.roles['pz']?.rol).toBe('radical');
    expect(t.promociones.map((p) => p.texto)).toEqual(['1 e⁻ de 2s → 2p']);
    const ang = angulos(a, 0);
    ang.forEach((x) => expect(Math.abs(x - 120)).toBeLessThan(3));
  });
  it('NO₂ y ClO₂ mantienen el electrón como dominio', () => {
    const n = an('NO2').tev.atomos[0];
    expect([n.hibridacion?.tipo, n.rpecv.notacion]).toEqual(['sp2', 'AX₂E']);
    const c = an('ClO2').tev.atomos[0];
    expect([c.hibridacion?.tipo, c.rpecv.notacion]).toEqual(['sp3', 'AX₂E₂']);
    expect(Math.abs(angulos(an('NO2'), 0)[0] - 134)).toBeLessThan(3);
    expect(Math.abs(angulos(an('ClO2'), 0)[0] - 117.6)).toBeLessThan(3);
  });
});

// ───────── 3. Nitrógeno conjugado ─────────
describe('Nitrógeno conjugado sp² plano', () => {
  const casos: [string, number][] = [['CC(N)=O', 2], ['NC(=O)N', 0], ['NC(=O)N', 3], ['Nc1ccccc1', 0]];
  for (const [smi, n] of casos) {
    it(`${smi} · N${n + 1}`, () => {
      const a = an(smi);
      const t = a.tev.atomos[n];
      expect(a.estructura.atomos[n].el.simbolo).toBe('N');
      expect(t.hibridacion?.tipo).toBe('sp2');
      expect(t.rpecv.geometriaMolecular).toBe('trigonal plana');
      expect(t.rpecv.parConjugado).toBe(true);
      expect(t.notas.join(' ')).toMatch(/Nitrógeno conjugado/);
      // N plano: Σ ángulos ≈ 360°
      expect(Math.abs(angulos(a, n).reduce((s, x) => s + x, 0) - 360)).toBeLessThan(8);
      expect(t.roles['pz']?.rol ?? t.roles['py']?.rol).toBe('par');
    });
  }
  it('una amina alifática (metilamina) sigue siendo sp³ piramidal y los O–H se quedan sp³', () => {
    expect(an('CH3NH2').tev.atomos[1].hibridacion?.tipo).toBe('sp3');
    expect(an('CH3NH2').tev.atomos[1].rpecv.geometriaMolecular).toBe('piramidal trigonal');
    const fenol = an('Oc1ccccc1');
    expect(fenol.tev.atomos[0].hibridacion?.tipo).toBe('sp3');
    expect(an('CC(=O)O').tev.atomos[3].hibridacion?.tipo).toBe('sp3');
    expect(an('N2H4').tev.atomos[0].hibridacion?.tipo).toBe('sp3');
  });
});

// ───────── 4. Ángulos reales ─────────
describe('Ángulos reales experimentales', () => {
  const EXP: [string, number][] = [
    ['H2O', 104.5], ['NH3', 107], ['CH4', 109.5], ['NF3', 102], ['OF2', 103], ['SCl2', 103], ['H2S', 92], ['PH3', 93.5], ['H2Se', 91],
    ['AsH3', 92], ['SO2', 119], ['O3', 116.8], ['NO2', 134], ['NO2-', 115], ['ClO2', 117.6], ['SF4', 102], ['SF4', 173], ['ClF3', 87.5],
    ['BrF3', 86], ['BrF5', 85], ['IF5', 82], ['XeF4', 90], ['C2H4', 121.3],
  ];
  for (const [f, v] of EXP) {
    it(`${f} ≈ ${v}°`, () => {
      const a = an(f);
      const c = a.centros[0];
      expect(angulos(a, c).some((x) => Math.abs(x - v) <= 3), `medidos ${angulos(a, c).map((x) => x.toFixed(1))}`).toBe(true);
    });
  }
  it('H₂S, PH₃, H₂Se y AsH₃ llevan la nota de orbitales p casi puros', () => {
    for (const f of ['H2S', 'PH3', 'H2Se', 'AsH3']) expect(an(f).tev.atomos[0].notas.join(' '), f).toMatch(/p casi puros/);
    expect(an('H2O').tev.atomos[0].notas.join(' ')).not.toMatch(/p casi puros/);
  });
  it('H₂O₂ avisa del diedro ≈ 111°', () => expect(an('H2O2').tev.atomos[0].notas.join(' ')).toMatch(/111/));
  it('eteno: H–C–C 121,3° y H–C–H ≈ 117° (texto)', () => expect(an('C2H4').tev.atomos[0].rpecv.anguloRealTexto).toMatch(/121,3.*117/));
});

// ───────── 5. Otros casos ─────────
describe('Otros casos', () => {
  it('H₂: σ(1s–1s), sin promoción ni hibridación', () => {
    const a = an('H2');
    const t = a.tev.atomos[0];
    expect(t.hibridacion).toBeNull();
    expect(t.promociones).toEqual([]);
    expect(a.tev.sigma).toBe(1);
    expect(a.tev.enlaces[0].sigma).toBe('σ(1s H – 1s H)');
  });
  it('XeF₆: AX₆E, número estérico 7, sp³d³, octaedro distorsionado (fluxional)', () => {
    const a = an('XeF6');
    const t = a.tev.atomos[0];
    expect([t.rpecv.notacion, t.rpecv.esterico, t.hibridacion?.tipo]).toEqual(['AX₆E', 7, 'sp3d3']);
    expect(t.rpecv.geometriaMolecular).toMatch(/octaedro distorsionado.*fluxional/);
    expect(t.notas.join(' ')).toMatch(/fluxional/);
    angulos(a, 0).forEach((x) => expect([90, 180].some((r) => Math.abs(x - r) <= 4), `${x}`).toBe(true));
  });
  it('terminales: p puro por defecto; hibridando los terminales N₂ es sp con 1 par y 2 π', () => {
    for (const f of ['HF', 'N2', 'CO', 'CN-', 'NO+', 'O2', 'ClO-', 'OH-']) expect(an(f).tev.atomos[0].hibridacion, f).toBeNull();
    const n = an('N2', 'cargas', true).tev.atomos[0];
    expect(n.hibridacion?.tipo).toBe('sp');
    expect(n.hibridacion?.contenido.map((c) => c.tipo)).toEqual(['par', 'sigma']);
    expect(n.pi).toBe(2);
    expect(an('HF', 'cargas', true).tev.atomos[0].hibridacion?.tipo).toBe('sp3');
  });
  it('núcleos del bloque p de los periodos 4–6', () => {
    expect(nucleo(ELEMENTOS.Ga)).toBe('[Ar] 3d¹⁰');
    expect(nucleo(ELEMENTOS.In)).toBe('[Kr] 4d¹⁰');
    for (const s of ['Tl', 'Pb', 'Bi']) expect(nucleo(ELEMENTOS[s])).toBe('[Xe] 4f¹⁴ 5d¹⁰');
    expect(nucleo(ELEMENTOS.Ge)).toBe('[Ar] 3d¹⁰');
    expect(nucleo(ELEMENTOS.Sn)).toBe('[Kr] 4d¹⁰');
    expect(nucleo(ELEMENTOS.Ca)).toBe('[Ar]');
  });
  it('las etiquetas de orbitales nunca son «3d1»', () => {
    for (const e of BIBLIOTECA) {
      const a = an(e.formula);
      for (const t of a.tev.atomos) {
        const texto = [t.configFundamental, t.configExcitada, ...t.promociones.map((p) => p.texto), ...t.notas].join(' ');
        expect(texto, e.formula).not.toMatch(/\d[spdf]\d/);
      }
    }
  });
  const APOLARES = ['CO2', 'BF3', 'CH4', 'CCl4', 'PCl5', 'SF6', 'XeF2', 'XeF4', 'BeCl2', 'SO3', 'C2H4', 'C2H2', 'C6H6'];
  const POLARES = ['H2O', 'NH3', 'SO2', 'SF4', 'ClF3', 'BrF5', 'CH2Cl2', 'CHCl3', 'O3', 'HCN', 'H2CO', 'NO2', 'XeOF4', 'OF2', 'SCl2'];
  it('polaridad: apolares', () => APOLARES.forEach((f) => expect(an(f).geometria.dipolo.polar, f).toBe(false)));
  it('polaridad: polares', () => POLARES.forEach((f) => expect(an(f).geometria.dipolo.polar, f).toBe(true)));
});

// ───────── 6. El validador detecta errores ─────────
describe('validarAnalisis detecta incoherencias', () => {
  it('σ/π incorrectos', () => {
    const a = an('CO2');
    a.tev.pi = 5;
    expect(validarAnalisis(a).join(' ')).toMatch(/π/);
  });
  it('carga formal inconsistente', () => {
    const a = an('NH4+');
    a.estructura.atomos[0].carga = 3;
    expect(validarAnalisis(a).join(' ')).toMatch(/cargas formales/);
  });
  it('ángulo 3D que no coincide con el real', () => {
    const a = an('H2O');
    a.geometria.pos[1] = [a.geometria.pos[1][0] * 0.2, a.geometria.pos[1][1] + 1.5, a.geometria.pos[1][2]];
    expect(validarAnalisis(a).join(' ')).toMatch(/ángulo real/);
  });
  it('hibridación con composición errónea', () => {
    const a = an('CH4');
    a.tev.atomos[0].hibridacion!.composicion = { s: 1, p: 2, d: 0 };
    expect(validarAnalisis(a).join(' ')).toMatch(/composición/);
  });
});

// ───────── 7. Una fila por cada especie de la biblioteca (instantánea revisada) ─────────
describe('Biblioteca completa', () => {
  it('tabla de especies (átomo central, hibridación, AXE, geometría, σ/π, promoción, polaridad)', async () => {
    const filas = BIBLIOTECA.map((e) => {
      const a = an(e.formula);
      const c = a.centros[0];
      const t = a.tev.atomos[c];
      return {
        especie: e.formula, centro: `${t.simbolo}${c + 1}`, hibridacion: t.hibridacion?.tipo ?? (t.simbolo === 'H' ? '1s' : 'p puro'), axe: t.rpecv.notacion,
        geometria: t.rpecv.geometriaMolecular, sigma: a.tev.sigma, pi: a.tev.pi, sigmaAtomo: t.sigma, piAtomo: t.pi,
        promocion: t.promociones.map((p) => p.texto).join('; ') || '—', polaridad: a.carga ? 'ion' : a.polaridad.polar ? 'polar' : 'apolar',
      };
    });
    expect(filas.length).toBeGreaterThanOrEqual(80);
    await expect(JSON.stringify(filas, null, 1)).toMatchFileSnapshot('./biblioteca.tabla.json');
  });
});

// ───────── Concordancia de los textos (singular / plural) ─────────
import { construirPlan } from '../src/viz/animacion/plan';
describe('Textos de la animación: concordancia', () => {
  it('nunca «1 enlaces», «1 pares», «1 electrones»… ni «2 enlace»', () => {
    const malos = /\b1 (enlaces|pares|pares solitarios|electrones|orbitales|dominios|átomos)\b|\b([2-9]|\d{2}) (enlace|par|electrón|orbital|dominio) /;
    const errores: string[] = [];
    for (const e of BIBLIOTECA) {
      const a = an(e.formula);
      for (const c of new Set([...a.centros, 0])) {
        if (a.tev.atomos[c].error) continue;
        const textos = [...construirPlan(a, c).map((p) => p.texto.replace(/<[^>]+>/g, '')), ...a.tev.atomos[c].notas, ...a.tev.notas];
        for (const t of textos) { const m = t.match(malos); if (m) errores.push(`${e.formula} (${c}): «${m[0]}» en «${t.slice(0, 90)}…»`); }
      }
    }
    expect(errores).toEqual([]);
  });
});
