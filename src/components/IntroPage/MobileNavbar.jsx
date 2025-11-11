import { useEffect, useState } from "react";
import { Sidebar } from "lucide-react";

export default function MobileNavbar({active,home,about,education,skills,projects,contact}){
    const [hamclick,sethamclick] = useState(false)

    function handleclick(clickon){
        clickon.current.scrollIntoView({behavior:"smooth"});
    }

    function handlehamclick(){
        sethamclick(val=>!val)
    }

    let current_class="z-2 fixed flex top-0 items-center ease-in-out duration-400 justify-center h-screen w-48 bg-[rgba(13,17,23,0.85)]"
    if(hamclick){
        current_class+=" right-0"
    }
    else{
        current_class+=" -right-48"
    }

    useEffect(()=>{
        function handler(e){
            if(e.target.id!="sidebar"){
            sethamclick(false)
            }
        }
        window.addEventListener("click",handler)
        return ()=>{window.removeEventListener("click",handler)}
    },[])
    
    return(
        <>
        <div className="bg-[rgba(13,17,23,0.85)] h-18 w-full fixed top-0 flex justify-between px-10 items-center text-lg border-b-1 border-[rgba(255,255,255,0.1)] z-3">
            <button onClick={handlehamclick}><Sidebar/></button>
        </div>
        <div className={current_class} id="sidebar">
            <div className="flex flex-col gap-10" id="sidebar">
                <button onClick={() => handleclick(home)} id="sidebar" className={active==="home" ? "text-[#EDEDED] border-b-2 border-[#39d353]":"text-[#A0A0A0] border-b-2 border-transparent"}>Home</button>
                <button onClick={() => handleclick(about)} id="sidebar" className={active==="about" ? "text-[#EDEDED] border-b-2 border-[#39d353]":"text-[#A0A0A0] border-b-2 border-transparent"}>About</button>
                <button onClick={() => handleclick(education)} id="sidebar" className={active==="education" ? "text-[#EDEDED] border-b-2 border-[#39d353]":"text-[#A0A0A0] border-b-2 border-transparent"}>Education</button>
                <button onClick={() => handleclick(skills)} id="sidebar" className={active==="skills" ? "text-[#EDEDED] border-b-2 border-[#39d353]":"text-[#A0A0A0] border-b-2 border-transparent"}>Skills</button>
                <button onClick={() => handleclick(projects)} id="sidebar" className={active==="projects" ? "text-[#EDEDED] border-b-2 border-[#39d353]":"text-[#A0A0A0] border-b-2 border-transparent"}>Projects</button>
                <button onClick={() => handleclick(contact)} id="sidebar" className={active==="contact" ? "text-[#EDEDED] border-b-2 border-[#39d353]":"text-[#A0A0A0] border-b-2 border-transparent"}>Contact</button>
            </div>
        </div>
        </>
    )
}