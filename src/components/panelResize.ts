/**
 * Let people size a drawer. Call once per `<dialog class="panel">` that has a `<div class="panel-grip">` as its first child:
 *
 *   panelResize(dialogEl, { key: 'customer-drawer' });
 *
 * Desktop: drag the strip on the left edge to change the width (360px up to 80% of the window). The width is
 * remembered per `key`, so the drawer opens the way the person left it. Double-click resets it.
 * Phones: drag the handle at the top of the sheet. It snaps to 50%, 70% or 90% of the screen height, and dragging it
 * below 30% closes the sheet. The height is not remembered: a sheet starts at its default each time.
 * Keyboard (the grip is focusable): arrow keys resize in steps, Home resets.
 * Presets without dragging: .panel-sm, .panel-wide, .panel-xl (width) and .panel-short, .panel-tall (phone height).
 */
export function panelResize(
  dlg: HTMLDialogElement,
  opts: { key?: string } = {},
): () => void {
  const grip = dlg.querySelector<HTMLElement>('.panel-grip');
  if (!grip) return () => {};
  const phone = window.matchMedia('(max-width: 639px)');
  const store = opts.key ? `panel-w:${opts.key}` : '';
  const SNAPS = [0.5, 0.7, 0.9];
  const clamp = (n: number, lo: number, hi: number) =>
    Math.min(hi, Math.max(lo, n));

  const setW = (px: number) =>
    dlg.style.setProperty(
      '--panel-w',
      `${Math.round(clamp(px, 360, window.innerWidth * 0.8))}px`,
    );
  const setH = (px: number) => {
    dlg.style.setProperty('--sheet-max', '92dvh');
    dlg.style.setProperty(
      '--sheet-h',
      `${Math.round(clamp(px, 0, window.innerHeight * 0.92))}px`,
    );
  };
  const reset = () => {
    for (const v of ['--panel-w', '--sheet-h', '--sheet-max'])
      dlg.style.removeProperty(v);
    if (store)
      try {
        localStorage.removeItem(store);
      } catch {
        /* ignore */
      }
  };
  const saveW = () => {
    if (store && !phone.matches)
      try {
        localStorage.setItem(store, String(dlg.getBoundingClientRect().width));
      } catch {
        /* ignore */
      }
  };

  if (store && !phone.matches) {
    try {
      const w = Number(localStorage.getItem(store));
      if (w) setW(w);
    } catch {
      /* ignore */
    }
  }
  grip.setAttribute('role', 'separator');
  grip.setAttribute('tabindex', '0');
  grip.setAttribute('aria-label', 'Resize drawer');
  const orient = () =>
    grip.setAttribute(
      'aria-orientation',
      phone.matches ? 'horizontal' : 'vertical',
    );
  orient();
  phone.addEventListener('change', orient);

  let dragging = false;
  const down = (e: PointerEvent) => {
    dragging = true;
    grip.setPointerCapture(e.pointerId);
    grip.classList.add('drag');
    dlg.classList.add('resizing');
    e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    if (!dragging) return;
    if (phone.matches) setH(window.innerHeight - e.clientY);
    else setW(window.innerWidth - e.clientX);
  };
  const up = () => {
    if (!dragging) return;
    dragging = false;
    grip.classList.remove('drag');
    dlg.classList.remove('resizing');
    if (phone.matches) {
      const h = dlg.getBoundingClientRect().height / window.innerHeight;
      if (h < 0.3) {
        reset();
        dlg.close();
        return;
      }
      setH(
        SNAPS.reduce((a, b) => (Math.abs(b - h) < Math.abs(a - h) ? b : a)) *
          window.innerHeight,
      );
    } else saveW();
  };
  const key = (e: KeyboardEvent) => {
    const r = dlg.getBoundingClientRect();
    if (e.key === 'Home') {
      reset();
      e.preventDefault();
      return;
    }
    if (phone.matches && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      setH(
        r.height + (e.key === 'ArrowUp' ? 1 : -1) * window.innerHeight * 0.1,
      );
      e.preventDefault();
    } else if (
      !phone.matches &&
      (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
    ) {
      setW(r.width + (e.key === 'ArrowLeft' ? 1 : -1) * 40);
      saveW();
      e.preventDefault();
    }
  };
  grip.addEventListener('pointerdown', down);
  grip.addEventListener('pointermove', move);
  grip.addEventListener('pointerup', up);
  grip.addEventListener('pointercancel', up);
  grip.addEventListener('dblclick', reset);
  grip.addEventListener('keydown', key);
  return () => {
    grip.removeEventListener('pointerdown', down);
    grip.removeEventListener('pointermove', move);
    grip.removeEventListener('pointerup', up);
    grip.removeEventListener('pointercancel', up);
    grip.removeEventListener('dblclick', reset);
    grip.removeEventListener('keydown', key);
    phone.removeEventListener('change', orient);
  };
}
