/** Modo práctica (quiz), comparador y ficha imprimible A4. */
import { BIBLIOTECA } from '../chem/biblioteca';
import { analizar, Analisis } from '../chem/analisis';
import { textoMu } from '../chem/dipolos';
import { hibridoTexto, num } from '../chem/formato';
import { ErrorQuimica } from '../chem/elementos';
import { cajasSVG } from '../diagramas/cajas';
import { ROL, TemaSVG, esc } from '../diagramas/comun';
import { DiagramaEnergia } from '../diagramas/energia';
import { resonanciaHTML } from '../diagramas/lewis2d';
import { LineaTemporal } from '../viz/animacion/linea-temporal';
import { Escena3D } from '../viz/escena3d';

function modal(raiz: HTMLElement, html: string): HTMLElement {
  const m = document.createElement('div');
  m.className = 'modal';
  m.innerHTML = `<div role="dialog" aria-modal="true"><button class="btn cerrar" aria-label="Cerrar">✕</button>${html}</div>`;
  const cerrar = () => { m.remove(); m.dispatchEvent(new Event('cerrado')); };
  m.querySelector('.cerrar')!.addEventListener('click', cerrar);
  m.addEventListener('mousedown', (e) => { if (e.target === m) cerrar(); });
  document.addEventListener('keydown', function f(e) { if (e.key === 'Escape') { cerrar(); document.removeEventListener('keydown', f); } });
  raiz.appendChild(m);
  return m;
}

// ───────────────────────── Quiz ─────────────────────────
const HIBS = ['sp', 'sp2', 'sp3', 'sp3d', 'sp3d2', 'sp3d3'];
const GEOS = ['lineal', 'angular', 'trigonal plana', 'piramidal trigonal', 'tetraédrica', 'balancín (tetraedro distorsionado)', 'forma de T', 'bipirámide trigonal', 'plano-cuadrada', 'pirámide cuadrada', 'octaédrica', 'bipirámide pentagonal'];

function aleatoria(): Analisis {
  for (let k = 0; k < 40; k++) {
    const e = BIBLIOTECA[Math.floor(Math.random() * BIBLIOTECA.length)];
    try {
      const r = analizar(e.formula);
      if (r.tipo !== 'ok') continue;
      const c = r.analisis.centros[0];
      const t = r.analisis.tev.atomos[c];
      if (!t.error && t.hibridacion && r.analisis.estructura.atomos.length <= 12) return r.analisis;
    } catch { /* siguiente */ }
  }
  return (analizar('CH4') as { analisis: Analisis }).analisis;
}

export function abrirQuiz(raiz: HTMLElement, tema: TemaSVG) {
  const m = modal(raiz, `<div class="quiz"><h3>Modo práctica</h3><div class="seg" id="qm"><button class="on" data-m="p">Preguntas</button><button data-m="c">Rellenar cajas</button></div><div id="qc"></div></div>`);
  const cont = m.querySelector('#qc') as HTMLElement;
  let modo = 'p';
  m.querySelector('#qm')!.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest('button');
    if (!b) return;
    modo = b.dataset.m!;
    m.querySelectorAll('#qm button').forEach((x) => x.classList.toggle('on', x === b));
    nueva();
  });
  const nueva = () => (modo === 'p' ? preguntas(cont, tema, nueva) : cajas(cont, tema, nueva));
  nueva();
}

function preguntas(cont: HTMLElement, tema: TemaSVG, otra: () => void) {
  const an = aleatoria();
  const c = an.centros[0];
  const t = an.tev.atomos[c];
  cont.innerHTML = `<p>Molécula: <b>${esc(an.nombre)}</b> (${esc(an.formula)}). Analiza el átomo <b>${t.simbolo}${c + 1}</b>.</p>
   <div class="fila"><label>Hibridación <select id="qh">${HIBS.map((h) => `<option value="${h}">${hibridoTexto(h)}</option>`).join('')}</select></label>
   <label>Geometría molecular <select id="qg">${GEOS.map((g) => `<option>${g}</option>`).join('')}</select></label></div>
   <div class="fila"><label>Enlaces σ de la molécula <input id="qs" type="number" min="0" value="0" style="width:72px"></label><label>Enlaces π <input id="qp" type="number" min="0" value="0" style="width:72px"></label></div>
   <p><button class="btn on" id="qok">Comprobar</button> <button class="btn" id="qn">Otra molécula</button></p><div id="qr"></div>`;
  cont.querySelector('#qn')!.addEventListener('click', otra);
  cont.querySelector('#qok')!.addEventListener('click', () => {
    const v = (id: string) => (cont.querySelector('#' + id) as HTMLInputElement).value;
    const res: [boolean, string][] = [
      [v('qh') === t.hibridacion!.tipo, `Hibridación: ${hibridoTexto(t.hibridacion!.tipo)}. Se cuentan los dominios de electrones (${t.sigma} σ + ${t.pares} pares${t.radical ? ' + 1 radical' : ''} = ${t.rpecv.esterico}); los enlaces π no cuentan.`],
      [v('qg') === t.rpecv.geometriaMolecular, `Geometría: ${t.rpecv.geometriaMolecular} (${t.rpecv.notacion}); la electrónica es ${t.rpecv.geometriaElectronica}.`],
      [+v('qs') === an.tev.sigma, `Enlaces σ: ${an.tev.sigma} (uno por cada enlace; los múltiples tienen un solo σ).`],
      [+v('qp') === an.tev.pi, `Enlaces π: ${an.tev.pi} (un doble enlace aporta 1 π, un triple 2).`],
    ];
    const ok = res.filter((r) => r[0]).length;
    cont.querySelector('#qr')!.innerHTML = `<h4>${ok}/4 correctas</h4>${res.map(([b, tx]) => `<p class="${b ? 'ok' : 'mal'}">${b ? '✓' : '✗'} ${esc(tx)}</p>`).join('')}<div class="svgbox"><div class="res-fila">${resonanciaHTML(an, tema, 200, 160).split('<div class="flecha-res"')[0]}</div></div>`;
  });
}

function cajas(cont: HTMLElement, tema: TemaSVG, otra: () => void) {
  let an = aleatoria();
  let t = an.tev.atomos[an.centros[0]];
  for (let k = 0; k < 30 && !(t.promociones.length || t.hibridacion?.composicion.d); k++) { an = aleatoria(); t = an.tev.atomos[an.centros[0]]; }
  const ids = t.excitado.map((o) => o.id).filter((id, i) => id[0] !== 'd' || t.excitado[i].e > 0 || t.fundamental[i].e > 0);
  const ocu: Record<string, number> = Object.fromEntries(ids.map((i) => [i, 0]));
  const total = t.efectivos;
  const pintar = () => {
    const usados = Object.values(ocu).reduce((a, b) => a + b, 0);
    const grupo = (s: string, n: string) => `<div class="grupoq"><b>${t.capa}${n}</b><div>${ids.filter((i) => i[0] === s).map((i) => `<div class="cq" data-o="${i}" title="Suelta aquí un electrón; clic para quitar">${ocu[i] === 0 ? '' : ocu[i] === 1 ? '↑' : '↑↓'}</div>`).join('')}</div></div>`;
    cont.innerHTML = `<p>Átomo <b>${t.etiqueta}</b> (${esc(an.nombre)}, ${esc(an.formula)}): arrastra los <b>${total} electrones</b> a las cajas del <b>estado excitado</b> necesario para ${t.sigma} σ${t.pi ? ` + ${t.pi} π` : ''}${t.pares ? ` y ${t.pares} par(es) solitario(s)` : ''}. Pares en los orbitales de menor energía; el resto, desapareados.</p>
      <div class="bandeja" id="bd">${Array.from({ length: total - usados }, () => '<span class="tok" draggable="true">↑</span>').join('') || '<small>Sin electrones por colocar</small>'}</div>
      <div class="cajasq">${grupo('s', 's')}${grupo('p', 'p')}${ids.some((i) => i[0] === 'd') ? grupo('d', 'd') : ''}</div>
      <p><button class="btn on" id="qok">Comprobar</button> <button class="btn" id="qr0">Vaciar</button> <button class="btn" id="qn">Otra</button></p><div id="qr"></div>`;
    cont.querySelectorAll('.tok').forEach((k) => k.addEventListener('dragstart', (e) => (e as DragEvent).dataTransfer?.setData('text', 'e')));
    cont.querySelectorAll('.cq').forEach((c) => {
      const id = (c as HTMLElement).dataset.o!;
      c.addEventListener('dragover', (e) => { e.preventDefault(); c.classList.add('sobre'); });
      c.addEventListener('dragleave', () => c.classList.remove('sobre'));
      c.addEventListener('drop', (e) => { e.preventDefault(); if (ocu[id] < 2) ocu[id]++; pintar(); });
      c.addEventListener('click', () => { if (ocu[id] > 0) { ocu[id]--; pintar(); } });
    });
    cont.querySelectorAll('#bd .tok').forEach((k) => k.addEventListener('click', () => { const libre = ids.find((i) => ocu[i] === 0) ?? ids.find((i) => ocu[i] < 2); if (libre) { ocu[libre]++; pintar(); } }));
    cont.querySelector('#qn')!.addEventListener('click', otra);
    cont.querySelector('#qr0')!.addEventListener('click', () => { ids.forEach((i) => (ocu[i] = 0)); pintar(); });
    cont.querySelector('#qok')!.addEventListener('click', () => {
      // Se compara por subnivel ignorando el orden entre orbitales equivalentes (px, py, pz…)
      const clave = (get: (id: string, i: number) => number) => (['s', 'p', 'd'] as const).map((s) => ids.map((id, i) => ({ id, i })).filter((x) => x.id[0] === s).map((x) => get(x.id, x.i)).sort().join('')).join('|');
      const bien = clave((id) => ocu[id]) === clave((_, i) => t.excitado[t.excitado.findIndex((o) => o.id === ids[i])].e);
      cont.querySelector('#qr')!.innerHTML = `<p class="${bien ? 'ok' : 'mal'}">${bien ? '✓ ¡Correcto!' : '✗ No coincide.'}</p><p>${t.promociones.length ? `Hay que promocionar: ${t.promociones.map((p) => p.texto).join('; ')}.` : 'No hace falta promocionar.'} Estado excitado: <b>${t.configExcitada}</b>.</p><div class="svgbox">${cajasSVG(t, 'excitado', tema)}</div>`;
    });
  };
  pintar();
}

// ───────────────────────── Comparador ─────────────────────────
export function abrirComparador(raiz: HTMLElement, tema: TemaSVG, oscuro: boolean, a0 = 'NH3', b0 = 'BF3') {
  const pares = [['NH3', 'BF3'], ['CO2', 'SO2'], ['H2O', 'CH4'], ['SF4', 'XeF4']];
  const m = modal(raiz, `<h3 style="font:600 22px var(--serif);margin:0 0 8px">Comparador</h3><p>${pares.map(([x, y]) => `<button class="chip" data-p="${x},${y}">${x} frente a ${y}</button>`).join(' ')}</p>
    <div class="comp">${[0, 1].map((k) => `<div><input type="search" id="c${k}" aria-label="Molécula ${k + 1}"><div class="card visor" id="v${k}"></div><div id="d${k}"></div></div>`).join('')}</div>
    <div class="lt-fila" style="margin-top:16px"><label>Etapa <input id="cs" type="range" min="1" max="8" value="8" style="width:220px"></label><span id="ce"></span></div><div id="dif"></div>`);
  const lados = [0, 1].map((k) => {
    const esc3 = new Escena3D(m.querySelector('#v' + k) as HTMLElement);
    esc3.setTema(oscuro);
    return { esc3, lt: new LineaTemporal(esc3), an: null as Analisis | null };
  });
  const etapa = () => +(m.querySelector('#cs') as HTMLInputElement).value;
  const aplicar = () => lados.forEach((l) => { if (!l.an) return; const i = l.lt.plan.findIndex((e) => e.numero >= etapa()); l.lt.irAEtapa(i < 0 ? l.lt.plan.length - 1 : i, 1); (m.querySelector('#ce') as HTMLElement).textContent = `Etapa ${etapa()}`; });
  const vaciar = (k: number, html: string) => {
    const l = lados[k];
    l.an = null;
    l.lt.vaciar();
    l.esc3.limpiar();
    l.esc3.analisis = null;
    l.esc3.pedirRender();
    (m.querySelector('#d' + k) as HTMLElement).innerHTML = html;
  };
  let version = [0, 0]; // si se cambia la molécula varias veces seguidas, solo cuenta la última
  const poner = (k: number, txt: string) => {
    const mi = ++version[k];
    try {
      const r = analizar(txt);
      if (mi !== version[k]) return;
      (m.querySelector('#c' + k) as HTMLInputElement).value = txt;
      if (r.tipo !== 'ok') {
        vaciar(k, `<p class="iso">«${esc(txt)}» (${esc(r.formula)}) admite varios esqueletos. Elige uno:<br>${r.opciones.map((o) => `<button class="chip" data-f="${esc(o.formula)}">${esc(o.nombre)}</button>`).join(' ')}</p>`);
        m.querySelectorAll(`#d${k} button[data-f]`).forEach((b) => b.addEventListener('click', () => poner(k, (b as HTMLElement).dataset.f!)));
        return;
      }
      const l = lados[k];
      const an = r.analisis;
      l.an = an;
      l.esc3.cargar(an);
      l.lt.cargar(an);
      const c0 = an.centros[0];
      const t = an.tev.atomos[c0];
      const centro = `${an.estructura.atomos[c0].el.simbolo}${c0 + 1}${an.centros.length > 1 ? ` (1.º de ${an.centros.length} centros)` : ''}`;
      (m.querySelector('#d' + k) as HTMLElement).innerHTML = t.error
        ? `<table class="tabla"><tr><th>Molécula</th><td>${esc(an.formula)}</td></tr></table><p class="msg">${esc(t.error)}</p>`
        : `<table class="tabla"><tr><th>Molécula</th><td>${esc(an.formula)}</td></tr><tr><th>${an.centros.length > 1 ? 'Átomo analizado' : 'Átomo central'}</th><td>${esc(centro)}</td></tr><tr><th>AXE</th><td>${t.rpecv.notacion}</td></tr><tr><th>Hibridación</th><td>${t.hibridacion ? hibridoTexto(t.hibridacion.tipo) : 'p'}</td></tr><tr><th>Geometría</th><td>${esc(t.rpecv.geometriaMolecular)}</td></tr><tr><th>σ / π</th><td>${an.tev.sigma} / ${an.tev.pi}</td></tr><tr><th>Polaridad</th><td>${an.carga ? 'ion (no se clasifica)' : an.polaridad.polar ? 'polar, ' + textoMu(an.polaridad) : 'apolar'}</td></tr></table>`;
      aplicar();
    } catch (e) {
      if (!(e instanceof ErrorQuimica)) throw e;
      if (mi === version[k]) vaciar(k, `<p class="msg">${esc(e.message)}</p>`);
    }
  };
  [0, 1].forEach((k) => m.querySelector('#c' + k)!.addEventListener('change', (e) => poner(k, (e.target as HTMLInputElement).value)));
  m.querySelector('#cs')!.addEventListener('input', aplicar);
  m.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => { const [x, y] = (b as HTMLElement).dataset.p!.split(','); poner(0, x); poner(1, y); }));
  m.addEventListener('cerrado', () => lados.forEach((l) => l.esc3.destruir()));
  poner(0, a0); poner(1, b0);
  void ROL;
}

// ───────────────────────── Ficha A4 ─────────────────────────
export function imprimirFicha(an: Analisis, centro: number, tema: TemaSVG, png: string) {
  const t = an.tev.atomos[centro];
  let f = document.getElementById('ficha');
  if (!f) { f = document.createElement('div'); f.id = 'ficha'; document.body.appendChild(f); }
  const claro: TemaSVG = { ...tema, tinta: '#111', suave: '#444', fondo: '#fff', caja: '#fff', linea: '#999' };
  const en = t.error ? '' : new DiagramaEnergia(t, claro).svgString();
  const d = an.polaridad;
  f.innerHTML = `<h1>${esc(an.nombre)} · ${esc(an.formula)}</h1>
   <div>${an.electronesValencia} e⁻ de valencia · carga ${an.carga} · ${an.tev.sigma} σ + ${an.tev.pi} π · ${d.polar ? 'polar (' + textoMu(d) + ')' : 'apolar'}</div>
   <div class="rej"><div><h2>Lewis</h2>${resonanciaHTML(an, claro, 200, 160)}</div><div><h2>Estructura 3D</h2><img src="${png}" alt="Molécula en 3D"></div></div>
   ${t.error ? `<p>${esc(t.error)}</p>` : `<h2>Átomo ${t.etiqueta}: ${t.rpecv.notacion}, ${t.rpecv.geometriaMolecular}${t.hibridacion ? ', ' + hibridoTexto(t.hibridacion.tipo) : ''}</h2>
   <div class="rej"><div><b>Fundamental</b> ${t.configFundamental}${cajasSVG(t, 'fundamental', claro)}</div><div><b>Excitado</b> ${t.configExcitada}${cajasSVG(t, 'excitado', claro)}</div></div>
   ${t.hibridacion ? `<div><b>Hibridado</b>${cajasSVG(t, 'hibridado', claro)}</div>` : ''}
   <h2>Diagrama de energía</h2>${en}`}
   <h2>Enlaces</h2>${an.tev.enlaces.map((e) => `<div>${an.estructura.atomos[e.a].el.simbolo}${e.a + 1}–${an.estructura.atomos[e.b].el.simbolo}${e.b + 1}: ${esc(e.sigma)} ${e.pis.map(esc).join(' ')}</div>`).join('')}
   <h2>Notas</h2>${[...t.notas, ...an.tev.notas].map((n) => `<div>• ${esc(n)}</div>`).join('')}`;
  setTimeout(() => window.print(), 150);
}

// ───────────────────────── Guía rápida ─────────────────────────
export function abrirGuia(raiz: HTMLElement) {
  modal(raiz, `<h3 style="font:600 22px var(--serif);margin:0 0 8px">Guía rápida</h3>
  <ol class="guia">
   <li><b>Busca</b> una molécula arriba (nombre, fórmula con carga o SMILES) o abre <b>Biblioteca</b> para elegir entre más de 100.</li>
   <li>Verás directamente el <b>resultado final</b> en 3D y en la pestaña <b>Resultado</b>: hibridación, geometría, enlaces σ/π y polaridad.</li>
   <li>Pulsa <b>▶ Ver paso a paso</b> para ver la animación: átomo → recuento → promoción → hibridación → repulsión → vecinos → π → molécula final.</li>
   <li>Con el reproductor puedes pausar, ir etapa a etapa (← →), cambiar la velocidad o arrastrar la barra.</li>
   <li><b>Haz clic en un átomo</b> para analizarlo. <b>⚙ Vista</b> permite mostrar u ocultar orbitales, pares, electrones, ángulos, dipolo y ejes x/y/z.</li>
   <li>Las pestañas <b>Lewis</b>, <b>Energía</b> y <b>Enlaces</b> tienen los diagramas (exportables a SVG/PNG).</li>
   <li>En <b>☰ Menú</b>: modo práctica, comparador, ficha A4 para imprimir y enlace para compartir.</li>
  </ol>`);
}
