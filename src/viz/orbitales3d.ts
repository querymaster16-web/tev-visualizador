/** Superficies de orbitales (geometría paramétrica con sombreado Fresnel) y sprites de electrones. */
import * as THREE from 'three';
import type { Vec3 } from '../chem/vec';
import type { Campo } from './campos';

export const COLORES = {
  par: '#8b5cf6',
  sigma: '#3b82f6',
  pi: '#f59e0b',
  promo: '#22c55e',
  vecino: '#ec4899',
  radical: '#14b8a6',
  fasePos: '#4cc3ff',
  faseNeg: '#ffd166',
} as const;

const VERT = /* glsl */ `
  attribute float fase;
  varying vec3 vN; varying vec3 vV; varying float vF;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vN = normalize(normalMatrix * normal);
    vV = normalize(-mv.xyz);
    vF = fase;
    gl_Position = projectionMatrix * mv;
  }`;
const FRAG = /* glsl */ `
  uniform vec3 colorPos; uniform vec3 colorNeg; uniform float opacidad; uniform float brillo;
  varying vec3 vN; varying vec3 vV; varying float vF;
  void main() {
    float f = clamp(vF * 3.0 * 0.5 + 0.5, 0.0, 1.0);
    vec3 base = mix(colorNeg, colorPos, f);
    float ndv = abs(dot(normalize(vN), normalize(vV)));
    float fres = pow(1.0 - ndv, 2.2);           // borde tipo Fresnel
    vec3 col = mix(base * (0.95 + 0.15 * brillo), base * 0.55, fres);
    float a = opacidad * (0.28 + 0.72 * pow(fres, 1.4)) * (0.8 + 0.2 * brillo);
    gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));
  }`;

export function materialOrbital(pos: string, neg: string, opacidad = 0.6): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      colorPos: { value: new THREE.Color(pos) },
      colorNeg: { value: new THREE.Color(neg) },
      opacidad: { value: opacidad },
      brillo: { value: 1 },
    },
  });
}

/** Malla paramétrica sobre la esfera de direcciones; se recalcula en cada cambio de campo. */
export class SuperficieOrbital {
  readonly mesh: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  private dirs: Float32Array;
  private nv: number;
  readonly mat: THREE.ShaderMaterial;
  private static idx: Uint16Array | null = null;
  private static readonly ST = 22;
  private static readonly SL = 32;

  constructor(pos: string = COLORES.fasePos, neg: string = COLORES.faseNeg, opacidad = 0.6) {
    const ST = SuperficieOrbital.ST, SL = SuperficieOrbital.SL;
    this.nv = (ST + 1) * (SL + 1);
    this.dirs = new Float32Array(this.nv * 3);
    let k = 0;
    for (let i = 0; i <= ST; i++) {
      const th = (Math.PI * i) / ST;
      for (let j = 0; j <= SL; j++) {
        const ph = (2 * Math.PI * j) / SL;
        this.dirs[k++] = Math.sin(th) * Math.cos(ph);
        this.dirs[k++] = Math.cos(th);
        this.dirs[k++] = Math.sin(th) * Math.sin(ph);
      }
    }
    if (!SuperficieOrbital.idx) {
      const idx: number[] = [];
      for (let i = 0; i < ST; i++)
        for (let j = 0; j < SL; j++) {
          const a = i * (SL + 1) + j, b = a + SL + 1;
          idx.push(a, b, a + 1, b, b + 1, a + 1);
        }
      SuperficieOrbital.idx = new Uint16Array(idx);
    }
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.nv * 3), 3));
    this.geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(this.nv * 3), 3));
    this.geo.setAttribute('fase', new THREE.BufferAttribute(new Float32Array(this.nv), 1));
    this.geo.setIndex(new THREE.BufferAttribute(SuperficieOrbital.idx, 1));
    this.mat = materialOrbital(pos, neg, opacidad);
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
  }

  colores(pos: string, neg: string) {
    this.mat.uniforms.colorPos.value.set(pos);
    this.mat.uniforms.colorNeg.value.set(neg);
  }
  opacidad(o: number) {
    this.mat.uniforms.opacidad.value = o;
    this.mesh.visible = o > 0.003;
  }

  /**
   * Recalcula la superficie ρ = R·|f|^γ. Si se da `eje`, las componentes perpendiculares
   * al eje se multiplican por `ancho` (pares solitarios más anchos).
   */
  actualizar(campo: Campo, radio: number, eje?: Vec3, ancho = 1, gamma = 1.55) {
    const pos = this.geo.getAttribute('position') as THREE.BufferAttribute;
    const fase = this.geo.getAttribute('fase') as THREE.BufferAttribute;
    const d = this.dirs;
    for (let v = 0; v < this.nv; v++) {
      const x = d[3 * v], y = d[3 * v + 1], z = d[3 * v + 2];
      const f = campo(x, y, z);
      const r = radio * Math.pow(Math.abs(f), gamma);
      let px = x * r, py = y * r, pz = z * r;
      if (eje && ancho !== 1) {
        const par = px * eje[0] + py * eje[1] + pz * eje[2];
        const qx = px - par * eje[0], qy = py - par * eje[1], qz = pz - par * eje[2];
        px = par * eje[0] + ancho * qx;
        py = par * eje[1] + ancho * qy;
        pz = par * eje[2] + ancho * qz;
      }
      pos.setXYZ(v, px, py, pz);
      fase.setX(v, f >= 0 ? 1 : -1);
    }
    pos.needsUpdate = true;
    fase.needsUpdate = true;
    this.geo.computeVertexNormals();
  }

  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

// ───────────────────────── Electrones ─────────────────────────
const cacheTex = new Map<string, THREE.CanvasTexture>();
/** Punto brillante con una pequeña flecha de espín (↑/↓) en su interior. */
export function texturaElectron(color: string, espin: 1 | -1 | 0): THREE.CanvasTexture {
  const key = color + espin;
  const c0 = cacheTex.get(key);
  if (c0) return c0;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 128;
  const g = cv.getContext('2d')!;
  g.beginPath();
  g.arc(64, 64, 46, 0, Math.PI * 2);
  g.fillStyle = color;
  g.fill();
  g.lineWidth = 7;
  g.strokeStyle = "rgba(10,14,40,0.85)";
  g.stroke();
  if (espin !== 0) {
    const arriba = espin === 1;
    const punta = arriba ? 36 : 92, cola = arriba ? 90 : 38, baseY = punta + (arriba ? 20 : -20);
    g.strokeStyle = "#ffffff";
    g.fillStyle = "#ffffff";
    g.lineWidth = 8;
    g.lineCap = "round";
    g.beginPath();
    g.moveTo(64, cola);
    g.lineTo(64, baseY);
    g.stroke();
    g.beginPath();
    g.moveTo(64, punta);
    g.lineTo(51, baseY);
    g.lineTo(77, baseY);
    g.closePath();
    g.fill();
  }
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  cacheTex.set(key, t);
  return t;
}

export function crearElectron(color: string, espin: 1 | -1 | 0, tam = 0.3): THREE.Sprite {
  const mat = new THREE.SpriteMaterial({ map: texturaElectron(color, espin), transparent: true, depthTest: false, depthWrite: false });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(tam);
  s.renderOrder = 20;
  return s;
}
export function cambiarElectron(s: THREE.Sprite, color: string, espin: 1 | -1 | 0) {
  (s.material as THREE.SpriteMaterial).map = texturaElectron(color, espin);
  (s.material as THREE.SpriteMaterial).needsUpdate = true;
}
