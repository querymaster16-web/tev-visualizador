/** Aplicación: orquesta buscador, vista 3D, línea temporal y paneles. */
import { analizar, Analisis } from '../chem/analisis';
import { BIBLIOTECA, CATEGORIAS, sugerir } from '../chem/biblioteca';
import type { EntradaBiblioteca } from '../chem/biblioteca';
import { textoMu } from '../chem/dipolos';
import { ErrorQuimica } from '../chem/elementos';
import { formulaUnicode, hibridoTexto, num, plano } from '../chem/formato';
import { enlacesDeslocalizados } from '../chem/lewis';
import { cajasSVG } from '../diagramas/cajas';
import { ROL, ROL_NOMBRE, TEMA_CLARO, TEMA_OSCURO, TemaSVG, esc, exportarPNGdeSVG, exportarSVG } from '../diagramas/comun';
import { DiagramaEnergia, ETAPA_DE_COLUMNA } from '../diagramas/energia';
import { nivelesSVG } from '../diagramas/niveles';
import { DiagramaClase } from '../diagramas/clase';
import { resonanciaHTML } from '../diagramas/lewis2d';
import type { EstadoLT } from '../viz/animacion/linea-temporal';
import { LineaTemporal, VELOCIDADES } from '../viz/animacion/linea-temporal';
import type { EtapaId } from '../viz/animacion/plan';
import { Escena3D } from '../viz/escena3d';
import { Vista2D } from '../viz/vista2d';
import { abrirComparador, abrirGuia, abrirQuiz, imprimirFicha } from './extras';

const ICONOS: Record<string, string> = {
  luna: '<path d="M20 14.5A8 8 0 1 1 9.5 4 6.5 6.5 0 0 0 20 14.5z"/>',
  sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  foto: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  centrar: '<circle cx="12" cy="12" r="3"/><path d="M12 2v5M12 17v5M2 12h5M17 12h5"/>',
  rotar: '<path d="M20 12a8 8 0 1 1-3-6.2M20 4v5h-5"/>',
  regla: '<path d="M3 17 17 3l4 4L7 21z"/><path d="m7 13 2 2M10 10l2 2M13 7l2 2"/>',
};
const ico = (n: string) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n]}</svg>`;

const EJEMPLOS = ['agua', 'metano', 'SF4', 'XeF4', 'etileno', 'benceno'];
const NOMBRE_ETAPA: Record<EtapaId, string> = { atomo: 'Átomo', recuento: 'Recuento', promocion: 'Promoción', hibridacion: 'Hibridación', repulsion: 'RPECV', vecinos: 'Vecinos σ', pi: 'Enlaces π', final: 'Final' };

export class App {
  private el = {} as Record<string, HTMLElement>;
  private escena!: Escena3D;
  private lt!: LineaTemporal;
  private an: Analisis | null = null;
  private texto = '';
  private hibTerm = false;
  private convenio: 'cargas' | 'octeto' = 'cargas';
  private oscuro = false;
  private energia: DiagramaEnergia | null = null;
  private clase: DiagramaClase | null = null;
  private ultimoLT: EstadoLT | null = null;
  private tab = 'datos';
  private iconos: Record<string, string> = {};
  private animMode = false;
  private vista!: Vista2D;
  private sugSel = -1;

  constructor(private raiz: HTMLElement) {
    try { this.oscuro = localStorage.getItem('tev-tema') ? localStorage.getItem('tev-tema') === 'oscuro' : matchMedia('(prefers-color-scheme: dark)').matches; } catch { /* sin almacenamiento */ }
    this.montar();
    this.actualizarVisor();
    this.aplicarTema();
    window.addEventListener('hashchange', () => this.desdeHash());
    window.addEventListener('keydown', (e) => this.teclas(e));
    const h = this.leerHash();
    this.cargar(h.mol ?? 'agua', h.paso);
  }

  private get tema(): TemaSVG { return this.oscuro ? TEMA_OSCURO : TEMA_CLARO; }

  // ───────────────────────── DOM ─────────────────────────
  private montar() {
    this.raiz.innerHTML = `
    <header class="cab">
      <div class="marca"><b>TEV</b> Enlace de Valencia <small>visualizador interactivo</small><small class="autor">por Juan Soilán</small></div>
      <div class="acc">
        <button class="btn" id="b-bib" aria-haspopup="dialog">Biblioteca</button>
        <div class="pop-w"><button class="btn" id="b-menu" aria-haspopup="true">☰ Menú</button><div class="pop" id="pop-menu" hidden></div></div>
        <button class="btn" id="b-tema" aria-label="Cambiar tema"></button>
      </div>
      <div class="buscador">
        <input id="q" type="search" placeholder="Escribe una molécula o ion: agua, SF4, SO4^2-, CCO…" autocomplete="off" aria-label="Buscar molécula" role="combobox" aria-expanded="false" />
        <div class="sug" id="sug" hidden role="listbox"></div>
        <div id="aviso"></div>
      </div>
    </header>
    <main>
      <section class="card" aria-label="Vista 3D">
        <div class="herr">
          <div class="pop-w"><button class="btn" id="b-vista" aria-haspopup="true">⚙ Vista ▾</button><div class="pop" id="pop-vista" hidden></div></div>
          <select id="centro" aria-label="Átomo analizado" title="Átomo que se analiza"></select>
          <span class="sep"></span>
          <button class="btn" id="b-centrar" title="Centrar la molécula">◎ Centrar</button>
          <button class="btn" id="b-rot" title="Girar automáticamente">↻ Girar</button>
          <button class="btn" id="b-png" title="Guardar imagen PNG">⬇ PNG</button>
        </div>
        <div class="visor" id="visor">
          <div class="mensaje3d" id="msg3d" hidden></div>
          <div class="gauge" id="gauge" hidden><i></i></div><span id="gtxt" hidden>Energía: sube al promocionar y se compensa al enlazar</span>
          <div class="cta-w" id="cta-w"><button class="btn on cta" id="b-anim">▶ Ver paso a paso</button><small>Clic en un átomo para analizarlo · arrastra para girar · rueda para zoom</small></div>
        </div>
        <div class="clase-w" id="clase-w" hidden><h4>Diagrama de niveles, como en clase</h4><div class="svgbox" id="clase-box"></div></div>
        <div class="lt" id="lt" hidden>
          <div class="lt-fila">
            <button class="btn" id="l-ini" aria-label="Ir al inicio" title="Al inicio"></button><button class="btn" id="l-ant" aria-label="Etapa anterior" title="Etapa anterior (←)"></button>
            <button class="btn on" id="l-play" aria-label="Reproducir" style="min-width:56px" title="Reproducir (espacio)"></button>
            <button class="btn" id="l-sig" aria-label="Etapa siguiente" title="Etapa siguiente (→)"></button><button class="btn" id="l-fin" aria-label="Ir al final" title="Al final"></button>
            <div class="lt-barra"><div class="marcas" id="marcas"></div><input id="l-rango" type="range" min="0" max="1000" value="0" aria-label="Progreso de la animación" /></div>
          </div>
          <div class="lt-fila">
            <div class="seg" id="vel" role="group" aria-label="Velocidad">${VELOCIDADES.map((v) => `<button data-v="${v}" class="${v === 1 ? 'on' : ''}">${String(v).replace('.', ',')}×</button>`).join('')}</div>
            <div class="seg" id="modoRep" role="group" aria-label="Modo"><button data-m="continuo" class="on" title="Reproduce todas las etapas seguidas">Continuo</button><button data-m="paso" title="Se detiene al acabar cada etapa">Paso a paso</button></div>
            <label class="chk"><input type="checkbox" id="secu" /> Recorrer todos los centros</label>
            <span style="flex:1"></span><button class="btn" id="l-salir">✕ Volver al resultado</button>
          </div>
          <span id="l-etq" style="font-size:13px;color:var(--muted)"></span>
          <div class="chips" id="chips"></div>
        </div>
      </section>
      <aside class="card lado">
        <div class="tabs" role="tablist" id="tabs">
          ${[['datos', 'Resultado'], ['lewis', 'Lewis'], ['energia', 'Energía'], ['enlaces', 'Enlaces'], ['pasos', 'Paso a paso']].map(([k, n]) => `<button role="tab" data-t="${k}" aria-selected="${k === 'datos'}">${n}</button>`).join('')}
        </div>
        ${['datos', 'lewis', 'energia', 'enlaces', 'pasos'].map((k) => `<div class="panel ${k === 'datos' ? 'on' : ''}" id="p-${k}" role="tabpanel"></div>`).join('')}
      </aside>
    </main>`;
    const q = (id: string) => this.raiz.querySelector('#' + id) as HTMLElement;
    ['q', 'sug', 'aviso', 'visor', 'msg3d', 'gauge', 'gtxt', 'centro', 'marcas', 'chips', 'l-etq', 'l-play', 'l-rango', 'p-pasos', 'p-lewis', 'p-energia', 'p-datos', 'p-enlaces', 'b-tema', 'b-rot', 'lt', 'cta-w', 'pop-vista', 'pop-menu'].forEach((i) => (this.el[i] = q(i)));
    this.escena = new Escena3D(this.el.visor);
    this.vista = new Vista2D(this.el.visor);
    this.vista.onSeleccion = (i) => this.seleccionarAtomo(i);
    this.lt = new LineaTemporal(this.escena);
    this.lt.vista = this.vista;
    this.lt.onCamara = (et) => {
      const t = this.an?.tev.atomos[et.centro];
      const n = t ? t.excitado.filter((o, i) => o.id === 's' || o.id[0] === 'p' || o.e > 0 || t.fundamental[i].e > 0).length : 4;
      const zSep = n <= 4 ? 0.7 : 0.46;
      const z: number | 'molecula' = et.id === 'final' ? 'molecula' : et.id === 'hibridacion' ? (n <= 4 ? 0.9 : 0.55) : ['atomo', 'recuento', 'promocion'].includes(et.id) ? zSep : et.id === 'repulsion' ? 1.7 : 1.25;
      this.vista.enfocar(et.id === 'final' ? null : et.centro, z);
    };
    this.lt.onEstado = (e) => this.alEstado(e);
    this.escena.onSeleccion = (i) => this.seleccionarAtomo(i);
    this.escena.onMedicion = (t) => this.aviso(t, false);
    this.menus();
    this.eventos();
    this.iconosReproductor();
  }

  private iconosReproductor() {
    const ic = (p: string) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${p}"/></svg>`;
    this.iconos = { ini: ic('M5 5h2.5v14H5zM20 5v14L8.5 12z'), ant: ic('M11 5v14L1.5 12zM22 5v14l-9.5-7z'), play: ic('M7 4v16l13-8z'), pausa: ic('M6 4h4v16H6zM14 4h4v16h-4z'), sig: ic('M13 5v14l9.5-7zM2 5v14l9.5-7z'), fin: ic('M16.5 5H19v14h-2.5zM4 5v14l11.5-7z') };
    const set = (id: string, k: string) => ((this.raiz.querySelector('#' + id) as HTMLElement).innerHTML = this.iconos[k]);
    set('l-ini', 'ini'); set('l-ant', 'ant'); set('l-play', 'play'); set('l-sig', 'sig'); set('l-fin', 'fin');
  }

  /** Menús desplegables: Biblioteca, Menú y Vista. */
  private menus() {
    const popover = (btn: string, pop: string) => {
      const b = this.raiz.querySelector('#' + btn) as HTMLElement, p = this.el[pop];
      b.addEventListener('click', (e) => { e.stopPropagation(); const abrir = p.hidden; this.cerrarPops(); p.hidden = !abrir; b.setAttribute('aria-expanded', String(abrir)); if (abrir) this.colocarPop(b, p); });
      p.addEventListener('click', (e) => e.stopPropagation());
    };
    ['b-menu:pop-menu', 'b-vista:pop-vista'].forEach((s) => popover(...(s.split(':') as [string, string])));
    document.addEventListener('click', () => this.cerrarPops());
    window.addEventListener('resize', () => this.cerrarPops());
    this.raiz.querySelector('#b-bib')!.addEventListener('click', () => this.abrirBiblioteca());
    // Menú de herramientas
    const items: [string, string, string, () => void][] = [
      ['mp', '🎯 Modo práctica', 'Preguntas sobre hibridación y geometría, y cajas de electrones para rellenar', () => abrirQuiz(this.raiz, this.tema)],
      ['mc', '⚖ Comparar dos moléculas', 'Por ejemplo NH₃ frente a BF₃', () => abrirComparador(this.raiz, this.tema, this.oscuro)],
      ['mf', '🖨 Ficha A4 (imprimir / PDF)', 'Todos los pasos de la molécula en una hoja', () => { if (!this.an) return; imprimirFicha(this.an, this.sel, this.tema, this.vista.dataURL()); }],
      ['ms', '🔗 Copiar enlace', 'Comparte la molécula y la etapa actual', () => { navigator.clipboard?.writeText(location.href).then(() => this.aviso('Enlace copiado.', false)).catch(() => this.aviso(`Enlace: ${esc(location.href)}`, false)); }],
      ['mg', '❓ Guía rápida', 'Qué hace cada parte de la herramienta', () => abrirGuia(this.raiz)],
    ];
    this.el['pop-menu'].innerHTML = items.map(([k, t, d]) => `<button class="item" data-k="${k}"><b>${t}</b><small>${d}</small></button>`).join('');
    this.el['pop-menu'].addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button'); if (!b) return; this.cerrarPops(); items.find((i) => i[0] === b.dataset.k)![3](); });
    // Vista
    const defs: [string, string, boolean][] = [['pi', 'Orbitales p / π', true], ['pares', 'Pares solitarios (del átomo elegido)', true], ['paresTodos', 'Pares solitarios de todos los átomos', false], ['electrones', 'Electrones', true], ['etiquetas', 'Etiquetas de átomos', true], ['angulos', 'Ángulos', false], ['dipolo', 'Dipolo', true], ['ejes', 'Ejes x/y/z', false], ['orbitales', 'Orbitales en la vista final', true]];
    this.el['pop-vista'].innerHTML = `<h5>Híbridos que se dibujan</h5><div class="seg" id="hib">${[['todos', 'Todos'], ['seleccionado', 'Átomo elegido'], ['ninguno', 'Ninguno']].map(([v, n], i) => `<button data-v="${v}" class="${i ? '' : 'on'}">${n}</button>`).join('')}</div>
      <h5>Mostrar</h5>${defs.map(([k, n, v]) => `<label class="chk"><input type="checkbox" data-k="${k}" ${v ? 'checked' : ''}/> ${n}</label>`).join('')}
      <h5>Modelo químico</h5><label class="chk"><input type="checkbox" data-k="hibterm"/> Hibridar también los átomos terminales</label>
      <h5>Convenio de Lewis</h5><div class="seg" id="conv">${[['cargas', 'Minimizar cargas'], ['octeto', 'Respetar octeto']].map(([v, n], i) => `<button data-v="${v}" class="${i ? '' : 'on'}">${n}</button>`).join('')}</div><small style="display:block;padding:4px 8px;color:var(--muted)">Cambia solo π y promoción en SO₂, SO₄²⁻, ClO₄⁻…; la hibridación y la geometría no cambian.</small>`;
    const pv = this.el['pop-vista'];
    pv.addEventListener('change', (e) => {
      const i = e.target as HTMLInputElement;
      const k = i.dataset.k!;
      if (k in this.vista.op) { (this.vista.op as unknown as Record<string, boolean>)[k] = i.checked; this.vista.render(); }
      if (k === 'paresTodos') { this.lt.paresTodos = i.checked; this.lt.refrescar(); return; }
      if (k === 'hibterm') { this.hibTerm = i.checked; this.cargar(this.texto, undefined, true); return; }
      if (['angulos', 'dipolo', 'ejes'].includes(k)) return;
      if (k === 'etiquetas') this.escena.setInterruptor('etiquetas', i.checked);
      this.lt.ctx[k as 'pi'] = i.checked;
      this.lt.refrescar();
    });
    pv.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('.seg button') as HTMLElement | null;
      if (!b) return;
      const seg = b.parentElement!;
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      if (seg.id === 'conv') { this.convenio = b.dataset.v as 'cargas'; this.cargar(this.texto, undefined, true); }
      else { this.lt.hibridos = b.dataset.v as 'todos'; this.vista.op.hibridos = b.dataset.v as 'todos'; this.vista.render(); this.lt.refrescar(); }
    });
  }
  /** El visor siempre usa el dibujo «estilo libro» (2D); la escena WebGL queda oculta y solo sirve de motor. */
  private actualizarVisor() {
    this.el.visor.querySelectorAll<HTMLElement>('.lienzo3d,.capa-etiquetas').forEach((e) => (e.style.display = 'none'));
    this.vista.margenInf = this.animMode ? 0 : 56;
    this.vista.mostrar(true);
    this.vista.encuadrar(true);
  }
  /** Coloca un menú desplegable dentro de la pantalla (nunca se sale por ningún lado). */
  private colocarPop(b: HTMLElement, p: HTMLElement) {
    p.style.position = 'fixed';
    p.style.right = 'auto';
    p.style.maxWidth = `${window.innerWidth - 16}px`;
    const r = b.getBoundingClientRect();
    const w = p.offsetWidth;
    let left = r.left;
    if (left + w > window.innerWidth - 8) left = r.right - w;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    p.style.left = `${left}px`;
    p.style.top = `${r.bottom + 8}px`;
    p.style.maxHeight = `${Math.max(160, window.innerHeight - r.bottom - 24)}px`;
  }

  /** Biblioteca de moléculas: ventana modal centrada, con filtro y cierre por ✕, Esc o clic fuera. */
  private abrirBiblioteca() {
    const m = document.createElement('div');
    m.className = 'modal';
    m.innerHTML = `<div class="modal-caja" role="dialog" aria-modal="true" aria-label="Biblioteca de moléculas">
      <div class="modal-cab"><h3>Biblioteca de moléculas</h3><button class="btn cerrar-x" aria-label="Cerrar" title="Cerrar (Esc)">✕</button></div>
      <input class="filtro-bib" type="search" placeholder="Filtrar por nombre o fórmula…" aria-label="Filtrar la biblioteca" autocomplete="off" />
      <div class="bib-cuerpo">${CATEGORIAS.map((c) => `<div class="cat"><h5>${esc(c)}</h5><div>${BIBLIOTECA.filter((e) => e.categoria === c).map((e) => `<button class="chip" data-f="${esc(e.formula)}" data-b="${esc(plano([e.nombre, e.formula, formulaUnicode(e.formula), ...e.alias].join(' ')))}" title="${esc(e.nombre)}">${esc(formulaUnicode(e.formula))}</button>`).join('')}</div></div>`).join('')}<p class="vacio" hidden>No hay moléculas que coincidan con el filtro.</p></div></div>`;
    const cerrar = () => { m.remove(); document.removeEventListener('keydown', onKey); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('keydown', onKey);
    m.addEventListener('mousedown', (e) => { if (e.target === m) cerrar(); });
    m.querySelector('.cerrar-x')!.addEventListener('click', cerrar);
    m.querySelector('.bib-cuerpo')!.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button'); if (b) { cerrar(); this.cargar(b.dataset.f!); } });
    const filtro = m.querySelector('.filtro-bib') as HTMLInputElement;
    filtro.addEventListener('input', () => {
      const q = plano(filtro.value);
      let total = 0;
      m.querySelectorAll<HTMLElement>('.cat').forEach((cat) => {
        let n = 0;
        cat.querySelectorAll<HTMLElement>('.chip').forEach((c) => { const ok = !q || c.dataset.b!.includes(q); c.hidden = !ok; if (ok) n++; });
        cat.hidden = n === 0;
        total += n;
      });
      (m.querySelector('.vacio') as HTMLElement).hidden = total > 0;
    });
    this.raiz.appendChild(m);
    filtro.focus();
  }

  private cerrarPops() { this.raiz.querySelectorAll('.pop').forEach((p) => ((p as HTMLElement).hidden = true)); }

  private eventos() {
    const $ = (id: string) => this.raiz.querySelector('#' + id) as HTMLElement;
    const q = this.el.q as HTMLInputElement;
    q.addEventListener('input', () => this.sugerencias());
    q.addEventListener('focus', () => { if (!q.value) this.sugerenciasIniciales(); });
    q.addEventListener('keydown', (e) => {
      const items = Array.from(this.el.sug.querySelectorAll('button'));
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); this.sugSel = (this.sugSel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(items.length, 1); items.forEach((b, i) => b.setAttribute('aria-selected', String(i === this.sugSel))); }
      else if (e.key === 'Enter') { e.preventDefault(); const it = items[this.sugSel]; this.ocultarSug(); this.cargar(it ? it.dataset.f! : q.value); }
      else if (e.key === 'Escape') this.ocultarSug();
    });
    q.addEventListener('blur', () => setTimeout(() => this.ocultarSug(), 150));
    this.el['b-tema'].addEventListener('click', () => { this.oscuro = !this.oscuro; try { localStorage.setItem('tev-tema', this.oscuro ? 'oscuro' : 'claro'); } catch { /* */ } this.aplicarTema(); });
    $('centro').addEventListener('change', (e) => this.seleccionarAtomo(+(e.target as HTMLSelectElement).value));
    $('b-centrar').addEventListener('click', () => { this.escena.encuadrar(); this.vista.encuadrar(); });
    $('b-rot').addEventListener('click', (e) => { const b = e.currentTarget as HTMLElement; b.classList.toggle('on'); this.escena.setAutorrotacion(b.classList.contains('on')); this.vista.autorrotar = b.classList.contains('on'); });
    $('b-png').addEventListener('click', () => this.vista.exportarPNG(`${this.texto || 'molecula'}.png`));
    $('b-anim').addEventListener('click', () => this.entrarAnim());
    $('l-salir').addEventListener('click', () => this.salirAnim());
    $('l-ini').addEventListener('click', () => this.lt.inicio());
    $('l-ant').addEventListener('click', () => { this.lt.pausar(); this.lt.anterior(); });
    $('l-sig').addEventListener('click', () => { this.lt.pausar(); this.lt.siguiente(); });
    $('l-fin').addEventListener('click', () => this.lt.fin());
    $('l-play').addEventListener('click', () => this.lt.alternar());
    ($('l-rango') as HTMLInputElement).addEventListener('input', (e) => { this.lt.pausar(); this.lt.ir((+(e.target as HTMLInputElement).value / 1000) * this.lt.total); });
    $('vel').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button'); if (!b) return; this.lt.setVelocidad(+b.dataset.v!); $('vel').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); });
    $('modoRep').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button'); if (!b) return; this.lt.modo = b.dataset.m as 'paso'; $('modoRep').querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b)); });
    $('secu').addEventListener('change', (e) => { this.lt.pausar(); this.lt.setSecuencia((e.target as HTMLInputElement).checked); this.pintarMarcas(); if (this.animMode) this.lt.irAEtapa(0, 0); });
    $('tabs').addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest('button'); if (b) this.irTab(b.dataset.t!); });
    this.el.chips.addEventListener('click', (e) => { const c = (e.target as HTMLElement).closest('button'); if (c) { this.lt.pausar(); this.lt.irAEtapa(+c.dataset.i!, 0); } });
  }

  /** Modo «paso a paso»: muestra el reproductor y arranca la animación desde la etapa 1. */
  private entrarAnim(paso?: number) {
    if (!this.an) return;
    this.animMode = true;
    this.actualizarVisor();
    this.el.lt.hidden = false;
    this.el.visor.classList.add('anim');
    (this.raiz.querySelector('#clase-w') as HTMLElement).hidden = false;
    this.el['cta-w'].hidden = true;
    this.irTab('pasos');
    this.pintarMarcas();
    if (paso) { const i = this.lt.plan.findIndex((e) => e.numero === paso); this.lt.irAEtapa(i >= 0 ? i : 0, 1); }
    else { this.lt.irAEtapa(0, 0); this.lt.reproducir(); }
  }
  private salirAnim(irResultado = true) {
    this.animMode = false;
    this.actualizarVisor();
    this.vista.enfocar(null, 1);
    this.lt.pausar();
    this.lt.mostrarFinalEstatico();
    this.el.lt.hidden = true;
    this.el.visor.classList.remove('anim');
    (this.raiz.querySelector('#clase-w') as HTMLElement).hidden = true;
    this.el['cta-w'].hidden = false;
    this.el.msg3d.hidden = true; this.el.gauge.hidden = true; this.el.gtxt.hidden = true;
    this.escena.encuadrar();
    if (irResultado) this.irTab('datos');
    this.escribirHash();
  }
  private sugerenciasIniciales() {
    this.el.sug.hidden = false;
    this.el.sug.innerHTML = `<div style="padding:8px 16px;font-size:12px;color:var(--muted)">Prueba con:</div>` + ['agua', 'metano', 'amoniaco', 'SF4', 'XeF4', 'etileno', 'benceno', 'ion sulfato', 'CCO'].map((f) => `<button data-f="${f}"><span>${f}</span></button>`).join('');
    this.el.sug.querySelectorAll('button').forEach((b) => b.addEventListener('mousedown', () => { this.ocultarSug(); this.cargar((b as HTMLElement).dataset.f!); }));
  }

  private teclas(e: KeyboardEvent) {
    const t = e.target as HTMLElement;
    if (/INPUT|SELECT|TEXTAREA/.test(t.tagName) && !(t as HTMLInputElement).type?.match(/checkbox|range/)) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); this.lt.pausar(); this.lt.siguiente(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); this.lt.pausar(); this.lt.anterior(); }
    else if (e.key === ' ' && t.tagName !== 'BUTTON') { e.preventDefault(); this.lt.alternar(); }
  }

  private irTab(k: string) {
    this.tab = k;
    this.raiz.querySelectorAll('#tabs button').forEach((b) => b.setAttribute('aria-selected', String((b as HTMLElement).dataset.t === k)));
    this.raiz.querySelectorAll('.panel').forEach((p) => p.classList.toggle('on', p.id === 'p-' + k));
  }

  private aplicarTema() {
    document.documentElement.dataset.theme = this.oscuro ? 'dark' : 'light';
    this.el['b-tema'].innerHTML = ico(this.oscuro ? 'sol' : 'luna');
    this.escena?.setTema(this.oscuro);
    if (this.vista) this.vista.oscuro = this.oscuro;
    if (this.an) this.renderPaneles();
  }

  // ───────────────────────── Búsqueda ─────────────────────────
  private sugerencias() {
    const v = (this.el.q as HTMLInputElement).value;
    const s = sugerir(v, 7);
    this.sugSel = -1;
    this.el.sug.hidden = !s.length;
    this.el.sug.innerHTML = s.map((e: EntradaBiblioteca) => `<button role="option" data-f="${esc(e.formula)}"><span>${esc(e.nombre)}</span><em>${esc(e.formula.replace(/\^.*/, ''))} · ${esc(e.categoria)}</em></button>`).join('');
    this.el.sug.querySelectorAll('button').forEach((b) => b.addEventListener('mousedown', () => { this.ocultarSug(); this.cargar((b as HTMLElement).dataset.f!); }));
  }
  private ocultarSug() { this.el.sug.hidden = true; }
  private avisoT = 0;
  private aviso(html: string, error = true) {
    this.el.aviso.innerHTML = html ? `<p class="${error ? 'msg' : 'iso'}">${html}</p>` : '';
    clearTimeout(this.avisoT);
    // los avisos informativos sin botones (p. ej. «Enlace copiado») desaparecen solos
    if (html && !error && !html.includes('<button')) { const el = this.el.aviso.firstElementChild; this.avisoT = window.setTimeout(() => { if (this.el.aviso.firstElementChild === el) this.el.aviso.innerHTML = ''; }, 3500); }
  }

  // ───────────────────────── Carga ─────────────────────────
  cargar(texto: string, paso?: number, conservar = false) {
    this.aviso('');
    try {
      const r = analizar(texto, { hibridarTerminales: this.hibTerm, convenio: this.convenio });
      if (r.tipo === 'ambiguo') {
        this.aviso(`«${esc(texto)}» (${esc(r.formula)}) admite varios esqueletos. Elige uno:<br>${r.opciones.map((o) => `<button data-f="${esc(o.formula)}">${esc(o.nombre)}</button>`).join('')}`, false);
        this.el.aviso.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => this.cargar((b as HTMLElement).dataset.f!)));
        return;
      }
      this.texto = texto;
      (this.el.q as HTMLInputElement).value = conservar ? (this.el.q as HTMLInputElement).value : texto;
      this.setAnalisis(r.analisis, paso);
    } catch (e) {
      if (e instanceof ErrorQuimica) {
        this.aviso(`${esc(e.message)}${e.sugerencias.length ? '<br>¿Quizá: ' + e.sugerencias.map((s) => `<button data-f="${esc(s)}">${esc(s)}</button>`).join('') + '?' : ''}`);
        this.el.aviso.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => this.cargar((b as HTMLElement).dataset.f!)));
      } else { this.aviso('Algo no ha salido como esperaba con esa molécula. Prueba con otra entrada.'); console.error(e); }
    }
  }

  private setAnalisis(an: Analisis, paso?: number) {
    this.an = an;
    this.escena.cargar(an);
    this.lt.cargar(an);
    this.vista.cargar(an, this.escena.sel);
    this.el.centro.innerHTML = an.centros.map((c) => `<option value="${c}">Átomo: ${an.estructura.atomos[c].el.simbolo}${c + 1}</option>`).join('');
    this.renderPaneles();
    this.pintarMarcas();
    if (paso) this.entrarAnim(paso);
    else if (this.animMode) this.salirAnim(false);
    else this.irTab('datos');
    this.escribirHash();
  }

  private seleccionarAtomo(i: number) {
    if (!this.an) return;
    const t = this.an.tev.atomos[i];
    if (t.error) { this.aviso(esc(t.error)); return; }
    this.escena.sel = i;
    this.escena.seleccionar(i);
    this.vista.sel = i;
    this.vista.render();
    (this.el.centro as HTMLSelectElement).value = String(i);
    this.lt.seleccionarCentro(i);
    this.renderPaneles();
    this.pintarMarcas();
  }

  // ───────────────────────── Paneles ─────────────────────────
  private get sel() { return this.escena.sel; }

  private renderPaneles() {
    const an = this.an!;
    const tema = this.tema;
    const t = an.tev.atomos[this.sel];
    // Lewis
    const desl = enlacesDeslocalizados(an.resonancia);
    this.el['p-lewis'].innerHTML = `<h3>Estructura de Lewis</h3>
      <p class="texto-paso">${an.electronesValencia} electrones de valencia${an.carga ? ` (carga total ${an.carga > 0 ? '+' : '−'}${Math.abs(an.carga)})` : ''}. Puntos = pares solitarios; círculos = cargas formales.</p>
      <div class="svgbox"><div class="res-fila" id="res">${resonanciaHTML(an, tema)}</div></div>
      ${an.resonancia.length > 1 ? `<div class="nota"><b>Resonancia:</b> ${an.resonancia.length} formas equivalentes. El enlace π está deslocalizado entre ${desl.size} enlaces (en azul): la estructura real es un híbrido.</div>` : ''}
      <p><button class="btn" id="x-lsvg">Exportar SVG</button> <button class="btn" id="x-lpng">Exportar PNG</button></p>`;
    const lsvg = () => this.el['p-lewis'].querySelector('svg')!;
    this.el['p-lewis'].querySelector('#x-lsvg')!.addEventListener('click', () => exportarSVG(lsvg(), `lewis-${this.texto}`));
    this.el['p-lewis'].querySelector('#x-lpng')!.addEventListener('click', () => exportarPNGdeSVG(lsvg(), `lewis-${this.texto}`, tema.fondo));
    // Energía
    this.montarEnergia(this.animMode && this.ultimoLT ? this.ultimoLT.etapa.centro : this.sel);
    // Datos
    const fcs = an.estructura.atomos.map((a, i) => ({ a, i })).filter(({ a }) => a.carga !== 0).map(({ a, i }) => `${a.el.simbolo}${i + 1}: ${a.carga > 0 ? '+' : '−'}${Math.abs(a.carga)}`);
    const d = an.polaridad;
    const fila = (k: string, v: string) => `<tr><th>${k}</th><td>${v}</td></tr>`;
    this.el['p-datos'].innerHTML = `<h3>${esc(an.nombre)} <span style="color:var(--muted);font-weight:400">${esc(an.formula)}</span></h3>
      <div class="resumen">${t.error ? '' : `<span class="dato"><small>Hibridación</small><b>${t.hibridacion ? hibridoTexto(t.hibridacion.tipo) : t.simbolo === 'H' ? '1s' : 'p puro'}</b></span><span class="dato"><small>Geometría</small><b>${esc(t.rpecv.geometriaMolecular)}</b></span><span class="dato"><small>AXE</small><b>${t.rpecv.notacion}</b></span>`}<span class="dato"><small>σ / π</small><b>${an.tev.sigma} / ${an.tev.pi}</b></span><span class="dato"><small>Polaridad</small><b>${an.carga ? 'ion' : d.polar ? 'polar' : 'apolar'}</b></span></div>
      <p class="texto-paso" style="color:var(--muted)">Datos del átomo <b>${t.etiqueta}</b> (haz clic en otro átomo para cambiarlo). Pulsa <b>▶ Ver paso a paso</b> para ver cómo se construye.</p>
      <table class="tabla">${fila('Electrones de valencia', String(an.electronesValencia))}${fila('Carga', an.carga ? (an.carga > 0 ? '+' : '−') + Math.abs(an.carga) : '0')}
      ${t.error ? fila('Átomo analizado', esc(t.error)) : `${fila(`Átomo analizado`, `${t.etiqueta} (n.º ${this.sel + 1})`)}${fila('Notación AXE', t.rpecv.notacion)}${fila('Número estérico', String(t.rpecv.esterico))}
      ${fila('Hibridación', t.hibridacion ? `${hibridoTexto(t.hibridacion.tipo)}` : t.simbolo === 'H' ? '1s (sin hibridar: σ 1s–1s)' : 'p puro (sin hibridar)')}${fila('Carácter s', t.hibridacion ? num(t.hibridacion.pctS, 1) + ' %' : '—')}
      ${fila('Geometría electrónica', t.rpecv.geometriaElectronica)}${fila('Geometría molecular', t.rpecv.geometriaMolecular)}${fila('Ángulos ideales', t.rpecv.angulosIdeales)}${fila('Ángulos reales', t.rpecv.anguloRealTexto)}
      ${fila('Configuración fundamental', t.configFundamental)}${fila('Configuración excitada', t.configExcitada)}${fila('Promoción', t.promociones.map((p) => p.texto).join('; ') || 'ninguna')}`}
      ${fila('Enlaces σ / π (molécula)', `${an.tev.sigma} / ${an.tev.pi}`)}${fila('Polaridad', an.carga ? 'es un ion: no se clasifica como polar o apolar' : d.polar ? `polar, ${textoMu(d)}` : d.nota ? `apolar. ${esc(d.nota)}` : 'apolar (Σ dipolos ≈ 0)')}${fila('Cargas formales', fcs.join(', ') || 'todas 0')}</table>`;
    // Enlaces
    const filas = an.tev.enlaces.map((e) => `<div class="fila-enl"><b>${an.estructura.atomos[e.a].el.simbolo}${e.a + 1}${'–'}${an.estructura.atomos[e.b].el.simbolo}${e.b + 1}</b>
      <span>${esc(e.sigma)}</span>${e.pis.map((p) => `<span style="color:var(--pi)">${esc(p)}</span>`).join('')}${e.deslocalizado ? '<span class="tag">π deslocalizado</span>' : ''}</div>`).join('');
    this.el['p-enlaces'].innerHTML = `<h3>${an.tev.sigma} σ · ${an.tev.pi} π</h3><p class="texto-paso">Cada enlace con los orbitales que solapan.</p>${filas}${an.tev.notas.map((n) => `<div class="nota">${esc(n)}</div>`).join('')}`;
    this.renderPasos(this.ultimoLT);
  }

  /** Diagramas de la pestaña Energía y «como en clase» del átomo `c` (en la animación, el centro que se está animando). */
  private centroEn = -1;
  private montarEnergia(c: number) {
    const an = this.an!;
    const tema = this.tema;
    const t = an.tev.atomos[c];
    this.centroEn = c;
    this.clase = t.error ? null : new DiagramaClase(t, an, tema);
    this.energia = t.error ? null : new DiagramaEnergia(t, tema);
    this.el['p-energia'].innerHTML = `<h3>Diagrama de energía de ${t.etiqueta}</h3><h4>Como en clase: fundamental → promoción → hibridación</h4><div class="svgbox" id="clase-est"></div><h4>Niveles y solapamiento</h4><p class="texto-paso">Orbitales de ${t.etiqueta} (azul) con sus electrones; en rojo, los orbitales de los vecinos con los que solapan (resaltados en amarillo).</p><div class="svgbox">${t.error ? '' : nivelesSVG(an, c, tema)}</div><h4>Fundamental → excitado → híbridos → enlaces</h4><p class="texto-paso">Pulsa una columna para verla en 3D (paso a paso).</p><div class="svgbox" id="en-box"></div>
      <div class="leyenda">${Object.entries(ROL_NOMBRE).map(([k, n]) => `<span><i style="background:${ROL[k]}"></i>${n}</span>`).join('')}</div>
      <p><button class="btn" id="x-esvg">Exportar SVG</button> <button class="btn" id="x-epng">Exportar PNG</button></p>`;
    if (!t.error) { const est = new DiagramaClase(t, an, tema); this.el['p-energia'].querySelector('#clase-est')!.appendChild(est.svg); }
    if (this.energia) {
      this.el['p-energia'].querySelector('#en-box')!.appendChild(this.energia.svg);
      this.energia.actualizar(null, 'final', 1);
      this.energia.onColumna = (c) => { const i = this.lt.plan.findIndex((e) => e.id === ETAPA_DE_COLUMNA[c]); if (i >= 0) { this.entrarAnim(this.lt.plan[i].numero); } };
      this.el['p-energia'].querySelector('#x-esvg')!.addEventListener('click', () => exportarSVG(this.energia!.svgString(), `energia-${this.texto}`));
      this.el['p-energia'].querySelector('#x-epng')!.addEventListener('click', () => exportarPNGdeSVG(this.energia!.svgString(), `energia-${this.texto}`, tema.fondo));
    }
  }

  private renderPasos(e: EstadoLT | null) {
    const an = this.an!;
    const t = an.tev.atomos[e && this.animMode ? e.etapa.centro : this.sel];
    if (!e || !this.lt.plan.length) { this.el['p-pasos'].innerHTML = `<div class="vacio">${t.error ? esc(t.error) : 'Cargando…'}</div>`; return; }
    const et = e.etapa;
    const estado = e.idx <= 1 ? 'fundamental' : et.id === 'promocion' ? 'excitado' : 'hibridado';
    const svgCajas = t.error ? '' : cajasSVG(t, et.id === 'atomo' || et.id === 'recuento' ? 'fundamental' : et.id === 'promocion' ? 'excitado' : t.hibridacion ? 'hibridado' : 'excitado', this.tema, { promo: et.id === 'promocion' });
    void estado;
    this.el['p-pasos'].innerHTML = `<h3>Etapa ${et.numero}: ${et.titulo}</h3><div class="texto-paso">${et.texto}</div>
      <h4>Cajas de orbitales de ${t.etiqueta}</h4><div class="svgbox">${svgCajas}</div>
      <div class="leyenda">${Object.entries(ROL_NOMBRE).map(([k, n]) => `<span><i style="background:${ROL[k]}"></i>${n}</span>`).join('')}</div>
      ${t.notas.length ? `<h4>Notas didácticas</h4>${t.notas.map((n) => `<div class="nota">${esc(n)}</div>`).join('')}` : ''}
      ${an.tev.notas.map((n) => `<div class="nota">${esc(n)}</div>`).join('')}`;
    const cb = this.raiz.querySelector('#clase-box');
    if (cb && this.clase) {
      cb.replaceChildren(this.clase.svg); this.clase.actualizar(et.id, e.u);
      // si el diagrama no cabe, se desplaza hasta el panel de la etapa actual (híbridos a la derecha)
      cb.scrollLeft = ['atomo', 'recuento', 'promocion'].includes(et.id) ? 0 : cb.scrollWidth;
    }
  }

  private pintarMarcas() {
    const lt = this.lt;
    this.el.marcas.innerHTML = lt.inicios.slice(1).map((s) => `<i style="left:${(s / lt.total) * 100}%"></i>`).join('');
    this.el.chips.innerHTML = lt.plan.map((e, i) => `<button class="chip" data-i="${i}">${e.numero}. ${NOMBRE_ETAPA[e.id]}${lt.secuencia ? ' · ' + (this.an!.estructura.atomos[e.centro].el.simbolo + (e.centro + 1)) : ''}</button>`).join('');
  }

  // ───────────────────────── Sincronización ─────────────────────────
  private alEstado(e: EstadoLT) {
    const prev = this.ultimoLT;
    this.ultimoLT = e;
    if (!this.animMode) return;
    const t = this.an!.tev.atomos[e.etapa.centro];
    this.el['l-play'].innerHTML = e.reproduciendo ? this.iconos.pausa : this.iconos.play;
    this.el['l-play'].title = e.reproduciendo ? 'Pausar (espacio)' : 'Reproducir (espacio)';
    this.el['l-play'].setAttribute('aria-label', e.reproduciendo ? 'Pausar' : 'Reproducir');
    (this.el['l-rango'] as HTMLInputElement).value = String(Math.round((e.t / e.total) * 1000));
    this.el['l-etq'].textContent = `Etapa ${e.etapa.numero}/8 · ${e.etapa.titulo}`;
    this.el.chips.querySelectorAll('.chip').forEach((c, i) => { c.classList.toggle('on', i === e.idx); c.classList.toggle('hecho', i < e.idx); });
    if (this.centroEn !== e.etapa.centro) {
      // «Recorrer todos los centros»: cajas, diagrama, Energía y selector siguen al centro que se anima
      this.montarEnergia(e.etapa.centro);
      (this.el.centro as HTMLSelectElement).value = String(e.etapa.centro);
    }
    if (!prev || prev.idx !== e.idx || prev.etapa.centro !== e.etapa.centro) { this.renderPasos(e); this.escribirHash(); }
    this.energia?.actualizar(e.info, e.etapa.id, e.u);
    this.clase?.actualizar(e.etapa.id, e.u);
    // mensajes sobre el 3D
    const m = this.el.msg3d;
    let html = '';
    if (e.etapa.id === 'recuento') html = `<b>Tiene ${t.fundamental.filter((o) => o.e === 1).length}, necesita ${t.desapareados}</b><br>electrones desapareados`;
    else if (e.etapa.id === 'promocion') html = t.promociones.length ? `<b>${t.promociones.map((p) => p.texto).join('; ')}</b>` : '<b>Sin promoción</b>';
    else if (e.etapa.id === 'repulsion' && e.u > 0.9) html = `<b>${t.rpecv.geometriaMolecular}</b><br>${t.rpecv.notacion}`;
    else if (e.etapa.id === 'atomo') html = `<b>${t.etiqueta}</b> · ${t.configFundamental}`;
    m.hidden = !html || !this.lt.estatico === false && !html;
    m.innerHTML = html;
    m.hidden = !html;
    const g = this.el.gauge;
    const mostrarG = ['promocion', 'hibridacion', 'repulsion', 'vecinos'].includes(e.etapa.id);
    g.hidden = !mostrarG; this.el.gtxt.hidden = !mostrarG;
    (g.firstElementChild as HTMLElement).style.height = `${Math.round(Math.max(4, Math.min(100, 50 + e.info.energia * 50)))}%`;
  }

  // ───────────────────────── Hash ─────────────────────────
  private leerHash(): { mol?: string; paso?: number } {
    const p = new URLSearchParams(location.hash.replace(/^#/, ''));
    return { mol: p.get('mol') ?? undefined, paso: p.get('paso') ? +p.get('paso')! : undefined };
  }
  private escribirHash() {
    if (!this.an) return;
    const p = new URLSearchParams();
    p.set('mol', this.texto);
    const e = this.ultimoLT;
    if (e && this.animMode) p.set('paso', String(e.etapa.numero));
    history.replaceState(null, '', '#' + p.toString());
  }
  private desdeHash() {
    const h = this.leerHash();
    if (h.mol && h.mol !== this.texto) this.cargar(h.mol, h.paso);
    else if (h.paso) { const i = this.lt.plan.findIndex((e) => e.numero === h.paso); if (i >= 0) this.lt.irAEtapa(i, 1); }
  }
}
void BIBLIOTECA; void EJEMPLOS;
