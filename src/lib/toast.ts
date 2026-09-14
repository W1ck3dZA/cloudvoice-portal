export type ToastKind = 'error' | 'info' | 'success';
export interface ToastPayload {
  message: string;
  kind?: ToastKind;
  durationMs?: number;
}
const TOAST_EVENT = 'cv-toast';
export function showToast(payload: ToastPayload) {
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
}
export function onToast(handler: (payload: ToastPayload) => void) {
  const listener = (e: Event) => handler((e as CustomEvent<ToastPayload>).detail);
  window.addEventListener(TOAST_EVENT, listener);
  return () => window.removeEventListener(TOAST_EVENT, listener);
}
