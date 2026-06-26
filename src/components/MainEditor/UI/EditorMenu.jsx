import { useState, useRef, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import {
  MoreVertical, SlidersHorizontal, Palette, History, Save, Download,
  RotateCcw, Images, Scissors, Boxes,
} from 'lucide-react';
import { cn } from '../../ui/cn';

export default function EditorMenu({
  onAdjust,
  onFilters,
  onHistory,
  onSave,
  onDownload,
  onReset,
  onLibrary,
  onOpenCutout,
  onSegment,
  isSegmented,
  hasUnsavedChanges,
  showCutout,
}) {
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

  const run = (fn) => () => {
    setOpen(false);
    fn?.();
  };

  const items = [
    showCutout && { icon: Scissors, label: 'Edit cut-out', onClick: run(onOpenCutout), accent: true },
    { icon: SlidersHorizontal, label: 'Adjust', onClick: run(onAdjust) },
    { icon: Palette, label: 'Filters', onClick: run(onFilters) },
    onSegment && { icon: Boxes, label: isSegmented ? 'Objects detected' : 'Segment image', onClick: run(onSegment), disabled: isSegmented, accent: !isSegmented },
    { icon: History, label: 'Edit history', onClick: run(onHistory) },
    'divider',
    { icon: Save, label: 'Save', onClick: run(onSave), disabled: !hasUnsavedChanges },
    { icon: Download, label: 'Download', onClick: run(onDownload) },
    { icon: RotateCcw, label: 'Reset edits', onClick: run(onReset) },
    'divider',
    { icon: Images, label: 'Library', onClick: run(onLibrary) },
  ].filter(Boolean);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Editor actions"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-2xl border border-line bg-surface-2 text-ink transition-colors hover:bg-surface-3"
      >
        <MoreVertical size={20} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            className="absolute right-0 top-[calc(100%+0.5rem)] z-50 w-56 origin-top-right overflow-hidden rounded-2xl border border-line-strong bg-surface-2 p-1.5 shadow-pop"
          >
            {items.map((item, i) =>
              item === 'divider' ? (
                <div key={`d${i}`} className="my-1 h-px bg-line" />
              ) : (
                <button
                  key={item.label}
                  role="menuitem"
                  disabled={item.disabled}
                  onClick={item.onClick}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-sm font-medium transition-colors disabled:opacity-40',
                    item.accent ? 'text-accent hover:bg-accent-soft' : 'text-ink hover:bg-white/5',
                  )}
                >
                  <item.icon size={17} className={item.accent ? '' : 'text-muted'} />
                  {item.label}
                </button>
              ),
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
