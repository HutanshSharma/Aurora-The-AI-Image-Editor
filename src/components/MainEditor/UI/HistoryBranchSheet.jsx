import { Check } from 'lucide-react';
import Sheet from '../../ui/Sheet';
import { cn } from '../../ui/cn';

export default function HistoryBranchSheet({ open, node, nodeMap, activeSet, getThumb, onSelect, onClose }) {
  const children = node?.children || [];

  return (
    <Sheet open={open} onClose={onClose} title="Choose a version" description="Switch to a different branch from this point.">
      <div className="space-y-2 pt-1">
        {children.map((childId, i) => {
          const child = nodeMap.get(childId);
          if (!child) return null;
          const thumb = getThumb(childId);
          const isActive = activeSet.has(childId);
          return (
            <button
              key={childId}
              onClick={() => onSelect(childId)}
              className={cn(
                'flex w-full items-center gap-3 rounded-2xl border p-2.5 text-left transition-colors',
                isActive ? 'border-accent bg-accent-soft' : 'border-line bg-surface-2 hover:bg-surface-3',
              )}
            >
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surface-3">
                {thumb ? (
                  <img src={thumb} alt={child.label} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full animate-pulse bg-surface-3" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{child.label || `Variant ${i + 1}`}</p>
                <p className="text-[12px] text-muted">{isActive ? 'Current branch' : `Variant ${i + 1}`}</p>
              </div>
              {isActive && (
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent text-white">
                  <Check size={13} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
