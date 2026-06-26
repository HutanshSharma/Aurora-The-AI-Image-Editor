// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';
import { useId } from 'react';
import { cn } from './cn';

export default function Segmented({ options, value, onChange, className }) {
  const groupId = useId();

  return (
    <div
      role="tablist"
      className={cn(
        'relative flex rounded-2xl border border-line bg-surface-2 p-1',
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(opt.value)}
            className={cn(
              'relative z-10 flex-1 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200',
              active ? 'text-white' : 'text-muted hover:text-ink',
            )}
          >
            {active && (
              <motion.span
                layoutId={`segmented-${groupId}`}
                className="absolute inset-0 -z-10 rounded-xl bg-accent shadow-glow"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              />
            )}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
