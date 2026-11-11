/** Validaciones automáticas de coherencia interna de un análisis (se ejecutan en los tests). */
import type { Analisis } from './analisis';
import { HIBRIDO_POR_ESTERICO } from './rpecv';
import { grado, vecinos } from './tipos';
import { anguloEntre, sub } from './vec';

/** Devuelve la lista de incoherencias (vacía si todo cuadra). */
export function validarAnalisis(a: Analisis): string[] {
  const err: string[] = [];
  const est = a.estructura;
  const f = a.formula;
  const bad = (m: string) => err.push(`${f}: ${m}`);

  // 1. Σ cargas formales = carga total
  const sumFC = est.atomos.reduce((s, x) => s + x.carga, 0);
  if (sumFC !== a.carga) bad(`la suma de cargas formales (${sumFC}) ≠ carga total (${a.carga})`);
  // 2. Electrones de Lewis = valencia total − carga
  const V = est.atomos.reduce((s, x) => s + x.el.valencia, 0) - a.carga;
  const usados = est.atomos.reduce((s, x) => s + 2 * x.pares + x.radical, 0) + 2 * est.enlaces.reduce((s, e) => s + Math.round(e.orden), 0);
  if (V !== usados) bad(`electrones de Lewis ${usados} ≠ valencia total ${V}`);
  if (a.electronesValencia !== V) bad(`electrones de valencia declarados ${a.electronesValencia} ≠ ${V}`);

  // 3. Por átomo: 2P + U = efectivos; fundamental y excitado suman lo mismo
  let sigmaAtomos = 0;
  a.tev.atomos.forEach((t, i) => {
    if (t.error) return bad(`átomo ${i + 1} (${t.simbolo}) con error TEV: ${t.error}`);
    if (2 * t.pares + t.desapareados !== t.efectivos) bad(`${t.simbolo}${i + 1}: 2·${t.pares} + ${t.desapareados} ≠ ${t.efectivos}`);
    const sf = t.fundamental.reduce((s, o) => s + o.e, 0), sx = t.excitado.reduce((s, o) => s + o.e, 0);
    if (sf !== t.efectivos || sx !== t.efectivos) bad(`${t.simbolo}${i + 1}: e⁻ fundamental ${sf} / excitado ${sx} ≠ efectivos ${t.efectivos}`);
    const nb = vecinos(est, i);
    if (t.sigma !== nb.length) bad(`${t.simbolo}${i + 1}: σ ${t.sigma} ≠ vecinos ${nb.length}`);
    const pi = nb.reduce((s, v) => s + Math.round(v.e.orden) - 1, 0);
    if (t.pi !== pi) bad(`${t.simbolo}${i + 1}: π ${t.pi} ≠ ${pi}`);
    sigmaAtomos += t.sigma;
    // 5. Hibridación: tantos orbitales como el número estérico y composición correcta
    const h = t.hibridacion;
    if (h) {
      if (h.n !== t.rpecv.esterico) bad(`${t.simbolo}${i + 1}: híbridos ${h.n} ≠ número estérico ${t.rpecv.esterico}`);
      const c = h.composicion;
      if (c.s !== 1 || c.p !== Math.min(3, h.n - 1) || c.d !== Math.max(0, h.n - 4) || c.s + c.p + c.d !== h.n) bad(`${t.simbolo}${i + 1}: composición ${h.composicionTexto} incorrecta para ${h.n} orbitales`);
      if (h.tipo !== HIBRIDO_POR_ESTERICO[h.n]) bad(`${t.simbolo}${i + 1}: nombre ${h.tipo} ≠ ${HIBRIDO_POR_ESTERICO[h.n]}`);
      if (h.contenido.length !== h.n) bad(`${t.simbolo}${i + 1}: contenido de híbridos ${h.contenido.length} ≠ ${h.n}`);
      if (t.capa === 2 && c.d > 0) bad(`${t.simbolo}${i + 1}: periodo 2 con orbitales d`);
    }
  });

  // 4. σ/π de la ficha = enlaces de Lewis = lista de solapamientos
  const piLewis = est.enlaces.reduce((s, e) => s + Math.round(e.orden) - 1, 0);
  if (a.tev.sigma !== est.enlaces.length) bad(`σ de la ficha ${a.tev.sigma} ≠ enlaces ${est.enlaces.length}`);
  if (a.tev.pi !== piLewis) bad(`π de la ficha ${a.tev.pi} ≠ ${piLewis}`);
  if (a.tev.enlaces.length !== est.enlaces.length) bad('lista de solapamientos incompleta');
  a.tev.enlaces.forEach((e, k) => {
    if (e.pis.length !== Math.round(est.enlaces[k].orden) - 1) bad(`enlace ${k + 1}: ${e.pis.length} π listados ≠ ${Math.round(est.enlaces[k].orden) - 1}`);
    if (/\?/.test(e.sigma) || e.pis.some((p) => /\?/.test(p))) bad(`enlace ${k + 1}: solapamiento sin orbital («${e.sigma}»)`);
  });
  if (sigmaAtomos !== 2 * est.enlaces.length) bad('suma de σ por átomo ≠ 2 × enlaces');

  // 6. Ángulos 3D = ángulo real indicado y geometría coherente con la declarada
  const P = a.geometria.pos;
  est.atomos.forEach((at, i) => {
    if (at.el.simbolo === 'H' || grado(est, i) < 2) return;
    const t = a.tev.atomos[i];
    if (t.error) return;
    const vs = vecinos(est, i).map((v) => v.j);
    const angs: number[] = [];
    for (let p = 0; p < vs.length; p++) for (let q = p + 1; q < vs.length; q++) angs.push(anguloEntre(sub(P[vs[p]], P[i]), sub(P[vs[q]], P[i])));
    const estrella = est.atomos.length === vs.length + 1;
    const tol = estrella ? 3 : 7;
    const rp = t.rpecv;
    const lbl = `${at.el.simbolo}${i + 1} (${rp.geometriaMolecular})`;
    if (rp.anguloReal !== null && !angs.some((x) => Math.abs(x - rp.anguloReal!) <= tol)) bad(`${lbl}: ángulo real ${rp.anguloReal}° ≠ medidos [${angs.map((x) => x.toFixed(1)).join(', ')}]`);
    const g = rp.geometriaMolecular;
    const tolG = estrella ? 4 : 9;
    if (g.startsWith('lineal') && angs.some((x) => x < 180 - tolG)) bad(`${lbl}: no es lineal ([${angs.map((x) => x.toFixed(0))}])`);
    if (g.startsWith('trigonal plana') && vs.length === 3 && Math.abs(angs.reduce((s, x) => s + x, 0) - 360) > 2 * tolG) bad(`${lbl}: no es plana (Σ ángulos ${angs.reduce((s, x) => s + x, 0).toFixed(0)}°)`);
    if (g.startsWith('tetraédrica') && vs.length === 4 && angs.some((x) => Math.abs(x - 109.5) > 2 * tolG)) bad(`${lbl}: ángulos no tetraédricos`);
    if (g.startsWith('piramidal trigonal') && vs.length === 3 && angs.reduce((s, x) => s + x, 0) > 350) bad(`${lbl}: es plana, no piramidal`);
    if (g.startsWith('angular') && vs.length === 2 && angs[0] > 175) bad(`${lbl}: es lineal, no angular`);
    if ((g.startsWith('octaédrica') || g.startsWith('plano-cuadrada')) && angs.some((x) => Math.abs(x - 90) > tolG && Math.abs(x - 180) > tolG)) bad(`${lbl}: ángulos distintos de 90°/180° ([${angs.map((x) => x.toFixed(0))}])`);
    if (g.startsWith('bipirámide trigonal') && angs.some((x) => ![90, 120, 180].some((r) => Math.abs(x - r) <= tolG))) bad(`${lbl}: ángulos fuera de 90/120/180°`);
    if (g.startsWith('bipirámide pentagonal') && angs.some((x) => ![72, 90, 144, 180].some((r) => Math.abs(x - r) <= tolG))) bad(`${lbl}: ángulos fuera de 72/90/144/180°`);
  });
  return err;
}
