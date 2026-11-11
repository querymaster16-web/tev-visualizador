import { analizar } from '../src/chem/analisis';
const lista = process.argv.slice(2);
for (const m of lista) {
  try {
    const r = analizar(m);
    if (r.tipo === 'ambiguo') { console.log(m, 'AMBIGUO', r.opciones.map((o) => o.nombre)); continue; }
    const a = r.analisis;
    const c = a.centros[0];
    const t = a.tev.atomos[c];
    console.log(
      m.padEnd(10), a.nombre.padEnd(22),
      `${t.simbolo}${c}`, t.rpecv.notacion, t.hibridacion?.tipo ?? (t.error ? 'ERR' : 'p'), t.rpecv.geometriaMolecular.padEnd(22),
      `σ${a.tev.sigma} π${a.tev.pi}`, 'prom:', t.promociones.map((p) => p.texto).join('; ') || '-',
      'FC:', a.estructura.atomos.map((x) => x.carga).join(','), 'res:', a.resonancia.length, t.error ?? '',
      a.geometria.dipolo.polar ? `polar ${a.geometria.dipolo.magnitud.toFixed(2)}` : 'apolar',
    );
  } catch (e: any) { console.log(m, 'ERROR', e.message); }
}
