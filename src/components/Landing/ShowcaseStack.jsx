import { useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { AnimatePresence, motion } from 'motion/react';
import { Scissors, Eraser, Blend, Crop, Palette } from 'lucide-react';
import MeshImage from './MeshImage';

const CARDS = [
  { id: 'seg', label: 'AI Segmentation', icon: Scissors, variant: 'aurora', img: '/showcase/segment.png', desc: 'Tap once — the subject is isolated.' },
  { id: 'erase', label: 'Lasso Eraser', icon: Eraser, variant: 'teal', img: '/showcase/erase.png', desc: 'Loop around stray bits to remove them.' },
  { id: 'blend', label: 'Auto Edge-Blend', icon: Blend, variant: 'sunset', img: '/showcase/blend.png', desc: 'Cutouts melt into the new background.' },
  { id: 'crop', label: 'Precision Crop', icon: Crop, variant: 'rose', img: '/showcase/crop.png', desc: 'WYSIWYG framing, fully undoable.' },
  { id: 'color', label: 'AI Color Grade', icon: Palette, variant: 'aurora', img: '/showcase/color.png', desc: 'Adaptive 3D LUTs in a single tap.' },
];

const VISIBLE = 3;
const N = CARDS.length;
const SPRING = { type: 'spring', stiffness: 320, damping: 30, mass: 0.8 };

const SCALE_PER = 0.055;
const Y_PER = 20;
const X_PER = 16;
const BLUR_PER = 0.7; 

const slot = (k) => ({
  scale: 1 - k * SCALE_PER,
  y: -k * Y_PER,
  x: k * X_PER,
  filter: `blur(${k * BLUR_PER}px)`,
  boxShadow: k === 0 ? '0 40px 80px -24px rgba(0,0,0,0.7)' : '0 22px 46px -26px rgba(0,0,0,0.5)',
  opacity: 1,
});

export default function ShowcaseStack() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return undefined;
    const t = setInterval(() => setActive((a) => (a + 1) % N), 2800);
    return () => clearInterval(t);
  }, [paused]);

  const visible = Array.from({ length: VISIBLE }, (_, k) => ({ card: CARDS[(active + k) % N], k }));

  return (
    <div className="relative w-full" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
      <div className="relative mx-auto aspect-4/3 w-full max-w-md" style={{ perspective: 1300 }}>
        <AnimatePresence mode="popLayout">
          {visible.map(({ card, k }) => {
            const Icon = card.icon;
            return (
              <motion.div
                key={card.id}
                className="absolute inset-0 origin-bottom will-change-transform"
                style={{ zIndex: VISIBLE - k }}
                initial={{ scale: 1 - VISIBLE * SCALE_PER, y: -VISIBLE * Y_PER, x: VISIBLE * X_PER, filter: `blur(${VISIBLE * BLUR_PER}px)`, opacity: 0 }}
                animate={slot(k)}
                exit={{ y: 72, scale: 0.95, opacity: 0, filter: 'blur(4px)' }}
                transition={SPRING}
              >
                <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-white/10 bg-surface-2">
                  <div className="flex items-center gap-2 px-4 py-3">
                    <span className="flex gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                      <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                      <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
                    </span>
                    <span className="ml-1 flex items-center gap-1.5 text-[12px] font-medium text-muted">
                      <Icon size={13} className="text-accent" /> {card.label}
                    </span>
                  </div>
                  <div className="relative flex-1">
                    <MeshImage variant={card.variant} className="absolute inset-0" />
                    {card.img && (
                      <img
                        src={card.img}
                        alt={card.label}
                        draggable={false}
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                      />
                    )}
                    <div className="absolute bottom-3.5 left-3.5 right-3.5 flex items-center gap-2 rounded-2xl bg-black/50 px-3.5 py-2.5 backdrop-blur-md">
                      <Icon size={15} className="shrink-0 text-accent" />
                      <span className="text-[13px] font-medium text-white">{card.desc}</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="mt-7 flex justify-center gap-2">
        {CARDS.map((c, i) => (
          <button
            key={c.id}
            onClick={() => setActive(i)}
            aria-label={c.label}
            className={`h-1.5 rounded-full transition-all duration-300 ${i === active ? 'w-7 bg-accent' : 'w-1.5 bg-white/20 hover:bg-white/40'}`}
          />
        ))}
      </div>
    </div>
  );
}
