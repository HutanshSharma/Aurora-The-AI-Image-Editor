// eslint-disable-next-line no-unused-vars
import { motion } from 'motion/react';
import { Scissors, Blend, Palette, SlidersHorizontal, Crop, Mic, Wand2 } from 'lucide-react';

const EASE = [0.22, 1, 0.36, 1];

const HERO = '/showcase/hero.jpg';

function Chip({ icon: Icon, label, className, delay = 0 }) {
  return (
    <motion.div
      className={`absolute z-30 flex items-center gap-1.5 rounded-full border border-white/15 bg-black/55 px-3 py-1.5 text-[12px] font-medium text-white shadow-xl backdrop-blur-md ${className}`}
      initial={{ opacity: 0, scale: 0.82, y: 8 }}
      whileInView={{ opacity: 1, scale: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay, duration: 0.6, ease: EASE }}
    >
      <Icon size={13} className="text-accent" />
      {label}
    </motion.div>
  );
}

const TOOLS = [SlidersHorizontal, Palette, Crop, Scissors, Mic];

export default function EditorPreview() {
  return (
    <motion.div
      className="relative w-full max-w-[460px]"
      initial={{ opacity: 0, y: 28, rotateX: 8 }}
      animate={{ opacity: 1, y: 0, rotateX: 0 }}
      transition={{ duration: 1, ease: EASE, delay: 0.15 }}
      style={{ perspective: 1200 }}
    >
      <div className="absolute -inset-6 -z-10 rounded-[3rem] bg-accent/20 blur-3xl" />

      <div className="overflow-hidden rounded-3xl border border-white/10 bg-surface-2/80 shadow-2xl backdrop-blur-xl">

        <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="flex gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
            </span>
            <span className="ml-1.5 text-[12px] font-medium text-muted">Aurora · editor</span>
          </div>
          <span className="flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-[11px] font-semibold text-accent">
            <Wand2 size={11} /> AI
          </span>
        </div>

        <div className="relative aspect-4/3 bg-surface-3">
          <img src={HERO} alt="Aurora editor preview" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        </div>

        <div className="flex items-center justify-center gap-5 border-t border-white/5 px-4 py-3.5">
          {TOOLS.map((Icon, i) => (
            <span
              key={i}
              className={`flex h-8 w-8 items-center justify-center rounded-full ${i === 3 ? 'bg-accent text-white' : 'text-muted'}`}
            >
              <Icon size={17} />
            </span>
          ))}
        </div>
      </div>

      <Chip icon={Scissors} label="Subject isolated" className="-left-5 top-16 sm:-left-8" delay={0.4} />
      <Chip icon={Blend} label="Edges blended" className="-right-4 top-28 sm:-right-7" delay={0.6} />
      <Chip icon={Palette} label="AI color grade" className="-left-3 bottom-24 sm:-left-6" delay={0.8} />
    </motion.div>
  );
}
