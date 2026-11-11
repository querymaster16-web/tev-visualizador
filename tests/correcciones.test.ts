/** Correcciones finales: conformaciones y polaridad, μ experimental, ángulos reales, etiquetas π y colores de las cajas. */
import { describe, expect, it } from 'vitest';
import { analizar } from '../src/chem/analisis';
import type { Analisis } from '../src/chem/analisis';
import { BIBLIOTECA } from '../src/chem/biblioteca';
import { MU_EXPERIMENTAL, textoMu } from '../src/chem/dipolos';
import { vecinos } from '../src/chem/tipos';
import type { Vec3 } from '../src/chem/vec';
import { anguloEntre, cross, dot, norm, sub } from '../src/chem/vec';
import { cajasSVG } from '../src/diagramas/cajas';
import { ROL, TEMA_CLARO } from '../src/diagramas/comun';
import { etiquetasPi } from '../src/viz/etiquetas-pi';
import { ejesPi } from '../src/viz/marcos';

const an = (f: string): Analisis => {
  const r = analizar(f);
  if (r.tipo !== 'ok') throw new Error('ambiguo ' + f);
  return r.analisis;
};
const idx = (a: Analisis, simbolo: string) => a.estructura.atomos.map((x, i) => (x.el.simbolo === simbolo ? i : -1)).filter((i) => i >= 0);
/** Diedro (grados, valor absoluto) a–b–c–d. */
function diedro(p: Vec3[], a: number, b: number, c: number, d: number): number {
  const b1 = sub(p[b], p[a]), b2 = sub(p[c], p[b]), b3 = sub(p[d], p[c]);
  return (Math.acos(Math.max(-1, Math.min(1, dot(norm(cross(b1, b2)), norm(cross(b2, b3)))))) * 180) / Math.PI;
}

describe('1. Polaridad y conformación 3D', () => {
  it('H₂O₂: diedro H–O–O–H ≈ 111° y polar', () => {
    const a = an('H2O2');
    const [o1, o2] = idx(a, 'O');
    const h1 = vecinos(a.estructura, o1).find((v) => v.j !== o2)!.j, h2 = vecinos(a.estructura, o2).find((v) => v.j !== o1)!.j;
    const d = diedro(a.geometria.pos, h1, o1, o2, h2);
    expect(d).toBeGreaterThan(104);
    expect(d).toBeLessThan(118);
    expect(a.geometria.dipolo.polar).toBe(true);
    expect(a.geometria.dipolo.magnitud).toBeGreaterThan(0.5);
  });
  it('N₂H₄: conformación gauche (pares solitarios de los N a ≈ 90°) y polar', () => {
    const a = an('N2H4');
    const [n1, n2] = idx(a, 'N');
    const lp = (n: number) => a.geometria.dominios[n].find((d) => d.tipo === 'par')!.dir;
    const eje = norm(sub(a.geometria.pos[n2], a.geometria.pos[n1]));
    const perp = (v: Vec3) => norm(sub(v, [eje[0] * dot(v, eje), eje[1] * dot(v, eje), eje[2] * dot(v, eje)]));
    const ang = anguloEntre(perp(lp(n1)), perp(lp(n2)));
    expect(ang).toBeGreaterThan(75);
    expect(ang).toBeLessThan(105);
    expect(a.geometria.dipolo.polar).toBe(true);
    expect(a.geometria.dipolo.magnitud).toBeGreaterThan(0.5);
  });
  it('H₃BO₃: plana con simetría C₃ₕ y apolar', () => {
    const a = an('H3BO3');
    const P = a.geometria.pos;
    const [b] = idx(a, 'B');
    const os = idx(a, 'O'), hs = idx(a, 'H');
    const nrm = norm(cross(sub(P[os[0]], P[b]), sub(P[os[1]], P[b])));
    [...os, ...hs].forEach((i) => expect(Math.abs(dot(sub(P[i], P[b]), nrm))).toBeLessThan(0.05));
    const dd = (i: number, j: number) => Math.hypot(...sub(P[i], P[j]));
    const hDe = (o: number) => vecinos(a.estructura, o).find((v) => v.j !== b)!.j;
    const d0 = dd(hDe(os[0]), os[1]), d1 = dd(hDe(os[1]), os[2]), d2 = dd(hDe(os[2]), os[0]);
    expect(Math.abs(d0 - d1)).toBeLessThan(0.05);
    expect(Math.abs(d1 - d2)).toBeLessThan(0.05);
    expect(Math.abs(d0 - dd(hDe(os[0]), os[2]))).toBeGreaterThan(0.3); // un único sentido de giro
    expect(a.geometria.dipolo.polar).toBe(false);
    expect(a.polaridad.polar).toBe(false);
  });
  it('especies con varios O–H / N–H: polares (H₂SO₄, H₃PO₄, H₂CO₃, H₂SO₃, HCO₃⁻, urea, ácidos, alcoholes, amidas…)', () => {
    for (const f of ['H2SO4', 'H3PO4', 'H2CO3', 'H2SO3', 'HCO3^-', 'CH4N2O', 'HNO3', 'HNO2', 'HClO', 'HClO3', 'HClO4', 'CH3COOH', 'HCOOH', 'C6H5COOH', 'C6H5OH', 'CH3OH', 'C2H5OH', 'CH3NH2', 'CH3CONH2', 'C6H5NH2']) {
      expect(an(f).geometria.dipolo.polar, f).toBe(true);
    }
  });
  it('los H de –OH sobre centros planos quedan en el plano (ácidos, fenol, HNO₃, H₂CO₃)', () => {
    for (const f of ['CH3COOH', 'HCOOH', 'C6H5OH', 'HNO3', 'H2CO3']) {
      const a = an(f);
      const P = a.geometria.pos;
      a.estructura.atomos.forEach((at, o) => {
        if (at.el.simbolo !== 'O' || at.pares !== 2) return;
        const vs = vecinos(a.estructura, o);
        const h = vs.find((v) => a.estructura.atomos[v.j].el.simbolo === 'H');
        const c = vs.find((v) => v.j !== h?.j);
        if (!h || !c) return;
        const vc = vecinos(a.estructura, c.j).map((v) => v.j).filter((j) => j !== o);
        if (vc.length < 2) return;
        const nrm = norm(cross(sub(P[vc[0]], P[c.j]), sub(P[vc[1]], P[c.j])));
        expect(Math.abs(dot(norm(sub(P[h.j], P[o])), nrm)), `${f} O${o}–H`).toBeLessThan(0.2);
      });
    }
  });
});

describe('2. Momentos dipolares: tabla experimental', () => {
  const enTabla = Object.keys(MU_EXPERIMENTAL);
  it('todas las claves de la tabla son especies de la biblioteca', () => {
    const ids = new Set(BIBLIOTECA.map((e) => e.id));
    enTabla.forEach((k) => expect(ids.has(k), k).toBe(true));
  });
  it('valores indicados en el enunciado', () => {
    const esperados: Record<string, number> = {
      H2O: 1.85, NH3: 1.47, NF3: 0.23, HF: 1.82, HCl: 1.08, H2S: 0.97, PH3: 0.58, SO2: 1.63, HCN: 2.98, H2CO: 2.33, CO: 0.11, CH3Cl: 1.87, CH2Cl2: 1.6, CHCl3: 1.04, O3: 0.53,
      NO: 0.16, NO2: 0.32, ClF3: 0.6, SF4: 0.63, BrF5: 1.51, IF5: 2.18, OF2: 0.3, SCl2: 0.36, PCl3: 0.56, H2O2: 2.26, N2H4: 1.85, CH3OH: 1.7, C2H5OH: 1.69, CH3COOH: 1.74, HCOOH: 1.41,
      CH3CHO: 2.75, C3H6O: 2.88, CH3NH2: 1.31, CH3CN: 3.92, CH3OCH3: 1.3, C6H5OH: 1.22, C6H5COOH: 1.72, C6H5NH2: 1.53, C7H8: 0.36, XeOF4: 0.65, SOCl2: 1.45, H2SO4: 2.7, HNO3: 2.17,
    };
    for (const [f, mu] of Object.entries(esperados)) {
      const a = an(f);
      expect(a.polaridad.experimental, f).toBe(true);
      expect(a.polaridad.mu, f).toBeCloseTo(mu, 2);
      expect(a.polaridad.polar, f).toBe(true);
      expect(textoMu(a.polaridad), f).toContain('(experimental)');
    }
  });
  it('formato «μ = 1,85 D (experimental)»', () => expect(textoMu(an('H2O').polaridad)).toBe('μ = 1,85 D (experimental)'));
  it('la geometría 3D concuerda con la tabla: salen polares todas las especies salvo las de μ muy pequeño por hiperconjugación (tolueno, propeno)', () => {
    const modeloSinDipoloDeC_H = new Set(['C7H8', 'C3H6']);
    for (const f of enTabla.filter((k) => !modeloSinDipoloDeC_H.has(k))) expect(an(f).geometria.dipolo.polar, `${f} (μ exp. ${MU_EXPERIMENTAL[f]})`).toBe(true);
  });
  it('fuera de la tabla (SMILES): estimación, sin «experimental»', () => {
    const a = an('CCCl');
    expect(a.polaridad.experimental).toBe(false);
    if (a.polaridad.polar) expect(textoMu(a.polaridad)).toMatch(/^μ ≈ \d+,\d D \(estimación\)$/);
  });
  it('XeF₆: apolar (estructura fluxional) con nota', () => {
    const a = an('XeF6');
    expect(a.polaridad.polar).toBe(false);
    expect(a.polaridad.nota).toMatch(/fluxional/);
  });
  it('las apolares clásicas siguen apolares', () => {
    for (const f of ['CO2', 'CH4', 'BF3', 'SF6', 'XeF4', 'C2H4', 'C2H2', 'C6H6', 'H3BO3']) expect(an(f).polaridad.polar, f).toBe(false);
  });
});

describe('5. Ángulos reales de la ficha = ángulos dibujados', () => {
  const ang = (a: Analisis, c: number, x: string, y: string) => {
    const vs = vecinos(a.estructura, c).map((v) => v.j);
    const P = a.geometria.pos;
    const r: number[] = [];
    for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
      const s = [a.estructura.atomos[vs[i]].el.simbolo, a.estructura.atomos[vs[j]].el.simbolo].sort().join('');
      if (s === [x, y].sort().join('')) r.push(anguloEntre(sub(P[vs[i]], P[c]), sub(P[vs[j]], P[c])));
    }
    return r;
  };
  it('eteno: H–C–C ≈ 121,3° y H–C–H ≈ 117,4°', () => {
    const a = an('C2H4');
    idx(a, 'C').forEach((c) => {
      ang(a, c, 'C', 'H').forEach((x) => expect(Math.abs(x - 121.3)).toBeLessThan(1));
      ang(a, c, 'H', 'H').forEach((x) => expect(Math.abs(x - 117.4)).toBeLessThan(1));
    });
  });
  it('propeno y butadieno: el CH₂= mide ≈ 121,3° (±1,5°)', () => {
    for (const f of ['C3H6', 'C4H6']) {
      const a = an(f);
      const ch2 = idx(a, 'C').filter((c) => vecinos(a.estructura, c).length === 3 && vecinos(a.estructura, c).filter((v) => a.estructura.atomos[v.j].el.simbolo === 'H').length === 2);
      expect(ch2.length, f).toBeGreaterThan(0);
      ch2.forEach((c) => ang(a, c, 'C', 'H').forEach((x) => expect(Math.abs(x - 121.3), f).toBeLessThan(1.5)));
    }
  });
  it('éter dimetílico: C–O–C ≈ 111,7°', () => {
    const a = an('CH3OCH3');
    const [o] = idx(a, 'O');
    expect(Math.abs(ang(a, o, 'C', 'C')[0] - 111.7)).toBeLessThan(1.5);
    expect(a.tev.atomos[o].rpecv.anguloRealTexto).toContain('111,7');
  });
});

describe('3. Etiquetas π de la animación', () => {
  /** π esperados del centro: Σ π de sus enlaces; un anillo aromático aporta una sola etiqueta (la nube). */
  const esperado = (a: Analisis, c: number) => {
    const aro = vecinos(a.estructura, c).some(({ e }) => e.aromatico);
    let n = aro ? 1 : 0;
    vecinos(a.estructura, c).forEach(({ e }) => { if (!(aro && e.aromatico)) n += Math.max(0, Math.round(e.orden) - 1); });
    return n;
  };
  const etiquetas = (a: Analisis, c: number) => {
    const P = a.geometria.pos.map((p) => sub(p, a.geometria.pos[c]));
    const aro = vecinos(a.estructura, c).some(({ e }) => e.aromatico);
    const anillo = aro ? { centro: [0, 0, 0] as Vec3, eje: [0, 1, 0] as Vec3, n: 6 } : null;
    return etiquetasPi(a, c, P, ejesPi(a), anillo);
  };
  it('una etiqueta por cada enlace π del centro, en toda la biblioteca', () => {
    for (const e of BIBLIOTECA) {
      const a = an(e.formula);
      for (const c of a.centros) {
        if (a.tev.atomos[c].error) continue;
        expect(etiquetas(a, c).length, `${e.formula} centro ${c}`).toBe(esperado(a, c));
      }
    }
  });
  it('triple enlace: π₁ y π₂; doble enlace: una sola π', () => {
    const t = etiquetas(an('C2H2'), 0).map((x) => x.texto);
    expect(t).toEqual(['π₁(2p–2p)', 'π₂(2p–2p)']);
    expect(etiquetas(an('C2H4'), 0).map((x) => x.texto)).toEqual(['π(2p–2p)']);
    expect(etiquetas(an('N2'), 0)).toHaveLength(2);
    const co2 = an('CO2'), h2co = an('H2CO');
    expect(etiquetas(co2, idx(co2, 'C')[0])).toHaveLength(2);
    expect(etiquetas(h2co, idx(h2co, 'C')[0])).toHaveLength(1);
  });
  it('las etiquetas π₁/π₂ de un triple enlace están en posiciones distintas', () => {
    const hcn = an('HCN');
    const e = etiquetas(hcn, idx(hcn, 'C')[0]);
    expect(e).toHaveLength(2);
    expect(Math.hypot(...sub(e[0].pos, e[1].pos))).toBeGreaterThan(0.5);
  });
  it('benceno: una etiqueta para la nube π deslocalizada', () => {
    const t = etiquetas(an('C6H6'), 0).map((x) => x.texto);
    expect(t).toHaveLength(1);
    expect(t[0]).toMatch(/deslocalizado/);
  });
  it('SO₂ y CO₃²⁻: hay etiquetas π en el centro', () => {
    const so2 = an('SO2'), co3 = an('CO3^2-');
    expect(etiquetas(so2, so2.centros[0]).length).toBe(esperado(so2, so2.centros[0]));
    expect(etiquetas(co3, co3.centros[0]).length).toBe(esperado(co3, co3.centros[0]));
    expect(etiquetas(co3, co3.centros[0]).length).toBeGreaterThan(0);
  });
});

describe('4. Colores de las cajas de orbitales', () => {
  it('etapa de π (hibridado): los dos 2p del etino van en naranja y no hay verde', () => {
    const a = an('C2H2');
    const t = a.tev.atomos[a.centros[0]];
    const svg = cajasSVG(t, 'hibridado', TEMA_CLARO, { promo: false });
    expect(svg).not.toContain(ROL.promo);
    expect(svg.split(ROL.pi).length - 1).toBeGreaterThanOrEqual(2);
  });
  it('el verde solo aparece en el estado excitado de la etapa de promoción', () => {
    const a = an('C2H2');
    const t = a.tev.atomos[a.centros[0]];
    expect(cajasSVG(t, 'excitado', TEMA_CLARO, { promo: true })).toContain(ROL.promo);
    expect(cajasSVG(t, 'excitado', TEMA_CLARO, { promo: false })).not.toContain(ROL.promo);
  });
  it('hibridado sin opciones tampoco usa el verde (C₂H₄, CO₂, benceno, HCN)', () => {
    for (const f of ['C2H4', 'CO2', 'C6H6', 'HCN']) {
      const a = an(f);
      const t = a.tev.atomos[a.centros[0]];
      if (t.hibridacion) expect(cajasSVG(t, 'hibridado', TEMA_CLARO), f).not.toContain(ROL.promo);
    }
  });
});
