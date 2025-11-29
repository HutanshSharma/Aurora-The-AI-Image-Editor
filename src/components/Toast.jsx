import {LaptopMinimalCheck, Ban, TicketX, X} from 'lucide-react'
import { useEffect, useState } from 'react';

export default function Toast({id, message, type, removeToast}){
    const [isVisible, setIsVisible] = useState(true);
    
    const getIcon = (type) => {
        switch(type) {
        case 'success':
            return <LaptopMinimalCheck className="text-green-600 text-lg sm:text-xl shrink-0" />;
        case 'error':
            return <Ban className="text-red-400 text-lg sm:text-xl shrink-0" />;
        case 'invalid':
            return <TicketX className="text-orange-400 text-lg sm:text-xl shrink-0" />;
        default:
            return null;
        }
    };
    
    const getProgressBarColor = (type) => {
        switch(type) {
            case 'success':
                return ['bg-green-600','bg-green-50 border-green-200 border-r-green-600'];
            case 'error':
                return ['bg-red-400','bg-red-50 border-red-200 border-r-red-600'];
            case 'invalid':
                return ['bg-orange-400','bg-orange-50 border-orange-200 border-r-orange-600'];
            default:
                return ['bg-green-600','bg-green-50 border-green-200 border-r-green-600'];
        }
    };

    const handleClose = () => {
        setIsVisible(false);
        setTimeout(() => removeToast(id), 300);
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            handleClose();
        }, 5000);
        
        return () => clearTimeout(timer);
    }, [id]); 

    const color = getProgressBarColor(type);

    return (
        <div className={`
            w-64 sm:w-72 md:w-80 min-h-14 
            ${color[1]}
            font-medium shadow-lg rounded-md 
            flex items-center gap-2 p-2 sm:p-3 relative 
            transition-all duration-300 ease-in-out
            ${isVisible ? 'animate-slideIn opacity-100' : 'opacity-0 translate-x-full'}
        `}>
            {getIcon(type)}
            <span className="flex-1 text-sm sm:text-base text-gray-800 pr-2 leading-tight">{message}</span>
            
            <button 
                onClick={handleClose}
                className="shrink-0 p-1 rounded-full hover:bg-black/10 transition-colors"
                aria-label="Close notification"
            >
                <X className="w-4 h-4 text-gray-600" />
            </button>
            
            <div className={`absolute rounded-b-md left-0 bottom-0 h-1 w-full ${color[0]} animate-shrink`}></div>
        </div>
    )
} 