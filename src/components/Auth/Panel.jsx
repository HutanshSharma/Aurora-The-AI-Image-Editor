import gsap from "gsap";
import { useGSAP } from "@gsap/react"
import { useRef } from "react";

export default function Panel() {
  const info = useRef()

  useGSAP(()=>{
    gsap.from(info.current.querySelectorAll(".box"), {
      x: -100,
      opacity: 0,
      duration: 0.6,
      stagger: 0.3,
      ease: "power2.out",
    });
  })

  return (
    <div className="md:hidden flex items-center justify-center p-8 relative overflow-hidden">
      <div className="relative z-10 max-w-5xl w-full">
        <div className="bg-[rgba(0,0,0,0.7)] backdrop-blur-xl rounded-none border-l-4 border-red-600 shadow-2xl p-8" ref={info}>
            <h1 className="text-3xl md:text-8xl font-bold mb-8 text-white leading-[1.1] tracking-tight box">
            Adobe Re-Imagining
            <br />
            <span className="bg-gradient-to-r from-red-400 to-red-600 bg-clip-text text-transparent box">
            Photoshop
            </span>
            </h1>

            <h2 className="text-2xl md:text-5xl font-light text-red-300/90 box">
              The AI Editor
            </h2>
          
          <div className="mt-8 w-24 h-1 bg-gradient-to-r from-red-500 to-transparent" />
        </div>
      </div>
    </div>
  );
}