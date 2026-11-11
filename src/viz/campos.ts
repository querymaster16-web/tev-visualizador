/**
 * Parte angular de los orbitales atómicos e híbridos, normalizada a máximo 1.
 * Los orbitales se dibujan como superficies ρ(u) = R·|f(u)|^γ con el signo de f como fase.
 */
import type { Vec3 } from '../chem/vec';

export type Campo = (x: number, y: number, z: number) => number;
export type Marco = [Vec3, Vec3, Vec3];

const IDENT: Marco = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];

/** Campo del orbital atómico `id` (s, px, py, pz, d1..d5) en el marco dado. */
export function campoAO(id: string, m: Marco = IDENT): Campo {
  const loc = (x: number, y: number, z: number): Vec3 => [
    x * m[0][0] + y * m[0][1] + z * m[0][2],
    x * m[1][0] + y * m[1][1] + z * m[1][2],
    x * m[2][0] + y * m[2][1] + z * m[2][2],
  ];
  switch (id) {
    case 's': return () => 1;
    case 'px': return (x, y, z) => loc(x, y, z)[0];
    case 'py': return (x, y, z) => loc(x, y, z)[1];
    case 'pz': return (x, y, z) => loc(x, y, z)[2];
    case 'd1': return (x, y, z) => { const l = loc(x, y, z); return (3 * l[2] * l[2] - 1) / 2; }; // d_z²
    case 'd2': return (x, y, z) => { const l = loc(x, y, z); return l[0] * l[0] - l[1] * l[1]; }; // d_x²−y²
    case 'd3': return (x, y, z) => { const l = loc(x, y, z); return 2 * l[0] * l[1]; }; // d_xy
    case 'd4': return (x, y, z) => { const l = loc(x, y, z); return 2 * l[0] * l[2]; }; // d_xz
    default: return (x, y, z) => { const l = loc(x, y, z); return 2 * l[1] * l[2]; }; // d_yz
  }
}

/** Híbrido sp^n dirigido: 1 + √(3n)·cosθ (lóbulo grande + lóbulo pequeño de fase opuesta). */
export function campoHibrido(dir: Vec3, n: number): Campo {
  const k = Math.sqrt(3 * n);
  const norm = 1 + k;
  return (x, y, z) => (1 + k * (x * dir[0] + y * dir[1] + z * dir[2])) / norm;
}

/** Orbital p dirigido a lo largo de `eje`. */
export function campoP(eje: Vec3): Campo {
  return (x, y, z) => x * eje[0] + y * eje[1] + z * eje[2];
}
export const campoS: Campo = () => 1;

export const mezclar = (a: Campo, b: Campo, m: number): Campo =>
  m <= 0 ? a : m >= 1 ? b : (x, y, z) => (1 - m) * a(x, y, z) + m * b(x, y, z);
