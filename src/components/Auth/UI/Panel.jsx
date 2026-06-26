import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { useRef } from "react";
import { Sparkles, Wand2, Layers } from "lucide-react";

const features = [
  { icon: Wand2, label: "Smart one-tap editing" },
  { icon: Layers, label: "Cut out & restyle any object" },
  { icon: Sparkles, label: "Cinematic color grading" },
];

export default function Panel() {
  const info = useRef(null);

  useGSAP(() => {
    gsap.from(info.current.querySelectorAll(".box"), {
      y: 24,
      opacity: 0,
      duration: 0.6,
      stagger: 0.12,
      ease: "power2.out",
    });
  });

  return (
    <div ref={info} className="relative w-full max-w-md">
      <div className="box inline-flex items-center gap-2 rounded-full border border-line bg-white/5 px-3 py-1.5 text-[12px] font-medium text-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-glow" />
        AI Image Editor
      </div>

      <h1 className="box mt-6 bg-linear-to-br from-white via-white to-accent/70 bg-clip-text text-6xl font-bold leading-[1.05] tracking-tight text-transparent md:text-7xl">
        Aurora
      </h1>

      <p className="box mt-4 max-w-sm text-lg font-light text-muted">
        Studio-grade edits, right from your phone. Cut, restyle, and grade your
        photos in a few taps.
      </p>

      <div className="box mt-6 h-px w-24 bg-linear-to-r from-accent to-transparent" />

      <ul className="mt-8 space-y-3">
        {features.map(({ icon: Icon, label }) => (
          <li key={label} className="box flex items-center gap-3 text-sm text-ink/90">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-accent">
              <Icon size={17} />
            </span>
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}
