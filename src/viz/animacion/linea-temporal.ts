/**
 * Línea temporal: reproduce el plan etapa a etapa. El estado de la escena es una función
 * determinista de (etapa, u), así que se puede ir a cualquier punto sin saltos.
 */
import type { Analisis } from '../../chem/analisis';
import { vecinos } from '../../chem/tipos';
import type { Escena3D } from '../escena3d';
import type { Ctx, InfoEstado } from '../orbitales-atomo';
import { OrbitalesAtomo } from '../orbitales-atomo';
import type { Etapa } from './plan';
import { construirPlan } from './plan';

export interface EstadoLT {
  idx: number;
  etapa: Etapa;
  u: number;
  t: number;
  total: number;
  info: InfoEstado;
  reproduciendo: boolean;
}
export type ModoReproduccion = 'continuo' | 'paso';

export const VELOCIDADES = [0.5, 1, 2];

export class LineaTemporal {
  plan: Etapa[] = [];
  inicios: number[] = [];
  total = 0;
  t = 0;
  reproduciendo = false;
  velocidad = 1;
  modo: ModoReproduccion = 'continuo';
  secuencia = false;
  reducido = false;
  onEstado: (e: EstadoLT) => void = () => {};
  ctx: Ctx = { orbitales: true, pi: true, pares: true, electrones: true };
  /** Qué híbridos se ven en el estado estático final. */
  hibridos: 'seleccionado' | 'todos' | 'ninguno' = 'todos';
  /** Pares solitarios de todos los átomos (por defecto, solo los del átomo seleccionado). */
  paresTodos = false;

  /** Salida 2D (estilo libro) que alimentan los rigs. */
  vista: { setDin: (d: import('../vista2d').Din | null) => void } | null = null;
  onCamara: (et: Etapa) => void = () => {};
  private an: Analisis | null = null;
  private centro = 0;
  private rigs = new Map<number, OrbitalesAtomo>();
  private ultimaEtapa = -1;
  private ultimoEstado: EstadoLT | null = null;
  private activo = false;
  /** Mientras es falso se muestra la molécula final estática sin animar. */
  estatico = true;

  constructor(private escena: Escena3D) {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    this.reducido = !!mq?.matches;
    mq?.addEventListener?.('change', (e) => (this.reducido = e.matches));
    escena.onFrame = (dt) => this.tick(dt);
  }

  // ───────────────────────── Configuración ─────────────────────────
  cargar(an: Analisis, centro: number = an.centros[0] ?? 0) {
    this.limpiarRigs();
    this.an = an;
    this.centro = centro;
    this.reconstruirPlan();
    this.irAEtapa(this.plan.length - 1, 1);
    this.mostrarFinalEstatico();
  }
  seleccionarCentro(c: number) {
    if (!this.an) return;
    this.centro = c;
    const idx = this.ultimoEstado?.idx ?? this.plan.length - 1;
    const id = this.ultimoEstado?.etapa.id;
    this.reconstruirPlan();
    // Conserva la etapa lógica si existe en el nuevo plan
    const nuevo = this.plan.findIndex((e) => e.id === id);
    const dest = nuevo >= 0 ? nuevo : Math.min(idx, this.plan.length - 1);
    this.irAEtapa(dest, 1);
    if (this.plan[dest].id === 'final') this.mostrarFinalEstatico();
  }
  setSecuencia(v: boolean) {
    this.secuencia = v;
    if (!this.an) return;
    this.reconstruirPlan();
    this.irAEtapa(this.plan.length - 1, 1);
    this.mostrarFinalEstatico();
  }
  private reconstruirPlan() {
    const an = this.an!;
    if (this.secuencia && an.centros.length > 1) {
      const plan: Etapa[] = [];
      an.centros.forEach((c, k) => {
        const p = construirPlan(an, c, k === an.centros.length - 1);
        plan.push(...(k === an.centros.length - 1 ? p : p.filter((e) => e.id !== 'final')));
      });
      this.plan = plan;
    } else this.plan = construirPlan(an, this.centro, true);
    this.inicios = [];
    let acc = 0;
    for (const e of this.plan) {
      this.inicios.push(acc);
      acc += e.duracion;
    }
    this.total = acc;
  }
  private duracion(i: number) {
    return this.plan[i].duracion;
  }
  private limpiarRigs() {
    this.rigs.forEach((r) => r.dispose());
    this.rigs.clear();
    this.ultimoEstado = null;
    this.ultimaEtapa = -1;
  }
  private rig(c: number): OrbitalesAtomo {
    let r = this.rigs.get(c);
    if (!r) {
      r = new OrbitalesAtomo(this.escena, this.an!, c);
      r.vista = this.vista;
      this.rigs.set(c, r);
    }
    return r;
  }

  // ───────────────────────── Control ─────────────────────────
  get indice() {
    return this.ultimoEstado?.idx ?? 0;
  }
  /** Va a un instante global (segundos). */
  ir(t: number) {
    if (!this.plan.length) return;
    this.t = Math.max(0, Math.min(this.total, t));
    this.aplicarT();
  }
  irAEtapa(i: number, u = 0) {
    if (!this.plan.length) return;
    i = Math.max(0, Math.min(this.plan.length - 1, i));
    this.t = this.inicios[i] + u * this.duracion(i) - (u >= 1 ? 1e-6 : 0);
    this.estatico = false;
    this.aplicarT();
  }
  inicio() {
    this.pausar();
    this.irAEtapa(0, 0);
  }
  fin() {
    this.pausar();
    this.irAEtapa(this.plan.length - 1, 1);
  }
  siguiente() {
    const s = this.ultimoEstado;
    if (!s) return;
    if (s.idx >= this.plan.length - 1) return this.irAEtapa(s.idx, 1);
    this.irAEtapa(s.idx + 1, 0);
  }
  anterior() {
    const s = this.ultimoEstado;
    if (!s) return;
    if (s.u > 0.06 || s.idx === 0) this.irAEtapa(s.idx, 0);
    else this.irAEtapa(s.idx - 1, 0);
  }
  reproducir() {
    if (!this.plan.length) return;
    if (this.t >= this.total - 0.01) this.irAEtapa(0, 0);
    else if (this.ultimoEstado && this.modo === 'paso' && this.ultimoEstado.u >= 0.995) this.irAEtapa(Math.min(this.plan.length - 1, this.ultimoEstado.idx + 1), 0);
    this.estatico = false;
    this.reproduciendo = true;
    this.emitir();
  }
  pausar() {
    this.reproduciendo = false;
    this.emitir();
  }
  alternar() {
    this.reproduciendo ? this.pausar() : this.reproducir();
  }
  setVelocidad(v: number) {
    this.velocidad = v;
  }

  private tick(dt: number) {
    if (!this.reproduciendo || !this.plan.length) return;
    const antes = this.ultimoEstado?.idx ?? 0;
    this.t += dt * this.velocidad;
    if (this.t >= this.total) {
      this.t = this.total - 1e-6;
      this.reproduciendo = false;
    } else if (this.modo === 'paso') {
      const fin = this.inicios[antes] + this.duracion(antes);
      if (this.t >= fin) {
        this.t = fin - 1e-6;
        this.reproduciendo = false;
      }
    }
    this.aplicarT();
  }

  /** Reaplica el estado actual (p. ej. al cambiar interruptores). */
  refrescar() {
    if (this.estatico || !this.ultimoEstado) this.mostrarFinalEstatico();
    else this.aplicarT();
  }

  // ───────────────────────── Aplicación del estado ─────────────────────────
  private localizar(): { idx: number; u: number } {
    let i = this.plan.length - 1;
    for (let k = 0; k < this.plan.length; k++) {
      if (this.t < this.inicios[k] + this.duracion(k)) { i = k; break; }
    }
    const d = this.duracion(i);
    let u = Math.max(0, Math.min(1, (this.t - this.inicios[i]) / d));
    return { idx: i, u };
  }
  private previosDe(idx: number): Set<number> {
    const s = new Set<number>();
    if (!this.secuencia || !this.an) return s;
    const actual = this.plan[idx].centro;
    for (const e of this.plan.slice(0, idx)) {
      if (e.centro === actual) continue;
      s.add(e.centro);
      vecinos(this.an.estructura, e.centro).forEach((v) => s.add(v.j));
    }
    return s;
  }

  private aplicarT() {
    if (!this.an) return;
    this.estatico = false;
    const { idx, u } = this.localizar();
    const et = this.plan[idx];
    const previos = this.previosDe(idx);
    this.escena.grupoExtras.visible = et.id === 'final';
    // Solo el rig del centro actual se anima; los anteriores quedan en estado final atenuado
    this.rigs.forEach((r, c) => r.visible(c === et.centro));
    const rg = this.rig(et.centro);
    rg.visible(true);
    if (this.secuencia) {
      const hechos = new Set(this.plan.slice(0, idx).map((e) => e.centro));
      hechos.delete(et.centro);
      hechos.forEach((c) => {
        const r = this.rig(c);
        r.visible(true);
        r.aplicar('final', 1, { ...this.ctx, previos: new Set(), opacidad: 0.45 });
      });
    }
    const info = rg.aplicar(et.id, u, { ...this.ctx, previos });
    if (idx !== this.ultimaEtapa) {
      this.ultimaEtapa = idx;
      this.camara(et);
    }
    this.escena.pedirRender();
    this.ultimoEstado = { idx, etapa: et, u, t: this.t, total: this.total, info, reproduciendo: this.reproduciendo };
    this.emitir();
  }

  private camara(et: Etapa) {
    this.onCamara(et);
    const e = this.escena;
    if (!this.an) return;
    if (et.id === 'final') e.encuadrar(false);
    else if (et.id === 'vecinos' || et.id === 'pi') e.enfocar(et.centro, Math.min(6.5, Math.max(4.8, e.radioEscena * 1.5))); // vecindad del átomo: no se aleja en moléculas grandes
    else e.enfocar(et.centro, 4.0);
  }

  private emitir() {
    if (this.ultimoEstado) {
      this.ultimoEstado.reproduciendo = this.reproduciendo;
      this.onEstado(this.ultimoEstado);
    }
  }

  // ───────────────────────── Vista estática ─────────────────────────
  /** Molécula completa con los orbitales que pidan los interruptores. */
  mostrarFinalEstatico() {
    if (!this.an) return;
    this.estatico = true;
    this.reproduciendo = false;
    this.rigs.forEach((r) => r.visible(false));
    this.escena.grupoExtras.visible = true;
    this.escena.restablecer();
    const an = this.an;
    const pesados = an.estructura.atomos.map((a, i) => (a.el.simbolo !== 'H' ? i : -1)).filter((i) => i >= 0);
    const lista = this.hibridos === 'todos' ? (pesados.length <= 12 ? pesados : an.centros) : this.hibridos === 'seleccionado' ? [this.escena.sel] : [];
    const centrosRig = new Set(an.centros);
    // átomos terminales seleccionados también tienen orbitales
    lista.forEach((c) => {
      if (an.tev.atomos[c].error) return;
      void centrosRig;
      const r = this.rig(c);
      r.visible(true);
      r.aplicar('final', 1, { ...this.ctx, orbitales: this.ctx.orbitales !== false, pares: this.ctx.pares !== false && (c === this.escena.sel || this.paresTodos) });
    });
    this.escena.actualizarEnlaces();
    this.escena.refrescarExtras();
    this.escena.pedirRender();
  }

  /** Estado actual con u = 1 en la etapa final, usado al abrir una molécula. */
  get activa() {
    return this.activo;
  }
  set activa(v: boolean) {
    this.activo = v;
  }
}
