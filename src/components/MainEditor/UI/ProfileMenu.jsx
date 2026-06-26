import { useState, useRef, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, BadgeCheck, ChevronDown } from 'lucide-react';
import { useUser } from '../../../store/UserContext';
import { cn } from '../../ui/cn';

export default function ProfileMenu() {
  const { user } = useUser();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const name = user?.name || 'Account';
  const email = user?.email || '';
  const initial = (user?.name || user?.email || '?').trim().charAt(0).toUpperCase();

  const logout = () => {
    localStorage.removeItem('refresh_token');
    sessionStorage.removeItem('access_token');
    window.location.href = '/auth';
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-full border border-line bg-surface-2 py-1 pl-1 pr-2 transition-colors hover:bg-surface-3"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-linear-to-br from-accent to-accent-press text-sm font-semibold text-white">
          {initial}
        </span>
        <span className="hidden max-w-28 truncate text-[13px] font-medium text-ink sm:block">
          {name}
        </span>
        <ChevronDown
          size={15}
          className={cn('text-muted transition-transform duration-200', open && 'rotate-180')}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute left-0 top-[calc(100%+0.5rem)] z-50 w-64 origin-top-left overflow-hidden rounded-2xl border border-line-strong bg-surface-2 shadow-pop"
          >
            <div className="flex items-center gap-3 border-b border-line p-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-accent to-accent-press text-base font-semibold text-white">
                {initial}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{name}</p>
                {email && <p className="truncate text-[12px] text-muted">{email}</p>}
              </div>
            </div>

            <div className="px-4 py-3">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium',
                  user?.verified
                    ? 'bg-success/15 text-success'
                    : 'bg-warning/15 text-warning',
                )}
              >
                <BadgeCheck size={12} />
                {user?.verified ? 'Email verified' : 'Email not verified'}
              </span>
            </div>

            <div className="p-1.5 pt-0">
              <button
                role="menuitem"
                onClick={logout}
                className="flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2.5 text-sm font-medium text-danger transition-colors hover:bg-danger/10"
              >
                <LogOut size={16} /> Log out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
