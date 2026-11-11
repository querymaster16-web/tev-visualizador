/**
 * Diagrama de niveles «de libro»: orbitales del átomo central (azul) con sus electrones,
 * orbitales de los vecinos (rojo) más abajo y líneas que unen los orbitales que solapan.
 */
import type { Analisis } from '../chem/analisis';
import { TemaSVG, esc, etqOrb, flecha } from './comun';

const AZUL = '#3d5fc4';
const ROJO = '#b03030';
const AMARILLO = '#fff0a0';
const AW = 38; // ancho de la raya de nivel
const GAP = 10;

export function nivelesSVG(an: Analisis, centro: number, tema: TemaSVG): string {
  const t = an.tev.atomos[centro];
  if (t.error) return '';
  const capa = t.capa;
  const oscuro = tema.fondo !== '#fbfaf6' && tema.fondo !== '#ffffff';
  const azul = oscuro ? '#7da2ff' : AZUL, rojo = oscuro ? '#ff8b8b' : ROJO, amar = oscuro ? '#6b5b00' : AMARILLO;
  const orbs = t.excitado.map((o, i) => ({ o, i })).filter(({ o, i }) => o.id === 's' || o.id[0] === 'p' || o.e > 0 || t.fundamental[i].e > 0);
  // Posiciones x: s | p p p | d…
  const grupos: { s: string; items: typeof orbs }[] = (['s', 'p', 'd'] as const).map((s) => ({ s, items: orbs.filter((x) => x.o.sub === s) })).filter((g) => g.items.length);
  let x = 96;
  const pos = new Map<string, number>();
  grupos.forEach((g) => {
    g.items.forEach(({ o }) => {
      pos.set(o.id, x);
      x += AW + GAP;
    });
    x += 20;
  });
  const W = Math.max(x + 20, 330);
  const H = 372;
  const yE = (e: number) => 188 - e * 88; // altura (px) de un nivel de energía relativa
  const eSub = (s: string) => (s === 's' ? 0 : s === 'p' ? 1 : 2.2);
  const yN = 246; // nivel de los vecinos
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;display:block;max-width:${W}px" font-family="Inter, system-ui, sans-serif" role="img" aria-label="Diagrama de niveles de energía y solapamiento">`;
  // Eje de energía
  s += `<line x1="40" y1="${H - 34}" x2="40" y2="20" stroke="${tema.suave}" stroke-width="1.5"/><path d="M34,28 L40,18 L46,28" fill="none" stroke="${tema.suave}" stroke-width="1.5"/>`;
  s += `<text transform="translate(18 ${H / 2 - 8}) rotate(-90)" text-anchor="middle" font-size="14" fill="${tema.tinta}">Energía</text>`;
  const nivel = (cx: number, y: number, e: number, col: string, colesp: string[] = []) => {
    let r = `<line x1="${cx - AW / 2}" x2="${cx + AW / 2}" y1="${y}" y2="${y}" stroke="${col}" stroke-width="3.2" stroke-linecap="round"/>`;
    if (e >= 1) r += flecha(cx + (e === 2 ? -7 : 0), y - 11, true, colesp[0] ?? col, 10);
    if (e === 2) r += flecha(cx + 7, y - 11, false, colesp[1] ?? col, 10);
    return r;
  };
  // Núcleo 1s (periodo 2): solo para dar contexto, como en los libros
  if (capa === 2) {
    const cx = pos.get('s')! ;
    s += nivel(cx, yE(-1.15) , 2, azul) + `<text x="${cx}" y="${yE(-1.15) + 20}" text-anchor="middle" font-size="13" fill="${tema.tinta}">1s</text>`;
  }
  // Orbitales del átomo central
  const marc: Record<string, { x: number; y: number }> = {};
  orbs.forEach(({ o, i }) => {
    const cx = pos.get(o.id)!;
    const y = yE(eSub(o.sub));
    const rol = t.roles[o.id]?.rol;
    const prom = t.promociones.some((p) => p.a === o.sub) && o.e > t.fundamental[i].e;
    s += nivel(cx, y, o.e, azul, [prom ? '#16a34a' : azul, azul]);
    const etq = etqOrb(capa, o.id);
    const bw = etq.length * 8 + 10;
    const enlaza = rol === 'sigma' || rol === 'pi';
    if (enlaza) s += `<rect x="${cx - bw / 2}" y="${y + 6}" width="${bw}" height="20" rx="4" fill="${amar}"/>`;
    s += `<text x="${cx}" y="${y + 21}" text-anchor="middle" font-size="14" fill="${tema.tinta}">${esc(etq.replace(/^(\d)([sp])(.)?$/, (_m, a, b, c) => a + b + (c ? c : '')))}</text>`;
    marc[o.id] = { x: cx, y: y + 26 };
  });
  // Vecinos
  type V = { j: number; id: string; tipo: 'σ' | 'π' };
  const lista: V[] = [];
  Object.entries(t.porVecino).forEach(([j, v]) => {
    lista.push({ j: +j, id: v.sigma, tipo: 'σ' });
    v.pis.forEach((p) => lista.push({ j: +j, id: p, tipo: 'π' }));
  });
  lista.forEach(({ j, id, tipo }) => {
    const m = marc[id];
    if (!m) return;
    const nb = an.tev.atomos[j];
    const orbN = nb.porVecino[centro];
    const idN = tipo === 'σ' ? orbN?.sigma ?? 's' : orbN?.pis[0] ?? 'pz';
    const etq = `${nb.capa}${idN[0] === 'p' ? 'p' : idN[0] === 's' ? 's' : 'd'}`;
    const dx = m.x + (tipo === 'π' ? 0 : 0);
    const col = tipo === 'σ' ? rojo : '#c97a00';
    s += `<line x1="${m.x}" y1="${m.y + 2}" x2="${dx}" y2="${yN - 4}" stroke="${tema.suave}" stroke-width="1" ${tipo === 'π' ? 'stroke-dasharray="3 3"' : ''}/>`;
    s += nivel(dx, yN, 1, col) + `<text x="${dx}" y="${yN + 18}" text-anchor="middle" font-size="13" fill="${tema.tinta}">${esc(etq)} <tspan fill="${col}" font-weight="600">${esc(nb.simbolo)}${j + 1}</tspan></text>`;
  });
  s += `<text x="${W / 2}" y="${H - 22}" text-anchor="middle" font-size="11" fill="${tema.suave}">Orbitales de ${esc(t.etiqueta)} tras la promoción (amarillo: los que solapan)</text><text x="${W / 2}" y="${H - 7}" text-anchor="middle" font-size="11" fill="${tema.suave}">Rojo: orbitales de los átomos vecinos</text>`;
  return s + '</svg>';
}
