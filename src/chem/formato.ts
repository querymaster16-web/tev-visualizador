/** Utilidades de notación química con subíndices / superíndices Unicode. */
const SUB = '₀₁₂₃₄₅₆₇₈₉';
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';

export const sub = (n: number | string) => String(n).replace(/\d/g, (d) => SUB[+d]);
export const sup = (n: number | string) =>
  String(n).replace(/\d/g, (d) => SUP[+d]).replace(/\+/g, '⁺').replace(/[-−]/g, '⁻');

/** Superíndice de carga: 2 → «²⁺», -1 → «⁻», 0 → «». */
export function cargaTexto(q: number): string {
  if (q === 0) return '';
  const m = Math.abs(q);
  return (m === 1 ? '' : sup(m)) + (q > 0 ? '⁺' : '⁻');
}

/** Convierte «SO4^2-» / «H2SO4» en «SO₄²⁻» / «H₂SO₄». */
export function formulaUnicode(f: string): string {
  const m = f.match(/^(.*?)(?:\^(\d*)([+-]))?$/);
  const cuerpo = (m?.[1] ?? f).replace(/(\d+)/g, (d) => sub(d));
  if (!m || !m[3]) return cuerpo;
  const n = m[2] ? +m[2] : 1;
  return cuerpo + cargaTexto(m[3] === '+' ? n : -n);
}

/** Etiqueta de hibridación: «sp3d2» → «sp³d²». */
export const hibridoTexto = (h: string) => h.replace(/(\d)/g, (d) => SUP[+d]);

export const num = (x: number, d = 1) => x.toFixed(d).replace('.', ',');

/** Quita acentos y pasa a minúsculas (para búsquedas). */
export const plano = (s: string) =>
  s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9+\-]/g, ' ').replace(/\s+/g, ' ').trim();
