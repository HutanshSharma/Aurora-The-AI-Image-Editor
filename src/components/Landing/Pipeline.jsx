import { useRef } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, useScroll, useTransform } from 'motion/react';
import { Upload, ScanSearch, Wand2, Zap, Sparkles } from 'lucide-react';

const STEPS = [
  { icon: Upload, title: 'Upload your photo', desc: 'Nothing leaves your device.' },
  { icon: ScanSearch, title: 'AI reads the scene', desc: 'Subjects and edges, detected automatically.' },
  { icon: Wand2, title: 'Choose your edits', desc: 'Segment, blend, crop or grade — tap or voice.' },
  { icon: Zap, title: 'Real-time processing', desc: 'Every change renders instantly.' },
  { icon: Sparkles, title: 'Professional result', desc: 'Export, with full history intact.' },
];

const EASE = [0.22, 1, 0.36, 1];

export default function Pipeline() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 75%', 'end 65%'] });
  const fillHeight = useTransform(scrollYProgress, [0, 1], ['0%', '100%']);

  return (
    <div ref={ref} className="relative mx-auto max-w-2xl">
      <div className="absolute bottom-3 left-5 top-3 w-px bg-white/10 sm:left-6" />
      <motion.div
        className="absolute left-5 top-3 w-px rounded-full bg-linear-to-b from-accent via-fuchsia-500 to-violet-500 sm:left-6"
        style={{ height: fillHeight }}
      />

      <div className="space-y-11 sm:space-y-16">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={i}
              className="relative flex gap-5 sm:gap-8"
              initial={{ opacity: 0, x: -18, filter: 'blur(6px)' }}
              whileInView={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
              viewport={{ once: true, margin: '-90px' }}
              transition={{ duration: 0.65, ease: EASE }}
            >
              <span className="relative z-10 flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-line bg-surface-2 text-accent shadow-lg sm:h-13 sm:w-13">
                <Icon size={19} />
              </span>
              <div className="pt-1.5">
                <div className="font-mono text-[12px] tracking-widest text-faint">{String(i + 1).padStart(2, '0')}</div>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl">{s.title}</h3>
                <p className="mt-1.5 max-w-sm text-[15px] leading-relaxed text-muted">{s.desc}</p>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
