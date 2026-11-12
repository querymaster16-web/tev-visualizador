/** Escena Three.js: moléculas (bolas y varillas / spacefill / esqueleto), etiquetas, ángulos, dipolo, medidas. */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Analisis } from '../chem/analisis';
import { textoMu } from '../chem/dipolos';
import { num } from '../chem/formato';
import { cargaTexto } from '../chem/formato';
import { hibridoTexto } from '../chem/formato';
import { vecinos } from '../chem/tipos';
import type { Vec3 } from '../chem/vec';
import { anguloEntre, sub } from '../chem/vec';
import { ejesPi } from './marcos';
import { protegerVisor } from './tactil';

export type Modo = 'bolas' | 'spacefill' | 'esqueleto';

export interface Interruptores {
  hibridos: 'seleccionado' | 'todos' | 'ninguno';
  pi: boolean;
  pares: boolean;
  electrones: boolean;
  etiquetas: boolean;
  angulos: boolean;
  dipolo: boolean;
  ejes: boolean;
  orbitales: boolean;
}
export const INTERRUPTORES_INICIALES: Interruptores = {
  hibridos: 'seleccionado', pi: true, pares: true, electrones: true, etiquetas: true, angulos: false, dipolo: true, ejes: false, orbitales: true,
};

const v3 = (v: Vec3) => new THREE.Vector3(v[0], v[1], v[2]);

export class Escena3D {
  readonly renderer: THREE.WebGLRenderer;
  readonly labelRenderer: CSS2DRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  readonly controls: OrbitControls;
  /** Contenedor de todo lo que pertenece a la molécula (orbitales incluidos). */
  readonly raiz = new THREE.Group();
  readonly grupoAtomos = new THREE.Group();
  readonly grupoEnlaces = new THREE.Group();
  readonly grupoExtras = new THREE.Group(); // ángulos, dipolo, medidas
  readonly grupoOrbitales = new THREE.Group();

  analisis: Analisis | null = null;
  modo: Modo = 'bolas';
  sel = 0;
  radioEscena = 3;
  radioEncuadre = 2;
  private camaraTocada = false;
  centro = new THREE.Vector3();
  private atomos: THREE.Group[] = [];
  private bolas: THREE.Mesh[] = [];
  private halos: THREE.Mesh[] = [];
  private etiquetas: CSS2DObject[] = [];
  private enlaces: { g: THREE.Group; k: number; varillas: THREE.Mesh[]; offs: number[]; vis: boolean; op: number }[] = [];
  private estadoAtomo: { visible: boolean; op: number; esc: number }[] = [];
  private ejesObj: THREE.Group | null = null;
  private sombra: THREE.Mesh | null = null;
  private dipoloObj: THREE.Group | null = null;
  private anguloObjs: THREE.Object3D[] = [];
  private medObjs: THREE.Object3D[] = [];
  private medicion: number[] = [];
  modoMedir = false;
  oscuro = false;
  inter: Interruptores = { ...INTERRUPTORES_INICIALES };
  onSeleccion: (i: number) => void = () => {};
  onMedicion: (txt: string) => void = () => {};
  /** Se llama en cada fotograma (para la animación). */
  onFrame: (dt: number) => void = () => {};
  private tooltip: HTMLDivElement;
  private ray = new THREE.Raycaster();
  private ptr = new THREE.Vector2();
  private reloj = new THREE.Clock();
  private alive = true;
  private necesitaRender = true;

  constructor(readonly contenedor: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.domElement.className = 'lienzo3d';
    contenedor.appendChild(this.renderer.domElement);
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'capa-etiquetas';
    contenedor.appendChild(this.labelRenderer.domElement);
    this.tooltip = document.createElement('div');
    this.tooltip.className = 'tooltip3d';
    this.tooltip.hidden = true;
    contenedor.appendChild(this.tooltip);

    this.camera.position.set(4, 3, 7);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.addEventListener('change', () => (this.necesitaRender = true));
    this.controls.addEventListener('start', () => (this.camaraTocada = true));
    protegerVisor(contenedor, this.renderer.domElement, () => this.encuadrar());

    // Iluminación suave: hemisférica + direccional + relleno
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a93a8, 1.35));
    const sol = new THREE.DirectionalLight(0xffffff, 1.9);
    sol.position.set(5, 8, 6);
    this.scene.add(sol);
    const rel = new THREE.DirectionalLight(0xbcd0ff, 0.6);
    rel.position.set(-6, -2, -4);
    this.scene.add(rel);

    this.raiz.add(this.grupoAtomos, this.grupoEnlaces, this.grupoExtras, this.grupoOrbitales);
    this.scene.add(this.raiz);

    const ro = new ResizeObserver(() => this.redimensionar());
    ro.observe(contenedor);
    this.redimensionar();

    const el = this.renderer.domElement;
    let down: { x: number; y: number } | null = null;
    el.addEventListener('pointerdown', (e) => (down = { x: e.clientX, y: e.clientY }));
    el.addEventListener('pointerup', (e) => {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 5) this.clic(e);
      down = null;
    });
    el.addEventListener('pointermove', (e) => this.hover(e));
    el.addEventListener('pointerleave', () => (this.tooltip.hidden = true));
    this.bucle();
  }

  // ───────────────────────── Ciclo de vida ─────────────────────────
  private redimensionar() {
    const w = this.contenedor.clientWidth || 300, h = this.contenedor.clientHeight || 300;
    this.renderer.setSize(w, h, false);
    this.renderer.domElement.style.width = w + 'px';
    this.renderer.domElement.style.height = h + 'px';
    this.labelRenderer.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.analisis && !this.camaraTocada) this.encuadrar(true); // el visor cambió de tamaño: la molécula sigue entera
    this.necesitaRender = true;
  }

  private bucle = () => {
    if (!this.alive) return;
    requestAnimationFrame(this.bucle);
    const dt = Math.min(this.reloj.getDelta(), 0.1);
    this.onFrame(dt);
    const moved = this.controls.update();
    // con el «estilo libro» el lienzo WebGL está oculto: no se gasta GPU/CPU en dibujarlo
    if (!this.renderer.domElement.offsetParent) return;
    if (this.necesitaRender || moved || this.controls.autoRotate) {
      this.renderer.render(this.scene, this.camera);
      this.labelRenderer.render(this.scene, this.camera);
      this.separarEtiquetas();
      this.necesitaRender = false;
    }
  };
  /** Etiquetas σ/π/ángulo/dipolo: si dos se solapan en pantalla, la segunda se desplaza (añade un translate al que fija CSS2DRenderer). */
  private separarEtiquetas() {
    const els = Array.from(this.labelRenderer.domElement.querySelectorAll<HTMLElement>('.etiqueta-atomo,.etiqueta-sigma,.etiqueta-pi,.etiqueta-medida,.etiqueta-hibrido'))
      .filter((e) => e.style.display !== 'none' && Number(e.style.opacity || 1) > 0.03);
    const base = this.labelRenderer.domElement.getBoundingClientRect();
    const col: { x: number; y: number; w: number; h: number }[] = [];
    const choca = (r: { x: number; y: number; w: number; h: number }) => col.some((q) => Math.abs(r.x - q.x) < (r.w + q.w) / 2 + 2 && Math.abs(r.y - q.y) < (r.h + q.h) / 2 + 2);
    let n = 0;
    for (const el of els) {
      const b = el.getBoundingClientRect();
      if (!b.width) continue;
      const r = { x: b.left - base.left + b.width / 2, y: b.top - base.top + b.height / 2, w: b.width, h: b.height };
      let dx = 0, dy = 0;
      if (choca(r)) {
        outer: for (let k = 1; k <= 8; k++) for (const [ux, uy] of [[0, -1], [0, 1], [1, 0], [-1, 0], [1, -1], [-1, -1], [1, 1], [-1, 1]]) {
          const c = { ...r, x: r.x + ux * k * (r.w * 0.5 + 4) * (uy === 0 ? 1 : 0.6), y: r.y + uy * k * (r.h + 2) };
          if (!choca(c)) { dx = c.x - r.x; dy = c.y - r.y; r.x = c.x; r.y = c.y; break outer; }
        }
      }
      // y dentro del visor: una etiqueta nunca queda cortada por el borde
      const mx = Math.max(2 - (r.x - r.w / 2), 0) + Math.min(base.width - 2 - (r.x + r.w / 2), 0), my = Math.max(2 - (r.y - r.h / 2), 0) + Math.min(base.height - 2 - (r.y + r.h / 2), 0);
      if (mx || my) { dx += mx; dy += my; r.x += mx; r.y += my; }
      if (dx || dy) { el.style.transform += ` translate(${dx.toFixed(1)}px,${dy.toFixed(1)}px)`; n++; }
      col.push(r);
    }
    this.labelRenderer.domElement.dataset.desplazadas = String(n);
  }
  pedirRender() {
    this.necesitaRender = true;
  }
  destruir() {
    this.alive = false;
    this.renderer.dispose();
  }

  // ───────────────────────── Carga de molécula ─────────────────────────
  limpiar() {
    for (const g of [this.grupoAtomos, this.grupoEnlaces, this.grupoExtras]) {
      while (g.children.length) {
        const o = g.children[0];
        g.remove(o);
        o.traverse((c) => {
          const m = c as THREE.Mesh;
          m.geometry?.dispose?.();
          (c as CSS2DObject).element?.remove();
        });
      }
    }
    this.etiquetas.forEach((e) => e.element.remove());
    this.atomos = []; this.bolas = []; this.halos = []; this.etiquetas = []; this.enlaces = [];
    this.anguloObjs = []; this.medObjs = []; this.medicion = [];
    if (this.sombra) { this.scene.remove(this.sombra); this.sombra = null; }
    if (this.ejesObj) { this.quitar(this.ejesObj); this.ejesObj = null; }
    this.dipoloObj = null;
  }

  cargar(an: Analisis, seleccion = an.centros[0] ?? 0) {
    this.limpiar();
    this.analisis = an;
    this.sel = seleccion;
    const P = an.geometria.pos;
    const est = an.estructura;
    // centro y radio
    const c = new THREE.Vector3();
    P.forEach((p) => c.add(v3(p)));
    c.multiplyScalar(1 / P.length);
    this.centro.copy(c);
    this.radioEscena = Math.max(1.6, ...P.map((p) => v3(p).distanceTo(c))) + 0.8;
    // encuadre más ajustado: una molécula pequeña (CH₄, NH₃…) debe ocupar buena parte del visor
    this.radioEncuadre = Math.max(0.8, ...P.map((p) => v3(p).distanceTo(c))) + 0.85; // átomos + lóbulos de los orbitales

    est.atomos.forEach((a, i) => {
      const g = new THREE.Group();
      g.position.copy(v3(P[i]));
      const mat = new THREE.MeshPhysicalMaterial({
        color: a.el.color, roughness: 0.22, metalness: 0.02, clearcoat: 0.9, clearcoatRoughness: 0.12,
      });
      if (a.el.simbolo === 'H') mat.color.set('#f4f6fb');
      const bola = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), mat);
      bola.userData.idx = i;
      const halo = new THREE.Mesh(
        new THREE.SphereGeometry(1, 24, 16),
        new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.BackSide, transparent: true, opacity: 0.45 }),
      );
      halo.visible = false;
      g.add(bola, halo);
      const div = document.createElement('div');
      div.className = 'etiqueta-atomo';
      const f = a.carga;
      div.innerHTML = `${a.el.simbolo}${f ? `<sup>${cargaTexto(f).replace(/[⁺⁻]/g, (x) => (x === '⁺' ? '+' : '−'))}</sup>` : ''}`;
      const lab = new CSS2DObject(div);
      g.add(lab);
      this.grupoAtomos.add(g);
      this.atomos.push(g); this.bolas.push(bola); this.halos.push(halo); this.etiquetas.push(lab);
      this.estadoAtomo.push({ visible: true, op: 1, esc: 1 });
    });

    const pis = ejesPi(an);
    est.enlaces.forEach((e, k) => {
      const g = new THREE.Group();
      const orden = an.ordenMedio[k];
      const n = Math.max(1, Math.ceil(orden - 0.01));
      const sep = 0.22;
      const offs = Array.from({ length: n }, (_, m) => (m - (n - 1) / 2) * sep);
      const varillas: THREE.Mesh[] = [];
      offs.forEach((_, m) => {
        for (const lado of [0, 1]) {
          const col = new THREE.Color(est.atomos[lado ? e.b : e.a].el.color);
          if (est.atomos[lado ? e.b : e.a].el.simbolo === 'H') col.set('#e8ecf5');
          const frac = m === n - 1 && orden - Math.floor(orden) > 0.05 && orden - Math.floor(orden) < 0.95 && n > 1;
          const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.4, metalness: 0.1, transparent: true, opacity: frac ? 0.55 : 1 });
          const cil = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 14, 1), mat);
          g.add(cil);
          varillas.push(cil);
        }
      });
      g.userData.eje = pis.get(k)?.[0] ?? null;
      this.grupoEnlaces.add(g);
      this.enlaces.push({ g, k, varillas, offs, vis: true, op: 1 });
    });

    // Sombra de contacto suave
    const ys = P.map((p) => p[1]);
    const minY = Math.min(...ys);
    this.sombra = this.crearSombra(this.radioEscena);
    this.sombra.position.set(c.x, minY - this.radioEscena * 0.55, c.z);
    this.scene.add(this.sombra);

    this.aplicarModo();
    this.refrescarExtras();
    this.camaraTocada = false;
    this.encuadrar(true);
    this.pedirRender();
  }

  private crearSombra(r: number) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    const g = cv.getContext('2d')!;
    const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
    gr.addColorStop(0, 'rgba(10,14,30,0.20)');
    gr.addColorStop(0.55, 'rgba(10,14,30,0.07)');
    gr.addColorStop(1, 'rgba(10,14,30,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 128, 128);
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(r * 2.4, r * 2.4),
      new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  encuadrar(inmediato = false) {
    // la molécula entera (con sus orbitales) cabe en vertical y en horizontal, sea cual sea la proporción del visor
    const d = (this.radioEncuadre / Math.tan((this.camera.fov * Math.PI) / 360)) * 1.0 / Math.min(1, this.camera.aspect);
    const dir = new THREE.Vector3(0.55, 0.38, 1).normalize();
    const objetivo = this.centro.clone();
    if (inmediato) {
      this.controls.target.copy(objetivo);
      this.camera.position.copy(objetivo).addScaledVector(dir, d);
    } else {
      this.animarCamara(objetivo, objetivo.clone().addScaledVector(dir, d));
    }
    this.pedirRender();
  }
  enfocar(i: number, distancia = 4.2) {
    const p = this.atomos[i]?.position;
    if (!p) return;
    const dir = this.camera.position.clone().sub(this.controls.target).normalize();
    this.animarCamara(p.clone(), p.clone().addScaledVector(dir, distancia));
  }
  private animarCamara(tgt: THREE.Vector3, pos: THREE.Vector3) {
    const t0 = this.controls.target.clone(), p0 = this.camera.position.clone();
    const ini = performance.now();
    const paso = () => {
      const u = Math.min(1, (performance.now() - ini) / 450);
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      this.controls.target.lerpVectors(t0, tgt, e);
      this.camera.position.lerpVectors(p0, pos, e);
      this.pedirRender();
      if (u < 1) requestAnimationFrame(paso);
    };
    paso();
  }

  // ───────────────────────── Representación ─────────────────────────
  setModo(m: Modo) {
    this.modo = m;
    this.aplicarModo();
  }
  radioAtomo(i: number): number {
    const a = this.analisis!.estructura.atomos[i].el;
    const r = a.radio / 100;
    return this.modo === 'spacefill' ? Math.max(0.55, r * 1.9) : this.modo === 'esqueleto' ? 0.07 : Math.max(0.24, r * 0.52);
  }
  private aplicarModo() {
    if (!this.analisis) return;
    this.analisis.estructura.atomos.forEach((_, i) => {
      const r = this.radioAtomo(i) * this.estadoAtomo[i].esc;
      this.bolas[i].scale.setScalar(r);
      this.halos[i].scale.setScalar(r * 1.08 + 0.03);
      this.etiquetas[i].position.set(0, r + 0.22, 0);
    });
    this.halos.forEach((h, i) => (h.visible = i === this.sel && this.estadoAtomo[i].visible));
    this.actualizarEnlaces();
    this.aplicarEtiquetas();
    this.pedirRender();
  }
  aplicarEtiquetas() {
    this.etiquetas.forEach((l, i) => (l.visible = this.inter.etiquetas && this.estadoAtomo[i].visible));
    this.pedirRender();
  }

  /** Estado dinámico de un átomo (para la animación). */
  setAtomo(i: number, o: { visible?: boolean; pos?: Vec3; op?: number; esc?: number }) {
    const g = this.atomos[i];
    if (!g) return;
    if (o.visible !== undefined) this.estadoAtomo[i].visible = o.visible;
    if (o.op !== undefined) this.estadoAtomo[i].op = o.op;
    if (o.esc !== undefined) {
      this.estadoAtomo[i].esc = o.esc;
      const r = this.radioAtomo(i) * o.esc;
      this.bolas[i].scale.setScalar(r);
      this.halos[i].scale.setScalar(r * 1.08 + 0.03);
      this.etiquetas[i].position.set(0, r + 0.22, 0);
    }
    if (o.pos) g.position.set(o.pos[0], o.pos[1], o.pos[2]);
    const e = this.estadoAtomo[i];
    g.visible = e.visible;
    const m = this.bolas[i].material as THREE.MeshPhysicalMaterial;
    m.transparent = e.op < 0.999;
    m.opacity = e.op;
    this.halos[i].visible = i === this.sel && e.visible && e.op > 0.5;
    this.etiquetas[i].visible = this.inter.etiquetas && e.visible;
  }
  posAtomo(i: number): THREE.Vector3 {
    return this.atomos[i].position;
  }
  setEnlace(k: number, o: { visible?: boolean; op?: number }) {
    const e = this.enlaces[k];
    if (!e) return;
    if (o.visible !== undefined) e.vis = o.visible;
    if (o.op !== undefined) e.op = o.op;
    this.actualizarEnlaces();
  }
  /** Restablece todos los átomos y enlaces visibles en su sitio. */
  restablecer() {
    if (!this.analisis) return;
    this.analisis.estructura.atomos.forEach((_, i) => this.setAtomo(i, { visible: true, op: 1, esc: 1, pos: this.analisis!.geometria.pos[i] }));
    this.enlaces.forEach((e) => ((e.vis = true), (e.op = 1)));
    this.actualizarEnlaces();
    this.refrescarExtras();
  }

  actualizarEnlaces() {
    if (!this.analisis) return;
    const est = this.analisis.estructura;
    const up = new THREE.Vector3(0, 1, 0);
    for (const b of this.enlaces) {
      const e = est.enlaces[b.k];
      const A = this.atomos[e.a], B = this.atomos[e.b];
      const visible = b.vis && b.op > 0.01 && this.estadoAtomo[e.a].visible && this.estadoAtomo[e.b].visible;
      b.g.visible = visible;
      if (!visible) continue;
      const pa = A.position, pb = B.position;
      const dir = pb.clone().sub(pa);
      const L = dir.length();
      if (L < 1e-4) continue;
      dir.normalize();
      // dirección de separación de las varillas paralelas
      let lat: THREE.Vector3 = b.g.userData.eje ? v3(b.g.userData.eje as Vec3) : new THREE.Vector3(0, 0, 1).cross(dir);
      lat = lat.clone().sub(dir.clone().multiplyScalar(lat.dot(dir)));
      if (lat.lengthSq() < 1e-6) lat = new THREE.Vector3(1, 0, 0).cross(dir);
      lat.normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(up, dir);
      const rad = this.modo === 'esqueleto' ? 0.03 : this.modo === 'spacefill' ? 0.0 : 0.1;
      const ra = this.radioAtomo(e.a), rb = this.radioAtomo(e.b);
      b.offs.forEach((off, m) => {
        for (const lado of [0, 1]) {
          const cil = b.varillas[m * 2 + lado];
          const frac = cil.material as THREE.MeshStandardMaterial;
          frac.opacity = (m === b.offs.length - 1 && b.offs.length > 1 && this.analisis!.ordenMedio[b.k] % 1 > 0.05 ? 0.55 : 1) * b.op;
          cil.visible = rad > 0;
          // mitad A: de A hacia el punto medio; mitad B: del medio hacia B
          const ini = lado === 0 ? Math.min(ra * 0.5, L * 0.3) : L / 2;
          const fin = lado === 0 ? L / 2 : L - Math.min(rb * 0.5, L * 0.3);
          const largo = Math.max(0.01, fin - ini);
          cil.scale.set(rad, largo, rad);
          cil.quaternion.copy(q);
          cil.position.copy(pa).addScaledVector(dir, ini + largo / 2).addScaledVector(lat, off);
        }
      });
    }
    this.pedirRender();
  }

  // ───────────────────────── Extras: ángulos, dipolo, ejes, medidas ─────────────────────────
  refrescarExtras() {
    if (!this.analisis) return;
    this.refrescarAngulos();
    this.refrescarDipolo();
    this.refrescarEjes();
    this.pedirRender();
  }

  setInterruptor<K extends keyof Interruptores>(k: K, v: Interruptores[K]) {
    this.inter[k] = v;
    if (k === 'etiquetas') this.aplicarEtiquetas();
    if (k === 'angulos' || k === 'dipolo' || k === 'ejes') this.refrescarExtras();
    this.pedirRender();
  }

  private refrescarAngulos() {
    this.anguloObjs.forEach((o) => {
      o.parent?.remove(o);
      if ((o as CSS2DObject).element) (o as CSS2DObject).element.remove();
    });
    this.anguloObjs = [];
    const an = this.analisis!;
    if (!this.inter.angulos) return;
    const c = this.sel;
    const P = an.geometria.pos;
    const vs = vecinos(an.estructura, c).map((v) => v.j);
    const pares: [number, number][] = [];
    for (let a = 0; a < vs.length; a++) for (let b = a + 1; b < vs.length; b++) pares.push([vs[a], vs[b]]);
    // evita saturar: como mucho 6 ángulos, sin repetir valores casi iguales
    const vistos: number[] = [];
    for (const [a, b] of pares) {
      const ang = anguloEntre(sub(P[a], P[c]), sub(P[b], P[c]));
      if (vistos.some((x) => Math.abs(x - ang) < 1) && pares.length > 3) continue;
      vistos.push(ang);
      if (vistos.length > 6) break;
      this.dibujarArco(c, a, b, ang);
    }
  }
  private dibujarArco(c: number, a: number, b: number, ang: number) {
    const P = this.analisis!.geometria.pos;
    const o = v3(P[c]);
    const u = v3(P[a]).sub(o).normalize(), w = v3(P[b]).sub(o).normalize();
    const R = 0.75;
    const pts: THREE.Vector3[] = [];
    const th = Math.acos(Math.max(-1, Math.min(1, u.dot(w))));
    for (let i = 0; i <= 24; i++) {
      const t = i / 24;
      const s = Math.sin(th) || 1;
      const p = u.clone().multiplyScalar(Math.sin((1 - t) * th) / s).add(w.clone().multiplyScalar(Math.sin(t * th) / s));
      pts.push(o.clone().addScaledVector(p, R));
    }
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xf59e0b }));
    this.grupoExtras.add(line);
    const div = document.createElement('div');
    div.className = 'etiqueta-medida';
    div.textContent = num(ang, 1) + '°';
    const lab = new CSS2DObject(div);
    lab.position.copy(pts[12].clone().sub(o).multiplyScalar(1.45).add(o));
    this.grupoExtras.add(lab);
    this.anguloObjs.push(line, lab);
  }

  /** Quita un objeto y elimina del DOM las etiquetas CSS2D que contenga. */
  private quitar(o: THREE.Object3D) {
    o.traverse((x) => (x as CSS2DObject).element?.remove());
    o.parent?.remove(o);
  }

  private refrescarDipolo() {
    if (this.dipoloObj) {
      this.quitar(this.dipoloObj);
      this.dipoloObj = null;
    }
    const an = this.analisis!;
    if (!this.inter.dipolo || !an.polaridad.polar || an.geometria.dipolo.magnitud < 0.1) return; // sin vector geométrico fiable (tolueno, propeno) no se dibuja la flecha
    const d = v3(an.geometria.dipolo.vector);
    const dir = d.clone().normalize();
    const L = Math.max(0.7, Math.min(1.2, 0.6 + an.polaridad.mu * 0.15, this.radioEscena * 0.7)); // flecha corta, dentro de la molécula
    const g = new THREE.Group();
    const origen = this.centro.clone().addScaledVector(dir, -L / 2);
    const flecha = new THREE.ArrowHelper(dir, origen, L, 0xf59e0b, 0.3, 0.18);
    (flecha.line.material as THREE.LineBasicMaterial).linewidth = 3;
    g.add(flecha);
    // cruz en el extremo positivo
    const cruz = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), new THREE.MeshBasicMaterial({ color: 0xf59e0b }));
    cruz.position.copy(origen);
    g.add(cruz);
    const div = document.createElement('div');
    div.className = 'etiqueta-medida dipolo';
    div.textContent = textoMu(an.polaridad);
    const lab = new CSS2DObject(div);
    lab.position.copy(origen).addScaledVector(dir, L * 0.6).add(new THREE.Vector3(0, 0.35, 0));
    g.add(lab);
    this.grupoExtras.add(g);
    this.dipoloObj = g;
  }

  private refrescarEjes() {
    if (this.ejesObj) {
      this.quitar(this.ejesObj);
      this.ejesObj = null;
    }
    if (!this.inter.ejes) return;
    const g = new THREE.Group();
    const L = this.radioEscena + 0.6;
    const defs: [THREE.Vector3, number, string][] = [
      [new THREE.Vector3(1, 0, 0), 0xef4444, 'x'], [new THREE.Vector3(0, 1, 0), 0x22c55e, 'y'], [new THREE.Vector3(0, 0, 1), 0x3b82f6, 'z'],
    ];
    for (const [d, col, n] of defs) {
      const ah = new THREE.ArrowHelper(d, this.centro.clone().addScaledVector(d, -L / 2), L, col, 0.25, 0.14);
      g.add(ah);
      const div = document.createElement('div');
      div.className = 'etiqueta-eje';
      div.textContent = n;
      const lab = new CSS2DObject(div);
      lab.position.copy(this.centro).addScaledVector(d, L / 2 + 0.3);
      g.add(lab);
    }
    this.ejesObj = g;
    this.raiz.add(g);
  }

  // ───────────────────────── Selección, tooltip y medición ─────────────────────────
  seleccionar(i: number, enfocar = false) {
    this.sel = i;
    this.halos.forEach((h, k) => (h.visible = k === i && this.estadoAtomo[k].visible));
    this.refrescarAngulos();
    if (enfocar) this.enfocar(i);
    this.pedirRender();
  }
  private golpe(ev: PointerEvent): number | null {
    const r = this.renderer.domElement.getBoundingClientRect();
    this.ptr.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ptr, this.camera);
    const vis = this.bolas.filter((b) => b.parent?.visible);
    const h = this.ray.intersectObjects(vis, false)[0];
    return h ? (h.object.userData.idx as number) : null;
  }
  private clic(ev: PointerEvent) {
    const i = this.golpe(ev);
    if (i === null) return;
    if (this.modoMedir) {
      this.medicion.push(i);
      if (this.medicion.length > 3) this.medicion = [i];
      this.refrescarMedicion();
      return;
    }
    this.seleccionar(i);
    this.onSeleccion(i);
  }
  private hover(ev: PointerEvent) {
    const i = this.golpe(ev);
    if (i === null || !this.analisis) {
      this.tooltip.hidden = true;
      this.renderer.domElement.style.cursor = '';
      return;
    }
    const a = this.analisis.estructura.atomos[i];
    const t = this.analisis.tev.atomos[i];
    const h = t.hibridacion ? hibridoTexto(t.hibridacion.tipo) : a.el.simbolo === 'H' ? '1s' : 'p puro';
    const fc = a.carga === 0 ? '0' : (a.carga > 0 ? '+' : '−') + Math.abs(a.carga);
    this.tooltip.innerHTML = `<b>${a.el.nombre[0].toUpperCase() + a.el.nombre.slice(1)} (${a.el.simbolo})</b><span>Hibridación: ${h}</span><span>Carga formal: ${fc}</span>`;
    const r = this.contenedor.getBoundingClientRect();
    this.tooltip.style.left = Math.min(ev.clientX - r.left + 14, r.width - 170) + 'px';
    this.tooltip.style.top = ev.clientY - r.top + 14 + 'px';
    this.tooltip.hidden = false;
    this.renderer.domElement.style.cursor = 'pointer';
  }
  setModoMedir(v: boolean) {
    this.modoMedir = v;
    if (!v) {
      this.medicion = [];
      this.refrescarMedicion();
    }
  }
  private refrescarMedicion() {
    this.medObjs.forEach((o) => {
      o.parent?.remove(o);
      if ((o as CSS2DObject).element) (o as CSS2DObject).element.remove();
    });
    this.medObjs = [];
    const P = this.analisis?.geometria.pos;
    if (!P) return;
    const m = this.medicion;
    m.forEach((i) => {
      const s = new THREE.Mesh(new THREE.SphereGeometry(this.radioAtomo(i) * 1.3, 16, 12), new THREE.MeshBasicMaterial({ color: 0xf59e0b, wireframe: true }));
      s.position.copy(this.atomos[i].position);
      this.grupoExtras.add(s);
      this.medObjs.push(s);
    });
    let txt = m.length ? 'Haz clic en otro átomo (2 = distancia, 3 = ángulo).' : 'Modo medida: haz clic en 2 o 3 átomos.';
    if (m.length >= 2) {
      const pts = m.map((i) => v3(P[i]));
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineDashedMaterial({ color: 0xf59e0b, dashSize: 0.12, gapSize: 0.08 }));
      line.computeLineDistances();
      this.grupoExtras.add(line);
      this.medObjs.push(line);
      let valor = '';
      let pos: THREE.Vector3;
      if (m.length === 2) {
        const d = pts[0].distanceTo(pts[1]);
        valor = `${num(d, 2)} Å`;
        pos = pts[0].clone().add(pts[1]).multiplyScalar(0.5);
      } else {
        valor = `${num(anguloEntre(sub(P[m[0]], P[m[1]]), sub(P[m[2]], P[m[1]])), 1)}°`;
        pos = pts[1].clone();
      }
      const div = document.createElement('div');
      div.className = 'etiqueta-medida';
      div.textContent = valor;
      const lab = new CSS2DObject(div);
      lab.position.copy(pos).add(new THREE.Vector3(0, 0.35, 0));
      this.grupoExtras.add(lab);
      this.medObjs.push(lab);
      txt = `Medida: ${valor}`;
    }
    this.onMedicion(txt);
    this.pedirRender();
  }

  // ───────────────────────── Tema, exportación ─────────────────────────
  setTema(oscuro: boolean) {
    this.oscuro = oscuro;
    if (this.sombra) (this.sombra.material as THREE.MeshBasicMaterial).opacity = oscuro ? 0.55 : 1;
    this.pedirRender();
  }
  setAutorrotacion(v: boolean) {
    this.controls.autoRotate = v;
    this.controls.autoRotateSpeed = 1.4;
  }
  /** PNG con el fondo del tema (las etiquetas HTML no se incluyen). */
  exportarPNG(nombre = 'molecula.png') {
    this.renderer.render(this.scene, this.camera);
    const src = this.renderer.domElement;
    const cv = document.createElement('canvas');
    cv.width = src.width;
    cv.height = src.height;
    const g = cv.getContext('2d')!;
    g.fillStyle = getComputedStyle(this.contenedor).getPropertyValue('--lienzo-fondo').trim() || (this.oscuro ? '#0f1524' : '#f5f7fb');
    g.fillRect(0, 0, cv.width, cv.height);
    g.drawImage(src, 0, 0);
    const a = document.createElement('a');
    a.download = nombre;
    a.href = cv.toDataURL('image/png');
    a.click();
  }
}
