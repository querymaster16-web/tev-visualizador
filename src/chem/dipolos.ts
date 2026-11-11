/**
 * Momentos dipolares experimentales (fase gaseosa, en debye) de las especies de la biblioteca.
 * Clave = id de la biblioteca (fórmula ASCII). Valores de referencia habituales (CRC Handbook, NIST CCCBDB).
 * Las especies que no están aquí (entradas por SMILES o fórmula libre) usan la estimación vectorial 3D.
 */
import { num } from './formato';

export const MU_EXPERIMENTAL: Record<string, number> = {
  H2O: 1.85, NH3: 1.47, NF3: 0.23, HF: 1.82, HCl: 1.08, H2S: 0.97, PH3: 0.58, AsH3: 0.2, H2Se: 0.62,
  SO2: 1.63, HCN: 2.98, H2CO: 2.33, CO: 0.11, CH3Cl: 1.87, CH2Cl2: 1.6, CHCl3: 1.04, O3: 0.53,
  NO: 0.16, NO2: 0.32, ClO2: 1.79, N2O: 0.16, ClF3: 0.6, BrF3: 1.19, SF4: 0.63, BrF5: 1.51, IF5: 2.18, XeOF4: 0.65,
  OF2: 0.3, SCl2: 0.36, PCl3: 0.56, SOCl2: 1.45, H2O2: 2.26, N2H4: 1.85, CH3OH: 1.7, C2H5OH: 1.69,
  CH3COOH: 1.74, HCOOH: 1.41, CH3CHO: 2.75, C3H6O: 2.88, CH3NH2: 1.31, CH3CN: 3.92, CH3OCH3: 1.3,
  C6H5OH: 1.22, C6H5COOH: 1.72, C6H5NH2: 1.53, C7H8: 0.36, C3H6: 0.37, CH4N2O: 4.56, CH3CONH2: 3.68,
  H2SO4: 2.7, HNO3: 2.17, OH: 1.66,
};

/** Especies que se clasifican como apolares aunque la estructura estática sea ligeramente polar. */
export const APOLAR_FORZADO: Record<string, string> = {
  XeF6: 'El XeF₆ es fluxional: el par solitario salta entre las caras del octaedro distorsionado y, en promedio, la molécula se comporta como prácticamente apolar (la estructura estática daría un μ pequeño).',
};

export interface Polaridad {
  polar: boolean;
  /** μ en debye: experimental si `experimental`, si no estimación vectorial. */
  mu: number;
  experimental: boolean;
  nota?: string;
}

export function calcularPolaridad(id: string | undefined, geo: { polar: boolean; magnitud: number }): Polaridad {
  if (id && APOLAR_FORZADO[id]) return { polar: false, mu: geo.magnitud, experimental: false, nota: APOLAR_FORZADO[id] };
  const mu = id ? MU_EXPERIMENTAL[id] : undefined;
  if (mu !== undefined) return { polar: mu >= 0.05, mu, experimental: true };
  return { polar: geo.polar, mu: geo.magnitud, experimental: false };
}

/** «μ = 1,85 D (experimental)» o «μ ≈ 0,9 D (estimación)». */
export function textoMu(p: Polaridad): string {
  return p.experimental ? `μ = ${num(p.mu, 2)} D (experimental)` : `μ ≈ ${num(p.mu, 1)} D (estimación)`;
}
