/** Diagramas de cajas de orbitales: configuración fundamental, excitada e hibridada. */
import { hibridoTexto } from '../chem/formato';
import type { AtomoTEV, Orbital } from '../chem/tev';
import { ROL, TemaSVG, esc, flecha } from './comun';

export type EstadoCajas = 'fundamental' | 'excitado' | 'hibridado';

const S = 30; // lado de la caja
const G = 4; // hueco entre cajas

interface Caja {
  etiqueta?: string;
  e: number;
  roles: (string | undefined)[]; // color por electrón (slot)
  fondo?: string;
  titulo?: string;
}

/** Color de cada electrón de un orbital según su función en el estado dado. */
function colorElectrones(t: AtomoTEV, o: Orbital, estado: EstadoCajas, idx: number, verde = true): string[] {
  if (estado === 'fundamental') return Array(o.e).fill(ROL.neutro);
  const rol = t.roles[o.id]?.rol ?? 'vacio';
  const nombre = rol === 'vacio' ? 'neutro' : rol;
  const f = t.fundamental[idx];
  return Array.from({ length: o.e }, (_, slot) => {
    // electrones que vienen de otro subnivel: verde (promocionado)
    if (verde && estado === 'excitado' && slot >= Math.min(f.e, o.e) && t.promociones.some((p) => p.a === o.sub)) return ROL.promo;
    return ROL[nombre];
  });
}

export function cajasSVG(t: AtomoTEV, estado: EstadoCajas, tema: TemaSVG, opts: { ancho?: number; /** El verde (electrón promocionado) solo se usa en la etapa de promoción. */ promo?: boolean } = {}): string {
  const verde = opts.promo !== false;
  const cajas: { grupo: string; items: Caja[] }[] = [];
  const orbs = estado === 'fundamental' ? t.fundamental : t.excitado;
  const N = t.hibridacion?.n ?? 0;
  const usados = (s: 's' | 'p' | 'd') => orbs.map((o, i) => ({ o, i })).filter(({ o, i }) => o.sub === s && (o.e > 0 || t.fundamental[i].e > 0 || t.excitado[i].e > 0 || (estado === 'hibridado' && i < N)));
  if (estado === 'hibridado' && t.hibridacion) {
    const h = t.hibridacion;
    cajas.push({
      grupo: `${h.n} × ${hibridoTexto(h.tipo)}`,
      items: h.contenido.map((c, k) => {
        const o = t.excitado[k];
        const rol = c.tipo === 'par' ? 'par' : c.tipo === 'sigma' ? 'sigma' : 'radical';
        return { e: o.e, roles: Array(o.e).fill(ROL[rol]), fondo: ROL[rol], titulo: c.tipo === 'par' ? 'par solitario' : c.tipo === 'sigma' ? 'σ' : 'radical' };
      }),
    });
    const resto = orbs.map((o, i) => ({ o, i })).filter(({ o, i }) => i >= N && (o.e > 0 || t.fundamental[i].e > 0));
    if (resto.length) {
      cajas.push({
        grupo: 'sin hibridar',
        items: resto.map(({ o, i }) => ({ e: o.e, roles: colorElectrones(t, o, 'hibridado', i, false), etiqueta: `${t.capa}${o.sub}`, titulo: t.roles[o.id]?.rol === 'pi' ? 'π' : '' })),
      });
    }
  } else {
    (['s', 'p', 'd'] as const).forEach((s) => {
      const u = usados(s);
      if (!u.length) return;
      cajas.push({ grupo: `${t.capa}${s}`, items: u.map(({ o, i }) => ({ e: o.e, roles: colorElectrones(t, o, estado, i, verde) })) });
    });
  }
  const gGap = 22;
  const anchoGrupo = (n: number) => n * S + (n - 1) * G;
  const total = cajas.reduce((s, g) => s + anchoGrupo(g.items.length), 0) + gGap * (cajas.length - 1);
  const W = Math.max(total + 24, opts.ancho ?? 0, 150);
  const H = 92;
  let x = (W - total) / 2;
  let out = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" style="width:100%;height:auto;max-width:${W}px" font-family="Inter, system-ui, sans-serif" role="img" aria-label="Diagrama de cajas de orbitales">`;
  for (const g of cajas) {
    out += `<text x="${x + anchoGrupo(g.items.length) / 2}" y="16" text-anchor="middle" font-size="12" font-weight="600" fill="${tema.suave}">${esc(g.grupo)}</text>`;
    g.items.forEach((c, k) => {
      const bx = x + k * (S + G);
      const by = 26;
      const borde = c.fondo ?? tema.linea;
      out += `<rect x="${bx}" y="${by}" width="${S}" height="${S + 6}" rx="5" fill="${c.fondo ? c.fondo + '1f' : tema.caja}" stroke="${borde}" stroke-width="${c.fondo ? 1.6 : 1.2}"/>`;
      if (c.e >= 1) out += flecha(bx + (c.e === 2 ? S * 0.32 : S / 2), by + (S + 6) / 2, true, c.roles[0] ?? ROL.neutro);
      if (c.e === 2) out += flecha(bx + S * 0.68, by + (S + 6) / 2, false, c.roles[1] ?? ROL.neutro);
      if (c.titulo) out += `<text x="${bx + S / 2}" y="${by + S + 20}" text-anchor="middle" font-size="10" fill="${tema.suave}">${esc(c.titulo)}</text>`;
      if (c.etiqueta) out += `<text x="${bx + S / 2}" y="${by + S + 20}" text-anchor="middle" font-size="10" fill="${tema.suave}">${esc(c.etiqueta)}</text>`;
    });
    x += anchoGrupo(g.items.length) + gGap;
  }

  return out + '</svg>';
}
