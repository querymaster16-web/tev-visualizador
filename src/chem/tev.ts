/** Teoría del Enlace de Valencia: configuración, promoción, hibridación, enlaces σ/π. */
import { ErrorQuimica, nucleo } from './elementos';
import { hibridoTexto, sub, sup } from './formato';
import { HIBRIDO_POR_ESTERICO, Rpecv, rpecvAtomo } from './rpecv';
import type { Estructura } from './tipos';
import { cargaFormal, vecinos } from './tipos';

export type Subnivel = 's' | 'p' | 'd';
export type Rol = 'par' | 'sigma' | 'pi' | 'radical' | 'vacio';

export interface Orbital {
  id: string; // s, px, py, pz, d1..d5
  sub: Subnivel;
  /** Electrones: 0, 1 o 2 */
  e: number;
}
export interface RolOrbital {
  rol: Rol;
  /** Vecino al que está ligado (σ/π). */
  vecino?: number;
}
export interface Promocion {
  de: Subnivel;
  a: Subnivel;
  texto: string;
}
export interface Hibridacion {
  tipo: string; // sp3d2
  tipoTexto: string;
  n: number;
  composicion: { s: number; p: number; d: number };
  composicionTexto: string; // «1 s + 3 p + 1 d»
  pctS: number;
  contenido: { tipo: 'par' | 'sigma' | 'radical'; vecino?: number }[];
  orbitalesIds: string[];
}
export interface AtomoTEV {
  idx: number;
  simbolo: string;
  capa: number;
  cargaFormal: number;
  /** Etiqueta del átomo/ion: «N⁺», «B⁻», «C». */
  etiqueta: string;
  efectivos: number;
  nucleo: string;
  configFundamental: string;
  configExcitada: string;
  fundamental: Orbital[];
  excitado: Orbital[];
  roles: Record<string, RolOrbital>;
  promociones: Promocion[];
  pares: number;
  desapareados: number;
  sigma: number;
  pi: number;
  radical: number;
  hibridado: boolean;
  hibridacion: Hibridacion | null;
  /** Orbitales atómicos que quedan sin hibridar y con electrones π (o vacíos relevantes). */
  sinHibridar: string[];
  rpecv: Rpecv;
  /** Orbital asignado al σ de cada vecino y a sus π. */
  porVecino: Record<number, { sigma: string; pis: string[] }>;
  notas: string[];
  error?: string;
}
export interface EnlaceTEV {
  a: number;
  b: number;
  orden: number;
  sigma: string;
  pis: string[];
  deslocalizado: boolean;
}
export interface OpcionesTEV {
  /** Hibridar también los átomos con un único vecino (por defecto, p puro). */
  hibridarTerminales: boolean;
  /** 'cargas' (por defecto): minimizar cargas formales; 'octeto': respetar el octeto. */
  convenio?: 'cargas' | 'octeto';
}

const ORDEN_IDS = ['s', 'px', 'py', 'pz', 'd1', 'd2', 'd3', 'd4', 'd5'];
const subDe = (id: string): Subnivel => (id === 's' ? 's' : id[0] === 'p' ? 'p' : 'd');
const SUBIDX = { s: 0, p: 1, d: 2 };

function orbitalesDisponibles(periodo: number, z: number): string[] {
  if (z <= 2) return ['s'];
  if (periodo === 2) return ORDEN_IDS.slice(0, 4);
  return ORDEN_IDS;
}

/** Llena `ne` electrones por Hund sobre s → p → d. */
function configFundamental(ids: string[], ne: number): Orbital[] {
  const orb: Orbital[] = ids.map((id) => ({ id, sub: subDe(id), e: 0 }));
  let resto = ne;
  const llenar = (grupo: Orbital[]) => {
    const cap = grupo.length * 2;
    const k = Math.min(resto, cap);
    resto -= k;
    // Hund: uno en cada orbital y luego se aparean
    for (let r = 0; r < k; r++) grupo[r % grupo.length].e++;
  };
  llenar(orb.filter((o) => o.sub === 's'));
  llenar(orb.filter((o) => o.sub === 'p'));
  llenar(orb.filter((o) => o.sub === 'd'));
  return orb;
}

export function etiquetaOrbital(o: { id: string; sub: Subnivel }, capa: number) {
  return `${capa}${o.sub}`;
}

function textoConfig(orb: Orbital[], capa: number, nuc: string): string {
  const tot = { s: 0, p: 0, d: 0 };
  orb.forEach((o) => (tot[o.sub] += o.e));
  const partes: string[] = [];
  (['s', 'p', 'd'] as Subnivel[]).forEach((s) => {
    if (tot[s] > 0 || (s === 'p' && false)) partes.push(`${capa}${s}${sup(tot[s])}`);
  });
  return [nuc, ...partes].filter(Boolean).join(' ');
}

function etiquetaAtomo(simbolo: string, q: number) {
  if (q === 0) return simbolo;
  return simbolo + (Math.abs(q) > 1 ? sup(Math.abs(q)) : '') + (q > 0 ? '⁺' : '⁻');
}

export function analizarAtomoTEV(est: Estructura, i: number, op: OpcionesTEV): AtomoTEV {
  const a = est.atomos[i];
  const el = a.el;
  const capa = el.periodo;
  const fc = cargaFormal(est, i);
  const efectivos = el.valencia - fc;
  const nb = vecinos(est, i);
  const sigma = nb.length;
  const pi = nb.reduce((s, v) => s + (v.e.orden - 1), 0);
  const P = a.pares;
  const rad = a.radical;
  const U = sigma + pi + rad;
  const rp = rpecvAtomo(est, i);
  const ids = orbitalesDisponibles(capa, el.z);
  const nuc = nucleo(el);
  const base: AtomoTEV = {
    idx: i, simbolo: el.simbolo, capa, cargaFormal: fc, etiqueta: etiquetaAtomo(el.simbolo, fc), efectivos, nucleo: nuc,
    configFundamental: '', configExcitada: '', fundamental: [], excitado: [], roles: {}, promociones: [],
    pares: P, desapareados: U, sigma, pi, radical: rad, hibridado: false, hibridacion: null, sinHibridar: [], rpecv: rp,
    porVecino: {}, notas: [],
  };
  const fallo = (m: string): AtomoTEV => ({ ...base, error: m });

  if (2 * P + U !== efectivos) {
    return fallo(`Los electrones del átomo ${el.simbolo} no cuadran (${2 * P} en pares + ${U} desapareados ≠ ${efectivos}).`);
  }
  if (P + U > ids.length) {
    const razon = capa === 2
      ? `El ${el.simbolo} es del periodo 2: solo tiene orbitales 2s y 2p (4 orbitales) y esta estructura necesitaría ${P + U}. Los átomos del periodo 2 no disponen de orbitales d, por lo que no pueden superar el octeto.`
      : `Hacen falta ${P + U} orbitales de valencia y el modelo solo dispone de ${ids.length}.`;
    return fallo(razon);
  }

  // Configuración fundamental
  const fund = configFundamental(ids, efectivos);
  // Estado excitado: los pares en los orbitales de menor energía y después los desapareados
  const exc: Orbital[] = ids.map((id) => ({ id, sub: subDe(id), e: 0 }));
  // Hibridación
  const pDom = rp.parConjugado ? 0 : P;
  const rDom = rp.radicalPlano ? 0 : rad;
  const N = sigma + pDom + rDom;
  const terminalPuro = sigma === 1 && !op.hibridarTerminales && el.z > 2;
  const hibridado = N >= 2 && !terminalPuro && el.z > 2;
  if (hibridado && N > ids.length) return fallo(`No hay orbitales suficientes para hibridar ${N} dominios.`);

  // Roles de los orbitales. Los dominios (híbridos) ocupan los primeros N; el par del N conjugado
  // y el electrón de un radical plano van a un p sin hibridar, justo después, y luego los π.
  const roles: Record<string, RolOrbital> = {};
  ids.forEach((id) => (roles[id] = { rol: 'vacio' }));
  for (let k = 0; k < pDom; k++) { roles[ids[k]] = { rol: 'par' }; exc[k].e = 2; }
  const vecs = nb.map((v) => v.j).sort((x, y) => x - y);
  let cursor = pDom;
  const porVecino: AtomoTEV['porVecino'] = {};
  vecs.forEach((j) => {
    roles[ids[cursor]] = { rol: 'sigma', vecino: j };
    exc[cursor].e = 1;
    porVecino[j] = { sigma: ids[cursor], pis: [] };
    cursor++;
  });
  for (let r = 0; r < rDom; r++) { roles[ids[cursor]] = { rol: 'radical' }; exc[cursor].e = 1; cursor++; }
  if (hibridado) cursor = N;
  if (rp.parConjugado) { roles[ids[cursor]] = { rol: 'par' }; exc[cursor].e = 2; cursor++; }
  if (rp.radicalPlano) { roles[ids[cursor]] = { rol: 'radical' }; exc[cursor].e = 1; cursor++; }
  vecs.forEach((j) => {
    const orden = nb.find((v) => v.j === j)!.e.orden;
    for (let k = 1; k < orden; k++) {
      roles[ids[cursor]] = { rol: 'pi', vecino: j };
      exc[cursor].e = 1;
      porVecino[j].pis.push(ids[cursor]);
      cursor++;
    }
  });
  // Si hay hibridación, los híbridos ocupan [0,N) aunque algún orbital esté «vacío» (p.ej. el d de sp³d sin π)
  const exc2 = exc;

  // Promociones por diferencia de subniveles
  const cuenta = (o: Orbital[]) => {
    const t = { s: 0, p: 0, d: 0 };
    o.forEach((x) => (t[x.sub] += x.e));
    return t;
  };
  const cf = cuenta(fund), ce = cuenta(exc2);
  const pierden: Subnivel[] = [], ganan: Subnivel[] = [];
  (['s', 'p', 'd'] as Subnivel[]).forEach((s) => {
    const dlt = ce[s] - cf[s];
    for (let k = 0; k < -dlt; k++) pierden.push(s);
    for (let k = 0; k < dlt; k++) ganan.push(s);
  });
  const promociones: Promocion[] = [];
  const agrupa = new Map<string, number>();
  pierden.forEach((de, k) => {
    const to = ganan[k];
    agrupa.set(`${de}>${to}`, (agrupa.get(`${de}>${to}`) ?? 0) + 1);
  });
  for (const [k, n] of agrupa) {
    const [de, to] = k.split('>') as [Subnivel, Subnivel];
    promociones.push({ de, a: to, texto: `${n} e⁻ de ${capa}${de} → ${capa}${to}` });
  }

  // Hibridación: composición y contenido
  let hib: Hibridacion | null = null;
  const sinHibridar: string[] = [];
  if (hibridado) {
    const hids = ids.slice(0, N);
    const comp = { s: 0, p: 0, d: 0 };
    hids.forEach((id) => comp[subDe(id)]++);
    const tipo = HIBRIDO_POR_ESTERICO[N];
    const contenido: Hibridacion['contenido'] = [];
    for (let k = 0; k < pDom; k++) contenido.push({ tipo: 'par' });
    vecs.forEach((j) => contenido.push({ tipo: 'sigma', vecino: j }));
    for (let r = 0; r < rDom; r++) contenido.push({ tipo: 'radical' });
    hib = {
      tipo, tipoTexto: hibridoTexto(tipo), n: N, composicion: comp,
      composicionTexto: [comp.s && `${comp.s} s`, comp.p && `${comp.p} p`, comp.d && `${comp.d} d`].filter(Boolean).join(' + '),
      pctS: 100 / N, contenido, orbitalesIds: hids,
    };
    ids.slice(N).forEach((id) => sinHibridar.push(id));
  } else {
    ids.forEach((id) => {
      if (roles[id].rol === 'pi') sinHibridar.push(id);
    });
  }

  // Notas didácticas de átomo
  const notas: string[] = [];
  if (hib && rp.e > 0) {
    notas.push(
      `La geometría electrónica es ${rp.geometriaElectronica} (${N} dominios), pero la geometría molecular es ${rp.geometriaMolecular}: los pares solitarios cuentan para la hibridación y no se «ven» en la forma.`,
    );
  }
  if (promociones.length) {
    notas.push(
      `La promoción cuesta energía, pero se compensa porque se forman más enlaces (cada enlace libera más energía que la que se gasta al promocionar el electrón).`,
    );
  }
  if (hib && hib.composicion.d > 0) {
    notas.push(
      `Octeto expandido: el modelo con orbitales d es el clásico de los libros de texto; los cálculos modernos le dan a los d poco peso en el enlace (hipervalencia por enlaces de 3 centros y 4 electrones).`,
    );
  } else if (pi > 0 && ids.slice(0, 4).length < P + U && sinHibridar.some((s) => s.startsWith('d'))) {
    notas.push('Algún enlace π de este átomo usa orbitales d (modelo clásico de octeto expandido).');
  }
  if (rad && !rp.radicalPlano) notas.push(`Tiene un electrón desapareado (radical): ocupa ${hibridado ? 'un híbrido' : 'un orbital p (átomo sin hibridar)'} y no forma enlace.`);
  if (rp.radicalPlano) notas.push('Radical de carbono: es plano, sp². El electrón desapareado no cuenta como dominio: se queda en el orbital 2p sin hibridar, perpendicular al plano (trigonal plana, 120°).');
  if (rp.parConjugado) notas.push('Nitrógeno conjugado: el par solitario ocupa un orbital p sin hibridar y se conjuga (resonancia) con el enlace π vecino. Por eso el N es sp² y plano (trigonal plana), no sp³ piramidal como en una amina.');
  if (!rp.parConjugado && ['S', 'Se', 'P', 'As'].includes(el.simbolo) && sigma >= 2 && nb.every((v) => est.atomos[v.j].el.simbolo === 'H') && rp.esterico === 4) notas.push(`El ángulo real (≈ ${rp.anguloReal ?? 92}°) está muy cerca de 90°: ${el.simbolo} usa orbitales p casi puros. Se describe como sp³ por coherencia con RPECV, pero la hibridación es muy pequeña.`);
  if (el.simbolo === 'Xe' && rp.esterico === 7) notas.push('XeF₆: número estérico 7 (AX₆E, sp³d³). No es una pirámide pentagonal rígida: es un octaedro distorsionado (estructura fluxional), porque el par solitario es muy móvil.');
  if (el.simbolo === 'O' && sigma === 2 && nb.every((v) => est.atomos[v.j].el.simbolo !== 'H' || true) && nb.some((v) => est.atomos[v.j].el.simbolo === 'O') && nb.some((v) => est.atomos[v.j].el.simbolo === 'H')) notas.push('H₂O₂: la molécula no es plana; el ángulo diedro H–O–O–H es ≈ 111°.');
  if (['Be', 'B', 'Al', 'Ga'].includes(el.simbolo) && sigma < 4 && efectivos <= 3) {
    notas.push(`${el.simbolo} no completa el octeto: queda un orbital p vacío (aceptor de pares de electrones).`);
  }
  if (fc !== 0) notas.push(`Carga formal ${fc > 0 ? '+' : '−'}${Math.abs(fc)}: el átomo se trata como el ion ${etiquetaAtomo(el.simbolo, fc)} (${efectivos} e⁻ efectivos).`);
  if (terminalPuro && el.z > 2) notas.push('Átomo con un solo vecino: por convención usa un orbital p puro para el enlace (sin hibridar).');

  return {
    ...base,
    configFundamental: textoConfig(fund, capa, nuc),
    configExcitada: textoConfig(exc2, capa, nuc),
    fundamental: fund, excitado: exc2, roles, promociones, hibridado: !!hib, hibridacion: hib, sinHibridar, porVecino, notas,
  };
}

/** Texto de un orbital para etiquetas de enlace: «sp³ C», «2p O», «1s H». */
export function nombreOrbitalEnlace(t: AtomoTEV, id: string): string {
  if (t.hibridacion && t.hibridacion.orbitalesIds.includes(id)) return `${t.hibridacion.tipoTexto} ${t.simbolo}`;
  const s = subDe(id);
  return `${t.capa}${s} ${t.simbolo}`;
}

export interface ResultadoTEV {
  atomos: AtomoTEV[];
  enlaces: EnlaceTEV[];
  sigma: number;
  pi: number;
  notas: string[];
}

export function analizarTEV(est: Estructura, formas: Estructura[], op: OpcionesTEV): ResultadoTEV {
  const atomos = est.atomos.map((_, i) => analizarAtomoTEV(est, i, op));
  const deslocalizados = new Set<number>();
  if (formas.length > 1) {
    est.enlaces.forEach((e, k) => {
      if (formas.some((f) => f.enlaces[k].orden !== e.orden)) deslocalizados.add(k);
    });
  }
  const enlaces: EnlaceTEV[] = est.enlaces.map((e, k) => {
    const A = atomos[e.a], B = atomos[e.b];
    const sg = `σ(${A.error ? '?' : nombreOrbitalEnlace(A, A.porVecino[e.b]?.sigma ?? 's')} – ${B.error ? '?' : nombreOrbitalEnlace(B, B.porVecino[e.a]?.sigma ?? 's')})`;
    const pis: string[] = [];
    for (let m = 0; m < e.orden - 1; m++) {
      const oa = A.porVecino[e.b]?.pis[m], ob = B.porVecino[e.a]?.pis[m];
      pis.push(`π(${oa ? nombreOrbitalEnlace(A, oa) : '?'} – ${ob ? nombreOrbitalEnlace(B, ob) : '?'})`);
    }
    return { a: e.a, b: e.b, orden: e.orden, sigma: sg, pis, deslocalizado: deslocalizados.has(k) };
  });
  const notas: string[] = [];
  if (est.atomos.length === 2 && est.atomos.every((a) => a.el.simbolo === 'O')) {
    notas.push('La TEV describe el O₂ con doble enlace y todos los electrones apareados, pero el O₂ real es paramagnético (tiene dos electrones desapareados). Eso solo lo explica la teoría de orbitales moleculares (TOM).');
  }
  if (formas.length > 1) {
    notas.push(`Resonancia: existen ${formas.length} formas resonantes equivalentes. La estructura real es un híbrido: el enlace π está deslocalizado y los enlaces afectados tienen orden intermedio.`);
  }
  if (atomos.some((a) => a.hibridacion && a.hibridacion.composicion.d > 0)) {
    notas.push('Octeto expandido: el modelo de orbitales d es el clásico de los libros de texto; los cálculos modernos le dan poco peso a los d.');
  }
  if (atomos.some((a) => !a.error && a.rpecv.paresSolitarios + a.rpecv.radical > 0 && a.hibridado)) {
    notas.push('Geometría electrónica ≠ molecular: la electrónica cuenta todos los dominios (también pares solitarios); la molecular solo describe la posición de los átomos.');
  }
  return {
    atomos, enlaces, notas,
    sigma: enlaces.length,
    pi: enlaces.reduce((s, e) => s + e.pis.length, 0),
  };
}
void sub;
