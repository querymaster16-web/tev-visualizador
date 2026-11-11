/** Datos de los elementos de los grupos principales (H–Rn, grupos 1, 2 y 13–18). */
export interface Elemento {
  z: number;
  simbolo: string;
  nombre: string;
  grupo: number;
  periodo: number;
  /** Electronegatividad de Pauling (null para He, Ne, Ar). */
  en: number | null;
  /** Radio covalente (pm). */
  radio: number;
  /** Color CPK. */
  color: string;
  /** Electrones de valencia del átomo neutro. */
  valencia: number;
}

export class ErrorQuimica extends Error {
  sugerencias: string[];
  /** "transicion": metal no soportado (no tiene sentido reintentar con otro formato). */
  codigo: "general" | "transicion" | "sintaxis" = "general";
  constructor(mensaje: string, sugerencias: string[] = [], codigo: "general" | "transicion" | "sintaxis" = "general") {
    super(mensaje);
    this.name = 'ErrorQuimica';
    this.sugerencias = sugerencias;
    this.codigo = codigo;
  }
}

// [z, símbolo, nombre, grupo, periodo, EN, radio, color]
type Fila = [number, string, string, number, number, number | null, number, string];
const FILAS: Fila[] = [
  [1, 'H', 'hidrógeno', 1, 1, 2.2, 31, '#FFFFFF'],
  [2, 'He', 'helio', 18, 1, null, 28, '#D9FFFF'],
  [3, 'Li', 'litio', 1, 2, 0.98, 128, '#CC80FF'],
  [4, 'Be', 'berilio', 2, 2, 1.57, 96, '#C2FF00'],
  [5, 'B', 'boro', 13, 2, 2.04, 84, '#FFB5B5'],
  [6, 'C', 'carbono', 14, 2, 2.55, 76, '#909090'],
  [7, 'N', 'nitrógeno', 15, 2, 3.04, 71, '#3050F8'],
  [8, 'O', 'oxígeno', 16, 2, 3.44, 66, '#FF0D0D'],
  [9, 'F', 'flúor', 17, 2, 3.98, 57, '#90E050'],
  [10, 'Ne', 'neón', 18, 2, null, 58, '#B3E3F5'],
  [11, 'Na', 'sodio', 1, 3, 0.93, 166, '#AB5CF2'],
  [12, 'Mg', 'magnesio', 2, 3, 1.31, 141, '#8AFF00'],
  [13, 'Al', 'aluminio', 13, 3, 1.61, 121, '#BFA6A6'],
  [14, 'Si', 'silicio', 14, 3, 1.9, 111, '#F0C8A0'],
  [15, 'P', 'fósforo', 15, 3, 2.19, 107, '#FF8000'],
  [16, 'S', 'azufre', 16, 3, 2.58, 105, '#FFFF30'],
  [17, 'Cl', 'cloro', 17, 3, 3.16, 102, '#1FF01F'],
  [18, 'Ar', 'argón', 18, 3, null, 106, '#80D1E3'],
  [19, 'K', 'potasio', 1, 4, 0.82, 203, '#8F40D4'],
  [20, 'Ca', 'calcio', 2, 4, 1.0, 176, '#3DFF00'],
  [31, 'Ga', 'galio', 13, 4, 1.81, 122, '#C28F8F'],
  [32, 'Ge', 'germanio', 14, 4, 2.01, 120, '#668F8F'],
  [33, 'As', 'arsénico', 15, 4, 2.18, 119, '#BD80E3'],
  [34, 'Se', 'selenio', 16, 4, 2.55, 120, '#FFA100'],
  [35, 'Br', 'bromo', 17, 4, 2.96, 120, '#A62929'],
  [36, 'Kr', 'criptón', 18, 4, 3.0, 116, '#5CB8D1'],
  [37, 'Rb', 'rubidio', 1, 5, 0.82, 220, '#702EB0'],
  [38, 'Sr', 'estroncio', 2, 5, 0.95, 195, '#00FF00'],
  [49, 'In', 'indio', 13, 5, 1.78, 142, '#A67573'],
  [50, 'Sn', 'estaño', 14, 5, 1.96, 139, '#668080'],
  [51, 'Sb', 'antimonio', 15, 5, 2.05, 139, '#9E63B5'],
  [52, 'Te', 'telurio', 16, 5, 2.1, 138, '#D47A00'],
  [53, 'I', 'yodo', 17, 5, 2.66, 139, '#940094'],
  [54, 'Xe', 'xenón', 18, 5, 2.6, 140, '#429EB0'],
  [55, 'Cs', 'cesio', 1, 6, 0.79, 244, '#57178F'],
  [56, 'Ba', 'bario', 2, 6, 0.89, 215, '#00C900'],
  [81, 'Tl', 'talio', 13, 6, 1.62, 145, '#A6544D'],
  [82, 'Pb', 'plomo', 14, 6, 2.33, 146, '#575961'],
  [83, 'Bi', 'bismuto', 15, 6, 2.02, 148, '#9E4FB5'],
  [84, 'Po', 'polonio', 16, 6, 2.0, 140, '#AB5C00'],
  [85, 'At', 'astato', 17, 6, 2.2, 150, '#754F45'],
  [86, 'Rn', 'radón', 18, 6, 2.2, 150, '#428296'],
  [87, 'Fr', 'francio', 1, 7, 0.7, 260, '#420066'],
  [88, 'Ra', 'radio', 2, 7, 0.9, 221, '#007D00'],
];

export const ELEMENTOS: Record<string, Elemento> = {};
for (const [z, simbolo, nombre, grupo, periodo, en, radio, color] of FILAS) {
  const valencia = grupo <= 2 ? grupo : grupo === 18 && z === 2 ? 2 : grupo - 10;
  ELEMENTOS[simbolo] = { z, simbolo, nombre, grupo, periodo, en, radio, color, valencia };
}

/** Metales de transición, lantánidos y actínidos: no soportados. */
const TRANSICION = new Set(
  ('Sc Ti V Cr Mn Fe Co Ni Cu Zn Y Zr Nb Mo Tc Ru Rh Pd Ag Cd Hf Ta W Re Os Ir Pt Au Hg ' +
    'La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Ac Th Pa U Np Pu').split(' '),
);

export function elemento(simbolo: string): Elemento {
  const e = ELEMENTOS[simbolo];
  if (e) return e;
  if (TRANSICION.has(simbolo)) {
    throw new ErrorQuimica(
      `El ${simbolo} es un metal de transición (o de los bloques d/f). La Teoría del Enlace de Valencia que ` +
        `se explica aquí solo cubre los elementos de los grupos principales (1, 2 y 13–18).`,
      [],
      "transicion",
    );
  }
  throw new ErrorQuimica(`«${simbolo}» no es un símbolo químico válido. Recuerda: mayúscula + minúscula opcional (Cl, Br, Xe).`);
}

/** Electronegatividad con valor razonable también para gases nobles ligeros. */
export function en(e: Elemento): number {
  return e.en ?? (e.simbolo === 'He' ? 4.2 : e.simbolo === 'Ne' ? 4.0 : 3.2);
}

const NUCLEOS = ['', '', '[He]', '[Ne]', '[Ar]', '[Kr]', '[Xe]', '[Rn]'];

/** Núcleo (gas noble + subcapas llenas internas) previo a la capa de valencia. */
export function nucleo(e: Elemento): string {
  const n = e.periodo;
  let s = NUCLEOS[n];
  if (e.grupo >= 13) {
    if (n >= 6) s += ` ${n - 2}f¹⁴`;
    if (n >= 4) s += ` ${n - 1}d¹⁰`;
  }
  return s.trim();
}

/** Electrones máximos admitidos por el modelo en el átomo central sin d: periodo 2 → octeto. */
export const EXENTOS_OCTETO = new Set(['H', 'Li', 'Be', 'B', 'Al', 'Ga', 'Mg']);
