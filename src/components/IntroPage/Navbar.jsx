import { useGSAP } from "@gsap/react";
import { useNavigate } from "react-router-dom";
import gsap from "gsap"

export default function Navbar({active,home,features,instructions,about_us}){
    const navigate = useNavigate()

    function handleclick(clickon){
        clickon.current.scrollIntoView({behavior:"smooth"});
    }

    function handlesignin(){
        navigate("/auth")
    }

    useGSAP(()=>{
        gsap.from(".topic",{
            opacity:0,
            y:-20,
            duration:1,
            stagger:0.1
        })
    })

    return(
        <div className="bg-[rgba(13,17,23,0.85)] h-18 w-4/5 lg:w-2/3 mt-5 rounded-full fixed flex top-0 px-10 items-center text-lg border-b-1 border-[rgba(255,255,255,0.1)] z-2 justify-between">
            <div className="flex gap-10 items-center">
            <button onClick={() => handleclick(home)} className={active==="home" ? "text-[#EDEDED] border-b-2 border-[#39d353]":"text-[#A0A0A0] border-b-2 cursor-pointer border-transparent topic"}>Home</button>
            <button onClick={() => handleclick(features)} className={active==="about" ? "text-[#EDEDED] border-b-2 border-[#39d353]":"text-[#A0A0A0] border-b-2 cursor-pointer border-transparent topic"}>Features</button>
            <button onClick={() => handleclick(instructions)} className={active==="education" ? "text-[#EDEDED] border-b-2 border-[#39d353]":"text-[#A0A0A0] cursor-pointer border-b-2 border-transparent topic"}>Instructions</button>
            <button onClick={() => handleclick(about_us)} className={active==="skills" ? "text-[#EDEDED] border-b-2 border-[#39d353]":"text-[#A0A0A0] border-b-2 cursor-pointer border-transparent topic"}>About Us</button>
            </div>
            <div>
                <button onClick={handlesignin} className="text-[#A0A0A0] cursor-pointer topic">SignIn</button>
            </div>
        </div>
    )
}