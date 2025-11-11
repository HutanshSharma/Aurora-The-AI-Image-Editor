import {LaptopMinimalCheck, Ban, TicketX} from 'lucide-react'
import { useEffect } from 'react';

export default function Toast({id, message, type, removeToast}){
    const getIcon = (type) => {
        switch(type) {
        case 'success':
            return <LaptopMinimalCheck className="text-[rgba(34,197,94,0.7)] text-3xl mx-5" />;
        case 'error':
            return <Ban className="text-[rgba(239,68,68,0.7)] text-3xl mx-5"></Ban>;
        case 'invalid':
            return <TicketX className="fa-solid fa-circle-exclamation text-[rgba(249,115,22,0.7)] text-3xl mx-5"></TicketX>;
        default:
            return null;
        }
    };
    
    const getProgressBarColor = (type) => {
        switch(type) {
            case 'success':
                return ['bg-[rgba(34,197,94,0.8)]','bg-green-200'];
            case 'error':
                return ['bg-[rgba(239,68,68,0.8)]','bg-[rgba(254,202,202,0.8)]'];
            case 'invalid':
                return ['bg-[rgba(249,115,22,0.8)]','bg-[rgba(254,215,170,0.8)]'];
            default:
                return ['bg-[rgba(34,197,94,0.8)]','bg-green-300'];
        }
    };

    useEffect(()=>{
        const timer = setTimeout(()=>{
            removeToast(id)
        },5000)
        return ()=>clearTimeout(timer)
    },[])

    const color = getProgressBarColor(type)

    return (
        <div className={`w-96 h-20 ${color[1]} font-medium shadow-lg rounded-md flex items-center relative animate-slideIn`}>
            {getIcon(type)}
            <span>{message}</span>
            <div className={`absolute rounded-b-md left-0 bottom-0 h-1 w-full ${color[0]} animate-shrink`}></div>
        </div>
    )
} 