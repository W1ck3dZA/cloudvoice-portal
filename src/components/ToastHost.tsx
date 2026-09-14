import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { onToast, type ToastKind } from '../lib/toast';
interface ToastItem {
  id: number;
  message: string;
  kind: ToastKind;
}
const icons: Record<ToastKind, typeof Info> = {
  error: AlertTriangle,
  info: Info,
  success: CheckCircle2,
};
export default function ToastHost() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const nextId = useRef(0);
  useEffect(
    () =>
      onToast(({ message, kind = 'info', durationMs = 8000 }) => {
        const id = ++nextId.current;
        setToasts((t) => [...t, { id, message, kind }]);
        setTimeout(
          () => setToasts((t) => t.filter((x) => x.id !== id)),
          durationMs,
        );
      }),
    [],
  );
  if (!toasts.length) return null;
  return (
    <div className="toast-host">
      {toasts.map((t) => {
        const Icon = icons[t.kind];
        return (
          <div key={t.id} className={`toast toast-${t.kind}`} role="alert">
            <Icon size={17} />
            <span>{t.message}</span>
            <button
              className="toast-close"
              aria-label="Dismiss"
              onClick={() => setToasts((ts) => ts.filter((x) => x.id !== t.id))}
            >
              <X size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
