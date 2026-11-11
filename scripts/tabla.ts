import { analizar } from '../src/chem/analisis';
import { BIBLIOTECA } from '../src/chem/biblioteca';
import { formulaUnicode } from '../src/chem/formato';
import { grado } from '../src/chem/tipos';
const filas: string[] = [
  '# Tabla resumen de la biblioteca (convenio por defecto: minimizar cargas formales)',
  '',
  'Una fila por cada átomo central (átomo no H con ≥ 2 vecinos; si no hay, los átomos pesados). σ/π de la molécula = enlaces de toda la especie; σ/π del átomo = enlaces del átomo de la fila.',
  '',
  '| Especie | Átomo | Hibridación | AXE | Geometría molecular | Ángulo real | σ/π átomo | σ/π molécula | Promoción | Polaridad |',
  '|---|---|---|---|---|---|---|---|---|---|',
];
for (const e of BIBLIOTECA) {
  const a: any = (analizar(e.formula) as any).analisis;
  const est = a.estructura;
  let cs: number[] = est.atomos.map((x: any, i: number) => (x.el.simbolo !== 'H' && grado(est, i) >= 2 ? i : -1)).filter((i: number) => i >= 0);
  if (!cs.length) cs = est.atomos.map((x: any, i: number) => (x.el.simbolo !== 'H' ? i : -1)).filter((i: number) => i >= 0);
  if (!cs.length) cs = [0];
  for (const c of cs) {
    const t = a.tev.atomos[c];
    const hib = t.hibridacion ? t.hibridacion.tipo : t.simbolo === 'H' ? '1s' : 'p puro';
    const pol = a.carga ? 'ion' : a.polaridad.polar ? 'polar' : 'apolar';
    filas.push(`| ${formulaUnicode(e.formula)} (${e.nombre}) | ${t.etiqueta}${c + 1} | ${hib} | ${t.rpecv.notacion} | ${t.rpecv.geometriaMolecular} | ${t.rpecv.anguloRealTexto} | ${t.sigma}/${t.pi} | ${a.tev.sigma}/${a.tev.pi} | ${t.promociones.map((p: any) => p.texto).join('; ') || '—'} | ${pol} |`);
  }
}
console.log(filas.join('\n'));
