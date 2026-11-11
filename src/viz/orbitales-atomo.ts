/**
 * Orbitales, electrones y vecinos de UN átomo central. `aplicar(etapa, u)` es una función
 * determinista del estado: coloca todo desde cero, de modo que se puede saltar a cualquier punto.
 */
import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { Analisis } from '../chem/analisis';
import { num } from '../chem/formato';
import { hibridoTexto } from '../chem/formato';
import type { AtomoTEV, Orbital } from '../chem/tev';
import { vecinos } from '../chem/tipos';
import type { Vec3 } from '../chem/vec';
import { add, anguloEntre, cross, dot, len, mul, norm, perpendicular, sub } from '../chem/vec';
import type { EtapaId } from './animacion/plan';
import type { Din } from './vista2d';
import type { Campo, Marco } from './campos';
import { campoAO, campoHibrido, campoP, campoS, mezclar } from './campos';
import type { Escena3D } from './escena3d';
import { etiquetasPi } from './etiquetas-pi';
import type { EtiquetaPi } from './etiquetas-pi';
import { Dominios, dominiosAtomo, ejesPi, marcoAtomo } from './marcos';
import { COLORES, SuperficieOrbital, cambiarElectron, crearElectron, materialOrbital } from './orbitales3d';

// ───────────────────────── utilidades ─────────────────────────
export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const easeInOutCubic = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const sub01 = (u: number, a: number, b: number) => clamp01((u - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpV = (a: Vec3, b: Vec3, t: number): Vec3 => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
const nlerp = (a: Vec3, b: Vec3, t: number): Vec3 => norm(lerpV(a, b, t));
const th = (v: Vec3) => new THREE.Vector3(v[0], v[1], v[2]);
function mulberry32(a: number) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function rgba(hex: string, a: number): string {
  const n = parseInt(new THREE.Color(hex).getHexString(), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
}
function mezclaColor(a: string, b: string, t: number): string {
  const ca = new THREE.Color(a), cb = new THREE.Color(b);
  return '#' + ca.lerp(cb, clamp01(t)).getHexString();
}
const tinte = (c: string) => mezclaColor(c, '#ffffff', 0.58);
const ROL_COLOR: Record<string, string> = { par: COLORES.par, sigma: COLORES.sigma, pi: COLORES.pi, radical: COLORES.radical, vacio: '#9aa4bd' };
const NEUTRO = '#dfe8ff';
const R_AO = (id: string) => (id === 's' ? 0.7 : id[0] === 'p' ? 1.15 : 1.05);
const GAMMA_AO = (id: string) => (id === 's' ? 1.0 : id[0] === 'p' ? 2.4 : 2.0);
const NOMBRE_D: Record<string, string> = { d1: 'dz²', d2: 'dx²−y²', d3: 'dxy', d4: 'dxz', d5: 'dyz' };

export interface Ctx {
  orbitales?: boolean;
  pi?: boolean;
  pares?: boolean;
  electrones?: boolean;
  previos?: Set<number>;
  /** Opacidad global del rig (secuencias: átomos ya completados). */
  opacidad?: number;
}
export interface InfoEstado {
  /** Orbitales atómicos (ids) activos, para resaltar en el diagrama. */
  resaltar: string[];
  columna: 'fund' | 'exc' | 'hib' | 'enl';
  energia: number;
  vecino: number | null;
  vecinosFormados: number[];
  promo: number;
  hibridos: number;
  separacion: number;
}

interface Elec {
  k: number; // índice del orbital en `ids`
  id: string;
  slot: number;
  espin: 1 | -1;
  desde: string;
  promo: boolean;
  rol: 'par' | 'sigma' | 'pi' | 'radical';
  vecino?: number;
  piIdx?: number;
  sprite: THREE.Sprite;
  color: string;
}
interface Vec {
  j: number;
  surf: SuperficieOrbital;
  elec: THREE.Sprite;
  elecColor: string;
  glow: THREE.Sprite;
  chip: CSS2DObject;
  kHib: number; // índice del híbrido (o del AO σ) del centro
  campo: Campo;
  R: number;
  dirOut: Vec3; // del centro al vecino
  rel: Vec3;
  kind: 'H' | 'p' | 'hib';
  /** Átomos del fragmento que llega con el vecino (él y sus sustituyentes). */
  frag: number[];
  /** Híbridos del vecino (si es otro centro), que llegan ya formados. */
  domJ: Dominios | null;
}
interface PiBond {
  j: number;
  bondIdx: number;
  ejes: Vec3[];
  surfs: SuperficieOrbital[]; // p del vecino
  lobos: THREE.Mesh[][]; // por π: [arriba, abajo]
  lineas: THREE.Line[];
  elec: THREE.Sprite[];
  orden: number;
}

function glowTextura(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = 64;
  const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 1, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)');
  gr.addColorStop(0.35, 'rgba(255,236,170,0.55)');
  gr.addColorStop(1, 'rgba(255,220,120,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}
let GLOW: THREE.CanvasTexture | null = null;

/** Malla elipsoidal con el atributo `fase` que necesita el material de orbitales. */
function elipsoide(geo: THREE.BufferGeometry, mat: THREE.ShaderMaterial): THREE.Mesh {
  const n = geo.getAttribute('position').count;
  geo.setAttribute('fase', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = 4;
  m.frustumCulled = false;
  return m;
}

export class OrbitalesAtomo {
  readonly grupo = new THREE.Group();
  private t: AtomoTEV;
  private an: Analisis;
  private c: number;
  private P: Vec3[]; // posiciones relativas al centro
  private Pw: Vec3[]; // posiciones del mundo
  private dom: Dominios;
  private marco: Marco;
  private pis: Map<number, Vec3[]>;
  private ids: string[];
  private N: number;
  private RH: number;
  private inicio: Vec3[];
  /** Salida 2D (estilo libro) de la animación. */
  vista: { setDin: (d: Din | null) => void } | null = null;
  private D!: Din;
  private offs = new Map<number, Vec3>();
  private offOf(k: number): Vec3 { return this.offs.get(k) ?? [0, 0, 0]; }
  private aos: Map<number, { surf: SuperficieOrbital; id: string }> = new Map();
  private aoLabs: Map<number, { lab: CSS2DObject; id: string }> = new Map();
  private elecs: Elec[] = [];
  private vecs: Vec[] = [];
  private piB: PiBond[] = [];
  private anillo: { atomos: number[]; surfs: SuperficieOrbital[]; toros: THREE.Mesh[]; ejes: Vec3; centro: Vec3; R: number } | null = null;
  /** Una etiqueta por enlace π (y una por la nube del anillo). */
  private etqPi: { datos: EtiquetaPi; chip: CSS2DObject }[] = [];
  private arco: THREE.Line;
  private arcoLab: CSS2DObject;
  private hibLab: CSS2DObject;
  private geoSig: Record<string, number> = {};
  private ultimoColor = new Map<THREE.Sprite, string>();
  private ultimoEspin = new Map<THREE.Sprite, number>();

  constructor(private escena: Escena3D, an: Analisis, centro: number) {
    this.an = an;
    this.c = centro;
    this.t = an.tev.atomos[centro];
    const Pw = an.geometria.pos;
    this.Pw = Pw;
    this.P = Pw.map((p) => sub(p, Pw[centro]));
    this.dom = dominiosAtomo(an, centro);
    this.pis = ejesPi(an);
    this.marco = marcoAtomo(an, centro, this.pis);
    this.ids = this.t.fundamental.map((o) => o.id);
    this.N = this.t.hibridacion?.n ?? 0;
    const ls = vecinos(an.estructura, centro).map(({ e }) => an.geometria.longitudes[an.estructura.enlaces.indexOf(e)]);
    const Lm = ls.length ? ls.reduce((a, b) => a + b, 0) / ls.length : 1.3;
    this.RH = Math.max(0.95, Math.min(1.35, 0.7 * Lm));
    const rnd = mulberry32(7 + this.N * 13 + centro);
    const base = norm([0.6, 0.5, 0.62]);
    // Orientación inicial «arbitraria» de los híbridos: en abanico, en el plano que se ve de frente
    this.inicio = Array.from({ length: Math.max(this.N, 1) }, (_, k) => { const th = -0.5 + k * 0.9 + (rnd() - 0.5) * 0.3; return norm([Math.cos(th), Math.sin(th), (rnd() - 0.5) * 0.3] as Vec3); });
    this.grupo.position.set(Pw[centro][0], Pw[centro][1], Pw[centro][2]);
    escena.grupoOrbitales.add(this.grupo);
    GLOW ??= glowTextura();
    this.construirAOs();
    // Los orbitales de valencia se muestran separados (en fila) y luego se juntan en el núcleo
    const claves = [...this.aos.keys()].sort((a, b) => a - b);
    claves.forEach((k, rk) => this.offs.set(k, [(rk - (claves.length - 1) / 2) * 2.7, 0, 0]));
    this.construirElectrones();
    this.construirVecinos();
    this.construirPi();
    // arco de ángulo (etapa 5)
    this.arco = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 25 }, () => new THREE.Vector3())), new THREE.LineBasicMaterial({ color: 0xf59e0b, transparent: true }));
    this.arco.frustumCulled = false;
    this.grupo.add(this.arco);
    const d1 = document.createElement('div');
    d1.className = 'etiqueta-medida';
    this.arcoLab = new CSS2DObject(d1);
    this.grupo.add(this.arcoLab);
    const d2 = document.createElement('div');
    d2.className = 'etiqueta-hibrido';
    this.hibLab = new CSS2DObject(d2);
    this.hibLab.position.set(0, this.RH + 0.95, 0);
    this.grupo.add(this.hibLab);
  }

  // ───────────────────────── construcción ─────────────────────────
  private construirAOs() {
    const { fundamental: fund, excitado: exc } = this.t;
    this.ids.forEach((id, i) => {
      const usa = fund[i].e > 0 || exc[i].e > 0 || i < this.N || i < 4;
      if (!usa || (id[0] === 'd' && exc[i].e === 0 && i >= this.N)) return;
      const surf = new SuperficieOrbital();
      surf.mesh.visible = false;
      this.grupo.add(surf.mesh);
      this.aos.set(i, { surf, id });
      const div = document.createElement('div');
      div.className = 'etiqueta-orb';
      div.textContent = id === 's' ? `${this.t.capa}s` : id[0] === 'p' ? `${this.t.capa}p${id[1]}` : `${this.t.capa}${NOMBRE_D[id] ?? id}`;
      const lab = new CSS2DObject(div);
      this.grupo.add(lab);
      this.aoLabs.set(i, { lab, id });
    });
  }

  private construirElectrones() {
    const { fundamental: fund, excitado: exc, roles } = this.t;
    // Electrones que se desplazan en la promoción: sobran en el fundamental / faltan en el excitado
    const sobrantes: string[] = [];
    fund.forEach((o, i) => {
      for (let q = 0; q < Math.max(0, o.e - exc[i].e); q++) sobrantes.push(o.id);
    });
    const subDe = (id: string) => id[0];
    exc.forEach((o, k) => {
      for (let slot = 0; slot < o.e; slot++) {
        const queda = slot < Math.min(fund[k].e, o.e);
        const desde = queda ? o.id : (sobrantes.shift() ?? o.id);
        const r = roles[o.id];
        const rol = r.rol === 'vacio' ? 'par' : r.rol;
        const espin: 1 | -1 = slot === 0 ? 1 : -1;
        // π: índice dentro del enlace
        let piIdx: number | undefined;
        if (rol === 'pi' && r.vecino !== undefined) piIdx = this.t.porVecino[r.vecino].pis.indexOf(o.id);
        const sprite = crearElectron(NEUTRO, espin);
        this.grupo.add(sprite);
        this.elecs.push({ k, id: o.id, slot, espin, desde, promo: subDe(desde) !== subDe(o.id), rol, vecino: r.vecino, piIdx, sprite, color: NEUTRO });
      }
    });
  }

  private construirVecinos() {
    const est = this.an.estructura;
    const t = this.t;
    const vs = Object.keys(t.porVecino).map(Number).sort((a, b) => a - b);
    vs.forEach((j) => {
      const nb = this.an.tev.atomos[j];
      const rel = this.P[j];
      const dirOut = norm(rel);
      const dirIn = mul(dirOut, -1);
      const idSigma = nb.porVecino[this.c]?.sigma ?? 's';
      let campo: Campo, R: number, kind: Vec['kind'];
      if (nb.hibridacion) {
        const Lb = len(rel);
        R = Math.max(0.8, Math.min(1.15, 0.58 * Lb));
        campo = campoHibrido(dirIn, nb.hibridacion.n - 1);
        kind = 'hib';
      } else if (idSigma === 's' || est.atomos[j].el.z <= 2) {
        campo = campoS;
        R = 0.4;
        kind = 'H';
      } else {
        campo = campoP(dirIn);
        R = 1.0;
        kind = 'p';
      }
      const surf = new SuperficieOrbital(COLORES.vecino, tinte(COLORES.vecino), 0.4);
      surf.actualizar(campo, R);
      surf.mesh.visible = false;
      this.grupo.add(surf.mesh);
      const elec = crearElectron(COLORES.vecino, -1);
      this.grupo.add(elec);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW!, transparent: true, depthTest: false, blending: THREE.AdditiveBlending }));
      glow.renderOrder = 15;
      this.grupo.add(glow);
      const div = document.createElement('div');
      div.className = 'etiqueta-sigma';
      const e = this.an.tev.enlaces.find((x) => (x.a === this.c && x.b === j) || (x.b === this.c && x.a === j))!;
      const corto = (s: string) => s.replace(/ [A-Z][a-z]?$/, '');
      const m = e.sigma.match(/^σ\((.*) – (.*)\)$/);
      const [oa, ob] = m ? [m[1], m[2]] : ['?', '?'];
      const centroEsA = e.a === this.c;
      div.textContent = `σ(${corto(centroEsA ? oa : ob)}–${corto(centroEsA ? ob : oa)})`;
      const chip = new CSS2DObject(div);
      this.grupo.add(chip);
      const kHib = this.dom.vecino.indexOf(j);
      const frag: number[] = [j];
      const vistos = new Set<number>([j, this.c]);
      const cola = [j];
      let anillo = false;
      while (cola.length) {
        const x = cola.shift()!;
        for (const w of vecinos(est, x)) {
          if (w.j === this.c) { if (x !== j) anillo = true; continue; }
          if (!vistos.has(w.j)) { vistos.add(w.j); frag.push(w.j); cola.push(w.j); }
        }
      }
      const domJ = nb.hibridacion && !nb.error ? dominiosAtomo(this.an, j) : null;
      this.vecs.push({ j, surf, elec, elecColor: COLORES.vecino, glow, chip, kHib, campo, R, dirOut, rel, kind, frag: anillo ? [j] : frag, domJ });
    });
  }

  private construirPi() {
    const est = this.an.estructura;
    const P = this.P;
    vecinos(est, this.c).forEach(({ j, e }) => {
      const bondIdx = est.enlaces.indexOf(e);
      const ej = this.pis.get(bondIdx);
      if (!ej) return;
      const mid = mul(P[j], 0.5);
      const dirB = norm(P[j]);
      const Lb = len(P[j]);
      const surfs: SuperficieOrbital[] = [];
      const lobos: THREE.Mesh[][] = [];
      const lineas: THREE.Line[] = [];
      const elec: THREE.Sprite[] = [];
      ej.forEach((ax, m) => {
        const sf = new SuperficieOrbital(COLORES.pi, tinte(COLORES.pi), 0.5);
        sf.actualizar(campoP(ax), 0.9, undefined, 1, 2.0);
        sf.mesh.position.set(P[j][0], P[j][1], P[j][2]);
        sf.mesh.visible = false;
        this.grupo.add(sf.mesh);
        surfs.push(sf);
        const par: THREE.Mesh[] = [];
        [1, -1].forEach((sg) => {
          const geo = new THREE.SphereGeometry(1, 28, 20);
          const mesh = elipsoide(geo, materialOrbital(sg > 0 ? COLORES.fasePos : COLORES.faseNeg, tinte(sg > 0 ? COLORES.fasePos : COLORES.faseNeg), 0.0));
          mesh.scale.set(Lb / 2 + 0.4, 0.17, 0.17);
          // el eje largo (x local) se orienta a lo largo del enlace
          mesh.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), th(dirB));
          const p = add(mid, mul(ax, 0.5 * sg));
          mesh.position.set(p[0], p[1], p[2]);
          mesh.visible = false;
          this.grupo.add(mesh);
          par.push(mesh);
        });
        lobos.push(par);
        // líneas que unen los dos orbitales p (arriba y abajo del eje)
        [1, -1].forEach((sg) => {
          const g = new THREE.BufferGeometry().setFromPoints([th(mul(ax, 0.95 * sg)), th(add(P[j], mul(ax, 0.95 * sg)))]);
          const ln = new THREE.Line(g, new THREE.LineDashedMaterial({ color: 0xf59e0b, dashSize: 0.12, gapSize: 0.08, transparent: true }));
          ln.computeLineDistances();
          ln.visible = false;
          this.grupo.add(ln);
          lineas.push(ln);
        });
        const s = crearElectron(COLORES.vecino, -1);
        this.grupo.add(s);
        elec.push(s);
      });
      this.piB.push({ j, bondIdx, ejes: ej, surfs, lobos, lineas, elec, orden: Math.round(e.orden) });
    });
    // Anillo aromático (benceno): dos «donuts»
    const aroEnl = est.enlaces.filter((e) => e.aromatico && (e.a === this.c || e.b === this.c));
    if (aroEnl.length) {
      const atomos = new Set<number>([this.c]);
      let cambio = true;
      while (cambio) {
        cambio = false;
        for (const e of est.enlaces) {
          if (!e.aromatico) continue;
          if (atomos.has(e.a) && !atomos.has(e.b)) { atomos.add(e.b); cambio = true; }
          if (atomos.has(e.b) && !atomos.has(e.a)) { atomos.add(e.a); cambio = true; }
        }
      }
      const lista = [...atomos];
      const cen = mul(lista.reduce((s, i) => add(s, P[i]), [0, 0, 0] as Vec3), 1 / lista.length);
      const R = lista.reduce((s, i) => s + len(sub(P[i], cen)), 0) / lista.length;
      const kk = est.enlaces.indexOf(aroEnl[0]);
      const eje = this.pis.get(kk)?.[0] ?? ([0, 1, 0] as Vec3);
      const surfs = lista.filter((i) => i !== this.c).map((i) => {
        const sf = new SuperficieOrbital(COLORES.pi, tinte(COLORES.pi), 0.45);
        sf.actualizar(campoP(eje), 1.2, undefined, 1, 2.0);
        sf.mesh.position.set(P[i][0], P[i][1], P[i][2]);
        sf.mesh.visible = false;
        this.grupo.add(sf.mesh);
        return sf;
      });
      const toros = [1, -1].map((sg) => {
        const geo = new THREE.TorusGeometry(R, 0.28, 20, 56);
        const mesh = elipsoide(geo, materialOrbital(sg > 0 ? COLORES.fasePos : COLORES.faseNeg, tinte(sg > 0 ? COLORES.fasePos : COLORES.faseNeg), 0));
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), th(eje));
        const p = add(cen, mul(eje, 0.78 * sg));
        mesh.position.set(p[0], p[1], p[2]);
        mesh.visible = false;
        this.grupo.add(mesh);
        return mesh;
      });
      this.anillo = { atomos: lista, surfs, toros, ejes: eje, centro: cen, R };
    }
    // Etiquetas π (mismo estilo que las σ)
    etiquetasPi(this.an, this.c, this.P, this.pis, this.anillo ? { centro: this.anillo.centro, eje: this.anillo.ejes, n: this.anillo.atomos.length } : null).forEach((datos) => {
      const div = document.createElement('div');
      div.className = 'etiqueta-pi';
      div.textContent = datos.texto;
      const chip = new CSS2DObject(div);
      chip.visible = false;
      this.grupo.add(chip);
      this.etqPi.push({ datos, chip });
    });
  }

  // ───────────────────────── posiciones de electrones ─────────────────────────
  private lobuloAO(id: string, signo: number): Vec3 {
    const m = this.marco;
    const comb = (a: number, b: number, c: number): Vec3 => norm(add(add(mul(m[0], a), mul(m[1], b)), mul(m[2], c)));
    switch (id) {
      case 'px': return mul(m[0], signo);
      case 'py': return mul(m[1], signo);
      case 'pz': return mul(m[2], signo);
      case 'd1': return mul(comb(0, 0, 1), signo);
      case 'd2': return mul(comb(1, 0, 0), signo);
      case 'd3': return mul(comb(1, 1, 0), signo);
      case 'd4': return mul(comb(1, 0, 1), signo);
      case 'd5': return mul(comb(0, 1, 1), signo);
      default: return mul(m[0], signo * 0.4);
    }
  }
  private posAO(id: string, slot: number, nSlots: number): Vec3 {
    if (id === 's') return nSlots === 1 ? [0.0, 0.0, 0.0] : mul(this.marco[1], slot === 0 ? 0.25 : -0.25);
    const R = R_AO(id) * 0.55;
    if (nSlots === 1) return mul(this.lobuloAO(id, 1), R);
    return mul(this.lobuloAO(id, slot === 0 ? 1 : -1), R);
  }
  private posHib(k: number, slot: number, dir: Vec3, ancho: number): Vec3 {
    const tipo = this.dom.tipos[k];
    const base = mul(dir, 0.55 * this.RH * (tipo === 'par' ? 0.95 : 1));
    if (tipo !== 'par') return base;
    const lat = perpendicular(dir);
    return add(base, mul(lat, (slot === 0 ? 1 : -1) * 0.15 * ancho));
  }

  private colorear(s: THREE.Sprite, color: string, espin: 1 | -1) {
    if (this.ultimoColor.get(s) === color && this.ultimoEspin.get(s) === espin) return;
    cambiarElectron(s, color, espin);
    this.ultimoColor.set(s, color);
    this.ultimoEspin.set(s, espin);
  }

  // ───────────────────────── estado ─────────────────────────
  aplicar(id: EtapaId, u: number, ctx: Ctx = {}): InfoEstado {
    const t = this.t;
    const hib = t.hibridacion;
    const N = this.N;
    const orden: EtapaId[] = ['atomo', 'recuento', 'promocion', 'hibridacion', 'repulsion', 'vecinos', 'pi', 'final'];
    const ei = orden.indexOf(id);
    const est = this.an.estructura;
    const opG = ctx.opacidad ?? 1;
    const orbOn = ctx.orbitales !== false;
    const verPi = ctx.pi !== false;
    const verPares = ctx.pares !== false;
    const verElec = ctx.electrones !== false;
    const previos = ctx.previos ?? new Set<number>();
    this.D = { lobulos: [], electrones: [], atomos: [], enlaces: [], glows: [], lineas: [], textos: [], mezcla: 0 };
    const D = this.D;
    const W = (v: Vec3): Vec3 => add(this.Pw[this.c], v);

    // Progresos derivados
    const m = ei < 3 ? 0 : id === 'hibridacion' ? easeInOutCubic(sub01(u, 0.5, 0.92)) : 1;
    const sepF = ei < 3 ? 1 : id === 'hibridacion' ? 1 - easeInOutCubic(sub01(u, 0, 0.5)) : 0;
    const sep = ei < 4 ? 0 : id === 'repulsion' ? u : 1;
    const wRamp = ei < 4 ? 0 : id === 'repulsion' ? easeInOutCubic(sub01(u, 0, 0.45)) : 1;
    const promoP = ei < 2 ? 0 : id === 'promocion' ? easeInOutCubic(sub01(u, 0.18, 0.72)) : 1;
    const finalFade = id === 'final' ? easeInOutCubic(sub01(u, 0.05, 0.85)) : 0;
    const orbMul = id === 'final' ? (orbOn ? lerp(1, 0.6, finalFade) : 1 - finalFade) : 1;
    const nv = this.vecs.length;
    const vP = (i: number) => (ei < 5 ? 0 : id === 'vecinos' ? clamp01(u * nv - i) : 1);
    const piP = ei < 6 ? 0 : id === 'pi' ? u : 1;
    // Al entrar los π se atenúa todo lo σ para que no se solape
    const hayPi = this.piB.length > 0 || !!this.anillo;
    D.mezcla = id === 'final' ? finalFade : 0;
    const sd = !hayPi || ei < 6 ? 1 : id === 'pi' ? 1 - 0.85 * easeInOutCubic(sub01(u, 0, 0.35)) : 0.15 + 0.2 * (orbOn ? 1 : 0);

    // Direcciones actuales de los híbridos
    const dirNow: Vec3[] = this.dom.finales.map((fin, k) => {
      if (!hib) return fin;
      const ini = this.inicio[k] ?? fin;
      const idl = this.dom.ideales[k];
      if (ei < 4) return ini;
      if (id !== 'repulsion') return fin;
      return u < 0.7 ? nlerp(ini, idl, easeInOutCubic(u / 0.7)) : nlerp(idl, fin, easeInOutCubic((u - 0.7) / 0.3));
    });

    // ── Orbitales atómicos / híbridos
    const resaltar: string[] = [];
    this.aos.forEach(({ surf, id: oid }, i) => {
      const isHyb = !!hib && i < N;
      const rol = t.roles[oid].rol;
      const e0 = t.fundamental[i].e, e1 = t.excitado[i].e;
      let op = 0.6;
      let campo: Campo = campoAO(oid, this.marco);
      let R = R_AO(oid);
      let pos: string = COLORES.fasePos, neg: string = COLORES.faseNeg;
      let eje: Vec3 | undefined;
      let ancho = 1;
      let brillo = 1;
      let mix2 = 0, col2 = '';
      // visibilidad de d en el fundamental
      if (oid[0] === 'd') op = ei < 2 ? 0 : id === 'promocion' ? 0.6 * easeInOutCubic(sub01(u, 0.1, 0.55)) : 0.6;
      if (ei <= 1 && e0 === 0 && oid[0] === 'p') op = 0.22;
      if (id === 'recuento') {
        // se destacan los orbitales con electrones desapareados
        if (t.fundamental[i].e === 1) { brillo = 1.7; resaltar.push(oid); }
      }
      if (id === 'promocion') {
        const dest = this.elecs.some((e) => e.promo && e.id === oid);
        const orig = this.elecs.some((e) => e.promo && e.desde === oid);
        if (dest) { brillo = 1 + 1.2 * Math.sin(Math.PI * sub01(u, 0.15, 0.95)); op = Math.max(op, 0.72); resaltar.push(oid); }
        if (orig) { resaltar.push(oid); }
        if (e0 === 0 && e1 === 0 && oid[0] === 'p') op = 0.22;
      }
      if (isHyb) {
        const dir = dirNow[i];
        campo = mezclar(campoAO(oid, this.marco), campoHibrido(dir, N - 1), m);
        R = lerp(R_AO(oid), this.RH, m);
        const tipo = this.dom.tipos[i];
        if (tipo === 'par') ancho = 1 + 0.38 * wRamp;
        eje = dir;
        const col = ROL_COLOR[tipo];
        pos = mezclaColor(COLORES.fasePos, col, m);
        neg = mezclaColor(COLORES.faseNeg, tinte(col), m);
        mix2 = m; col2 = col;
        if (ei >= 3) resaltar.push(oid);
        if (tipo === 'par' && !verPares) op = 0;
        // los híbridos σ se atenúan cuando ya han solapado
        if (tipo === 'sigma' && ei >= 5) {
          const k = this.vecs.find((v) => v.j === this.dom.vecino[i]);
          const vi = k ? vP(this.vecs.indexOf(k)) : 0;
          op = lerp(0.62, 0.5, vi);
        }
      } else if (ei >= 3) {
        // orbitales sin hibridar
        const mc = id === 'hibridacion' ? easeInOutCubic(sub01(u, 0.2, 0.8)) : 1;
        if (rol === 'pi') {
          pos = mezclaColor(COLORES.fasePos, COLORES.pi, mc);
          neg = mezclaColor(COLORES.faseNeg, tinte(COLORES.pi), mc);
          op = lerp(0.6, 0.5, mc);
          R = R_AO(oid) * 0.72;
          if (ei >= 6) { op = 0.55 + 0.1 * piP; brillo = 1 + 0.5 * Math.sin(Math.PI * piP); resaltar.push(oid); }
          if (!verPi) op = 0;
        } else if (rol === 'par' || rol === 'sigma' || rol === 'radical') {
          // átomo no hibridado (p puro): colorea por función
          const col = ROL_COLOR[rol];
          pos = mezclaColor(COLORES.fasePos, col, mc);
          neg = mezclaColor(COLORES.faseNeg, tinte(col), mc);
          mix2 = mc; col2 = col;
          if (rol === 'par' && !verPares) op = 0;
          if (rol === 'sigma' && ei >= 5) {
            const k = this.vecs.find((v) => v.j === t.roles[oid].vecino);
            const vi = k ? vP(this.vecs.indexOf(k)) : 0;
            op = lerp(0.62, 0.5, vi);
          }
        } else {
          op = lerp(0.6, 0.16, mc); // vacío (p vacío de B, d sobrantes)
        }
      }
      surf.colores(pos, neg);
      surf.actualizar(campo, R, eje, ancho, isHyb ? lerp(GAMMA_AO(oid), 1.5, m) : GAMMA_AO(oid));
      surf.mat.uniforms.brillo.value = brillo;
      mix2 = 1; col2 = ROL_COLOR[rol] ?? ROL_COLOR.vacio;
      const offA = mul(this.offOf(i), sepF);
      if (sepF > 0.02 && ei < 4 && opG > 0.05) D.lineas.push({ a: W([0, 0, 0]), b: W(offA), color: '#9aa4bd', a_: 0.55 * sepF });
      const opF = op * orbMul * opG * (id === 'final' && !orbOn ? 1 - finalFade : 1) * (rol === 'pi' ? (id === 'final' ? 0.6 : 1) : sd);
      surf.opacidad(opF);
      this.lobos2D(D, oid, isHyb, m, isHyb ? dirNow[i] : undefined, ancho, mix2, col2, opF, R, isHyb ? this.dom.tipos[i] : undefined, offA);
    });

    // ── Etiquetas de los orbitales atómicos (etapas 1-4, mientras están separados)
    this.aoLabs.forEach(({ lab, id: oid }, i) => {
      const sobre = this.aos.get(i)!;
      const fase = id === 'hibridacion' ? 1 - sub01(u, 0.35, 0.5) : 1;
      const visible = (ei <= 2 || (id === 'hibridacion' && fase > 0.02)) && orbOn && sobre.surf.mesh.visible;
      const off = mul(this.offOf(i), sepF);
      const ptxt: Vec3 = add(off, [0, -1.3, 0]);
      lab.position.set(ptxt[0], ptxt[1], ptxt[2]);
      lab.visible = visible;
      lab.element.style.opacity = String(opG * fase);
      if (visible) {
        D.textos.push({ pos: W(ptxt), txt: lab.element.textContent ?? '', tipo: 'orb', op: opG * fase });
        if (id === 'hibridacion' && hib) D.textos.push({ pos: W(add(ptxt, [0, -0.6, 0])), txt: i < N ? 'hibrida' : 'sin hibridar', tipo: i < N ? 'chip' : 'orb', op: opG * fase });
      }
    });

    // ── Átomos (núcleos) y enlaces
    this.aplicarAtomos(id, u, ei, vP, finalFade, previos, opG);

    // ── Vecinos
    const formados: number[] = [];
    let vecinoAct: number | null = null;
    this.vecs.forEach((v, i) => {
      const p = vP(i);
      const arrive = easeInOutCubic(sub01(p, 0, 0.55));
      const solapa = easeInOutCubic(sub01(p, 0.45, 0.82));
      const yaEstaba = previos.has(v.j);
      const lejos = mul(v.dirOut, 5.2);
      const relNow: Vec3 = yaEstaba ? v.rel : lerpV(add(v.rel, lejos), v.rel, arrive);
      const visible = ei >= 5 && (p > 0 || yaEstaba);
      v.surf.mesh.position.set(relNow[0], relNow[1], relNow[2]);
      v.surf.opacidad(visible && id !== 'final' ? lerp(0.1, 1, clamp01(p * 6)) * lerp(0.62, 0.4, ei > 5 || p >= 1 ? 1 : solapa) * orbMul * opG * sd : 0);
      if (p > 0.001 && p < 0.999 && id === 'vecinos') vecinoAct = v.j;
      if (p >= 0.999) formados.push(v.j);
      // electrones: antes del solape en su lóbulo; después, apareados en la región internuclear
      const mid = mul(v.rel, 0.5);
      const lat = mul(norm(v.dirOut), 0.11);
      const lobN = add(relNow, mul(v.dirOut, -0.42 * v.R));
      const parN = add(mid, lat);
      const posN = lerpV(lobN, parN, solapa);
      v.elec.position.set(posN[0], posN[1], posN[2]);
      v.elec.scale.setScalar(0.3);
      v.elec.visible = visible && verElec && id !== 'final';
      if (visible && id !== 'final') this.vecino2D(D, v, W(relNow), Math.min(0.55, lerp(0.1, 1, clamp01(p * 6)) * lerp(0.62, 0.4, ei > 5 || p >= 1 ? 1 : solapa) * orbMul * opG * sd * 0.8));
      if (visible && id !== 'final' && v.domJ) {
        const aR = Math.min(0.55, lerp(0.1, 1, clamp01(p * 6)) * orbMul * opG * sd * 0.8);
        v.domJ.finales.forEach((d, kk) => {
          const tp = v.domJ!.tipos[kk];
          if (tp === 'sigma' && v.domJ!.vecino[kk] === this.c) return;
          const cr = ROL_COLOR[tp];
          D.lobulos.push({ pos: W(relNow), dir: d, L: tp === 'par' ? 0.9 : 0.95, ancho: tp === 'par' ? 1.3 : 1, fill: rgba(cr, aR), stroke: rgba(mezclaColor(cr, '#000000', 0.3), 0.85) });
        });
      }
      if (v.elec.visible) D.electrones.push({ pos: W(posN), color: COLORES.vecino, espin: -1, esc: 0.95 });
      // brillo del solapamiento
      const g = Math.sin(Math.PI * sub01(p, 0.5, 0.9)) * 1.0 + (p >= 0.9 ? 0.32 : 0);
      v.glow.position.set(mid[0], mid[1], mid[2]);
      v.glow.scale.setScalar(0.5 + 0.9 * clamp01(g));
      (v.glow.material as THREE.SpriteMaterial).opacity = clamp01(g) * 0.9 * opG * sd * (id === 'final' ? 1 - finalFade * 0.6 : 1);
      v.glow.visible = visible && orbMul > 0.05 && id !== 'final';
      if (v.glow.visible) D.glows.push({ pos: W(mid), r: 0.2 + 0.35 * clamp01(g), a: (v.glow.material as THREE.SpriteMaterial).opacity });
      // etiqueta
      const lp = add(mul(mid, 1.45), [0, 0.3, 0]);
      v.chip.position.set(lp[0], lp[1], lp[2]);
      v.chip.element.style.opacity = String(clamp01(sub01(p, 0.7, 0.95)) * (id === 'final' ? (orbOn ? 1 - finalFade * 0.7 : 0) : 1) * opG);
      v.chip.visible = p > 0.7 && ei >= 5 && id !== 'final';
      if (v.chip.visible) D.textos.push({ pos: W(lp), txt: v.chip.element.textContent ?? '', tipo: 'chip', op: Number(v.chip.element.style.opacity) });
    });

    // ── Electrones del centro
    const fi = id === 'recuento' ? Math.abs(Math.sin(u * Math.PI * 3)) : 0;
    this.elecs.forEach((e) => {
      const nSl = this.t.excitado[e.k].e;
      let p: Vec3;
      const posExc = this.posAO(e.id, e.slot, nSl);
      const isHyb = !!hib && e.k < N;
      if (id === 'promocion' || ei < 2) {
        const desde = this.posAO(e.desde, e.slot, Math.max(1, this.t.fundamental[this.ids.indexOf(e.desde)].e));
        const q = e.promo || e.desde !== e.id ? promoP : 1;
        const base = lerpV(desde, posExc, q);
        const mid = mul(add(desde, posExc), 0.5);
        const levanta = norm(cross(sub(posExc, desde), [0.3, 0.2, 1]));
        const arco = mul(len(levanta) ? levanta : ([0, 1, 0] as Vec3), 1.1 * Math.sin(Math.PI * q) * (len(sub(posExc, desde)) + 0.6) * 0.5);
        void mid;
        p = e.desde === e.id ? posExc : add(base, arco);
        if (ei < 2) p = e.desde === e.id ? posExc : this.posAO(e.desde, e.slot, Math.max(1, this.t.fundamental[this.ids.indexOf(e.desde)].e));
        const qq = ei < 2 ? (e.desde === e.id ? 1 : 0) : e.promo || e.desde !== e.id ? promoP : 1;
        p = add(p, lerpV(this.offOf(this.ids.indexOf(e.desde)), this.offOf(e.k), qq));
      } else if (isHyb) {
        const ph0 = this.posHib(e.k, e.slot, dirNow[e.k], 1 + 0.38 * wRamp);
        const ph = ph0;
        p = ei === 3 && id === 'hibridacion' ? lerpV(posExc, this.posHib(e.k, e.slot, dirNow[e.k], 1), m) : ph;
        p = add(p, mul(this.offOf(e.k), sepF));
        // apareamiento σ
        if (e.rol === 'sigma') {
          const vi = this.vecs.findIndex((v) => v.j === e.vecino);
          if (vi >= 0) {
            const v = this.vecs[vi];
            const solapa = easeInOutCubic(sub01(vP(vi), 0.45, 0.82));
            p = lerpV(p, sub(mul(v.rel, 0.5), mul(norm(v.dirOut), 0.11)), solapa);
          }
        }
      } else {
        p = add(posExc, mul(this.offOf(e.k), sepF));
        if (e.rol === 'sigma') {
          const vi = this.vecs.findIndex((v) => v.j === e.vecino);
          if (vi >= 0) {
            const v = this.vecs[vi];
            const solapa = easeInOutCubic(sub01(vP(vi), 0.45, 0.82));
            p = lerpV(p, sub(mul(v.rel, 0.5), mul(norm(v.dirOut), 0.11)), solapa);
          }
        }
      }
      // π: los electrones pasan a la nube
      if (e.rol === 'pi' && ei >= 6) {
        const pb = this.piB.find((b) => b.j === e.vecino);
        if (pb && e.piIdx !== undefined && e.piIdx >= 0) {
          const ax = pb.ejes[e.piIdx];
          const mid = mul(this.P[pb.j], 0.5);
          const nube = add(sub(mid, mul(norm(this.P[pb.j]), 0.18)), mul(ax, 0.62));
          const q = easeInOutCubic(sub01(piP, 0.45, 0.85));
          p = lerpV(p, nube, q);
        } else if (this.anillo) {
          const q = easeInOutCubic(sub01(piP, 0.45, 0.85));
          const radial = norm(sub([0, 0, 0], this.anillo.centro));
          p = lerpV(p, add(add(this.anillo.centro, mul(this.anillo.ejes, 0.78)), mul(radial, this.anillo.R)), q);
        }
      }
      e.sprite.position.set(p[0], p[1], p[2]);
      // color fijo según la función del electrón (no cambia entre etapas)
      const color = ROL_COLOR[e.rol];
      const pulso = id === 'recuento' && this.t.fundamental[e.k].e === 1 && e.desde === e.id;
      this.colorear(e.sprite, color, e.espin);
      const esc = pulso ? 0.34 + 0.12 * fi : 0.34;
      e.sprite.scale.setScalar(esc * (id === 'final' ? 0.55 : 0.85));
      let vis = verElec && opG > 0.02;
      if (e.rol === 'par' && !verPares && ei >= 3) vis = false;
      if (e.rol === 'pi' && !verPi && ei >= 3) vis = false;
      if (id === 'final' && !orbOn && finalFade > 0.5) vis = false;
      if (id === 'final' && e.rol !== 'par' && e.rol !== 'radical') vis = false;
      e.sprite.visible = vis;
      if (vis) D.electrones.push({ pos: W(p), color, espin: e.espin, esc: id === 'final' ? 0.6 : esc / 0.34 });
      (e.sprite.material as THREE.SpriteMaterial).opacity = opG;
    });

    // ── Enlaces π
    this.piB.forEach((b) => {
      const q = verPi ? 1 : 0;
      const aparece = easeInOutCubic(sub01(piP, 0, 0.4));
      const nube = easeInOutCubic(sub01(piP, 0.3, 0.8));
      {
        const aP = ei >= 6 ? 0.5 * aparece * q * (id === 'final' ? 0.6 : 1) * orbMul * opG * 0.8 : 0;
        const o2 = ei >= 6 && verPi ? 0.9 * aparece * orbMul * opG : 0;
        b.ejes.forEach((ax) => [1, -1].forEach((sg) => {
          if (aP > 0.01) D.lobulos.push({ pos: W(this.P[b.j]), dir: mul(ax, sg), L: 0.9, fill: rgba(sg > 0 ? '#ff922b' : '#74c0fc', Math.min(0.55, aP)), stroke: rgba(sg > 0 ? '#e8590c' : '1c7ed6'.replace(/^/, '#'), 0.8) });
          D.lineas.push({ a: W(mul(ax, 0.9 * sg)), b: W(add(this.P[b.j], mul(ax, 0.9 * sg))), color: '#e8590c', a_: o2 });
        }));
      }
      b.surfs.forEach((s) => s.opacidad(ei >= 6 ? 0.36 * aparece * q * (id === 'final' ? 0.5 : 1) * orbMul * opG : 0));
      b.lobos.forEach((par) =>
        par.forEach((mesh) => {
          const mm = mesh.material as THREE.ShaderMaterial;
          const o = ei >= 6 ? 0.36 * nube * q * (id === 'final' ? orbMul : 1) * opG : 0;
          mm.uniforms.opacidad.value = o;
          mesh.visible = o > 0.01;
        }),
      );
      b.lineas.forEach((ln) => {
        const o2 = ei >= 6 && verPi ? 0.9 * aparece * orbMul * opG : 0;
        (ln.material as THREE.LineDashedMaterial).opacity = o2;
        ln.visible = o2 > 0.02;
      });
      b.elec.forEach((s, m) => {
        const ax = b.ejes[m];
        const mid = mul(this.P[b.j], 0.5);
        const lobN = add(this.P[b.j], mul(ax, 0.5));
        const nubeP = add(add(mid, mul(norm(this.P[b.j]), 0.18)), mul(ax, -0.62));
        const p = lerpV(lobN, nubeP, easeInOutCubic(sub01(piP, 0.45, 0.85)));
        s.position.set(p[0], p[1], p[2]);
        s.visible = ei >= 6 && verElec && verPi && aparece > 0.05 && id !== 'final';
        (s.material as THREE.SpriteMaterial).opacity = aparece * opG;
        if (s.visible) D.electrones.push({ pos: W([s.position.x, s.position.y, s.position.z]), color: COLORES.vecino, espin: -1, esc: 0.95 });
      });
    });
    if (this.anillo) {
      const a = this.anillo;
      const aparece = easeInOutCubic(sub01(piP, 0, 0.4));
      const nube = easeInOutCubic(sub01(piP, 0.3, 0.8));
      a.surfs.forEach((s) => s.opacidad(ei >= 6 && verPi ? 0.45 * aparece * orbMul * opG : 0));
      {
        const aR = ei >= 6 && verPi ? 0.45 * aparece * orbMul * opG * 0.8 : 0;
        if (aR > 0.01) {
          a.atomos.forEach((ia) => { if (ia !== this.c) [1, -1].forEach((sg) => D.lobulos.push({ pos: W(this.P[ia]), dir: mul(a.ejes, sg), L: 0.9, fill: rgba(sg > 0 ? '#ff922b' : '#74c0fc', Math.min(0.5, aR)), stroke: rgba(sg > 0 ? '#e8590c' : '#1c7ed6', 0.8) })); });
          est.enlaces.forEach((en2) => { if (en2.aromatico && a.atomos.includes(en2.a) && a.atomos.includes(en2.b)) [1, -1].forEach((sg) => D.lineas.push({ a: W(add(this.P[en2.a], mul(a.ejes, 0.9 * sg))), b: W(add(this.P[en2.b], mul(a.ejes, 0.9 * sg))), color: '#e8590c', a_: Math.min(1, aR * 1.8) })); });
        }
      }
      a.toros.forEach((mesh) => {
        const mm = mesh.material as THREE.ShaderMaterial;
        const o = ei >= 6 && verPi ? 0.34 * nube * orbMul * opG : 0;
        mm.uniforms.opacidad.value = o;
        mesh.visible = o > 0.01;
      });
    }

    // ── Etiquetas π: una por enlace π, junto al solapamiento lateral (opacas y por delante de los orbitales)
    {
      const aparece = easeInOutCubic(sub01(piP, 0.25, 0.7));
      const op = ei >= 6 && verPi && (id !== 'final' || orbOn) ? aparece * (id === 'final' ? 1 - finalFade * 0.3 : 1) * opG : 0;
      this.etqPi.forEach(({ datos, chip }) => {
        chip.position.set(datos.pos[0], datos.pos[1], datos.pos[2]);
        chip.element.style.opacity = String(op);
        chip.visible = op > 0.03;
        if (chip.visible) D.textos.push({ pos: W(datos.pos), txt: datos.texto, tipo: 'pi', op });
      });
    }

    // ── Arco de ángulo (repulsión)
    this.actualizarArco(id, u, ei, dirNow, opG);

    // ── Etiqueta de hibridación
    if (hib) {
      const mostrar = (id === 'hibridacion' && u > 0.55) || (id === 'repulsion' && u < 0.85);
      const o = id === 'hibridacion' ? sub01(u, 0.55, 0.8) : id === 'repulsion' ? 1 - sub01(u, 0.7, 0.9) : 0;
      this.hibLab.element.innerHTML = `${N} × <b>${hibridoTexto(hib.tipo)}</b> <span>(${num(hib.pctS, hib.pctS % 1 ? 0 : 0)} % s)</span>`;
      this.hibLab.visible = mostrar;
      this.hibLab.element.style.opacity = String(o * opG);
      if (mostrar) D.textos.push({ pos: W([0, this.RH + 0.95, 0]), txt: `${N} × ${hibridoTexto(hib.tipo)} (${num(hib.pctS, 0)} % s)`, tipo: 'hib', op: o * opG });
    } else this.hibLab.visible = false;

    // Energía relativa para el indicador
    const hayPromo = t.promociones.length > 0;
    const subida = hayPromo ? 0.75 : 0;
    let energia = 0;
    if (id === 'promocion') energia = hayPromo ? subida * easeInOutCubic(sub01(u, 0.18, 0.72)) : 0;
    else if (ei === 3) energia = subida - 0.2 * m;
    else if (ei === 4) energia = subida - 0.2 - 0.15 * u;
    else if (ei === 5) energia = subida - 0.35 - (subida + 0.45) * (nv ? (id === 'vecinos' ? (u * nv > 0 ? clamp01(u) : 0) : 1) : 0);
    else if (ei >= 6) energia = -0.85 - (t.pi ? 0.1 * piP : 0);
    const columna: InfoEstado['columna'] = ei <= 1 ? 'fund' : ei === 2 ? (promoP > 0.5 ? 'exc' : 'fund') : ei <= 4 ? 'hib' : 'enl';
    this.vista?.setDin(D);
    return { resaltar, columna, energia, vecino: vecinoAct, vecinosFormados: formados, promo: promoP, hibridos: m, separacion: sep };
  }

  private aplicarAtomos(id: EtapaId, u: number, ei: number, vP: (i: number) => number, finalFade: number, previos: Set<number>, opG: number) {
    const escn = this.escena;
    const setA = (i: number, o: { visible?: boolean; pos?: Vec3; op?: number; esc?: number }) => {
      escn.setAtomo(i, o);
      this.D.atomos[i] = { visible: o.visible ?? true, op: o.op ?? 1, esc: o.esc ?? 1, pos: o.pos ?? this.Pw[i] };
    };
    const groupOf = new Map<number, number>();
    this.vecs.forEach((vv, kk) => vv.frag.forEach((x) => groupOf.set(x, kk)));
    const est = this.an.estructura;
    const nbrs = new Map(this.vecs.map((v, i) => [v.j, i]));
    est.atomos.forEach((_, i) => {
      const w = this.Pw[i];
      if (i === this.c) {
        // el núcleo: pequeño mientras se ven los orbitales
        const s = id === 'final' ? lerp(0.45, 1, finalFade) : 0.45;
        setA(i, { visible: true, op: 1, esc: s, pos: w });
      } else if (nbrs.has(i)) {
        const k = nbrs.get(i)!;
        const p = vP(k);
        const yaEstaba = previos.has(i);
        const arrive = easeInOutCubic(sub01(p, 0, 0.55));
        const v = this.vecs[k];
        const lejos = mul(v.dirOut, 5.2);
        const pos = add(this.Pw[this.c], yaEstaba ? v.rel : lerpV(add(v.rel, lejos), v.rel, arrive));
        const visible = ei >= 5 && (p > 0 || yaEstaba);
        const s = id === 'final' ? lerp(0.45, 1, finalFade) : 0.45;
        setA(i, { visible: visible || id === 'final', op: id === 'final' ? 1 : clamp01(p * 8) || (yaEstaba ? 1 : 0), esc: s, pos });
      } else if (groupOf.has(i)) {
        const k = groupOf.get(i)!;
        const p = vP(k);
        const v = this.vecs[k];
        const yaEstaba = previos.has(i);
        const arrive = easeInOutCubic(sub01(p, 0, 0.55));
        const disp = yaEstaba ? ([0, 0, 0] as Vec3) : sub(lerpV(add(v.rel, mul(v.dirOut, 5.2)), v.rel, arrive), v.rel);
        const visible = ei >= 5 && (p > 0 || yaEstaba);
        setA(i, { visible: visible || id === 'final', op: id === 'final' ? 1 : clamp01(p * 8) || (yaEstaba ? 1 : 0), esc: id === 'final' ? lerp(0.45, 1, finalFade) : 0.45, pos: add(this.Pw[i], disp) });
      } else {
        const vis = id === 'final' || previos.has(i);
        setA(i, { visible: vis, op: id === 'final' ? finalFade : 1, esc: id === 'final' ? 1 : 0.45, pos: w });
      }
    });
    est.enlaces.forEach((e, k) => {
      let op = 0;
      if (id === 'final') op = finalFade;
      if (previos.has(e.a) && previos.has(e.b)) op = 1;
      const ga = groupOf.get(e.a), gb = groupOf.get(e.b);
      if (ga !== undefined && ga === gb) op = id === 'final' ? 1 : ei >= 5 ? clamp01(vP(ga) * 8) : 0;
      escn.setEnlace(k, { visible: op > 0.01, op: op * opG });
      this.D.enlaces[k] = { op: op * opG };
    });
    escn.actualizarEnlaces();
  }

  private actualizarArco(id: EtapaId, u: number, ei: number, dirNow: Vec3[], opG: number) {
    const t = this.t;
    const mostrar = !!t.hibridacion && id === 'repulsion' && this.N >= 2;
    this.arco.visible = mostrar;
    this.arcoLab.visible = mostrar;
    if (!mostrar) return;
    const tipos = this.dom.tipos;
    const sig = tipos.map((x, i) => (x === 'sigma' ? i : -1)).filter((i) => i >= 0);
    const otros = tipos.map((x, i) => (x !== 'sigma' ? i : -1)).filter((i) => i >= 0);
    let a: number, b: number;
    if (sig.length >= 2) [a, b] = [sig[0], sig[1]];
    else if (sig.length === 1 && otros.length) [a, b] = [sig[0], otros[0]];
    else [a, b] = [0, 1];
    const ua = dirNow[a], ub = dirNow[b];
    const R = 0.62;
    const ang = anguloEntre(ua, ub);
    const thRad = Math.acos(Math.max(-1, Math.min(1, dot(ua, ub))));
    const pts: THREE.Vector3[] = [];
    // arco en el plano de ua y ub; si son colineales (180°, sp) se usa un semicírculo en un plano cualquiera que los contenga
    const cd = dot(ua, ub);
    let w: Vec3 = sub(ub, mul(ua, cd));
    w = len(w) < 1e-4 ? perpendicular(ua) : norm(w);
    for (let i = 0; i <= 24; i++) {
      const q = i / 24;
      const p = add(mul(ua, Math.cos(q * thRad)), mul(w, Math.sin(q * thRad)));
      pts.push(new THREE.Vector3(p[0] * R, p[1] * R, p[2] * R));
    }
    this.arco.geometry.setFromPoints(pts);
    (this.arco.material as THREE.LineBasicMaterial).opacity = opG;
    const mid = pts[12];
    this.arcoLab.position.set(mid.x * 1.5, mid.y * 1.5, mid.z * 1.5);
    this.arcoLab.element.textContent = `${num(ang, 1)}°`;
    const Wt = (v: THREE.Vector3): Vec3 => add(this.Pw[this.c], [v.x, v.y, v.z]);
    for (let i = 0; i < pts.length - 1; i++) this.D.lineas.push({ a: Wt(pts[i]), b: Wt(pts[i + 1]), color: '#f59e0b', a_: opG });
    this.D.textos.push({ pos: Wt(mid.clone().multiplyScalar(1.5)), txt: `${num(ang, 1)}°`, tipo: 'ang', op: opG });
    void u; void ei;
  }

  /** Lóbulos 2D (estilo libro) de un orbital atómico/híbrido, con morphing AO → híbrido. */
  private lobos2D(D: Din, oid: string, isHyb: boolean, m: number, hdir: Vec3 | undefined, ancho: number, mix2: number, col2: string, opF: number, R: number, tipo: string | undefined, off: Vec3) {
    void mix2; void tipo;
    if (opF < 0.02) return;
    const a = Math.min(0.62, opF * 0.8), so = Math.min(1, opF * 1.6);
    const cp = col2, cn = tinte(col2);
    const fp = rgba(cp, a), sp = rgba(mezclaColor(cp, '#000000', 0.3), 0.85 * so);
    const fb = rgba(cn, a * 0.95 * (1 - 0.6 * m)), sb = rgba(mezclaColor(cn, '#000000', 0.3), 0.85 * so * (1 - 0.5 * m));
    const pw = add(this.Pw[this.c], off), O0: Vec3 = [0, 0, 0], base = R_AO(oid);
    if (oid === 's') {
      if (!isHyb) { D.lobulos.push({ pos: pw, dir: O0, L: 0, esfera: base * 0.62, fill: fp, stroke: sp }); return; }
      if (m < 0.98) D.lobulos.push({ pos: pw, dir: O0, L: 0, esfera: base * 0.62 * (1 - m), fill: fp, stroke: sp });
      if (m > 0.02) {
        D.lobulos.push({ pos: pw, dir: hdir!, L: this.RH * 0.95 * m, fill: fp, stroke: sp, ancho });
        D.lobulos.push({ pos: pw, dir: mul(hdir!, -1), L: this.RH * 0.3 * m, fill: fb, stroke: sb });
      }
      return;
    }
    const ax0 = this.lobuloAO(oid, 1), Lp = base * 0.8;
    if (!isHyb) {
      D.lobulos.push({ pos: pw, dir: ax0, L: Lp, fill: fp, stroke: sp });
      D.lobulos.push({ pos: pw, dir: mul(ax0, -1), L: Lp, fill: fp, stroke: sp });
      return;
    }
    D.lobulos.push({ pos: pw, dir: nlerp(ax0, hdir!, m), L: lerp(Lp, this.RH * 0.95, m), fill: fp, stroke: sp, ancho });
    D.lobulos.push({ pos: pw, dir: nlerp(mul(ax0, -1), mul(hdir!, -1), m), L: lerp(Lp, this.RH * 0.3, m), fill: m < 0.5 ? fp : fb, stroke: m < 0.5 ? sp : sb });
  }

  private vecino2D(D: Din, v: Vec, pw: Vec3, a: number) {
    if (a < 0.02) return;
    const fp = rgba(COLORES.vecino, a), sp = rgba(mezclaColor(COLORES.vecino, '#000000', 0.25), 0.85);
    if (v.kind === 'H') { D.lobulos.push({ pos: pw, dir: [0, 0, 0], L: 0, esfera: 0.42, fill: fp, stroke: sp }); return; }
    D.lobulos.push({ pos: pw, dir: mul(v.dirOut, -1), L: v.R * 0.9, fill: fp, stroke: sp });
    if (v.kind === 'p') D.lobulos.push({ pos: pw, dir: v.dirOut, L: v.R * 0.9, fill: rgba(tinte(COLORES.vecino), a * 0.6), stroke: sp });
  }

  /** Muestra u oculta todo el rig. */
  visible(v: boolean) {
    this.grupo.visible = v;
    if (!v) { this.vecs.forEach((x) => (x.chip.visible = false)); this.etqPi.forEach((x) => (x.chip.visible = false)); }
    if (!v) {
      this.vista?.setDin(null);
      this.aoLabs.forEach(({ lab }) => (lab.visible = false));
      this.hibLab.visible = false;
      this.arcoLab.visible = false;
    }
  }

  dispose() {
    this.escena.grupoOrbitales.remove(this.grupo);
    this.grupo.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose?.();
      if ((o as CSS2DObject).element) (o as CSS2DObject).element.remove();
    });
  }
}

export type { Orbital };
void cross;
