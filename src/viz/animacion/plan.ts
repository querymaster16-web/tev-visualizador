/** Plan de la animación «Construcción paso a paso»: etapas, duraciones y textos. */
import type { Analisis } from '../../chem/analisis';
import { textoMu } from '../../chem/dipolos';
import { hibridoTexto, num } from '../../chem/formato';

export type EtapaId = 'atomo' | 'recuento' | 'promocion' | 'hibridacion' | 'repulsion' | 'vecinos' | 'pi' | 'final';

export interface Etapa {
  id: EtapaId;
  /** Número visible (1-8) de la etapa, según el guion de la herramienta. */
  numero: number;
  titulo: string;
  texto: string;
  duracion: number; // segundos a 1×
  centro: number;
}

export const TITULOS: Record<EtapaId, [number, string]> = {
  atomo: [1, 'Átomo aislado'],
  recuento: [2, 'Recuento de electrones'],
  promocion: [3, 'Promoción'],
  hibridacion: [4, 'Hibridación'],
  repulsion: [5, 'Repulsión (RPECV)'],
  vecinos: [6, 'Llegada de los vecinos'],
  pi: [7, 'Enlaces π'],
  final: [8, 'Molécula final'],
};

const plural = (n: number, s: string, p: string) => (n === 1 ? s : p);

export function construirPlan(an: Analisis, centro: number, incluirFinal = true): Etapa[] {
  const t = an.tev.atomos[centro];
  const est = an.estructura;
  const out: Etapa[] = [];
  if (t.error) return out;
  const tieneEn = t.fundamental.filter((o) => o.e === 1).length;
  const necesita = t.desapareados;
  const hib = t.hibridacion;
  const N = hib?.n ?? 0;
  const nombreEl = est.atomos[centro].el.nombre;
  const add = (id: EtapaId, texto: string, duracion: number) =>
    out.push({ id, numero: TITULOS[id][0], titulo: TITULOS[id][1], texto, duracion, centro });

  add(
    'atomo',
    `<b>${t.etiqueta}</b> (${nombreEl}), capa de valencia n = ${t.capa}. Configuración fundamental: <b>${t.configFundamental}</b>. ` +
      (t.cargaFormal !== 0 ? `Como su carga formal es ${t.cargaFormal > 0 ? '+' : '−'}${Math.abs(t.cargaFormal)}, se estudia como el ion ${t.etiqueta} con ${t.efectivos} e⁻ de valencia. ` : '') +
      `Se ven el orbital ${t.capa}s (esfera)${t.capa >= 2 && t.efectivos >= 0 ? ` y los tres ${t.capa}p (lóbulos dobles en x, y, z; azul = fase +, amarillo = fase −)` : ''}. Cada punto es un electrón; la flecha indica su espín. Los orbitales se dibujan separados para verlos bien (en realidad todos están centrados en el núcleo) y cada uno conserva su color durante toda la construcción.`,
    3.6,
  );
  add(
    'recuento',
    `Electrones desapareados: <b>tiene ${tieneEn}, necesita ${necesita}</b> (${t.sigma} σ${t.pi ? ` + ${t.pi} π` : ''}${t.radical ? ' + 1 radical' : ''}). ` +
      (t.pares ? `Además guarda ${t.pares} ${plural(t.pares, 'par solitario', 'pares solitarios')}. ` : '') +
      (tieneEn === necesita ? 'Coincide: no hace falta promocionar.' : 'No coincide: hay que promocionar electrones.'),
    3.2,
  );
  add(
    'promocion',
    t.promociones.length
      ? `Promoción: <b>${t.promociones.map((p) => p.texto).join('; ')}</b>. Configuración excitada: <b>${t.configExcitada}</b>. Subir un electrón de subnivel cuesta energía, pero se compensa de sobra con la energía que se libera al formar más enlaces.`
      : `<b>No hay promoción</b>: la configuración fundamental ya tiene ${necesita} ${plural(necesita, 'electrón desapareado', 'electrones desapareados')} y ${t.pares} ${plural(t.pares, 'par', 'pares')}, justo lo que hace falta.`,
    t.promociones.length ? 5.6 : 2.4,
  );
  if (hib) {
    add(
      'hibridacion',
      `Se combinan <b>${hib.composicionTexto}</b> y resultan <b>${N} orbitales híbridos ${hibridoTexto(hib.tipo)}</b> equivalentes (${num(hib.pctS, hib.pctS % 1 ? 1 : 0)} % de carácter s). ` +
        `Los orbitales marcados «hibrida» se combinan; los de «sin hibridar» se quedan como están. Contenido: ${t.rpecv.parConjugado ? 0 : t.pares} ${plural(t.rpecv.parConjugado ? 0 : t.pares, 'par solitario', 'pares solitarios')}, ${t.sigma} ${plural(t.sigma, 'enlace σ', 'enlaces σ')}${t.radical && !t.rpecv.radicalPlano ? ' y 1 electrón desapareado' : ''}. ` +
        (t.rpecv.radicalPlano ? `El electrón desapareado <b>no hibrida</b>: se queda en el orbital ${t.capa}p sin hibridar, perpendicular al plano (radical plano).` : t.rpecv.parConjugado ? `El par solitario del N <b>no hibrida</b>: ocupa un orbital ${t.capa}p sin hibridar y se conjuga con el π vecino (resonancia).` : t.pi ? `Los orbitales sin hibridar (${t.capa}p y ${t.capa}d libres) alojan los electrones π.` : 'No quedan electrones para enlaces π.'),
      5.4,
    );
    add(
      'repulsion',
      `Los ${N} dominios de electrones se repelen y se separan hasta la geometría electrónica <b>${t.rpecv.geometriaElectronica}</b>. ` +
        (t.rpecv.e > 0
          ? `Los pares solitarios (más anchos) empujan más que los enlaces y cierran los ángulos: ideal ${t.rpecv.angulosIdeales} → real ${t.rpecv.anguloRealTexto}. `
          : `Todos los dominios son enlazantes: los ángulos son los ideales (${t.rpecv.angulosIdeales}). `) +
        `Geometría molecular: <b>${t.rpecv.geometriaMolecular}</b> (${t.rpecv.notacion}).`,
      6.0,
    );
  } else if (est.atomos[centro].el.z <= 2) {
    add(
      'hibridacion',
      `El hidrógeno solo tiene el orbital <b>1s</b>: no hay promoción ni hibridación. El enlace se forma por solapamiento frontal de dos orbitales 1s: <b>σ(1s–1s)</b>.`,
      2.2,
    );
  } else {
    add(
      'hibridacion',
      `Este átomo solo tiene un vecino: por convención clásica usa un <b>orbital p puro</b> (sin hibridar) para el enlace σ y deja los demás orbitales para pares solitarios y enlaces π. ` +
        `Con el interruptor «hibridar también los átomos terminales» puedes verlo hibridado.`,
      2.2,
    );
  }
  const nv = t.sigma;
  if (nv > 0) {
    add(
      'vecinos',
      `Cada átomo vecino llega con su orbital y <b>solapa de frente</b> con un híbrido de ${est.atomos[centro].el.simbolo}: ${[...new Set(Object.keys(t.porVecino).map((j) => an.tev.enlaces.find((e) => (e.a === centro && e.b === +j) || (e.b === centro && e.a === +j))?.sigma ?? ''))].join(', ') || '—'}. Los electrones (uno de cada átomo) se aparean en la región internuclear y se forma un enlace <b>σ</b>. Si el vecino es otro átomo central, llega <b>ya construido</b>, con sus propios híbridos y sus átomos.`,
      Math.min(16, 1.6 + 2.8 * nv),
    );
  }
  const aro = est.enlaces.some((e) => e.aromatico && (e.a === centro || e.b === centro));
  if (t.pi > 0 || aro) {
    add(
      'pi',
      aro
        ? `Los orbitales p sin hibridar de los seis carbonos son paralelos y solapan <b>lateralmente</b>: la nube π queda por encima y por debajo del anillo, deslocalizada como dos «donuts».`
        : `Los orbitales p sin hibridar de átomos contiguos se colocan paralelos y solapan <b>lateralmente</b>: la densidad queda por encima y por debajo del eje internuclear (enlace <b>π</b>).` +
          (t.pi >= 2 ? ' En un enlace múltiple los dos π son perpendiculares entre sí.' : ''),
      4.8,
    );
  }
  if (incluirFinal) {
    const d = an.polaridad;
    add(
      'final',
      `Resultado: <b>${an.tev.sigma} ${plural(an.tev.sigma, 'enlace', 'enlaces')} σ y ${an.tev.pi} π</b>. Geometría alrededor de ${est.atomos[centro].el.simbolo}: ${t.rpecv.geometriaMolecular} (${t.rpecv.notacion}). ` +
        (an.carga !== 0 ? ' ' : d.polar ? `La molécula es <b>polar</b> (${textoMu(d)}; la flecha va hacia el extremo más negativo).` : d.nota ? `Molécula <b>apolar</b>. ${d.nota}` : 'La suma de los dipolos de enlace es nula: molécula <b>apolar</b>.') +
        (an.resonancia.length > 1 ? ` Existen ${an.resonancia.length} formas resonantes: el π está deslocalizado.` : ''),
      3.2,
    );
  }
  return out;
}

export const duracionTotal = (p: Etapa[]) => p.reduce((s, e) => s + e.duracion, 0);
