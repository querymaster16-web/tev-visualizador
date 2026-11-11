/** Estructura de Lewis en 2D (SVG): puntos para pares solitarios, cargas formales y resonancia. */
import type { Analisis } from '../chem/analisis';
import { cargaTexto } from '../chem/formato';
import type { Estructura } from '../chem/tipos';
import { vecinos } from '../chem/tipos';
import type { Vec3 } from '../chem/vec';
import { cross, dot, len, mul, norm, rotar, sub } from '../chem/vec';
import { TemaSVG, esc } from './comun';

type P2 = [number, number];

/** Proyección ortogonal que mejor separa los átomos (plano principal / vista que evita solapes). */
export interface Fantasma { centro: number; dir: Vec3 }

function proyectar(est: Estructura, pos: Vec3[], fantasmas: Fantasma[] = []): { pr: P2[]; angF: { ang: number; largo: number }[] } {
  const n = pos.length;
  const c = mul(pos.reduce((s, p) => [s[0] + p[0], s[1] + p[1], s[2] + p[2]] as Vec3, [0, 0, 0] as Vec3), 1 / n);
  const q = pos.map((p) => sub(p, c));
  // PCA por iteración de potencias
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  q.forEach((p) => { for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) cov[i][j] += p[i] * p[j]; });
  const mulM = (v: Vec3): Vec3 => [0, 1, 2].map((i) => cov[i][0] * v[0] + cov[i][1] * v[1] + cov[i][2] * v[2]) as Vec3;
  let e1: Vec3 = norm([1, 0.37, 0.21]);
  for (let i = 0; i < 80; i++) e1 = norm(mulM(e1));
  let e2: Vec3 = norm(cross(e1, [0.13, 0.9, 0.41]));
  for (let i = 0; i < 80; i++) {
    let v = mulM(e2);
    v = sub(v, mul(e1, dot(v, e1)));
    e2 = len(v) > 1e-9 ? norm(v) : e2;
  }
  const e3 = norm(cross(e1, e2));
  const proj3 = (p: Vec3): Vec3 => [dot(p, e1), dot(p, e2), dot(p, e3)];
  // los pares solitarios de los centros se proyectan como puntos «fantasma» a 1 unidad del núcleo
  const base: Vec3[] = [...q.map(proj3), ...fantasmas.map((f) => { const c0 = proj3(q[f.centro]); const d = proj3(f.dir); return [c0[0] + d[0], c0[1] + d[1], c0[2] + d[2]] as Vec3; })];
  const bonds = est.enlaces;
  let mejor: P2[] = base.map((p) => [p[0], p[1]]);
  let mejorScore = -1;
  const evalua = (v: Vec3[]) => {
    const pr: P2[] = v.map((p) => [p[0], p[1]]);
    let minRatio = 1;
    bonds.forEach((e) => {
      const real = len(sub(v[e.a], v[e.b])) || 1;
      const proy = Math.hypot(pr[e.a][0] - pr[e.b][0], pr[e.a][1] - pr[e.b][1]);
      minRatio = Math.min(minRatio, proy / real);
    });
    let minD = 9;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) minD = Math.min(minD, Math.hypot(pr[i][0] - pr[j][0], pr[i][1] - pr[j][1]));
    return { pr, score: 0.6 * minRatio + 0.4 * Math.min(minD / 1.0, 1.2) };
  };
  const cand: Vec3[][] = [base];
  for (let yaw = 0; yaw < 360; yaw += 30) for (let pit = -60; pit <= 60; pit += 20) {
    cand.push(base.map((p) => rotar(rotar(p, [0, 1, 0], (yaw * Math.PI) / 180), [1, 0, 0], (pit * Math.PI) / 180)));
  }
  for (const v of cand) {
    const r = evalua(v);
    if (r.score > mejorScore + 1e-9) { mejorScore = r.score; mejor = r.pr; }
    if (v === base && r.score > 0.97) break; // moléculas planas: se queda el plano principal
  }
  const angF = fantasmas.map((f, k) => ({ ang: Math.atan2(mejor[n + k][1] - mejor[f.centro][1], mejor[n + k][0] - mejor[f.centro][0]), largo: Math.hypot(mejor[n + k][1] - mejor[f.centro][1], mejor[n + k][0] - mejor[f.centro][0]) }));
  return { pr: mejor.slice(0, n), angF };
}

function angulosLibres(ocupados: number[], k: number): number[] {
  if (!ocupados.length) return Array.from({ length: k }, (_, i) => -Math.PI / 2 + (2 * Math.PI * i) / k);
  let ang = [...ocupados].sort((a, b) => a - b);
  const res: number[] = [];
  for (let q = 0; q < k; q++) {
    let mejor = 0, mg = -1;
    for (let i = 0; i < ang.length; i++) {
      const a = ang[i], b = i + 1 < ang.length ? ang[i + 1] : ang[0] + 2 * Math.PI;
      if (b - a > mg) { mg = b - a; mejor = i; }
    }
    const a = ang[mejor], b = mejor + 1 < ang.length ? ang[mejor + 1] : ang[0] + 2 * Math.PI;
    const m = (a + b) / 2;
    res.push(m);
    ang = [...ang, m > Math.PI ? m - 2 * Math.PI : m].sort((x, y) => x - y);
  }
  return res;
}

/**
 * Elige los ángulos de los pares solitarios: la posición libre más alejada de los enlaces, de la
 * carga formal (arriba a la derecha), de los pares ya colocados y de los átomos vecinos.
 */
function elegirAngulos(x: number, y: number, ocup: number[], k: number, r: number, otros: P2[], conCarga: boolean): number[] {
  const dist = (a: number, b: number) => { const d = Math.abs(a - b) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
  const ocupados = [...ocup];
  if (conCarga) ocupados.push(-Math.PI / 4);
  const res: number[] = [];
  for (let q = 0; q < k; q++) {
    let mejor = -Math.PI / 2, ms = -Infinity;
    for (let g = 0; g < 72; g++) {
      const a = -Math.PI + (g * 2 * Math.PI) / 72;
      let s = ocupados.length ? Math.min(...ocupados.map((o) => dist(a, o))) : Math.PI;
      const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      for (const o of otros) if (Math.hypot(px - o[0], py - o[1]) < 22) s -= 1.5;
      if (s > ms + 1e-9) { ms = s; mejor = a; }
    }
    res.push(mejor);
    ocupados.push(mejor);
  }
  return res;
}

/** AX₄E con cuatro vecinos terminales (SF₄, SeF₄…): posiciones 2D del dibujo de libro (axiales en vertical, ecuatoriales a la derecha). */
function balancin(est: Estructura): { centro: number; pr: P2[] } | null {
  const n = est.atomos.length;
  if (n !== 5) return null;
  const c = est.atomos.findIndex((_, i) => vecinos(est, i).length === 4);
  if (c < 0 || est.atomos[c].pares !== 1 || est.atomos[c].radical !== 0 || est.atomos[c].carga !== 0) return null;
  const vs = vecinos(est, c).map((v) => v.j);
  if (vs.some((j) => vecinos(est, j).length !== 1)) return null;
  const pr: P2[] = Array(n).fill([0, 0]);
  const ang = [-90, 90, -36, 36]; // axial arriba, axial abajo, ecuatoriales a la derecha
  vs.forEach((j, k) => { const a = (ang[k] * Math.PI) / 180; pr[j] = [Math.cos(a) * 1.15, Math.sin(a) * 1.15]; });
  return { centro: c, pr };
}

function ruedaTerminales(est: Estructura): P2[] | null {
  const n = est.atomos.length;
  if (n < 8) return null;
  const c = est.atomos.findIndex((_, i) => vecinos(est, i).length === n - 1);
  if (c < 0) return null;
  const pr: P2[] = Array(n).fill([0, 0]);
  const vs = vecinos(est, c).map((v) => v.j);
  vs.forEach((j, k) => { const a = -Math.PI / 2 + (2 * Math.PI * k) / vs.length; pr[j] = [Math.cos(a) * 1.15, Math.sin(a) * 1.15]; });
  return pr;
}

export interface OpcionesLewis {
  ancho?: number;
  alto?: number;
  /** Marca los enlaces que cambian entre formas resonantes. */
  deslocalizados?: Set<number>;
  titulo?: string;
  /** Direcciones 3D de los pares solitarios de los centros de octeto expandido (para colocarlos en un hueco libre). */
  fantasmas?: Fantasma[];
}

export function lewisSVG(est: Estructura, pos: Vec3[], tema: TemaSVG, op: OpcionesLewis = {}): string {
  const W = op.ancho ?? 300, H = op.alto ?? 230;
  const m = 34;
  const proy = proyectar(est, pos, op.fantasmas ?? []);
  // Balancín AX₄E (SF₄, SeF₄…): dibujo de libro con los dos F axiales arriba y abajo y el par solitario a la izquierda, en un hueco libre
  const bal = balancin(est);
  // Estrella con ≥ 7 vecinos terminales (IF₇): rueda 2D legible
  const rueda = ruedaTerminales(est);
  const pr = bal ? bal.pr : rueda ?? proy.pr, angF = proy.angF;
  const xs = pr.map((p) => p[0]), ys = pr.map((p) => p[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  const sc = Math.min((W - 2 * m) / Math.max(w, 0.8), (H - 2 * m) / Math.max(h, 0.8), 64);
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2, cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  const A: P2[] = pr.map((p) => [W / 2 + (p[0] - cx) * sc, H / 2 + (p[1] - cy) * sc]);
  const rAt = (i: number) => (est.atomos[i].el.simbolo === 'H' ? 8 : 11);
  let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" font-family="Inter, system-ui, sans-serif" role="img" aria-label="Estructura de Lewis">`;
  // enlaces
  est.enlaces.forEach((e, k) => {
    const [x1, y1] = A[e.a], [x2, y2] = A[e.b];
    const d = Math.hypot(x2 - x1, y2 - y1) || 1;
    const ux = (x2 - x1) / d, uy = (y2 - y1) / d;
    const a0: P2 = [x1 + ux * rAt(e.a), y1 + uy * rAt(e.a)], b0: P2 = [x2 - ux * rAt(e.b), y2 - uy * rAt(e.b)];
    const n = Math.round(e.orden);
    const nx = -uy, ny = ux;
    const deslocal = op.deslocalizados?.has(k);
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 4.2;
      s += `<line x1="${a0[0] + nx * off}" y1="${a0[1] + ny * off}" x2="${b0[0] + nx * off}" y2="${b0[1] + ny * off}" stroke="${deslocal && i > 0 ? tema.acento : tema.tinta}" stroke-width="1.9" stroke-linecap="round"/>`;
    }
  });
  // átomos
  est.atomos.forEach((a, i) => {
    const [x, y] = A[i];
    const H_ = a.el.simbolo === 'H';
    s += `<text x="${x}" y="${y + (H_ ? 5 : 6.5)}" text-anchor="middle" font-size="${H_ ? 14 : 19}" font-weight="${H_ ? 500 : 600}" fill="${tema.tinta}">${a.el.simbolo}</text>`;
    // pares solitarios
    const ocup = vecinos(est, i).map(({ j }) => Math.atan2(A[j][1] - y, A[j][0] - x));
    const nPtos = a.pares + a.radical;
    let usados = [...ocup];
    if (nPtos) {
      const r = rAt(i) + 10;
      const otros = A.filter((_, j) => j !== i);
      const idxF = (op.fantasmas ?? []).map((f, k) => ({ f, k })).filter(({ f }) => f.centro === i);
      let libres: number[];
      // Dirección real del par (proyectada) si cae en un hueco libre (≥ 45° de cualquier enlace y de otro par); si no, el mejor hueco
      const dAng = (u: number, v: number) => { const d = Math.abs(u - v) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
      const reales = idxF.map(({ k }) => angF[k]);
      const sirven = a.pares > 0 && a.radical === 0 && reales.length >= a.pares && reales.slice(0, a.pares).every((g, q, arr) =>
        g.largo >= 0.45 && ocup.every((o) => dAng(g.ang, o) >= (Math.PI / 4)) && arr.every((h, q2) => q2 === q || dAng(g.ang, h.ang) >= (Math.PI / 4)));
      if (bal && bal.centro === i) libres = [Math.PI];
      else if (sirven) libres = reales.slice(0, a.pares).map((g) => g.ang);
      else if (ocup.length === 1 && nPtos <= 3) {
        // átomo terminal (F, Cl, =O…): pares repartidos simétricamente respecto al enlace
        const o = ocup[0] + Math.PI;
        libres = nPtos === 1 ? [o] : nPtos === 2 ? [o - Math.PI / 3, o + Math.PI / 3] : [o, o - Math.PI / 2, o + Math.PI / 2];
        // si hay carga formal, el primer par se aparta de la esquina superior derecha (donde va la carga)
        if (a.carga !== 0 && nPtos === 3) libres = [o - Math.PI / 2, o + Math.PI / 2, o];
      } else libres = elegirAngulos(x, y, ocup, nPtos, r, otros, a.carga !== 0);
      usados = [...ocup, ...libres];
      libres.forEach((ang, k) => {
        const px = x + Math.cos(ang) * r, py = y + Math.sin(ang) * r;
        const nx = -Math.sin(ang) * 3.3, ny = Math.cos(ang) * 3.3;
        if (k < a.pares) s += `<circle cx="${px + nx}" cy="${py + ny}" r="2.4" fill="${tema.tinta}"/><circle cx="${px - nx}" cy="${py - ny}" r="2.4" fill="${tema.tinta}"/>`;
        else s += `<circle cx="${px}" cy="${py}" r="2.6" fill="${tema.acento}"/>`;
      });
    }
    // carga formal
    if (a.carga !== 0) {
      // la carga formal va en el hueco angular más libre (preferiblemente arriba a la derecha)
      const dA = (u: number, v: number) => { const d = Math.abs(u - v) % (2 * Math.PI); return d > Math.PI ? 2 * Math.PI - d : d; };
      let mejorA = -Math.PI / 4, mejorS = -1;
      for (let g = 0; g < 48; g++) {
        const ang = -Math.PI + (g * 2 * Math.PI) / 48;
        const sep = usados.length ? Math.min(...usados.map((u) => dA(ang, u))) : Math.PI;
        const sc2 = Math.min(sep, 0.9) - 0.12 * dA(ang, -Math.PI / 4);
        if (sc2 > mejorS + 1e-9) { mejorS = sc2; mejorA = ang; }
      }
      const bx = x + Math.cos(mejorA) * 19, by = y + Math.sin(mejorA) * 19;
      s += `<circle cx="${bx}" cy="${by}" r="6.6" fill="${tema.fondo}" stroke="${a.carga > 0 ? '#d9480f' : '#1f4fd8'}" stroke-width="1.3"/><text x="${bx}" y="${by + 3.6}" text-anchor="middle" font-size="${Math.abs(a.carga) > 1 ? 8 : 11}" font-weight="700" fill="${a.carga > 0 ? '#d9480f' : '#1f4fd8'}">${Math.abs(a.carga) > 1 ? Math.abs(a.carga) : ''}${a.carga > 0 ? '+' : '−'}</text>`;
    }
  });
  // corchetes con la carga total
  if (est.cargaTotal !== 0) {
    const x0 = Math.min(...A.map((p) => p[0])) - 24, x1 = Math.max(...A.map((p) => p[0])) + 24;
    const y0 = Math.min(...A.map((p) => p[1])) - 26, y1 = Math.max(...A.map((p) => p[1])) + 26;
    const br = (x: number, dir: number) => `<path d="M${x - dir * 8},${y0} L${x},${y0} L${x},${y1} L${x - dir * 8},${y1}" fill="none" stroke="${tema.tinta}" stroke-width="1.6"/>`;
    s += br(x0, -1) + br(x1, 1);
    s += `<text x="${x1 + 5}" y="${y0 + 4}" font-size="15" font-weight="600" fill="${tema.tinta}">${esc(cargaTexto(est.cargaTotal))}</text>`;
  }
  if (op.titulo) s += `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-size="11" fill="${tema.suave}">${esc(op.titulo)}</text>`;
  return s + '</svg>';
}

/** Todas las formas resonantes con flechas ↔ (HTML con SVG incrustado). */
export function resonanciaHTML(an: Analisis, tema: TemaSVG, ancho = 230, alto = 190): string {
  const f = an.resonancia;
  const deslocal = new Set<number>();
  if (f.length > 1) f[0].enlaces.forEach((e, k) => { if (f.some((g) => g.enlaces[k].orden !== e.orden)) deslocal.add(k); });
  return f
    .map((est, i) => {
      const svg = lewisSVG(est, an.geometria.pos, tema, { ancho, alto, fantasmas: fantasmasLewis(an), deslocalizados: deslocal, titulo: f.length > 1 ? `Forma ${i + 1}` : undefined });
      return `<div class="forma-res">${svg}</div>${i < f.length - 1 ? '<div class="flecha-res" aria-hidden="true">↔</div>' : ''}`;
    })
    .join('');
}

/** Pares solitarios de los centros con número estérico ≥ 5 (octeto expandido): su dirección 3D real. */
export function fantasmasLewis(an: Analisis): Fantasma[] {
  const out: Fantasma[] = [];
  an.estructura.atomos.forEach((a, i) => {
    if (a.pares < 1 || a.radical) return;
    if (vecinos(an.estructura, i).length + a.pares < 5) return;
    an.geometria.dominios[i].filter((d) => d.tipo === 'par').forEach((d) => out.push({ centro: i, dir: d.dir }));
  });
  return out;
}
