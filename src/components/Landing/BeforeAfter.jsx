import { useRef, useState, useCallback } from 'react';
import { MoveHorizontal } from 'lucide-react';

const BEFORE = '/showcase/before.jpg';
const AFTER = '/showcase/after.png';

export default function BeforeAfter() {
  const ref = useRef(null);
  const dragging = useRef(false);
  const [pos, setPos] = useState(52);

  const setFromX = useCallback((clientX) => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.max(2, Math.min(98, ((clientX - r.left) / r.width) * 100)));
  }, []);

  return (
    <div
      ref={ref}
      className="group relative aspect-4/3 w-full cursor-ew-resize touch-none select-none overflow-hidden rounded-3xl border border-white/10 bg-surface-2 shadow-2xl sm:aspect-16/10"
      onPointerDown={(e) => {
        dragging.current = true;
        e.currentTarget.setPointerCapture(e.pointerId);
        setFromX(e.clientX);
      }}
      onPointerMove={(e) => dragging.current && setFromX(e.clientX)}
      onPointerUp={() => (dragging.current = false)}
      onPointerCancel={() => (dragging.current = false)}
    >
      <img src={AFTER} alt="After — AI color graded" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
      <span className="absolute right-4 top-4 z-20 rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-md">
        After · AI graded
      </span>


      <div className="absolute inset-0 z-10" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
        <img src={BEFORE} alt="Before — original" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        <span className="absolute left-4 top-4 rounded-full bg-black/45 px-3 py-1 text-[11px] font-semibold text-white/90 backdrop-blur-md">
          Before
        </span>
      </div>

      <div className="absolute inset-y-0 z-20" style={{ left: `${pos}%` }}>
        <div className="absolute inset-y-0 -ml-px w-0.5 bg-white/85 shadow-[0_0_12px_rgba(255,255,255,0.4)]" />
        <div className="absolute top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white text-neutral-900 shadow-xl transition-transform group-active:scale-95">
          <MoveHorizontal size={18} />
        </div>
      </div>
    </div>
  );
}
