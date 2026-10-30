import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent } from 'react';

/**
 * Press-and-hold to confirm. Spread `bind` on the button; add `holding` and `done` as the classes `.holding` and `.done`.
 *
 *   const hold = useHold(() => deleteCustomer(id));
 *   <button className={`hold ${hold.holding ? 'holding' : ''} ${hold.done ? 'done' : ''}`} {...hold.bind}>...</button>
 *
 * Rules (reasons in references/hold-to-delete.md):
 *  - The action runs only when the hold lasts the full duration (default 1000ms, the same as --hold-ms in hold.css).
 *  - Letting go early, moving the pointer off, a cancelled touch or the window losing focus all abort. Nothing runs.
 *  - Keyboard: hold Space or Enter. Releasing the key early aborts. A held key's auto-repeat does not restart it.
 *  - The long-press menu and text selection are suppressed on touch; the button is not a link and not draggable.
 *  - `onDone` runs once per completed hold. The button stays in `.done` until `reset()`, so a slow request can't be
 *    fired twice.
 */
export function useHold(onDone: () => void, ms = 1000) {
  const [holding, setHolding] = useState(false);
  const [done, setDone] = useState(false);
  const timer = useRef<number | null>(null);
  const cb = useRef(onDone);
  cb.current = onDone;

  const stop = useCallback(() => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  }, []);

  const start = useCallback(() => {
    if (done || timer.current !== null) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      setDone(true);
      cb.current();
    }, ms);
  }, [done, ms]);

  useEffect(() => {
    window.addEventListener('blur', stop);
    return () => {
      window.removeEventListener('blur', stop);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, [stop]);

  const bind = {
    onPointerDown: (e: PointerEvent<HTMLElement>) => {
      if (e.button !== 0) return;
      e.currentTarget.setPointerCapture?.(e.pointerId);
      start();
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onPointerLeave: stop,
    onKeyDown: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (!e.repeat) start();
      }
    },
    onKeyUp: (e: KeyboardEvent<HTMLElement>) => {
      if (e.key === ' ' || e.key === 'Enter') stop();
    },
    onContextMenu: (e: { preventDefault: () => void }) => e.preventDefault(),
    onDragStart: (e: { preventDefault: () => void }) => e.preventDefault(),
    'aria-describedby': undefined as string | undefined,
  };

  return {
    holding,
    done,
    bind,
    reset: () => {
      stop();
      setDone(false);
    },
  };
}
