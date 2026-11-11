/**
 * Vista «estilo libro»: render 2D con algoritmo del pintor (esferas con degradado, varillas con
 * contorno, orbitales como elipses translúcidas con borde, puntos en los pares solitarios).
 */
import type { Analisis } from '../chem/analisis';
import type { Vec3 } from '../chem/vec';
import { add, cross, len, mul, norm, perpendicular, sub } from '../chem/vec';
import { grado } from '../chem/tipos';
import { ejesPi } from './marcos';

type M3 = number[][];
const mm = (A: M3, B: M3): M3 => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
const rX = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [[1, 0, 0], [0, c, -s], [0, s, c]]; };
const rY = (a: number): M3 => { const c = Math.cos(a), s = Math.sin(a); return [[c, 0, s], [0, 1, 0], [-s, 0, c]]; };
const ap = (M: M3, v: Vec3): Vec3 => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
  const m = (x: number) => Math.max(0, Math.min(255, Math.round(f > 0 ? x + (255 - x) * f : x * (1 + f))));
  return `rgb(${m(r)},${m(g)},${m(b)})`;
}
const COLOR_ESP: Record<string, string> = { H: '#f2f2f2', S: '#e6c619', C: '#4a4a4a' };

export interface LobDin { pos: Vec3; dir: Vec3; L: number; fill: string; stroke: string; ancho?: number; puntos?: number; esfera?: number }
export interface Din {
  lobulos: LobDin[];
  electrones: { pos: Vec3; color: string; espin: 1 | -1; esc: number }[];
  atomos: { visible: boolean; op: number; esc: number; pos: Vec3 }[];
  enlaces: { op: number }[];
  glows: { pos: Vec3; r: number; a: number }[];
  lineas: { a: Vec3; b: Vec3; color: string; a_: number }[];
  textos: { pos: Vec3; txt: string; tipo: string; op: number }[];
  /** 0 = solo dinámico · 1 = solo vista estática (resultado final). */
  mezcla: number;
}
const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

interface Item { z: number; draw: () => void; atom?: number; p?: { x: number; y: number }; r?: number }
export interface Opciones2D { hibridos: 'seleccionado' | 'todos' | 'ninguno'; pi: boolean; pares: boolean; paresTodos: boolean; etiquetas: boolean; orbitales: boolean }

export class Vista2D {
  readonly cv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private an: Analisis | null = null;
  private pos: Vec3[] = [];
  sel = 0;
  /** Píxeles reservados abajo (p. ej. para el botón «Ver paso a paso»). */
  margenInf = 0;
  op: Opciones2D = { hibridos: 'todos', pi: true, pares: true, paresTodos: false, etiquetas: true, orbitales: true };
  autorrotar = false;
  oscuro = false;
  onSeleccion: (i: number) => void = () => {};
  private R: M3 = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  private zoom = 1;
  private base = 80;
  private hit: Item[] = [];
  private drag: { x: number; y: number } | null = null;
  private moved = false;
  private vivo = true;
  private pis = new Map<number, Vec3[]>();
  private din: Din | null = null;
  private off: Vec3 = [0, 0, 0];
  private foco: Vec3 = [0, 0, 0];
  private focoT: Vec3 = [0, 0, 0];
  private zA = 1;
  private zT = 1;
  private esc() { return this.base * this.zoom * this.zA; }
  setDin(d: Din | null) { this.din = d; this.render(); }
  /** Acerca la cámara a un átomo (o vuelve a la molécula entera si c es null). */
  enfocar(c: number | null, zoom: number | 'molecula' = 1) {
    this.focoT = c === null ? [0, 0, 0] : this.pos[c] ?? [0, 0, 0];
    this.zAuto = zoom === 'molecula';
    this.zRel = c !== null && typeof zoom === 'number' ? zoom : null;
    this.zT = zoom === 'molecula' ? this.zoomMolecula() : zoom;
  }
  /** Zoom relativo de un átomo enfocado: en moléculas grandes (el encuadre base es pequeño) se compensa para que el átomo ocupe lo mismo. */
  private zRel: number | null = null;
  private zObjetivo(): number {
    if (this.zAuto) return this.zoomMolecula();
    if (this.zRel !== null) return this.zRel * Math.max(1, Math.min(2.2, 70 / this.base));
    return this.zT;
  }
  /** Con `enfocar(null, 'molecula')` el zoom se recalcula cada fotograma (el visor puede no tener tamaño aún). */
  private zAuto = false;

  constructor(private cont: HTMLElement) {
    this.cv = document.createElement('canvas');
    this.cv.dataset.etqPi = '[]'; this.cv.dataset.etqSigma = '[]'; this.cv.dataset.etqSolapes = '0';
    this.cv.className = 'lienzo2d';
    this.cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;cursor:grab;touch-action:' + (matchMedia('(pointer:coarse)').matches ? 'pan-y' : 'none');
    cont.appendChild(this.cv);
    this.ctx = this.cv.getContext('2d')!;
    const c = this.cv;
    // Táctil: un dedo gira (en horizontal; el desplazamiento vertical es de la página) y dos dedos hacen zoom
    const dedos = new Map<number, { x: number; y: number }>();
    let distPinza = 0;
    c.addEventListener('pointerdown', (e) => {
      dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.drag = { x: e.clientX, y: e.clientY }; this.moved = false; c.setPointerCapture(e.pointerId);
      if (dedos.size === 2) { const [a, b] = [...dedos.values()]; distPinza = Math.hypot(a.x - b.x, a.y - b.y); this.moved = true; }
    });
    c.addEventListener('pointermove', (e) => {
      if (dedos.has(e.pointerId)) dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (dedos.size === 2) {
        const [a, b] = [...dedos.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (distPinza > 0) this.zoom = Math.max(0.4, Math.min(3, this.zoom * (d / distPinza)));
        distPinza = d; this.render(); return;
      }
      if (!this.drag) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 2) this.moved = true;
      this.R = mm(mm(rY(dx * 0.01), rX(dy * 0.01)), this.R);
      this.drag = { x: e.clientX, y: e.clientY };
      this.render();
    });
    c.addEventListener('pointercancel', (e) => { dedos.delete(e.pointerId); this.drag = null; });
    c.addEventListener('pointerup', (e) => {
      dedos.delete(e.pointerId);
      if (!this.moved) {
        const b = c.getBoundingClientRect();
        const x = e.clientX - b.left, y = e.clientY - b.top;
        const h = this.hit.filter((t) => Math.hypot(t.p!.x - x, t.p!.y - y) < t.r! + 4).sort((a, b2) => b2.z - a.z)[0];
        if (h) { this.sel = h.atom!; this.onSeleccion(h.atom!); this.render(); }
      }
      this.drag = null;
    });
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.zoom = Math.max(0.4, Math.min(3, this.zoom * (e.deltaY < 0 ? 1.1 : 0.9))); this.render(); }, { passive: false });
    new ResizeObserver(() => { if (this.an) this.encuadrar(true); this.render(); }).observe(cont);
    const bucle = () => {
      if (!this.vivo) return;
      this.zT = this.zObjetivo();
      const mov = Math.abs(this.zT - this.zA) > 0.002 || len(sub(this.focoT, this.foco)) > 0.002;
      if (mov) { this.zA += (this.zT - this.zA) * 0.1; this.foco = lerp3(this.foco, this.focoT, 0.1); this.render(); }
      if (this.autorrotar && this.an && !this.drag && c.offsetParent) { this.R = mm(rY(0.008), this.R); this.render(); }
      requestAnimationFrame(bucle);
    };
    bucle();
  }

  cargar(an: Analisis, sel: number) {
    this.an = an;
    this.sel = sel;
    const P = an.geometria.pos;
    const c = mul(P.reduce((s, p) => add(s, p), [0, 0, 0] as Vec3), 1 / P.length);
    this.off = c;
    this.pos = P.map((p) => sub(p, c));
    this.din = null; this.foco = [0, 0, 0]; this.focoT = [0, 0, 0]; this.zA = 1; this.zT = 1;
    this.pis = ejesPi(an);
    this.R = mm(rX(0.32), rY(-0.45));
    this.zoom = 1;
    this.encuadrar(true);
    this.render();
  }
  encuadrar(mantener = false) {
    if (!this.an) return;
    const w = this.cv.clientWidth || 300, h = (this.cv.clientHeight || 300) - this.margenInf;
    // radio que abarca todos los átomos y sus orbitales (≈ 0,9 Å en los centros, 0,6 Å en el resto)
    const alcance = this.pos.map((p, i) => len(p) + (this.an!.estructura.atomos[i].el.simbolo !== 'H' && grado(this.an!.estructura, i) >= 2 ? 0.95 : 0.6));
    const mr = Math.max(1.1, ...alcance);
    this.base = Math.min((Math.min(w, h) * 0.4) / mr, Math.min(w, h) * 0.34);
    if (!mantener) { this.zoom = 1; this.R = mm(rX(0.32), rY(-0.45)); }
    this.render();
  }
  /** Zoom que hace que la molécula entera (átomos, sin orbitales) ocupe ≈ 52 % del visor; nunca menos que el encuadre base. */
  zoomMolecula(): number {
    if (!this.an) return 1;
    const w = this.cv.clientWidth || 300, h = (this.cv.clientHeight || 300) - this.margenInf;
    const alcance = Math.max(0.8, ...this.pos.map((p, i) => len(p) + (this.an!.estructura.atomos[i].el.simbolo === 'H' ? 0.45 : 0.7)));
    return Math.max(1, Math.min(2.6, (0.52 * Math.min(w, h)) / alcance / this.base));
  }
  mostrar(v: boolean) { this.cv.style.display = v ? '' : 'none'; if (v) { this.encuadrar(true); } }
  destruir() { this.vivo = false; }

  private proj(v: Vec3) {
    const w = ap(this.R, sub(v, this.foco));
    const k = 1 / (1 - w[2] / 14);
    const s = this.esc();
    return { x: this.cv.clientWidth / 2 + w[0] * s * k, y: (this.cv.clientHeight - this.margenInf) / 2 - w[1] * s * k, z: w[2], k };
  }

  private lobulo(items: Item[], pos: Vec3, dir: Vec3, L: number, fill: string, stroke: string, extra?: (Pc: { x: number; y: number }, Pt: { x: number; y: number }) => void, ancho = 1) {
    const c3 = add(pos, mul(dir, L * 0.55)), tip = add(pos, mul(dir, L));
    const P0 = this.proj(pos), Pc = this.proj(c3), Pt = this.proj(tip);
    const ctx = this.ctx, s = this.esc();
    items.push({
      z: Pc.z,
      draw: () => {
        const dx = Pt.x - P0.x, dy = Pt.y - P0.y, l = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
        const minor = L * 0.32 * ancho * s * Pc.k, major = Math.max(minor, l * 0.56 + minor * 0.15);
        ctx.beginPath();
        ctx.ellipse(Pc.x, Pc.y, major, minor, ang, 0, Math.PI * 2);
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.strokeStyle = stroke;
        ctx.lineWidth = 1;
        ctx.stroke();
        extra?.(Pc, Pt);
      },
    });
  }

  render() {
    const an = this.an;
    const cv = this.cv, ctx = this.ctx;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth, H = cv.clientHeight;
    if (!W || !H) return;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    if (!an) return;
    const D = this.din;
    if (D && D.mezcla < 1) { this.pintarDin(D, 1 - D.mezcla); if (D.mezcla <= 0) return; }
    ctx.globalAlpha = D ? D.mezcla : 1;
    const est = an.estructura;
    const items: Item[] = [];
    const s = this.esc();
    const col = (i: number) => COLOR_ESP[est.atomos[i].el.simbolo] ?? est.atomos[i].el.color;
    const o = this.op;
    // enlaces
    est.enlaces.forEach((b) => {
      const pa = this.proj(this.pos[b.a]), pb = this.proj(this.pos[b.b]);
      const orden = Math.max(1, Math.round(b.orden));
      items.push({
        z: (pa.z + pb.z) / 2 - 0.05,
        draw: () => {
          const dx = pb.x - pa.x, dy = pb.y - pa.y, l = Math.hypot(dx, dy) || 1;
          const nx = -dy / l, ny = dx / l;
          const gap = 0.11 * s, offs = orden === 1 ? [0] : orden === 2 ? [-gap / 2, gap / 2] : [-gap, 0, gap];
          const w = (orden === 1 ? 0.13 : 0.075) * s;
          offs.forEach((off) => {
            const ax = pa.x + nx * off, ay = pa.y + ny * off, bx = pb.x + nx * off, by = pb.y + ny * off, mx = (ax + bx) / 2, my = (ay + by) / 2;
            ctx.lineCap = 'round';
            ([[ax, ay, mx, my, col(b.a)], [mx, my, bx, by, col(b.b)]] as [number, number, number, number, string][]).forEach(([x1, y1, x2, y2, c]) => {
              ctx.strokeStyle = '#5c6170'; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
              ctx.strokeStyle = shade(c, 0.15); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            });
          });
        },
      });
    });
    // orbitales
    if (o.orbitales) {
      est.atomos.forEach((a, i) => {
        if (a.el.simbolo === 'H') return;
        const t = an.tev.atomos[i];
        if (t.error) return;
        const dom = an.geometria.dominios[i];
        const enl = dom.filter((d) => d.tipo === 'enlace');
        const libres = dom.filter((d) => d.tipo !== 'enlace');
        const activo = i === this.sel || o.hibridos === 'todos';
        if (o.hibridos !== 'ninguno' && activo && t.hibridacion) {
          enl.forEach((d) => this.lobulo(items, this.pos[i], d.dir, Math.min(0.95, 0.9 * len(sub(this.pos[d.vecino ?? i], this.pos[i]))), 'rgba(77,171,247,.42)', 'rgba(28,126,214,.7)'));
        }
        if (o.pares && libres.length && (i === this.sel || o.paresTodos)) {
          libres.forEach((d) => {
            const rad = d.tipo === 'radical';
            const fuerte = activo;
            this.lobulo(items, this.pos[i], d.dir, fuerte ? 0.9 : 0.55, fuerte ? 'rgba(177,151,252,.5)' : 'rgba(177,151,252,.28)', 'rgba(132,94,247,.75)', (Pc, Pt) => {
              const mx = Pc.x + (Pt.x - Pc.x) * 0.35, my = Pc.y + (Pt.y - Pc.y) * 0.35;
              const ang = Math.atan2(Pt.y - Pc.y, Pt.x - Pc.x) + Math.PI / 2;
              const r = 0.07 * s;
              ctx.fillStyle = '#5f3dc4';
              (rad ? [0] : [-1, 1]).forEach((tt) => { ctx.beginPath(); ctx.arc(mx + Math.cos(ang) * r * tt, my + Math.sin(ang) * r * tt, Math.max(2, 0.045 * s), 0, 7); ctx.fill(); });
            });
          });
        }
        if (o.pi && t.pi > 0 && activo) {
          const ejes: Vec3[] = [];
          est.enlaces.forEach((e, k) => {
            if ((e.a === i || e.b === i) && this.pis.has(k)) this.pis.get(k)!.forEach((ax) => { if (!ejes.some((x) => Math.abs(x[0] * ax[0] + x[1] * ax[1] + x[2] * ax[2]) > 0.95)) ejes.push(ax); });
          });
          ejes.forEach((ax) => {
            this.lobulo(items, this.pos[i], ax, 0.8, 'rgba(255,146,43,.45)', 'rgba(232,89,12,.75)');
            this.lobulo(items, this.pos[i], mul(ax, -1), 0.8, 'rgba(116,192,252,.45)', 'rgba(28,126,214,.7)');
          });
        }
      });
    }
    // átomos
    est.atomos.forEach((a, i) => {
      const p = this.proj(this.pos[i]);
      const r = (a.el.simbolo === 'H' ? 0.24 : 0.2 + 0.2 * (a.el.radio / 100)) * s * p.k;
      items.push({
        z: p.z, atom: i, p, r,
        draw: () => {
          const c = col(i);
          const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
          g.addColorStop(0, shade(c, 0.65)); g.addColorStop(0.6, c); g.addColorStop(1, shade(c, -0.45));
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fillStyle = g; ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke();
          if (i === this.sel) { ctx.setLineDash([4, 3]); ctx.strokeStyle = '#f08c00'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(p.x, p.y, r + 5, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
          if (o.etiquetas) {
            const n = parseInt(c.slice(1), 16);
            const br = ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
            ctx.fillStyle = br > 150 ? '#222' : '#fff';
            ctx.font = `700 ${Math.max(11, r * 0.85)}px Inter, system-ui, sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(a.el.simbolo, p.x, p.y + 1);
          }
        },
      });
    });
    items.sort((a, b) => a.z - b.z).forEach((it) => it.draw());
    this.hit = items.filter((x) => x.atom != null);
    ctx.globalAlpha = 1;
  }

  /** Escena de la animación paso a paso (misma estética que la vista de resultado). */
  private pintarDin(D: Din, alpha: number) {
    const an = this.an!, est = an.estructura, ctx = this.ctx, s = this.esc();
    const O = (p: Vec3): Vec3 => sub(p, this.off);
    const items: Item[] = [];
    const col = (i: number) => COLOR_ESP[est.atomos[i].el.simbolo] ?? est.atomos[i].el.color;
    const rad = (i: number, p: { k: number }) => (est.atomos[i].el.simbolo === 'H' ? 0.24 : 0.2 + 0.2 * (est.atomos[i].el.radio / 100)) * s * p.k * (D.atomos[i]?.esc ?? 1);
    est.enlaces.forEach((b, k) => {
      const op = D.enlaces[k]?.op ?? 0;
      if (op < 0.02 || !D.atomos[b.a]?.visible || !D.atomos[b.b]?.visible) return;
      const pa = this.proj(O(D.atomos[b.a].pos)), pb = this.proj(O(D.atomos[b.b].pos));
      const orden = Math.max(1, Math.round(b.orden));
      items.push({ z: (pa.z + pb.z) / 2 - 0.05, draw: () => {
        const dx = pb.x - pa.x, dy = pb.y - pa.y, l = Math.hypot(dx, dy) || 1, nx = -dy / l, ny = dx / l;
        const gap = 0.11 * s, offs = orden === 1 ? [0] : orden === 2 ? [-gap / 2, gap / 2] : [-gap, 0, gap];
        const w = (orden === 1 ? 0.13 : 0.075) * s;
        ctx.globalAlpha = alpha * Math.min(1, op);
        offs.forEach((off) => {
          const ax = pa.x + nx * off, ay = pa.y + ny * off, bx = pb.x + nx * off, by = pb.y + ny * off, mx = (ax + bx) / 2, my = (ay + by) / 2;
          ctx.lineCap = 'round';
          ([[ax, ay, mx, my, col(b.a)], [mx, my, bx, by, col(b.b)]] as [number, number, number, number, string][]).forEach(([x1, y1, x2, y2, c]) => {
            ctx.strokeStyle = '#5c6170'; ctx.lineWidth = w + 2; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
            ctx.strokeStyle = shade(c, 0.15); ctx.lineWidth = w; ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
          });
        });
      } });
    });
    D.lobulos.forEach((l) => {
      const pw = O(l.pos);
      if (l.esfera) {
        const p = this.proj(pw), r = l.esfera * s * p.k;
        items.push({ z: p.z, draw: () => { ctx.globalAlpha = alpha; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fillStyle = l.fill; ctx.fill(); ctx.strokeStyle = l.stroke; ctx.lineWidth = 1; ctx.stroke(); } });
        return;
      }
      const puntos = l.puntos ?? 0;
      this.lobulo(items, pw, l.dir, l.L, l.fill, l.stroke, puntos ? (Pc, Pt) => {
        const mx = Pc.x + (Pt.x - Pc.x) * 0.35, my = Pc.y + (Pt.y - Pc.y) * 0.35, ang = Math.atan2(Pt.y - Pc.y, Pt.x - Pc.x) + Math.PI / 2, r = 0.07 * s;
        ctx.fillStyle = '#5f3dc4';
        (puntos === 1 ? [0] : [-1, 1]).forEach((tt) => { ctx.beginPath(); ctx.arc(mx + Math.cos(ang) * r * tt, my + Math.sin(ang) * r * tt, Math.max(2, 0.045 * s), 0, 7); ctx.fill(); });
      } : undefined, l.ancho ?? 1);
      const it = items[items.length - 1], d0 = it.draw;
      it.draw = () => { ctx.globalAlpha = alpha; d0(); };
    });
    D.atomos.forEach((a, i) => {
      if (!a?.visible || a.op < 0.02) return;
      const p = this.proj(O(a.pos)), r = rad(i, p);
      items.push({ z: p.z + 0.001, draw: () => {
        ctx.globalAlpha = alpha * Math.min(1, a.op);
        const c = col(i);
        const g = ctx.createRadialGradient(p.x - r * 0.35, p.y - r * 0.35, r * 0.1, p.x, p.y, r);
        g.addColorStop(0, shade(c, 0.65)); g.addColorStop(0.6, c); g.addColorStop(1, shade(c, -0.45));
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fillStyle = g; ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.stroke();
        if (a.esc > 0.8 && this.op.etiquetas) {
          const n = parseInt(c.slice(1), 16), br = ((n >> 16) * 299 + ((n >> 8) & 255) * 587 + (n & 255) * 114) / 1000;
          ctx.fillStyle = br > 150 ? '#222' : '#fff'; ctx.font = `700 ${Math.max(11, r * 0.85)}px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText(est.atomos[i].el.simbolo, p.x, p.y + 1);
        } else if (a.esc <= 0.8) {
          ctx.fillStyle = this.oscuro ? '#e9ecf3' : '#1a1d24'; ctx.font = `700 12px Inter, system-ui, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
          ctx.fillText(est.atomos[i].el.simbolo, p.x, p.y - r - 3);
        }
      } });
    });
    D.glows.forEach((g) => {
      const p = this.proj(O(g.pos)), r = g.r * s * p.k;
      items.push({ z: p.z + 0.5, draw: () => { ctx.globalAlpha = alpha * Math.min(1, g.a); const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r); gr.addColorStop(0, 'rgba(255,236,120,.95)'); gr.addColorStop(1, 'rgba(255,220,100,0)'); ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); } });
    });
    D.lineas.forEach((l) => {
      if (l.a_ < 0.03) return;
      const a = this.proj(O(l.a)), b = this.proj(O(l.b));
      items.push({ z: Math.max(a.z, b.z) + 0.4, draw: () => { ctx.globalAlpha = alpha * Math.min(1, l.a_); ctx.setLineDash([5, 4]); ctx.strokeStyle = l.color; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.setLineDash([]); } });
    });
    D.electrones.forEach((e) => {
      const p = this.proj(O(e.pos)), r = Math.max(4.5, 0.075 * s * p.k * e.esc);
      items.push({ z: p.z + 1, draw: () => {
        ctx.globalAlpha = alpha;
        ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fillStyle = e.color; ctx.fill(); ctx.strokeStyle = 'rgba(10,14,40,.85)'; ctx.lineWidth = 1.5; ctx.stroke();
        const h = r * 0.55, up = e.espin === 1;
        ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.3, r * 0.2); ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(p.x, p.y + (up ? h : -h)); ctx.lineTo(p.x, p.y + (up ? -h : h)); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(p.x - r * 0.28, p.y + (up ? -h * 0.2 : h * 0.2)); ctx.lineTo(p.x, p.y + (up ? -h : h)); ctx.lineTo(p.x + r * 0.28, p.y + (up ? -h * 0.2 : h * 0.2)); ctx.stroke();
      } });
    });
    // para las pruebas: etiquetas σ y π visibles en este fotograma (y solapes tras recolocar: siempre 0)
    this.cv.dataset.etqPi = JSON.stringify(D.textos.filter((t) => t.tipo === 'pi' && t.op >= 0.5).map((t) => t.txt));
    this.cv.dataset.etqSigma = JSON.stringify(D.textos.filter((t) => t.tipo === 'chip' && t.op >= 0.5 && t.txt.startsWith('σ')).map((t) => t.txt));
    // Las etiquetas nunca se solapan: si chocan, la que llega después se desplaza (arriba/abajo, y a los lados si hace falta)
    const colocadas: { x: number; y: number; w: number; h: number }[] = [];
    const choca = (r: { x: number; y: number; w: number; h: number }) => colocadas.some((q) => Math.abs(r.x - q.x) < (r.w + q.w) / 2 + 2 && Math.abs(r.y - q.y) < (r.h + q.h) / 2 + 2);
    ctx.font = '600 12px Inter, system-ui, sans-serif';
    D.textos.forEach((t) => {
      if (t.op < 0.03) return;
      const p = { ...this.proj(O(t.pos)) };
      const serif = t.tipo === 'hib';
      ctx.font = serif ? '600 15px Fraunces, Georgia, serif' : '600 12px Inter, system-ui, sans-serif';
      const r = { x: p.x, y: p.y, w: ctx.measureText(t.txt).width + 16, h: serif ? 26 : 20 };
      if (choca(r)) {
        let ok = false;
        for (let k = 1; k <= 8 && !ok; k++) {
          for (const [dx, dy] of [[0, -1], [0, 1], [1, 0], [-1, 0], [1, -1], [-1, -1], [1, 1], [-1, 1]]) {
            const c = { ...r, x: p.x + dx * k * (r.w * 0.5 + 4) * (dy === 0 ? 1 : 0.6), y: p.y + dy * k * (r.h + 2) };
            if (!choca(c)) { r.x = c.x; r.y = c.y; ok = true; break; }
          }
        }
      }
      colocadas.push(r);
      p.x = r.x; p.y = r.y;
      items.push({ z: 1e9, draw: () => {
        ctx.globalAlpha = alpha * Math.min(1, t.op);
        const serif = t.tipo === 'hib';
        ctx.font = serif ? '600 15px Fraunces, Georgia, serif' : '600 12px Inter, system-ui, sans-serif';
        const w = ctx.measureText(t.txt).width + 16, h = serif ? 26 : 20;
        // Etiquetas σ (azul) y π (naranja): fondo opaco, por delante de los orbitales, legibles en claro y oscuro
        const fondo = t.tipo === 'chip' ? (this.oscuro ? '#16284a' : '#e6efff') : t.tipo === 'pi' ? (this.oscuro ? '#3b2a0c' : '#fff0d3') : this.oscuro ? '#151a26' : '#ffffff';
        ctx.fillStyle = fondo; ctx.strokeStyle = t.tipo === 'chip' ? (this.oscuro ? '#6b9bff' : '#3b82f6') : t.tipo === 'pi' ? (this.oscuro ? '#fbbf24' : '#e8890c') : t.tipo === 'ang' ? '#f59e0b' : this.oscuro ? '#2a3249' : '#d9d3c3';
        ctx.beginPath(); ctx.roundRect(p.x - w / 2, p.y - h / 2, w, h, h / 2); ctx.fill(); ctx.lineWidth = 1.2; ctx.stroke();
        ctx.fillStyle = this.oscuro ? '#e9ecf3' : '#1a1d24'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(t.txt, p.x, p.y + 1);
      } });
    });
    let solapes = 0;
    colocadas.forEach((a, i) => colocadas.slice(i + 1).forEach((b) => { if (Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2) solapes++; }));
    this.cv.dataset.etqSolapes = String(solapes);
    items.sort((a, b) => a.z - b.z).forEach((it) => it.draw());
    ctx.globalAlpha = 1;
  }

  exportarPNG(nombre: string) {
    this.render();
    const cv2 = document.createElement('canvas');
    cv2.width = this.cv.width; cv2.height = this.cv.height;
    const g = cv2.getContext('2d')!;
    g.fillStyle = this.oscuro ? '#0f1524' : '#f4f6fa';
    g.fillRect(0, 0, cv2.width, cv2.height);
    g.drawImage(this.cv, 0, 0);
    const a = document.createElement('a');
    a.download = nombre; a.href = cv2.toDataURL('image/png'); a.click();
  }
  dataURL(): string {
    this.render();
    const cv2 = document.createElement('canvas');
    cv2.width = this.cv.width; cv2.height = this.cv.height;
    const g = cv2.getContext('2d')!;
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, cv2.width, cv2.height); g.drawImage(this.cv, 0, 0);
    return cv2.toDataURL('image/png');
  }
}
void cross; void norm; void perpendicular;
