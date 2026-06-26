import { CheckCircle2, XCircle, AlertTriangle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

const TYPES = {
  success: { Icon: CheckCircle2, color: 'text-success', bar: 'bg-success' },
  error: { Icon: XCircle, color: 'text-danger', bar: 'bg-danger' },
  invalid: { Icon: AlertTriangle, color: 'text-warning', bar: 'bg-warning' },
  info: { Icon: AlertTriangle, color: 'text-accent', bar: 'bg-accent' },
};

export default function Toast({ id, message, type, removeToast }) {
  const [isVisible, setIsVisible] = useState(true);
  const { Icon, color, bar } = TYPES[type] || TYPES.info;

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => removeToast(id), 300);
  };

  useEffect(() => {
    const timer = setTimeout(handleClose, 5000);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  return (
    <div
      className={`relative flex w-64 min-h-14 items-center gap-2.5 overflow-hidden rounded-2xl border border-line bg-surface-2 p-3 shadow-pop transition-all duration-300 ease-in-out sm:w-80 ${
        isVisible ? 'animate-slideIn opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <Icon size={20} className={`shrink-0 ${color}`} />
      <span className="flex-1 pr-2 text-sm font-medium leading-tight text-ink">{message}</span>
      <button
        onClick={handleClose}
        className="shrink-0 rounded-full p-1 text-muted transition-colors hover:bg-white/10 hover:text-ink"
        aria-label="Close notification"
      >
        <X className="h-4 w-4" />
      </button>
      <div className={`absolute bottom-0 left-0 h-1 w-full rounded-b-2xl ${bar} animate-shrink`} />
    </div>
  );
}
