import { useState, useRef, useEffect, useMemo } from 'react';
import { Check, X, Crop as CropIcon } from 'lucide-react';

const MIN = 28; 
const HANDLES = ['nw', 'n', 'ne', 'w', 'e', 'sw', 's', 'se'];

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export default function CropOverlay({ source, onConfirm, onCancel }) {
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [crop, setCrop] = useState(null);

  const srcW = source.naturalWidth || source.width;
  const srcH = source.naturalHeight || source.height;
  const srcUrl = useMemo(
    () => (source.toDataURL ? source.toDataURL('image/png') : source.src),
    [source],
  );

  const bounds = useMemo(() => {
    if (!size.w || !size.h) return null;
    const scale = Math.min(size.w / srcW, size.h / srcH);
    const dispW = srcW * scale;
    const dispH = srcH * scale;
    const l = (size.w - dispW) / 2;
    const t = (size.h - dispH) / 2;
    return { l, t, r: l + dispW, b: t + dispH, scale };
  }, [size, srcW, srcH]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (bounds && !crop) {
      setCrop({ l: bounds.l, t: bounds.t, r: bounds.r, b: bounds.b });
    }
  }, [bounds, crop]);

  const onPointerDown = (e, mode) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, start: { ...crop } };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const onPointerMove = (e) => {
    const d = dragRef.current;
    if (!d || !bounds) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    let { l, t, r, b } = d.start;

    if (d.mode === 'body') {
      const w = r - l;
      const h = b - t;
      l = clamp(l + dx, bounds.l, bounds.r - w);
      t = clamp(t + dy, bounds.t, bounds.b - h);
      r = l + w;
      b = t + h;
    } else {
      if (d.mode.includes('w')) l = clamp(l + dx, bounds.l, r - MIN);
      if (d.mode.includes('e')) r = clamp(r + dx, l + MIN, bounds.r);
      if (d.mode.includes('n')) t = clamp(t + dy, bounds.t, b - MIN);
      if (d.mode.includes('s')) b = clamp(b + dy, t + MIN, bounds.b);
    }
    setCrop({ l, t, r, b });
  };

  const onPointerUp = () => {
    dragRef.current = null;
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  };

  const confirm = () => {
    if (!crop || !bounds) return;
    const { scale } = bounds;
    const x = (crop.l - bounds.l) / scale;
    const y = (crop.t - bounds.t) / scale;
    const w = (crop.r - crop.l) / scale;
    const h = (crop.b - crop.t) / scale;
    onConfirm(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  };

  const handleStyle = (mode) => {
    if (!crop) return {};
    const w = crop.r - crop.l;
    const h = crop.b - crop.t;
    const x = mode.includes('w') ? 0 : mode.includes('e') ? w : w / 2;
    const y = mode.includes('n') ? 0 : mode.includes('s') ? h : h / 2;
    const cursor =
      mode === 'n' || mode === 's' ? 'ns-resize'
        : mode === 'e' || mode === 'w' ? 'ew-resize'
          : mode === 'nw' || mode === 'se' ? 'nwse-resize'
            : 'nesw-resize';
    return { left: x, top: y, transform: 'translate(-50%, -50%)', cursor };
  };

  return (
    <div className="fixed inset-0 z-60 flex flex-col bg-black">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <button
          onClick={onCancel}
          className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface-2 px-4 text-[14px] font-medium text-ink transition-colors hover:bg-surface-3"
        >
          <X size={16} /> Cancel
        </button>
        <span className="flex items-center gap-2 text-[15px] font-semibold text-ink">
          <CropIcon size={16} className="text-accent" /> Crop
        </span>
        <button
          onClick={confirm}
          className="flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-semibold text-white transition-colors hover:bg-accent-hover"
        >
          <Check size={16} /> Apply
        </button>
      </div>

      <div ref={containerRef} className="relative min-h-0 flex-1 touch-none overflow-hidden">
        {bounds && (
          <img
            src={srcUrl}
            alt="crop source"
            draggable={false}
            className="pointer-events-none absolute select-none"
            style={{ left: bounds.l, top: bounds.t, width: bounds.r - bounds.l, height: bounds.b - bounds.t }}
          />
        )}

        {crop && (
          <div
            className="absolute cursor-move border border-white/90"
            style={{
              left: crop.l,
              top: crop.t,
              width: crop.r - crop.l,
              height: crop.b - crop.t,
              boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
            }}
            onPointerDown={(e) => onPointerDown(e, 'body')}
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/3 top-0 h-full w-px bg-white/30" />
              <div className="absolute left-2/3 top-0 h-full w-px bg-white/30" />
              <div className="absolute left-0 top-1/3 h-px w-full bg-white/30" />
              <div className="absolute left-0 top-2/3 h-px w-full bg-white/30" />
            </div>

            {HANDLES.map((mode) => (
              <div
                key={mode}
                onPointerDown={(e) => onPointerDown(e, mode)}
                className="absolute h-5 w-5 rounded-full border-2 border-accent bg-white shadow"
                style={handleStyle(mode)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
