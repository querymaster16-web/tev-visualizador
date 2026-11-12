/**
 * Comportamiento táctil de los visores de moléculas: si el dedo empieza dentro del visor la página
 * se queda quieta (sin scroll, sin «tirar para recargar», sin zoom de página ni selección de texto)
 * y solo se mueve la molécula. Fuera del visor la página se desplaza con normalidad.
 * El zoom de la página entera sigue permitido (no se toca la meta viewport).
 */
export function protegerVisor(cont: HTMLElement, lienzo: HTMLElement, alDobleToque: () => void) {
  cont.classList.add('visor-tactil'); // touch-action: none, overscroll-behavior: contain, sin selección (ver app.css)
  const e = cont.style as CSSStyleDeclaration & { webkitUserSelect?: string; webkitTouchCallout?: string };
  e.touchAction = 'none'; e.overscrollBehavior = 'contain'; e.userSelect = 'none'; e.webkitUserSelect = 'none'; e.webkitTouchCallout = 'none';
  // Safari de iPhone: refuerzo cuando no respeta touch-action. Solo se cancela el movimiento (no el toque), así los botones siguen funcionando
  cont.addEventListener('touchmove', (ev) => { if (ev.cancelable) ev.preventDefault(); }, { passive: false });
  for (const g of ['gesturestart', 'gesturechange', 'gestureend']) cont.addEventListener(g, (ev) => ev.preventDefault(), { passive: false } as AddEventListenerOptions);
  cont.addEventListener('contextmenu', (ev) => { if ((ev as PointerEvent).pointerType === 'touch') ev.preventDefault(); });
  // Doble toque sobre la molécula: centrarla (nunca amplía la página)
  const activos = new Set<number>();
  let ini: { x: number; y: number; t: number; solo: boolean } | null = null;
  let ultimo: { x: number; y: number; t: number } | null = null;
  lienzo.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse') return;
    activos.add(ev.pointerId);
    ini = { x: ev.clientX, y: ev.clientY, t: ev.timeStamp, solo: activos.size === 1 };
    if (activos.size > 1) ultimo = null;
  });
  lienzo.addEventListener('pointerup', (ev) => {
    if (ev.pointerType === 'mouse') return;
    activos.delete(ev.pointerId);
    if (!ini || !ini.solo || ev.timeStamp - ini.t > 300 || Math.hypot(ev.clientX - ini.x, ev.clientY - ini.y) > 10) { ini = null; ultimo = null; return; }
    const p = { x: ev.clientX, y: ev.clientY, t: ev.timeStamp };
    if (ultimo && p.t - ultimo.t < 350 && Math.hypot(p.x - ultimo.x, p.y - ultimo.y) < 40) { ultimo = null; alDobleToque(); } else ultimo = p;
    ini = null;
  });
  lienzo.addEventListener('pointercancel', (ev) => { activos.delete(ev.pointerId); ini = null; ultimo = null; });
}
