import { analizar } from '../src/chem/analisis';
import { BIBLIOTECA } from '../src/chem/biblioteca';
import { vecinos } from '../src/chem/tipos';
import { anguloEntre, sub } from '../src/chem/vec';
let n = 0;
for (const e of BIBLIOTECA) {
  const r: any = analizar(e.formula);
  const a = r.analisis;
  for (const c of a.centros) {
    const t = a.tev.atomos[c];
    if (t.error) { console.log('ERR TEV', e.formula, t.error); continue; }
    const vs = vecinos(a.estructura, c).map((v: any) => v.j);
    if (vs.length < 2) continue;
    const P = a.geometria.pos;
    const angs: number[] = [];
    for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) angs.push(anguloEntre(sub(P[vs[i]], P[c]), sub(P[vs[j]], P[c])));
    const mn = Math.min(...angs), mx = Math.max(...angs);
    const rp = t.rpecv;
    const esp: Record<string, [number, number]> = { 'lineal': [180, 180], 'angular': [100, 135], 'trigonal plana': [118, 122], 'piramidal trigonal': [100, 110], 'tetraédrica': [107, 112], 'bipirámide trigonal': [88, 122], 'balancín': [85, 180], 'forma de T': [80, 180], 'octaédrica': [88, 182], 'plano-cuadrada': [88, 182], 'pirámide cuadrada': [80, 182], 'bipirámide pentagonal': [70, 182] };
    const k = Object.keys(esp).find((x) => rp.geometriaMolecular.startsWith(x));
    const [lo, hi] = k ? esp[k] : [0, 180];
    const mal = mn < lo - 6 || mx > hi + 6;
    const hy = t.hibridacion?.tipo ?? 'p';
    const hyEsp = ({ 2: 'sp', 3: 'sp2', 4: 'sp3', 5: 'sp3d', 6: 'sp3d2', 7: 'sp3d3' } as any)[rp.esterico];
    const incoh = t.hibridacion && hy !== hyEsp;
    if (mal || incoh) { n++; console.log((mal ? 'ANGULO' : 'HIB   '), e.formula.padEnd(10), a.estructura.atomos[c].el.simbolo + (c + 1), rp.notacion, rp.geometriaMolecular, `${mn.toFixed(0)}-${mx.toFixed(0)}°`, hy, incoh ? '≠' + hyEsp : ''); }
  }
}
console.log('sospechosos:', n, 'de', BIBLIOTECA.length);
