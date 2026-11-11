/**
 * Diagrama «como en clase»: estado fundamental → (promoción) → estado excitado → (hibridación) →
 * híbridos, con el eje de energía, rayas de nivel y flechas de espín. Es una función determinista
 * de (etapa, u): muestra de dónde a dónde va cada electrón al promocionar y cómo los niveles
 * s y p se funden en el nivel híbrido.
 */
import type { Analisis } from '../chem/analisis';
import { hibridoTexto } from '../chem/formato';
import type { AtomoTEV } from '../chem/tev';
import type { EtapaId } from '../viz/animacion/plan';
import { ROL, TemaSVG, esc, flecha } from './comun';

const ORDEN: EtapaId[] = ['atomo', 'recuento', 'promocion', 'hibridacion', 'repulsion', 'vecinos', 'pi', 'final'];
const LW = 30; // ancho de la raya
const SP = 36; // separación entre rayas
const H = 372; // 296 para los paneles + bloque de texto inferior
const PH = 296;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const sub01 = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

interface Orb {
  i: number;
  id: string;
  sub: 's' | 'p' | 'd';
  g: number;
  x: number;
  rx: number; // x relativo al panel
  y: number; // altura en px
}
interface Mover {
  de: number; // índice orbital origen
  a: number; // índice orbital destino
  slotDe: number;
}

export class DiagramaClase {
  readonly svg: SVGSVGElement;
  private orbs: Orb[] = [];
  private movers: Mover[] = [];
  private W = 800;
  private ox = [0, 0, 0];
  private wP = [0, 0, 0];
  private yE = (e: number) => 190 - e * 62;
  private N: number;
  private yH: number;
  private neighbors: number[];

  constructor(private t: AtomoTEV, private an: Analisis, private tema: TemaSVG) {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.N = t.hibridacion?.n ?? 0;
    const eSub = (s: string) => (s === 's' ? 0 : s === 'p' ? 1 : 2.3);
    // orbitales mostrados (s, p y los d que se usan)
    const lista = t.excitado.map((o, i) => ({ o, i })).filter(({ o, i }) => o.id === 's' || o.id[0] === 'p' || o.e > 0 || t.fundamental[i].e > 0);
    const cuenta: Record<string, number> = { s: 0, p: 0, d: 0 };
    lista.forEach(({ o, i }) => {
      const k = cuenta[o.sub]++;
      this.orbs.push({ i, id: o.id, sub: o.sub, g: t.fundamental[i].e, x: o.e, rx: 40 + k * SP, y: this.yE(eSub(o.sub)) });
    });
    const maxLin = Math.max(1, cuenta.s, cuenta.p, cuenta.d);
    const wA = 40 + maxLin * SP + 44;
    const hyN = Math.max(this.N, 1);
    const wH = Math.max(wA, 40 + Math.max(hyN, 3) * SP + 80, 300);
    this.wP = [wA, wA, wH];
    this.ox = [8, 8 + wA + 120, 8 + 2 * (wA + 120)];
    this.W = this.ox[2] + wH + 10;
    // energía del nivel híbrido: media ponderada de s, p y d
    const h = t.hibridacion;
    this.yH = this.yE(h ? (h.composicion.p * 1 + h.composicion.d * 2.3) / h.n : 1);
    // electrones que se desplazan al promocionar
    const sobr: { de: number; slot: number }[] = [];
    t.fundamental.forEach((o, i) => {
      for (let q = 0; q < Math.max(0, o.e - t.excitado[i].e); q++) sobr.push({ de: i, slot: o.e - 1 - q });
    });
    t.excitado.forEach((o, i) => {
      for (let q = 0; q < Math.max(0, o.e - t.fundamental[i].e); q++) {
        const s = sobr.shift();
        if (s) this.movers.push({ de: s.de, a: i, slotDe: s.slot });
      }
    });
    this.neighbors = Object.keys(t.porVecino).map(Number).sort((a, b) => a - b);
    const s = this.svg;
    s.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    s.setAttribute('viewBox', `0 0 ${this.W} ${H}`);
        s.setAttribute('font-family', 'Inter, system-ui, sans-serif');
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', 'Diagrama de niveles como en clase: fundamental, promoción e hibridación');
    s.style.width = '100%';
    // el texto nunca baja de ≈ 85 % de su tamaño: en pantallas estrechas el recuadro se desplaza en horizontal
    s.style.minWidth = `${Math.round(this.W * 0.85)}px`;
    s.style.height = 'auto';
    s.style.display = 'block';
    this.actualizar('final', 1);
  }

  private color(i: number): string {
    const r = this.t.roles[this.t.excitado[i].id]?.rol ?? 'vacio';
    return r === 'vacio' ? this.tema.suave : ROL[r];
  }

  /** Dibuja las rayas de un orbital con sus flechas. */
  private raya(cx: number, y: number, e: number, cols: string[], op = 1, extra = '', desplaza = false): string {
    const x1 = cx - LW / 2, x2 = cx + LW / 2;
    let r = `<g opacity="${op}"><line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}" stroke="${this.tema.tinta}" stroke-width="3.4" stroke-linecap="round"/>`;
    if (e >= 1) r += flecha(cx + (e === 2 || desplaza ? -7 : 0), y - 15, true, cols[0] ?? this.tema.tinta, 12);
    if (e === 2) r += flecha(cx + 7, y - 15, false, cols[1] ?? this.tema.tinta, 12);
    return r + extra + '</g>';
  }
  private texto(x: number, y: number, tx: string, size = 18, color = this.tema.tinta, anchor = 'middle', op = 1, peso = 500, it = false) {
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${peso}" ${it ? 'font-style="italic"' : ''} fill="${color}" opacity="${op}">${esc(tx)}</text>`;
  }
  private eje(ox: number, op = 1) {
    const c = this.tema.suave;
    return `<g opacity="${op}"><line x1="${ox + 12}" y1="${PH - 26}" x2="${ox + 12}" y2="26" stroke="${c}" stroke-width="2"/><path d="M${ox + 5},36 L${ox + 12},24 L${ox + 19},36" fill="none" stroke="${c}" stroke-width="2"/>${this.texto(ox + 2, 20, 'E', 15, c, 'middle')}</g>`;
  }
  private flechaPanel(x1: number, x2: number, y: number, tx: string, op: number) {
    const c = this.tema.tinta;
    return `<g opacity="${op}"><line x1="${x1}" y1="${y}" x2="${x2 - 6}" y2="${y}" stroke="${c}" stroke-width="2.2"/><path d="M${x2 - 14},${y - 7} L${x2},${y} L${x2 - 14},${y + 7}" fill="none" stroke="${c}" stroke-width="2.2"/>${this.texto((x1 + x2) / 2, y - 12, tx, 16, c, 'middle', 1, 600)}</g>`;
  }

  actualizar(id: EtapaId, u: number) {
    this.svg.innerHTML = this.dibujar(id, u);
  }
  estatico() {
    this.actualizar('final', 1);
  }

  private dibujar(id: EtapaId, u: number): string {
    const { t, tema, orbs } = this;
    const ei = ORDEN.indexOf(id);
    const capa = t.capa;
    const promoP = ei < 2 ? 0 : id === 'promocion' ? ease(sub01(u, 0.12, 0.62)) : 1;
    const op2 = ei < 2 ? 0 : id === 'promocion' ? ease(sub01(u, 0.58, 0.92)) : 1;
    const m = ei < 3 ? 0 : id === 'hibridacion' ? ease(sub01(u, 0.28, 0.85)) : 1;
    const op3 = ei < 3 ? 0 : id === 'hibridacion' ? ease(sub01(u, 0, 0.22)) : 1;
    const nv = this.neighbors.length;
    const vP = (k: number) => (ei < 5 ? 0 : id === 'vecinos' ? clamp01(u * nv - k) : 1);
    const piP = ei < 6 ? 0 : id === 'pi' ? ease(u) : 1;
    const [o1, o2, o3] = this.ox;
    let s = '';
    const etiquetaGrupo = (ox: number, sub: 's' | 'p' | 'd', n: number, y: number, op = 1) => this.texto(ox + 40 + (n - 1) * SP + LW / 2 + 12, y + 6, `${capa}${sub}`, 17, tema.tinta, 'start', op);

    // ───── Panel 1: estado fundamental
    s += this.eje(o1);
    // núcleo 1s (solo periodo 2, como en clase)
    if (capa === 2) {
      s += this.raya(o1 + 40, this.yE(-0.9), 2, [tema.suave, tema.suave]) + this.texto(o1 + 40 + LW / 2 + 12, this.yE(-0.9) + 6, '1s', 17, tema.tinta, 'start');
    }
    const grupos = (['s', 'p', 'd'] as const).map((sub) => ({ sub, l: orbs.filter((o) => o.sub === sub) })).filter((g) => g.l.length);
    orbs.forEach((o) => {
      const stay = Math.min(o.g, o.x);
      const movs = this.movers.filter((mv) => mv.de === o.i);
      const cols: string[] = [];
      for (let q = 0; q < o.g; q++) {
        const mv = movs.find((x) => x.slotDe === q);
        cols.push(mv ? this.color(mv.a) : this.color(o.i));
      }
      void stay;
      let r = `<g>`;
      r += `<line x1="${o1 + o.rx - LW / 2}" x2="${o1 + o.rx + LW / 2}" y1="${o.y}" y2="${o.y}" stroke="${tema.tinta}" stroke-width="3.4" stroke-linecap="round"/>`;
      for (let q = 0; q < o.g; q++) {
        const mv = movs.find((x) => x.slotDe === q);
        const opq = mv ? 1 - 0.65 * promoP : 1; // el electrón que se va queda «fantasma»
        r += `<g opacity="${opq}">${flecha(o1 + o.rx + (o.g === 2 ? (q === 0 ? -7 : 7) : 0), o.y - 15, q === 0, cols[q], 12)}</g>`;
      }
      s += r + '</g>';
    });
    grupos.forEach((g) => (s += etiquetaGrupo(o1, g.sub, g.l.length, g.l[0].y)));
    s += this.texto(o1 + this.wP[0] / 2, PH - 2, 'estado fundamental', 14, tema.suave, 'middle', 1, 500, true);

    // recuento: «N e⁻ desapareados»
    const des = orbs.filter((o) => o.g === 1);
    if (id === 'recuento' && des.length) {
      const x1 = o1 + Math.min(...des.map((o) => o.rx)) - 12, x2 = o1 + Math.max(...des.map((o) => o.rx)) + 12;
      const yb = Math.min(...des.map((o) => o.y)) - 40;
      const pulso = 0.65 + 0.35 * Math.abs(Math.sin(u * Math.PI * 3));
      const cx = (x1 + x2) / 2;
      s += `<g opacity="${pulso}"><path d="M${x1},${yb + 12} Q${x1},${yb} ${x1 + 10},${yb} L${cx - 6},${yb} L${cx},${yb - 8} L${cx + 6},${yb} L${x2 - 10},${yb} Q${x2},${yb} ${x2},${yb + 12}" fill="none" stroke="${tema.acento}" stroke-width="2.2"/>${this.texto(cx, yb - 14, `${des.length} ${des.length === 1 ? 'e⁻ desapareado' : 'e⁻ desapareados'}`, 17, tema.acento, 'middle', 1, 600)}</g>`;
    }

    // flechas curvas de la promoción: de dónde a dónde va cada electrón
    if (ei >= 2) {
      this.movers.forEach((mv, k) => {
        const A = orbs.find((o) => o.i === mv.de)!, B = orbs.find((o) => o.i === mv.a)!;
        const p0 = { x: o1 + A.rx + (A.g === 2 ? (mv.slotDe === 0 ? -7 : 7) : 0), y: A.y - 26 };
        const p1 = { x: o1 + B.rx + (B.g === 1 ? 0 : 0), y: B.y - 30 };
        const c = { x: Math.min(p0.x, p1.x) - 46 - k * 14, y: (p0.y + p1.y) / 2 };
        const pt = (q: number) => ({ x: (1 - q) * (1 - q) * p0.x + 2 * (1 - q) * q * c.x + q * q * p1.x, y: (1 - q) * (1 - q) * p0.y + 2 * (1 - q) * q * c.y + q * q * p1.y });
        const col = this.color(mv.a);
        const n = 26;
        let d = '';
        for (let q = 0; q <= n; q++) { const P = pt((q / n) * promoP); d += (q ? 'L' : 'M') + `${P.x.toFixed(1)},${P.y.toFixed(1)} `; }
        const fin = pt(promoP), ant = pt(Math.max(0, promoP - 0.05));
        const ang = Math.atan2(fin.y - ant.y, fin.x - ant.x);
        const h1 = { x: fin.x - 11 * Math.cos(ang - 0.45), y: fin.y - 11 * Math.sin(ang - 0.45) }, h2 = { x: fin.x - 11 * Math.cos(ang + 0.45), y: fin.y - 11 * Math.sin(ang + 0.45) };
        const trans = id === 'promocion' ? 1 : 0.9;
        s += `<g opacity="${trans}"><path d="${d}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-dasharray="1 0"/>${promoP > 0.04 ? `<path d="M${h1.x},${h1.y} L${fin.x},${fin.y} L${h2.x},${h2.y}" fill="none" stroke="${col}" stroke-width="3" stroke-linecap="round"/>` : ''}</g>`;
        // el electrón viajero
        if (id === 'promocion' && promoP > 0.02 && promoP < 0.98) {
          const P = pt(promoP);
          s += `<circle cx="${P.x}" cy="${P.y}" r="11" fill="${col}" stroke="rgba(10,14,40,.8)" stroke-width="2"/>${flecha(P.x, P.y, true, '#fff', 6)}`;
        }
        // etiqueta del movimiento
        if (id === 'promocion') s += this.texto(c.x - 6, c.y, `${capa}${A.sub} → ${capa}${B.sub}`, 15, col, 'end', clamp01(promoP * 3), 600);
      });
    }

    // ───── Flecha 1 → 2 y panel 2: estado excitado
    s += this.flechaPanel(o1 + this.wP[0] + 8, o2 - 6, this.yE(1.55), t.promociones.length ? 'Promoción' : 'Sin promoción', op2);
    if (op2 > 0.01) {
      s += `<g opacity="${op2}">${this.eje(o2)}`;
      if (capa === 2) s += this.raya(o2 + 40, this.yE(-0.9), 2, [tema.suave, tema.suave]) + this.texto(o2 + 40 + LW / 2 + 12, this.yE(-0.9) + 6, '1s', 17, tema.tinta, 'start');
      orbs.forEach((o) => {
        const cols = Array.from({ length: o.x }, () => this.color(o.i));
        s += this.raya(o2 + o.rx, o.y, o.x, cols);
      });
      grupos.forEach((g) => (s += etiquetaGrupo(o2, g.sub, g.l.length, g.l[0].y)));
      s += this.texto(o2 + this.wP[1] / 2, PH - 2, 'estado excitado', 14, tema.suave, 'middle', 1, 500, true) + '</g>';
    }

    // ───── Flecha 2 → 3 y panel 3: híbridos
    const hib = t.hibridacion;
    s += this.flechaPanel(o2 + this.wP[1] + 8, o3 - 6, this.yE(1.55), hib ? 'Hibridación' : 'Sin hibridar', op3);
    if (op3 > 0.01) {
      s += `<g opacity="${op3}">${this.eje(o3)}`;
      if (capa === 2) s += this.raya(o3 + 40, this.yE(-0.9), 2, [tema.suave, tema.suave]) + this.texto(o3 + 40 + LW / 2 + 12, this.yE(-0.9) + 6, '1s', 17, tema.tinta, 'start');
      const N = this.N;
      // convergen: hilos desde los niveles originales hacia el nivel híbrido
      if (hib && id === 'hibridacion' && m < 0.98) {
        orbs.filter((o) => o.i < N).forEach((o) => {
          s += `<line x1="${o2 + o.rx + LW / 2 + 4}" y1="${o.y - 4}" x2="${o3 + 40 - 6}" y2="${lerp(o.y, this.yH, 0.5) - 4}" stroke="${tema.suave}" stroke-width="1.4" stroke-dasharray="4 4" opacity="${(1 - m) * 0.9}"/>`;
        });
      }
      orbs.forEach((o) => {
        const esHib = !!hib && o.i < N;
        const tipo = esHib ? this.dom(o.i) : null;
        if (esHib) {
          const k = o.i; // el híbrido k procede del orbital k
          const xf = o3 + 40 + k * SP, yf = this.yH;
          const xi = o3 + o.rx, yi = o.y;
          const x = lerp(xi, xf, m), y = lerp(yi, yf, m);
          const col = this.color(o.i);
          const cols = o.x === 2 ? [col, col] : [col];
          let pink = '';
          if (tipo?.tipo === 'sigma') {
            const kv = this.neighbors.indexOf(tipo.vecino ?? -1);
            const f = kv >= 0 ? ease(vP(kv)) : 0;
            if (f > 0.02) pink = `<g opacity="${f}">${flecha(x + 7, y - 15, false, ROL.vecino, 12)}</g>`;
          }
          let extra = '';
          if (o.x === 1 && tipo?.tipo === 'sigma') { /* la flecha propia ya va en raya() */ }
          s += this.raya(x, y, o.x, cols, 1, pink + extra, tipo?.tipo === 'sigma');
        } else {
          // orbitales sin hibridar: se quedan donde estaban
          const rol = t.roles[o.id]?.rol;
          const col = this.color(o.i);
          // con híbridos, el p sin hibridar se dibuja siempre por encima de ellos (a la altura del 2p o más arriba)
          const yy = hib ? Math.max(34, Math.min(o.y, this.yH - 40)) : o.y;
          let pink = '';
          if (rol === 'pi') { const f = ease(piP); if (f > 0.02) pink = `<g opacity="${f}">${flecha(o3 + o.rx + 7, yy - 15, false, ROL.vecino, 12)}</g>`; }
          if (rol === 'sigma' && !hib) {
            const kv = this.neighbors.indexOf(t.roles[o.id]?.vecino ?? -1);
            const f = kv >= 0 ? ease(vP(kv)) : 0;
            if (f > 0.02) pink = `<g opacity="${f}">${flecha(o3 + o.rx + 7, yy - 15, false, ROL.vecino, 12)}</g>`;
          }
          s += this.raya(o3 + o.rx, yy, o.x, Array.from({ length: o.x }, () => col), 1, pink, rol === 'pi' || rol === 'sigma');
        }
      });
      // etiquetas
      if (hib) {
        const xl = o3 + 40 + (N - 1) * SP + LW / 2 + 12;
        s += this.texto(xl, lerp(orbs.find((o) => o.sub === 's')!.y, this.yH, m) + 6, hibridoTexto(hib.tipo), 19, tema.acento, 'start', clamp01((m - 0.55) * 3), 700);
        const pm = 1 - clamp01((m - 0.2) * 3);
        if (pm > 0.02) grupos.forEach((g) => (s += etiquetaGrupo(o3, g.sub, g.l.length, g.l[0].y, pm)));
      } else grupos.forEach((g) => (s += etiquetaGrupo(o3, g.sub, g.l.length, g.l[0].y)));
      // los que no hibridan
      const noHib = orbs.filter((o) => (hib ? o.i >= this.N : false) && t.roles[o.id]?.rol === 'pi');
      if (noHib.length && ei >= 3) {
        const y0 = Math.min(...noHib.map((o) => Math.max(34, Math.min(o.y, this.yH - 40)))) - 46;
        // dos líneas para que quepa entero
        s += this.texto(o3 + this.wP[2] - 2, y0 - 16, 'no hibrida →', 14, ROL.pi, 'end', clamp01(m * 2), 600, true);
        s += this.texto(o3 + this.wP[2] - 2, y0, 'solapamiento lateral (π)', 14, ROL.pi, 'end', clamp01(m * 2), 600, true);
      }
      s += this.texto(o3 + this.wP[2] / 2, PH - 2, hib ? 'orbitales híbridos' : 'orbitales atómicos', 14, tema.suave, 'middle', 1, 500, true);
      // geometría y enlaces, como en las notas de clase: en una banda propia bajo los paneles
      if (ei >= 4) {
        const al = clamp01(id === 'repulsion' ? sub01(u, 0.55, 0.95) : 1);
        const x0 = o2 + 20;
        s += this.texto(x0, PH + 28, `geometría electrónica: ${t.rpecv.geometriaElectronica}`, 16, tema.tinta, 'start', al, 600);
        s += this.texto(x0, PH + 50, `geometría molecular: ${t.rpecv.geometriaMolecular}`, 16, tema.tinta, 'start', al, 600);
      }
      if (ei >= 5) {
        const tipoEnl = t.pi === 0 ? '' : t.pi === 1 ? 'doble enlace: 1σ y 1π' : t.pi === 2 ? 'triple enlace: 1σ y 2π' : '';
        const tx = `${t.sigma} ${t.sigma === 1 ? 'enlace' : 'enlaces'} σ${t.pi ? ` y ${t.pi} π` : ''}${tipoEnl && t.sigma === 1 ? ` (${tipoEnl})` : ''}`;
        s += this.texto(o2 + 20, PH + 72, tx, 16, ROL.sigma, 'start', clamp01(ei === 5 ? vP(nv - 1) : 1), 600);
      }
      s += '</g>';
    }
    return s;
  }

  private dom(k: number) {
    const c = this.t.hibridacion?.contenido[k];
    return c ? { tipo: c.tipo, vecino: c.vecino } : null;
  }

  svgString(): string {
    const clon = this.svg.cloneNode(true) as SVGSVGElement;
    clon.innerHTML = `<rect width="100%" height="100%" fill="${this.tema.fondo}"/>` + clon.innerHTML;
    return new XMLSerializer().serializeToString(clon);
  }
}
void ROL;
