// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from './cn';

export default function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  size = 'md', 
}) {
  const maxW = { sm: 'sm:max-w-sm', md: 'sm:max-w-md', lg: 'sm:max-w-lg' }[size] ?? 'sm:max-w-md';

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-70 flex items-end justify-center sm:items-center"
          initial="hidden"
          animate="visible"
          exit="hidden"
        >
          <motion.div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            className={cn(
              'relative flex max-h-[92vh] w-full flex-col overflow-hidden glass',
              'rounded-t-3xl border border-line shadow-pop',
              'sm:rounded-3xl pb-safe',
              maxW,
              className,
            )}
            variants={{
              hidden: { y: 32, opacity: 0, scale: 0.98 },
              visible: { y: 0, opacity: 1, scale: 1 },
            }}
            transition={{ type: 'spring', stiffness: 380, damping: 34 }}
            drag="y"
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 120 || info.velocity.y > 600) onClose?.();
            }}
          >
            {/* Grab handle (mobile) */}
            <div className="flex shrink-0 justify-center pt-3 sm:hidden">
              <div className="h-1.5 w-10 rounded-full bg-white/15" />
            </div>

            {(title || onClose) && (
              <div className="flex shrink-0 items-start justify-between gap-3 px-5 pb-3 pt-3 sm:pt-5">
                <div className="min-w-0">
                  {title && (
                    <h2 className="truncate text-base font-semibold text-ink">{title}</h2>
                  )}
                  {description && (
                    <p className="mt-0.5 text-[13px] text-muted">{description}</p>
                  )}
                </div>
                {onClose && (
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="-mr-1.5 -mt-1 inline-flex h-9 w-9 items-center justify-center rounded-full text-muted transition-colors hover:bg-white/8 hover:text-ink"
                  >
                    <X size={18} />
                  </button>
                )}
              </div>
            )}

            <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-5 pb-5">
              {children}
            </div>

            {footer && (
              <div className="shrink-0 border-t border-line px-5 py-4">{footer}</div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
