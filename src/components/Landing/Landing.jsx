import { useNavigate } from 'react-router-dom';
// eslint-disable-next-line no-unused-vars
import { motion } from 'motion/react';
import {
  Sparkles, Scissors, Eraser, Blend, Crop, Palette, Mic, History,
  Layers, Wand2, Image as ImageIcon, SlidersHorizontal, ArrowRight, ArrowUpRight,
} from 'lucide-react';
import Beams from '../Auth/UI/Beams';
import EditorPreview from './EditorPreview';
import BeforeAfter from './BeforeAfter';
import Pipeline from './Pipeline';
import ShowcaseStack from './ShowcaseStack';

const ACCENT = 'rgb(239,68,68)';
const EASE = [0.22, 1, 0.36, 1];

function Reveal({ children, className = '', delay = 0, y = 26 }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y, filter: 'blur(8px)' }}
      whileInView={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      viewport={{ once: true, margin: '-90px' }}
      transition={{ duration: 0.75, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}

function Eyebrow({ children }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.2em] text-accent">
      <span className="h-px w-6 bg-accent/60" />
      {children}
    </span>
  );
}

const CAPABILITIES = [
  { icon: Scissors, title: 'AI Segmentation', desc: 'Isolate any subject with a single tap.' },
  { icon: Eraser, title: 'Lasso Eraser', desc: 'Loop to remove, with feathered edges.' },
  { icon: Blend, title: 'Auto Edge-Blend', desc: 'Cutouts merge in — never pasted-on.' },
  { icon: Crop, title: 'Precision Crop', desc: 'WYSIWYG framing, fully undoable.' },
  { icon: Wand2, title: 'Predictive Grading', desc: 'AI optimizes between your variations.' },
  { icon: Palette, title: 'Adaptive LUTs', desc: 'One-tap, image-aware color grade.' },
  { icon: Mic, title: 'Voice Commands', desc: 'Edit by speaking — Chrome & Firefox.' },
  { icon: ImageIcon, title: 'Background Swap', desc: 'Drop in a color or a fresh image.' },
  { icon: SlidersHorizontal, title: 'Full Adjustments', desc: 'Light, color, blur, sharpen, geometry.' },
  { icon: Layers, title: 'Segment Editor', desc: 'Edit objects, then composite back.' },
  { icon: History, title: 'Branching History', desc: 'A complete, lossless undo tree.' },
  { icon: Sparkles, title: 'Filter Library', desc: 'Curated cinematic one-tap looks.' },
];

export default function Landing() {
  const navigate = useNavigate();
  const loggedIn = typeof window !== 'undefined' && !!localStorage.getItem('refresh_token');
  const goEditor = () => navigate('/editor');
  const goAuth = (mode) => navigate('/auth', { state: { mode } });
  const getStarted = () => (loggedIn ? goEditor() : goAuth('signup'));
  const scrollToId = (id) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  return (
    <div className="relative w-full overflow-x-hidden bg-background text-ink antialiased">
      <section className="relative isolate flex min-h-screen flex-col overflow-hidden">
        <div className="absolute inset-0 -z-10 opacity-90">
          <Beams beamWidth={2} beamHeight={15} beamNumber={48} lightColor={ACCENT} speed={2.4} noiseIntensity={1.6} scale={0.2} rotation={22} />
        </div>
        <div className="pointer-events-none absolute inset-0 -z-10 bg-linear-to-b from-background/30 via-background/55 to-background" />

        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <img src="/logo_nav.png" alt="Aurora" className="h-9 w-9 object-contain" />
            <span className="text-lg font-semibold tracking-tight">Aurora</span>
          </div>
          {loggedIn ? (
            <button
              onClick={goEditor}
              className="flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-[14px] font-semibold text-white transition-colors hover:bg-accent-hover"
            >
              Open editor <ArrowUpRight size={15} />
            </button>
          ) : (
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={() => goAuth('login')}
                className="rounded-full px-3.5 py-2 text-[14px] font-semibold text-ink transition-colors hover:text-accent"
              >
                Log in
              </button>
              <button
                onClick={() => goAuth('signup')}
                className="flex h-10 items-center rounded-full bg-accent px-4 text-[14px] font-semibold text-white transition-colors hover:bg-accent-hover"
              >
                Sign up
              </button>
            </div>
          )}
        </header>

        <div className="mx-auto grid w-full max-w-6xl flex-1 grid-cols-1 items-center gap-12 px-5 py-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-8 lg:py-0">
          <div className="text-center lg:text-left">
            <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-[12px] font-medium text-muted backdrop-blur-md">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-accent" />
                </span>
                AI photo editing · 100% in your browser
              </span>
            </motion.div>

            <motion.h1
              className="mt-5 text-[3.75rem] font-semibold tracking-tight sm:text-8xl lg:text-[7rem] lg:leading-[0.92]"
              initial={{ opacity: 0, y: 22, filter: 'blur(10px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              transition={{ duration: 0.9, ease: EASE, delay: 0.08 }}
            >
              <span
                className="bg-linear-to-br from-white via-rose-100 to-rose-300 bg-clip-text text-transparent"
                style={{ WebkitTextFillColor: 'transparent' }}
              >
                Aurora
              </span>
            </motion.h1>

            <motion.p
              className="mx-auto mt-6 max-w-md text-[16px] leading-relaxed text-muted text-pretty sm:text-[17px] lg:mx-0"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.22 }}
            >
              Studio-grade photo editing,{' '}
              <button
                type="button"
                onClick={() => scrollToId('showcase')}
                className="font-semibold text-accent underline-offset-4 transition-colors hover:text-accent-hover hover:underline"
              >
                powered by AI
              </button>
              . Cut out, blend, and color-grade like a pro — right in your browser.
            </motion.p>

            <motion.div
              className="mt-9 flex flex-col items-center gap-3 sm:flex-row lg:justify-start justify-center"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: EASE, delay: 0.34 }}
            >
              <button
                onClick={loggedIn ? goEditor : () => goAuth('signup')}
                className="group flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-7 text-[15px] font-semibold text-white shadow-glow transition-all hover:bg-accent-hover hover:shadow-[0_0_40px_-6px_rgba(239,68,68,0.6)] sm:w-auto"
              >
                {loggedIn ? 'Open editor' : 'Get started — free'}
                <ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <a
                href="#showcase"
                onClick={(e) => { e.preventDefault(); scrollToId('showcase'); }}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-7 text-[15px] font-semibold text-ink backdrop-blur-md transition-colors hover:bg-white/10 sm:w-auto"
              >
                See it in action
              </a>
            </motion.div>
          </div>

          {/* hero preview */}
          <div className="flex justify-center lg:justify-end">
            <EditorPreview />
          </div>
        </div>
      </section>

      <section id="showcase" className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <Reveal>
            <Eyebrow>See the difference</Eyebrow>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
              Flat photos become finished frames.
            </h2>
            <p className="mt-5 max-w-sm text-[16px] leading-relaxed text-muted">
              Aurora grades each image intelligently. Drag to compare.
            </p>
            <button onClick={getStarted} className="mt-7 inline-flex items-center gap-2 text-[15px] font-semibold text-accent transition-colors hover:text-accent-hover">
              Try it yourself <ArrowRight size={16} />
            </button>
          </Reveal>

          <Reveal delay={0.1}>
            <BeforeAfter />
          </Reveal>
        </div>
      </section>

      <section className="relative overflow-hidden py-24 sm:py-32">
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-160 w-160 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/10 blur-[120px]" />
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-14 px-5 sm:px-8 lg:grid-cols-2 lg:gap-16">
          <Reveal className="order-2 lg:order-1">
            <ShowcaseStack />
          </Reveal>
          <Reveal delay={0.1} className="order-1 lg:order-2">
            <Eyebrow>One canvas, every tool</Eyebrow>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
              A whole studio in a single tap.
            </h2>
            <p className="mt-5 max-w-sm text-[16px] leading-relaxed text-muted">
              Segment, erase, blend, crop and grade — all on one canvas.
            </p>
          </Reveal>
        </div>
      </section>

      <section className="relative mx-auto max-w-6xl px-5 py-24 sm:px-8 sm:py-32">
        <Reveal className="mb-16 text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mx-auto mt-5 max-w-2xl text-3xl font-semibold tracking-tight text-balance sm:text-4xl lg:text-[2.75rem] lg:leading-[1.1]">
            From a raw photo to a finished result.
          </h2>
        </Reveal>
        <Pipeline />
      </section>

      <section className="relative border-t border-white/5 py-24 sm:py-32">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal className="mb-14 max-w-2xl">
            <Eyebrow>Everything inside</Eyebrow>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
              Built for serious edits.
            </h2>
          </Reveal>

          <div className="grid grid-cols-1 gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map(({ icon: Icon, title }, i) => (
              <Reveal key={title} delay={(i % 3) * 0.05}>
                <div className="group flex items-center gap-3.5">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-accent/10 text-accent transition-all duration-300 group-hover:bg-accent group-hover:text-white">
                    <Icon size={20} />
                  </span>
                  <h3 className="text-[15px] font-semibold text-ink">{title}</h3>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="relative overflow-hidden px-5 py-28 text-center sm:px-8 sm:py-36">
        <div className="pointer-events-none absolute left-1/2 top-1/2 -z-10 h-136 w-136 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/15 blur-[130px]" />
        <Reveal>
          <h2 className="mx-auto max-w-3xl text-4xl font-semibold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Your studio is one click away.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-[16px] leading-relaxed text-muted">
            Start editing in seconds — nothing leaves your browser.
          </p>
          <div className="mt-10 flex justify-center">
            <button
              onClick={loggedIn ? goEditor : () => goAuth('signup')}
              className="group flex h-13 items-center justify-center gap-2 rounded-full bg-accent px-9 text-[16px] font-semibold text-white shadow-glow transition-all hover:bg-accent-hover hover:shadow-[0_0_44px_-6px_rgba(239,68,68,0.65)]"
            >
              {loggedIn ? 'Open editor' : 'Get started — free'}
              <ArrowRight size={18} className="transition-transform group-hover:translate-x-0.5" />
            </button>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-white/5 px-5 py-9 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-center sm:flex-row sm:text-left">
          <div className="flex items-center gap-2.5 text-muted">
            <img src="/logo_nav.png" alt="Aurora" className="h-7 w-7 object-contain" />
            <span className="text-[13px]">© 2026 Aurora. All rights reserved.</span>
          </div>
          <span className="text-[12px] text-faint">
            Animations powered by{' '}
            <a href="https://reactbits.dev" target="_blank" rel="noreferrer" className="text-muted underline-offset-2 transition-colors hover:text-ink hover:underline">
              React Bits
            </a>
          </span>
        </div>
      </footer>
    </div>
  );
}
