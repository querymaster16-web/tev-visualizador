/**
 * Diagrama de energía en cuatro columnas (fundamental → excitado → híbridos → enlaces),
 * interactivo y sincronizado con la línea temporal.
 */
import { hibridoTexto } from '../chem/formato';
import type { AtomoTEV } from '../chem/tev';
import type { EtapaId } from '../viz/animacion/plan';
import type { InfoEstado } from '../viz/orbitales-atomo';
import { ROL, TemaSVG, esc, etqOrb, flecha } from './comun';

const B = 22; // lado de caja
const GB = 3;
const E_S = 0, E_P = 1, E_D = 2.35; // alturas relativas (unidades arbitrarias, orden correcto)
const energiaSub = (s: string) => (s === 's' ? E_S : s === 'p' ? E_P : E_D);

interface Pos {
  x: number;
  y: number;
}

const ORDEN: EtapaId[] = ['atomo', 'recuento', 'promocion', 'hibridacion', 'repulsion', 'vecinos', 'pi', 'final'];
/** Etapa de la línea temporal a la que lleva cada columna. */
export const ETAPA_DE_COLUMNA: EtapaId[] = ['atomo', 'promocion', 'hibridacion', 'vecinos'];

export class DiagramaEnergia {
  readonly svg: SVGSVGElement;
  private W = 1000;
  private H = 410;
  private yBase = 340;
  private yTit = 380;
  private etqSigma: { x: number; y: number } | null = null;
  private sc = 82;
  private cols: { x0: number; w: number }[] = [];
  private colG: SVGGElement[] = [];
  private fondoCol: SVGRectElement[] = [];
  private cajas = new Map<string, SVGGElement>(); // clave: col:orb
  private pinkSigma = new Map<number, SVGElement>();
  private pinkPi: SVGElement[] = [];
  private marcador!: SVGGElement;
  private viaje: { g: SVGGElement; de: Pos; a: Pos }[] = [];
  private verdes: { el: SVGElement; rol: string }[] = [];
  private flechas: SVGGElement[] = [];
  onColumna: (col: number) => void = () => {};

  constructor(private t: AtomoTEV, private tema: TemaSVG, private vecinosOrden: number[] = []) {
    this.svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.construir();
  }

  private y(e: number) {
    return this.yBase - e * this.sc;
  }

  private construir() {
    const { t, tema } = this;
    const N = t.hibridacion?.n ?? 0;
    const hib = t.hibridacion;
    const usados = t.excitado.map((o, i) => ({ o, i })).filter(({ o, i }) => o.id[0] === 's' || o.id[0] === 'p' || o.e > 0 || t.fundamental[i].e > 0);
    const nP = usados.filter(({ o }) => o.sub === 'p').length;
    const nD = usados.filter(({ o }) => o.sub === 'd').length;
    const anchoCluster = (n: number) => n * B + (n - 1) * GB;
    const w1 = Math.max(anchoCluster(Math.max(nP, 1)), anchoCluster(Math.max(nD, 1)), B);
    const wHib = N ? Math.max(anchoCluster(N), w1) : w1;
    const colW = [w1, w1, wHib, Math.max(wHib, w1)];
    const gap = 78;
    const x0 = 86;
    let x = x0;
    this.cols = colW.map((w) => {
      const c = { x0: x, w };
      x += w + gap;
      return c;
    });
    this.W = x - gap + 30;
    const energiaHib = hib ? (hib.composicion.s * E_S + hib.composicion.p * E_P + hib.composicion.d * E_D) / hib.n : E_P;
    const topE = Math.max(E_D + 0.7, 2.6);
    this.sc = (this.yBase - 56) / topE;
    // los títulos de columna bajan lo necesario para no pisar los cuadros σ/π de «Enlaces» ni sus etiquetas
    const bajo = Math.max(hib ? this.y(energiaHib - 0.85) + B + 20 : this.y(E_P - 0.85) + B + 4, this.y(E_P - 0.62) + B + 20);
    this.yTit = Math.max(this.yBase + 40, bajo + 18 + (hib && t.pi > 0 ? 13 : 0));
    this.H = Math.max(410, this.yTit + 30);

    const s = this.svg;
    s.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
    s.style.width = '100%';
    s.style.height = 'auto';
    s.style.display = 'block';
    s.setAttribute('role', 'img');
    s.setAttribute('aria-label', 'Diagrama de energía de la hibridación');
    s.setAttribute('font-family', 'Inter, system-ui, sans-serif');
    s.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    let h = `<defs><marker id="pta" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${tema.suave}"/></marker>
      <marker id="ptv" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${ROL.promo}"/></marker></defs>`;
    // Eje de energía
    h += `<line x1="40" y1="${this.yBase + 14}" x2="40" y2="22" stroke="${tema.suave}" stroke-width="1.5" marker-end="url(#pta)"/>`;
    h += `<text transform="translate(18 ${(this.yBase + 22) / 2}) rotate(-90)" text-anchor="middle" font-size="13" fill="${tema.suave}">Energía</text>`;
    // marcas de nivel
    ([['s', E_S], ['p', E_P]] as [string, number][]).concat(nD ? [['d', E_D]] : []).forEach(([lab, e]) => {
      h += `<line x1="36" x2="44" y1="${this.y(e) + B / 2}" y2="${this.y(e) + B / 2}" stroke="${tema.suave}"/><text x="${52}" y="${this.y(e) + B / 2 + 4}" font-size="11" fill="${tema.suave}">${t.capa}${lab}</text>`;
    });
    s.innerHTML = h;

    const titulos = ['Fundamental', 'Excitado', hib ? `Híbridos ${hibridoTexto(hib.tipo)}` : 'Sin hibridar', 'Enlaces'];
    const subt = [t.configFundamental.replace(/^\[.*?\]\s*/, ''), t.configExcitada.replace(/^\[.*?\]\s*/, ''), hib ? `${hib.n} orbitales` : 'p puro', `${t.sigma} σ${t.pi ? ` + ${t.pi} π` : ''}`];
    this.cols.forEach((c, i) => {
      const gc = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gc.setAttribute('data-col', String(i));
      gc.style.cursor = 'pointer';
      gc.addEventListener('click', () => this.onColumna(i));
      const fondo = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      fondo.setAttribute('x', String(c.x0 - 16));
      fondo.setAttribute('y', '6');
      fondo.setAttribute('width', String(c.w + 32));
      fondo.setAttribute('height', String(this.H - 14));
      fondo.setAttribute('rx', '14');
      fondo.setAttribute('fill', tema.acento);
      fondo.setAttribute('opacity', '0');
      fondo.setAttribute('class', 'fondo-col');
      gc.appendChild(fondo);
      this.fondoCol.push(fondo);
      const tx = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      tx.innerHTML = `<text x="${c.x0 + c.w / 2}" y="${this.yTit}" text-anchor="middle" font-size="13" font-weight="600" fill="${tema.tinta}">${esc(titulos[i])}</text>
        <text x="${c.x0 + c.w / 2}" y="${this.yTit + 18}" text-anchor="middle" font-size="11" fill="${tema.suave}">${esc(subt[i])}</text>`;
      gc.appendChild(tx);
      this.svg.appendChild(gc);
      this.colG.push(gc);
    });

    // ── Columnas 1 y 2: orbitales atómicos
    [0, 1].forEach((ci) => {
      const orbs = ci === 0 ? t.fundamental : t.excitado;
      const c = this.cols[ci];
      (['s', 'p', 'd'] as const).forEach((sub) => {
        const grupo = usados.filter(({ o }) => o.sub === sub);
        if (!grupo.length) return;
        const ancho = anchoCluster(grupo.length);
        const xs = c.x0 + (c.w - ancho) / 2;
        grupo.forEach(({ o, i }, k) => {
          const oo = orbs[i];
          const cols: string[] = [];
          for (let sl = 0; sl < oo.e; sl++) {
            let col = ROL.neutro;
            if (ci === 1) {
              const rol = t.roles[o.id]?.rol ?? 'vacio';
              col = ROL[rol === 'vacio' ? 'neutro' : rol];
              if (sl >= Math.min(t.fundamental[i].e, oo.e) && t.promociones.some((p) => p.a === oo.sub)) col = ROL.promo;
            }
            cols.push(col);
          }
          const gc = this.caja(ci, `${ci}:${o.id}`, xs + k * (B + GB), this.y(energiaSub(sub)), oo.e, cols, `${etqOrb(t.capa, o.id)}${oo.e ? ` — ${oo.e} e⁻` : ' — vacío'}`);
          if (ci === 1) {
            // el verde (promocionado) solo se ve en la etapa de promoción; luego el electrón toma el color de su función
            const rol = t.roles[o.id]?.rol ?? 'vacio';
            cols.forEach((c, sl) => {
              const el = gc.querySelector(sl === 0 ? '.e-arriba' : '.e-abajo') as SVGElement | null;
              if (el && c === ROL.promo) this.verdes.push({ el, rol: ROL[rol === 'vacio' ? 'neutro' : rol] });
            });
          }
        });
      });
    });
    // ── Columna 3: híbridos y orbitales sin hibridar
    const c3 = this.cols[2];
    if (hib) {
      const ancho = anchoCluster(hib.n);
      const xs = c3.x0 + (c3.w - ancho) / 2;
      hib.contenido.forEach((cn, k) => {
        const o = t.excitado[k];
        const rol = cn.tipo;
        this.caja(2, `2:${o.id}`, xs + k * (B + GB), this.y(energiaHib), o.e, Array(o.e).fill(ROL[rol]), `Híbrido ${hibridoTexto(hib.tipo)} (${rol === 'par' ? 'par solitario' : rol === 'sigma' ? 'enlace σ' : 'radical'})`, ROL[rol]);
      });
      const resto = usados.filter(({ i }) => i >= hib.n);
      (['p', 'd'] as const).forEach((sub) => {
        const g = resto.filter(({ o }) => o.sub === sub);
        if (!g.length) return;
        const an = anchoCluster(g.length);
        const x2 = c3.x0 + (c3.w - an) / 2;
        g.forEach(({ o, i }, k) => {
          const rol = t.roles[o.id]?.rol ?? 'vacio';
          this.caja(2, `2:${o.id}`, x2 + k * (B + GB), this.y(energiaSub(sub)), t.excitado[i].e, Array(t.excitado[i].e).fill(ROL[rol === 'vacio' ? 'neutro' : rol]), `${etqOrb(t.capa, o.id)} sin hibridar${rol === 'pi' ? ' (π)' : ''}`);
        });
      });
    } else {
      // átomo no hibridado: mismas cajas que el excitado
      usados.forEach(({ o, i }) => {
        const sub = o.sub;
        const grupo = usados.filter((u) => u.o.sub === sub);
        const k = grupo.findIndex((g) => g.i === i);
        const an = anchoCluster(grupo.length);
        const x2 = c3.x0 + (c3.w - an) / 2;
        const rol = t.roles[o.id]?.rol ?? 'vacio';
        this.caja(2, `2:${o.id}`, x2 + k * (B + GB), this.y(energiaSub(sub)), t.excitado[i].e, Array(t.excitado[i].e).fill(ROL[rol === 'vacio' ? 'neutro' : rol]), `${etqOrb(t.capa, o.id)} (p puro)`);
      });
    }
    // ── Columna 4: enlaces
    const c4 = this.cols[3];
    const yh = this.y(energiaHib);
    const cuadro = (x: number, y: number, e: number, col: string[], tit: string, borde?: string) => this.caja(3, `3:${tit}:${x}`, x, y, e, col, tit, borde);
    if (hib) {
      const grupos = {
        par: hib.contenido.map((c, k) => ({ c, k })).filter(({ c }) => c.tipo === 'par'),
        rad: hib.contenido.map((c, k) => ({ c, k })).filter(({ c }) => c.tipo === 'radical'),
        sig: hib.contenido.map((c, k) => ({ c, k })).filter(({ c }) => c.tipo === 'sigma'),
      };
      const sinLibres = grupos.par.length + grupos.rad.length;
      const anL = anchoCluster(Math.max(1, sinLibres));
      let xl = c4.x0;
      grupos.par.forEach(({ k }) => {
        cuadro(xl, yh, 2, [ROL.par, ROL.par], 'Par solitario', ROL.par);
        void k;
        xl += B + GB;
      });
      grupos.rad.forEach(() => {
        cuadro(xl, yh, 1, [ROL.radical], 'Electrón desapareado', ROL.radical);
        xl += B + GB;
      });
      void anL;
      const ys = this.y(energiaHib - 0.85);
      let xsig = c4.x0 + c4.w - anchoCluster(Math.max(1, grupos.sig.length));
      grupos.sig.forEach(({ c }, idx) => {
        const g = cuadro(xsig, ys, 1, [ROL.sigma], `σ con ${c.vecino !== undefined ? '#' + c.vecino : 'vecino'}`, ROL.sigma);
        const pk = this.flechaExtra(g, xsig + B * 0.68, ys + B / 2, false, ROL.vecino);
        pk.setAttribute('opacity', '0');
        this.pinkSigma.set(c.vecino ?? idx, pk);
        xsig += B + GB;
      });
      // etiqueta de enlaces
      if (grupos.sig.length) { this.etqSigma = { x: c4.x0 + c4.w - anchoCluster(grupos.sig.length) / 2, y: ys + B + 16 }; this.texto(this.etqSigma.x, this.etqSigma.y, 'enlaces σ', tema.suave, 10, 3); }
    } else {
      // p puro: σ y pares
      const sg = t.excitado.map((o, i) => ({ o, i })).filter(({ o }) => t.roles[o.id]?.rol === 'sigma');
      sg.forEach(({ o }, k) => {
        const ys = this.y(energiaSub(o.sub) - 0.85);
        const g = cuadro(c4.x0 + k * (B + GB), ys, 1, [ROL.sigma], `σ ${etqOrb(t.capa, o.id)}`, ROL.sigma);
        const vv = t.roles[o.id]?.vecino ?? k;
        const pk = this.flechaExtra(g, c4.x0 + k * (B + GB) + B * 0.68, ys + B / 2, false, ROL.vecino);
        pk.setAttribute('opacity', '0');
        this.pinkSigma.set(vv, pk);
      });
      t.excitado.forEach((o, i) => {
        const rol = t.roles[o.id]?.rol;
        if (rol === 'par') cuadro(c4.x0 + (sg.length + i) * (B + GB) * 0 + (sg.length + i) * (B + GB), this.y(energiaSub(o.sub)), 2, [ROL.par, ROL.par], 'Par solitario', ROL.par);
      });
    }
    // π: bajo el nivel p
    const pis = t.excitado.map((o, i) => ({ o, i })).filter(({ o }) => t.roles[o.id]?.rol === 'pi');
    if (pis.length) {
      const xp0 = c4.x0 + (c4.w - anchoCluster(pis.length)) / 2;
      const yp = this.y(E_P - 0.62);
      pis.forEach(({ o }, k) => {
        const xx = xp0 + k * (B + GB);
        const g = cuadro(xx, yp, 1, [ROL.pi], `π ${etqOrb(t.capa, o.id)}`, ROL.pi);
        const pk = this.flechaExtra(g, xx + B * 0.68, yp + B / 2, false, ROL.vecino);
        pk.setAttribute('opacity', '0');
        this.pinkPi.push(pk);
      });
      const xe = xp0 + anchoCluster(pis.length) / 2;
      // si «enlaces σ» cae justo al lado, «enlaces π» baja una línea
      const dy = this.etqSigma && Math.abs(this.etqSigma.x - xe) < 62 && Math.abs(this.etqSigma.y - (yp + B + 16)) < 13 ? 13 : 0;
      this.texto(xe, yp + B + 16 + dy, 'enlaces π', tema.suave, 10, 3);
    }

    // ── Flechas entre columnas
    const mk = (d: string, color: string, marker: string, dash = false) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.innerHTML = `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.6" ${dash ? 'stroke-dasharray="4 3"' : ''} marker-end="url(#${marker})"/>`;
      this.svg.appendChild(g);
      this.flechas.push(g);
      return g;
    };
    const mx = (i: number) => this.cols[i].x0 + this.cols[i].w + 10;
    const mxn = (i: number) => this.cols[i].x0 - 10;
    // 1→2 promoción
    const yTop = 36;
    if (t.promociones.length) {
      t.promociones.forEach((p, k) => {
        const y1 = this.y(energiaSub(p.de)) + B / 2, y2 = this.y(energiaSub(p.a)) + B / 2;
        mk(`M${mx(0)},${y1} C${mx(0) + 30},${y1} ${mxn(1) - 30},${y2} ${mxn(1)},${y2}`, ROL.promo, 'ptv');
        this.texto((mx(0) + mxn(1)) / 2, Math.min(y1, y2) - 8 - k * 13, p.texto, ROL.promo, 10.5, 0, true);
      });
      this.texto((mx(0) + mxn(1)) / 2, yTop, 'Promoción (+ΔE)', tema.suave, 11.5, 0, true);
    } else {
      this.texto((mx(0) + mxn(1)) / 2, yTop, 'Sin promoción', tema.suave, 11.5, 0, true);
      mk(`M${mx(0)},${this.y(E_P) + B / 2} L${mxn(1)},${this.y(E_P) + B / 2}`, tema.suave, 'pta', true);
    }
    // 2→3 hibridación
    if (hib) {
      const ids = new Set(hib.orbitalesIds.map((id) => id[0]));
      [...ids].forEach((sub) => {
        const y1 = this.y(energiaSub(sub)) + B / 2;
        mk(`M${mx(1)},${y1} C${mx(1) + 28},${y1} ${mxn(2) - 28},${yh + B / 2} ${mxn(2)},${yh + B / 2}`, tema.suave, 'pta');
      });
      this.texto((mx(1) + mxn(2)) / 2, yTop, `Hibridación (${hib.composicionTexto})`, tema.suave, 11.5, 1, true);
    } else this.texto((mx(1) + mxn(2)) / 2, yTop, 'Sin hibridar', tema.suave, 11.5, 1, true);
    // 3→4 enlace
    mk(`M${mx(2)},${yh + B / 2} C${mx(2) + 28},${yh + B / 2} ${mxn(3) - 28},${this.y(energiaHib - 0.85) + B / 2} ${mxn(3)},${this.y(energiaHib - 0.85) + B / 2}`, tema.suave, 'pta');
    this.texto((mx(2) + mxn(3)) / 2, yTop, 'Solapamiento (−E)', tema.suave, 11.5, 2, true);

    // Marcador de energía sobre el eje
    this.marcador = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    this.marcador.innerHTML = `<circle r="6" fill="${tema.acento}" stroke="${tema.fondo}" stroke-width="2"/>`;
    this.marcador.setAttribute('transform', `translate(40 ${this.y(0) + B / 2})`);
    this.svg.appendChild(this.marcador);

    // Electrón viajero de la promoción
    this.viaje = [];
    const orig = this.promocionesEnCajas();
    orig.forEach(({ de, a }) => {
      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.innerHTML = flecha(0, 0, true, ROL.promo, 9);
      g.setAttribute('opacity', '0');
      this.svg.appendChild(g);
      this.viaje.push({ g, de, a });
    });
    this.actualizarVacio();
  }

  private actualizarVacio() {
    this.fondoCol.forEach((f) => f.setAttribute('opacity', '0'));
  }

  /** Posiciones (centro de caja) del electrón promocionado en col. 1 y col. 2. */
  private promocionesEnCajas(): { de: Pos; a: Pos }[] {
    const t = this.t;
    const res: { de: Pos; a: Pos }[] = [];
    const movers = t.promociones;
    movers.forEach((p) => {
      const de = this.posCaja(`0:${this.primerOrbital(p.de, 'fund')}`);
      const a = this.posCaja(`1:${this.primerOrbital(p.a, 'exc')}`);
      if (de && a) res.push({ de, a });
    });
    return res;
  }
  private primerOrbital(sub: string, modo: 'fund' | 'exc'): string {
    const orb = modo === 'fund' ? this.t.fundamental : this.t.excitado;
    const ref = modo === 'fund' ? this.t.excitado : this.t.fundamental;
    const cand = orb.filter((o, i) => o.sub === sub && (modo === 'fund' ? o.e > ref[i].e : o.e > ref[i].e));
    return (cand[0] ?? orb.find((o) => o.sub === sub) ?? orb[0]).id;
  }
  private posCaja(key: string): Pos | null {
    const g = this.cajas.get(key);
    if (!g) return null;
    return { x: +g.dataset.cx!, y: +g.dataset.cy! };
  }
  private texto(x: number, y: number, txt: string, color: string, size: number, _col: number, anchorMid = true) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    el.setAttribute('x', String(x));
    el.setAttribute('y', String(y));
    el.setAttribute('font-size', String(size));
    el.setAttribute('fill', color);
    if (anchorMid) el.setAttribute('text-anchor', 'middle');
    el.textContent = txt;
    this.svg.appendChild(el);
    return el;
  }

  private flechaExtra(g: SVGGElement, cx: number, cy: number, arriba: boolean, color: string): SVGElement {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    el.innerHTML = flecha(cx, cy, arriba, color);
    g.appendChild(el);
    return el;
  }

  /** Dibuja una caja (orbital) con sus electrones. */
  private caja(col: number, key: string, x: number, y: number, e: number, colores: string[], titulo: string, borde?: string): SVGGElement {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('data-key', key);
    g.dataset.cx = String(x + B / 2);
    g.dataset.cy = String(y + B / 2);
    g.dataset.col = String(col);
    const { tema } = this;
    let h = `<title>${esc(titulo)}</title><rect class="caja-rect" x="${x}" y="${y}" width="${B}" height="${B}" rx="4" fill="${borde ? borde + '1f' : tema.caja}" stroke="${borde ?? tema.linea}" stroke-width="${borde ? 1.5 : 1.2}"/>`;
    if (e >= 1) h += flecha(x + (e === 2 ? B * 0.32 : B / 2), y + B / 2, true, colores[0] ?? ROL.neutro, 7, 'e-arriba');
    if (e === 2) h += flecha(x + B * 0.68, y + B / 2, false, colores[1] ?? ROL.neutro, 7, 'e-abajo');
    g.innerHTML = h;
    this.colG[col].appendChild(g);
    this.cajas.set(key + (this.cajas.has(key) ? ':' + this.cajas.size : ''), g);
    return g;
  }

  // ───────────────────────── Sincronización ─────────────────────────
  actualizar(info: InfoEstado | null, id: EtapaId, u: number) {
    const ei = ORDEN.indexOf(id);
    const colAct = info ? ['fund', 'exc', 'hib', 'enl'].indexOf(info.columna) : -1;
    // columnas futuras atenuadas
    const vis = [1, ei >= 2 ? 1 : 0.3, ei >= 3 ? 1 : 0.3, ei >= 5 ? 1 : 0.3];
    this.colG.forEach((g, i) => {
      const hijos = Array.from(g.children) as SVGElement[];
      hijos.forEach((c) => {
        if ((c as SVGElement).classList?.contains('fondo-col')) return;
        c.style.opacity = String(vis[i]);
        c.style.transition = 'opacity 180ms ease-out';
      });
    });
    this.fondoCol.forEach((f, i) => {
      f.setAttribute('opacity', info && i === colAct ? '0.07' : '0');
    });
    // resaltado de orbitales activos
    this.cajas.forEach((g, key) => {
      const [c, id2] = key.split(':');
      const r = g.querySelector('.caja-rect') as SVGElement | null;
      if (!r) return;
      const on = info && +c === colAct && info.resaltar.includes(id2);
      r.setAttribute('stroke-width', on ? '3' : r.getAttribute('data-sw') ?? '');
      if (!r.getAttribute('data-sw')) r.setAttribute('data-sw', r.getAttribute('stroke-width') ?? '1.2');
      r.style.filter = on ? `drop-shadow(0 0 4px ${this.tema.acento})` : '';
    });
    // criterio de color: verde solo mientras se promociona; después, el color de su función (σ, π, par…)
    this.verdes.forEach(({ el, rol }) => el.setAttribute('stroke', !info || id === 'promocion' ? ROL.promo : rol));
    // electrón promocionado en tránsito
    const p = info?.promo ?? 0;
    this.viaje.forEach(({ g, de, a }) => {
      const mid = { x: (de.x + a.x) / 2 + 26, y: Math.min(de.y, a.y) - 12 };
      const tt = p;
      const x = (1 - tt) * (1 - tt) * de.x + 2 * (1 - tt) * tt * mid.x + tt * tt * a.x;
      const y = (1 - tt) * (1 - tt) * de.y + 2 * (1 - tt) * tt * mid.y + tt * tt * a.y;
      g.setAttribute('transform', `translate(${x} ${y})`);
      g.setAttribute('opacity', id === 'promocion' && p > 0.01 && p < 0.99 ? '1' : '0');
    });
    // flechas rosa (electrones de los vecinos)
    const formados = new Set(info?.vecinosFormados ?? []);
    this.pinkSigma.forEach((el, j) => {
      const o = formados.has(j) ? 1 : info?.vecino === j ? 0.55 : ei >= 7 ? 1 : 0;
      el.setAttribute('opacity', String(o));
    });
    this.pinkPi.forEach((el) => el.setAttribute('opacity', ei >= 7 ? '1' : ei === 6 ? String(Math.min(1, u * 2)) : '0'));
    // marcador de energía
    if (info) {
      const e = 0.55 + info.energia * 0.9;
      this.marcador.setAttribute('transform', `translate(40 ${this.y(e) + B / 2})`);
    }
  }

  svgString(): string {
    const clon = this.svg.cloneNode(true) as SVGSVGElement;
    clon.querySelectorAll('[style]').forEach((el) => ((el as SVGElement).style.cssText = ''));
    const fondo = `<rect width="100%" height="100%" fill="${this.tema.fondo}"/>`;
    clon.innerHTML = fondo + clon.innerHTML;
    return new XMLSerializer().serializeToString(clon);
  }
}
