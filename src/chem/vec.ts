export type Vec3 = [number, number, number];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a: Vec3) => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: Vec3): Vec3 => {
  const l = len(a) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};
export const dist = (a: Vec3, b: Vec3) => len(sub(a, b));
/** Rotación de Rodrigues de v alrededor de un eje unitario. */
export function rotar(v: Vec3, eje: Vec3, ang: number): Vec3 {
  const c = Math.cos(ang), s = Math.sin(ang);
  const k = norm(eje);
  const kv = cross(k, v);
  const kd = dot(k, v) * (1 - c);
  return [v[0] * c + kv[0] * s + k[0] * kd, v[1] * c + kv[1] * s + k[1] * kd, v[2] * c + kv[2] * s + k[2] * kd];
}
/** Ángulo (grados) entre dos vectores. */
export const anguloEntre = (a: Vec3, b: Vec3) => (Math.acos(Math.max(-1, Math.min(1, dot(norm(a), norm(b))))) * 180) / Math.PI;
/** Rotación mínima que lleva `a` sobre `b`; devuelve (eje, ángulo). */
export function rotacionEntre(a: Vec3, b: Vec3): { eje: Vec3; ang: number } {
  const na = norm(a), nb = norm(b);
  const d = Math.max(-1, Math.min(1, dot(na, nb)));
  let eje = cross(na, nb);
  if (len(eje) < 1e-9) {
    // paralelos o antiparalelos
    eje = Math.abs(na[0]) < 0.9 ? cross(na, [1, 0, 0]) : cross(na, [0, 1, 0]);
  }
  return { eje: norm(eje), ang: Math.acos(d) };
}
export const perpendicular = (a: Vec3): Vec3 => norm(Math.abs(a[0]) < 0.9 ? cross(a, [1, 0, 0]) : cross(a, [0, 1, 0]));
