import Navbar from "./Navbar"
import MobileNavbar from "./MobileNavbar"
import Page from "./Page"
import Plasma from "./Plasma"
import { useEffect, useState } from "react"

export default function IntroPage(){
    const [ width, setwidth] = useState(window.innerWidth)
    useEffect(()=>{
        function handleResize(){
            setwidth(window.innerWidth)
        }
        window.addEventListener("resize",handleResize)
        return ()=>window.removeEventListener("resize", handleResize)
    },[])
    return (
        <div className='relative sm:min-h-screen sm:flex sm:items-center sm:justify-center'>
            {width >780 && <Navbar home={null} about={null} education={null} skills={null} projects={null} contact={null} active={null}/>}
            {width <=780 && <MobileNavbar home={null} about={null} education={null} skills={null} projects={null} contact={null} active={null}/>}
            <div className="absolute inset-0 overflow-hidden">
            <Plasma 
                color="#EF4444"
                speed={0.6}
                direction="forward"
                scale={width> 780 ? 1.1:0.7}
                opacity={0.5}
                mouseInteractive={false}
            />
            </div>
            <Page ref={null} projects={null} contact={null}/>
        </div>
    )
}