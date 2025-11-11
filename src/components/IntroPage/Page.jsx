import { useGSAP } from "@gsap/react";
import gsap from "gsap"
import { useNavigate } from "react-router-dom";

export default function Page({ref}){
    const mainclass="bg-black h-screen w-screen"
    const navigate = useNavigate()

    function handlesignin(){
        navigate("/auth")
    }

    useGSAP(() => {
    const tl = gsap.timeline();

    tl.from('.header', {
      x: -100,
      opacity: 0,
      duration: 0.8,
      stagger: 0.2,
    });

    tl.from('.header-btn', {
      opacity: 0,
      duration: 0.2,
    });
  });

    return(
        <div className={`${mainclass} flex flex-col justify-center`} ref={ref} id="home">
            <div className="flex flex-col align-center items-center mx-20 md:mx-40 gap-10">
                <div className="flex flex-col gap-4 text-center">
                    <h1 className="text-4xl sm:text-5xl md:text-6xl bg-gradient-to-b from-[#dc2626] to-[#6d28d9] font-semibold bg-clip-text text-transparent header">Welcome To</h1>
                    <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold text-slate-300 header">The AI Editor</h1>
                    <h2 className="text-xl sm:text-2xl md:text-3xl text-stone-100 header">Adobe Re-Imagining</h2>
                </div>
                <div className="flex flex-col sm:flex-row gap-8 z-1">
                    <button onClick={handlesignin} className="cursor-pointer border-1 text-2xl border-transparent hover:border-[#dc2626] hover:bg-transparent py-2 px-4 rounded-lg hover:text-[#dc2626] bg-[#dc2626] font-semibold text-white header-btn">Let's start editing</button>
                </div>
            </div>
        </div> 
    )
}