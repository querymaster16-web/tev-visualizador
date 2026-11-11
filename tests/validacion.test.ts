import { describe, expect, it } from 'vitest';
import { analizar } from '../src/chem/analisis';
import type { Analisis } from '../src/chem/analisis';
import { BIBLIOTECA } from '../src/chem/biblioteca';
import { validarAnalisis } from '../src/chem/validar';

const an = (f: string, convenio: 'cargas' | 'octeto' = 'cargas', hibTerm = false): Analisis => {
  const r = analizar(f, { hibridarTerminales: hibTerm, convenio });
  if (r.tipo !== 'ok') throw new Error('ambiguo ' + f);
  return r.analisis;
};

describe('validarAnalisis() sobre toda la biblioteca', () => {
  for (const conv of ['cargas', 'octeto'] as const) {
    for (const hibTerm of [false, true]) {
      it(`convenio «${conv}», terminales ${hibTerm ? 'hibridados' : 'p puro'}`, () => {
        const errores = BIBLIOTECA.flatMap((e) => validarAnalisis(an(e.formula, conv, hibTerm)));
        expect(errores).toEqual([]);
      });
    }
  }
});
