import { useState, useRef, useMemo, useEffect, useLayoutEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Minus, Locate } from 'lucide-react';
import { cn } from '../../ui/cn';

const COL = 150;
const ROW = 172;
const SIZE = { lg: 112, md: 84, sm: 62 };
const tkey = (id) => (id === null ? 'root' : String(id));

export default function HistoryGraph({ nodeMap, rootId, activeSet, currentId, getThumb, onSelect }) {
  const [expanded, setExpanded] = useState(() => new Set());
  const prevCurRef = useRef(currentId);
  const needsCenterRef = useRef(true);
  if (prevCurRef.current !== currentId) {
    prevCurRef.current = currentId;
    needsCenterRef.current = true;
    if (expanded.size) setExpanded(new Set());
  }
  const containerRef = useRef(null);
  const wrapperRef = useRef(null);
  const dragRef = useRef(null);
  const viewRef = useRef({ x: 0, y: 64, scale: 1 });
  const extentRef = useRef({ minX: 0, maxX: 0, minY: 0, maxY: 0 });

  const cur = nodeMap.get(currentId);
  const tierOf = (id) => {
    if (id === currentId) return 'lg';
    if (cur && (cur.parentId === id || (cur.children || []).includes(id))) return 'md';
    return 'sm';
  };
  const { pos, leaves } = useMemo(() => {
    const p = new Map();
    let leaf = 0;
    const walk = (id, d, reveal) => {
      const node = nodeMap.get(id);
      const allKids = node?.children || [];
      const open = expanded.has(id);
      const autoChain = reveal && allKids.length === 1;
      const kids = allKids.filter((cid) => activeSet.has(cid) || open || autoChain);
      let x;
      if (!kids.length) {
        x = leaf++;
      } else {
        const xs = kids.map((cid) => walk(cid, d + 1, open || autoChain));
        x = (xs[0] + xs[xs.length - 1]) / 2;
      }
      p.set(id, { x, y: d });
      return x;
    };
    walk(rootId, 0, false);
    return { pos: p, leaves: Math.max(1, leaf) };
  }, [nodeMap, expanded, activeSet, rootId]);

  const cx = (id) => (pos.get(id).x - (leaves - 1) / 2) * COL;
  const cy = (id) => pos.get(id).y * ROW;
  const half = (id) => SIZE[tierOf(id)] / 2 + 10;

  const visibleIds = [...pos.keys()];
  {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const id of visibleIds) {
      const x = cx(id);
      const y = cy(id);
      const h = SIZE[tierOf(id)] / 2;
      if (x - h < minX) minX = x - h;
      if (x + h > maxX) maxX = x + h;
      if (y - h < minY) minY = y - h;
      if (y + h > maxY) maxY = y + h;
    }
    if (Number.isFinite(minX)) extentRef.current = { minX, maxX, minY, maxY };
  }

  const edges = visibleIds
    .filter((id) => id !== rootId)
    .map((id) => {
      const parent = nodeMap.get(id)?.parentId ?? null;
      if (!pos.has(parent)) return null;
      const x1 = cx(parent);
      const y1 = cy(parent) + half(parent);
      const x2 = cx(id);
      const y2 = cy(id) - half(id);
      const my = (y1 + y2) / 2;
      return {
        key: `${tkey(parent)}-${tkey(id)}`,
        d: `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`,
        active: activeSet.has(id) && activeSet.has(parent),
      };
    })
    .filter(Boolean);

  const applyTransform = (animate = false) => {
    const el = containerRef.current;
    const v = viewRef.current;

    if (el) {
      const { minX, maxX, minY, maxY } = extentRef.current;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const s = v.scale;
      const TOP = 96;
      const BOT = 108;
      const SIDE = 72;
      if ((maxY - minY) * s <= ch - TOP - BOT) {
        v.y = TOP - minY * s; 
      } else {
        v.y = Math.min(Math.max(v.y, ch - BOT - maxY * s), TOP - minY * s);
      }
      if ((maxX - minX) * s <= cw - 2 * SIDE) {
        v.x = -((minX + maxX) / 2) * s;
      } else {
        v.x = Math.min(Math.max(v.x, cw - SIDE - cw / 2 - maxX * s), SIDE - cw / 2 - minX * s);
      }
    }
    if (wrapperRef.current) {
      wrapperRef.current.style.transition = animate ? 'transform 0.3s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
      wrapperRef.current.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.scale})`;
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const v = viewRef.current;
      if (e.ctrlKey || e.metaKey) {
        v.scale = Math.min(2, Math.max(0.4, v.scale * (e.deltaY < 0 ? 1.06 : 0.94)));
      } else {
        v.x -= e.deltaX;
        v.y -= e.deltaY;
      }
      applyTransform();
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  const centerOnCurrent = (animate = false) => {
    const el = containerRef.current;
    if (!el || !pos.has(currentId)) return;
    const h = el.clientHeight || 600;
    viewRef.current = { x: -cx(currentId), y: h * 0.4 - cy(currentId), scale: 1 };
    applyTransform(animate);
  };

  const mountedRef = useRef(false);
  useLayoutEffect(() => {
    if (needsCenterRef.current) {
      needsCenterRef.current = false;
      centerOnCurrent(mountedRef.current);
      mountedRef.current = true;
    } else {
      applyTransform();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pos]);

  const onPointerDown = (e) => {
    if (e.target.closest('[data-interactive]')) return;
    const v = viewRef.current;
    dragRef.current = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y };
  };
  const onPointerMove = (e) => {
    if (!dragRef.current) return;
    const { x, y, vx, vy } = dragRef.current;
    viewRef.current.x = vx + (e.clientX - x);
    viewRef.current.y = vy + (e.clientY - y);
    applyTransform();
  };
  const endPan = () => {
    dragRef.current = null;
  };

  const zoomBy = (f) => {
    viewRef.current.scale = Math.min(2, Math.max(0.4, viewRef.current.scale * f));
    applyTransform(true);
  };

  const toggleExpand = (id) =>
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 cursor-grab touch-none overflow-hidden active:cursor-grabbing"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endPan}
      onPointerLeave={endPan}
    >
      <p className="pointer-events-none absolute left-1/2 top-3 z-10 -translate-x-1/2 text-[12px] text-faint">
        Scroll to navigate · ⌘/Ctrl + scroll to zoom · drag to pan
      </p>

      <div
        ref={wrapperRef}
        className="absolute left-1/2 top-0 will-change-transform"
        style={{ transformOrigin: '0 0' }}
      >
        <svg className="absolute left-0 top-0 overflow-visible" width="1" height="1">
          <AnimatePresence>
            {edges.map((e) => (
              <motion.path
                key={e.key}
                d={e.d}
                fill="none"
                stroke={e.active ? 'var(--color-accent)' : 'var(--color-line-strong)'}
                strokeWidth={e.active ? 2.5 : 1.5}
                strokeLinecap="round"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.18 }}
              />
            ))}
          </AnimatePresence>
        </svg>

        <AnimatePresence>
          {visibleIds.map((id) => {
            const node = nodeMap.get(id);
            if (!node) return null;
            const size = SIZE[tierOf(id)];
            const isCur = id === currentId;
            const thumb = getThumb(id);
            return (
              <motion.div
                key={`n-${tkey(id)}`}
                className="absolute left-0 top-0"
                initial={{ opacity: 0, scale: 0.6, x: cx(id), y: cy(id) }}
                animate={{ opacity: 1, scale: 1, x: cx(id), y: cy(id) }}
                exit={{ opacity: 0, scale: 0.7, transition: { duration: 0.12 } }}
                transition={{ duration: 0.18, ease: 'easeOut', x: { duration: 0 }, y: { duration: 0 } }}
              >
                <div className="-translate-x-1/2 -translate-y-1/2">
                  <button data-interactive onClick={() => onSelect(id)} className="group relative block">
                    <div
                      className={cn(
                        'overflow-hidden rounded-2xl bg-surface-2 transition-all duration-200 group-hover:scale-[1.05]',
                        isCur ? 'ring-2 ring-accent shadow-glow' : 'ring-1 ring-line group-hover:ring-line-strong',
                      )}
                      style={{ width: size, height: size }}
                    >
                      {thumb ? (
                        <img src={thumb} alt={node.label} className="h-full w-full object-cover" draggable={false} />
                      ) : (
                        <div className="h-full w-full animate-pulse bg-surface-3" />
                      )}
                    </div>
                    {isCur ? (
                      <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-white">
                        Current
                      </span>
                    ) : (
                      <span className="absolute -bottom-5 left-1/2 max-w-32 -translate-x-1/2 truncate text-[10px] text-faint opacity-0 transition-opacity group-hover:opacity-100">
                        {node.label}
                      </span>
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        <AnimatePresence>
          {visibleIds.map((id) => {
            const node = nodeMap.get(id);
            if (!node) return null;
            const kids = node.children || [];
            const shown = kids.filter((c) => pos.has(c)).length;
            const hidden = kids.length - shown;
            const isExpanded = expanded.has(id) && kids.length > 1;
            if (!hidden && !isExpanded) return null;
            return (
              <motion.div
                key={`c-${tkey(id)}`}
                className="absolute left-0 top-0"
                initial={{ opacity: 0, x: cx(id), y: cy(id) + half(id) + 16 }}
                animate={{ opacity: 1, x: cx(id), y: cy(id) + half(id) + 16 }}
                exit={{ opacity: 0, transition: { duration: 0.1 } }}
                transition={{ duration: 0.18, ease: 'easeOut', x: { duration: 0 }, y: { duration: 0 } }}
              >
                <button
                  data-interactive
                  onClick={() => toggleExpand(id)}
                  className="-translate-x-1/2 whitespace-nowrap rounded-full border border-line bg-surface-2 px-2.5 py-1 text-[11px] font-medium text-muted shadow-soft transition-colors hover:bg-surface-3 hover:text-ink"
                >
                  {isExpanded ? 'Hide' : `+${hidden} version${hidden === 1 ? '' : 's'}`}
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="absolute bottom-4 right-4 z-10 flex flex-col overflow-hidden rounded-2xl border border-line bg-surface-2 shadow-soft">
        <button data-interactive onClick={() => zoomBy(1.15)} aria-label="Zoom in" className="flex h-10 w-10 items-center justify-center text-muted transition-colors hover:bg-surface-3 hover:text-ink">
          <Plus size={16} />
        </button>
        <button data-interactive onClick={() => zoomBy(0.87)} aria-label="Zoom out" className="flex h-10 w-10 items-center justify-center border-t border-line text-muted transition-colors hover:bg-surface-3 hover:text-ink">
          <Minus size={16} />
        </button>
        <button data-interactive onClick={() => centerOnCurrent(true)} aria-label="Recenter" className="flex h-10 w-10 items-center justify-center border-t border-line text-muted transition-colors hover:bg-surface-3 hover:text-ink">
          <Locate size={16} />
        </button>
      </div>
    </div>
  );
}
