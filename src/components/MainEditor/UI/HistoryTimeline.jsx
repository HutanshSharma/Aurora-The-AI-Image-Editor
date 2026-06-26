import { useState, useRef } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronRight, GitBranch, ChevronsDown } from 'lucide-react';
import { cn } from '../../ui/cn';

const SIZE = { lg: 144, md: 104, sm: 76 };
const tkey = (id) => (id === null ? 'root' : String(id));
const tween = { duration: 0.18, ease: 'easeOut' };

export default function HistoryTimeline({ activePath, forwardPath, nodeMap, currentId, getThumb, onSelect, onOpenBranches }) {
  const [showAhead, setShowAhead] = useState(false);
  const prevCur = useRef(currentId);
  if (prevCur.current !== currentId) {
    prevCur.current = currentId;
    if (showAhead) setShowAhead(false);
  }

  const curIndex = activePath.length - 1;
  const path = showAhead ? [...activePath, ...forwardPath] : activePath;

  const curNode = nodeMap.get(currentId);
  const curChildren = (curNode?.children || []).length;
  const tipId = path[path.length - 1];
  const tipChildren = (nodeMap.get(tipId)?.children || []).length;

  return (
    <div className="absolute inset-0 overflow-y-auto scrollbar-slim">
      <div className="mx-auto flex max-w-md flex-col items-center px-6 py-8 pb-16">
        <AnimatePresence initial={false}>
          {path.map((id, i) => {
            const node = nodeMap.get(id);
            if (!node) return null;
            const isCur = id === currentId;
            const isFuture = i > curIndex;
            const tier = isCur ? 'lg' : Math.abs(i - curIndex) === 1 ? 'md' : 'sm';
            const size = SIZE[tier];
            const thumb = getThumb(id);
            const variants = (node.children || []).length;
            const isLastOnPath = i === path.length - 1;

            return (
              <motion.div
                key={tkey(id)}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={tween}
                className="flex flex-col items-center"
              >
                <button onClick={() => onSelect(id)} className="group relative block">
                  <div
                    className={cn(
                      'overflow-hidden rounded-3xl bg-surface-2 transition-all duration-200 group-active:scale-95',
                      isCur ? 'ring-2 ring-accent shadow-glow' : 'ring-1 ring-line',
                      isFuture && 'opacity-60',
                    )}
                    style={{ width: size, height: size }}
                  >
                    {thumb ? (
                      <img src={thumb} alt={node.label} className="h-full w-full object-cover" draggable={false} />
                    ) : (
                      <div className="h-full w-full animate-pulse bg-surface-3" />
                    )}
                  </div>
                  {isCur && (
                    <span className="absolute -bottom-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-soft">
                      Current
                    </span>
                  )}
                </button>

                {!isLastOnPath && (
                  <div className="flex flex-col items-center gap-1.5 py-3">
                    {variants > 1 && (
                      <button
                        onClick={() => onOpenBranches(node)}
                        className="flex items-center gap-1.5 rounded-full border border-accent/30 bg-accent-soft px-3 py-1.5 text-[12px] font-semibold text-accent transition-colors active:scale-95"
                      >
                        <GitBranch size={13} />
                        {variants} variants
                        <ChevronRight size={13} />
                      </button>
                    )}
                    <div className="h-4 w-px bg-line-strong" />
                    <ChevronDown size={14} className="-mt-2 text-faint" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {!showAhead && curChildren === 1 && (
          <ForwardChip onClick={() => setShowAhead(true)}>
            <ChevronsDown size={14} /> Show newer versions
          </ForwardChip>
        )}
        {curChildren > 1 && (
          <ForwardChip accent onClick={() => onOpenBranches(curNode)}>
            <GitBranch size={13} /> {curChildren} ways forward <ChevronRight size={13} />
          </ForwardChip>
        )}
        {showAhead && tipChildren > 1 && (
          <ForwardChip accent onClick={() => onOpenBranches(nodeMap.get(tipId))}>
            <GitBranch size={13} /> {tipChildren} ways forward <ChevronRight size={13} />
          </ForwardChip>
        )}
      </div>
    </div>
  );
}

function ForwardChip({ accent, onClick, children }) {
  return (
    <div className="flex flex-col items-center gap-1.5 pt-6">
      <div className="h-4 w-px bg-line-strong" />
      <button
        onClick={onClick}
        className={cn(
          'flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[12px] font-semibold transition-colors active:scale-95',
          accent
            ? 'border border-accent/30 bg-accent-soft text-accent'
            : 'border border-line bg-surface-2 text-ink hover:bg-surface-3',
        )}
      >
        {children}
      </button>
    </div>
  );
}
