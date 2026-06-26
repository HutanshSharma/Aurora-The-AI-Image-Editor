import { Sun, Contrast, Droplet, Sparkles, RotateCw, RotateCcw, ImageIcon, Palette, Check, Minus, Plus } from "lucide-react";
import { useRef, useState } from "react";
// eslint-disable-next-line no-unused-vars
import { animate, motion, useMotionValue, useMotionValueEvent, useTransform } from 'motion/react';

const MAX_OVERFLOW = 24;

class Command {
  constructor(doFn, undoFn) {
    this.do = doFn;
    this.undo = undoFn;
  }
}

export default function EditSlider({selectedEditOption, editorState, execute, setSelectedEditOption, embedded = false, onClose}){
    const [, setIsDragging] = useState(false);
    const startValueRef = useRef(null);
    const sliderRef = useRef(null);
    const [region, setRegion] = useState('middle');
    const clientX = useMotionValue(0);
    const overflow = useMotionValue(0);
    const scale = useMotionValue(1);

    const getValue = () => {
        if (selectedEditOption === 'brightness') return editorState.brightness;
        if (selectedEditOption === 'contrast') return editorState.contrast;
        if (selectedEditOption === 'saturation') return editorState.saturation;
        if (selectedEditOption === 'blur') return editorState.blur;
        if (selectedEditOption === 'rotation') return editorState.rotation;
        if (selectedEditOption === 'opacity') return editorState.opacity;
        if (selectedEditOption === 'sharpen') return editorState.sharpen;
        if (selectedEditOption === 'hue') return editorState.hue;
        return 0;
    };

    const getMinMax = () => {
        if (selectedEditOption === 'blur') return { min: 0, max: 20 };
        if (selectedEditOption === 'opacity') return { min: 0, max: 100 };
        if (selectedEditOption === 'sharpen') return { min: 0, max: 100 };
        if (selectedEditOption === 'rotation' || selectedEditOption === 'hue') return { min: 0, max: 360 };
        return { min: 0, max: 200 };
    };

    const getIcon = () => {
        const iconProps = { size: 18, className: "text-current" };
        if (selectedEditOption === 'brightness') return <Sun {...iconProps} />;
        if (selectedEditOption === 'contrast') return <Contrast {...iconProps} />;
        if (selectedEditOption === 'saturation') return <Droplet {...iconProps} />;
        if (selectedEditOption === 'blur') return <Sparkles {...iconProps} />;
        if (selectedEditOption === 'rotation') return <RotateCw {...iconProps} />;
        if (selectedEditOption === 'opacity') return <ImageIcon {...iconProps} />;
        if (selectedEditOption === 'sharpen') return <Sparkles {...iconProps} />;
        if (selectedEditOption === 'hue') return <Palette {...iconProps} />;
        return null;
    };

    const getColor = () => {
        if (selectedEditOption === 'brightness') return '#facc15';
        if (selectedEditOption === 'contrast') return '#3b82f6';
        if (selectedEditOption === 'saturation') return '#a855f7';
        if (selectedEditOption === 'blur') return '#ec4899';
        if (selectedEditOption === 'rotation') return '#10b981';
        if (selectedEditOption === 'opacity') return '#6366f1';
        if (selectedEditOption === 'sharpen') return '#06b6d4';
        if (selectedEditOption === 'hue') return '#f97316';
        return '#fff';
    };

    const getUnit = () => {
        if (selectedEditOption === 'blur') return 'px';
        if (selectedEditOption === 'rotation' || selectedEditOption === 'hue') return '°';
        if (selectedEditOption === 'sharpen') return '';
        return '%';
    };

    useMotionValueEvent(clientX, 'change', latest => {
        if (sliderRef.current) {
            const { left, right } = sliderRef.current.getBoundingClientRect();
            let newValue;

            if (latest < left) {
                setRegion('left');
                newValue = left - latest;
            } else if (latest > right) {
                setRegion('right');
                newValue = latest - right;
            } else {
                setRegion('middle');
                newValue = 0;
            }

            overflow.jump(decay(newValue, MAX_OVERFLOW));
        }
    });

    const handleSliderStart = () => {
        setIsDragging(true);
        startValueRef.current = getValue();
    };

    const handleSliderEnd = () => {
        const finalValue = getValue();
        const startValue = startValueRef.current;        
        
        setIsDragging(false);
        
        if (startValue !== null && Math.abs(startValue - finalValue) > 1) {            
            execute(new Command(
                (s) => {
                    const newState = { ...s, [selectedEditOption]: finalValue };
                    return newState;
                },
                (s) => {
                    const undoState = { ...s, [selectedEditOption]: startValue };
                    return undoState;
                }
            ), false, startValue, finalValue);
        }        
        startValueRef.current = null;
        
        animate(overflow, 0, { type: 'spring', bounce: 0.5 });
    };
    
    const handleChange = (value) => {
        execute(new Command(
            (s) => ({ ...s, [selectedEditOption]: value }),
            (s) => s
        ), true);
    };

    const getDefault = () =>
        ['brightness', 'contrast', 'saturation', 'opacity'].includes(selectedEditOption) ? 100 : 0;

    const handleReset = () => {
        const def = getDefault();
        const cur = getValue();
        if (cur === def) return;
        execute(new Command(
            (s) => ({ ...s, [selectedEditOption]: def }),
            (s) => ({ ...s, [selectedEditOption]: cur })
        ), false, cur, def);
    };

    const handlePointerMove = (e) => {
        if (e.buttons > 0 && sliderRef.current) {
            const { min, max } = getMinMax();
            const { left, width } = sliderRef.current.getBoundingClientRect();
            let newValue = min + ((e.clientX - left) / width) * (max - min);
            
            newValue = Math.min(Math.max(Math.round(newValue), min), max);
            handleChange(newValue);
            clientX.jump(e.clientX);
        }
    };

    const handlePointerDown = (e) => {
        handleSliderStart();
        handlePointerMove(e);
        e.currentTarget.setPointerCapture(e.pointerId);
    };

    const handlePointerUp = () => {
        handleSliderEnd();
    };

    const getRangePercentage = () => {
        const { min, max } = getMinMax();
        const totalRange = max - min;
        if (totalRange === 0) return 0;
        return ((getValue() - min) / totalRange) * 100;
    };

    return (
        <div className={embedded
            ? "relative w-full px-1 pb-1"
            : "absolute bottom-7 left-1/2 -translate-x-1/2 glass border border-line rounded-2xl px-5 py-4 z-20 w-[min(22rem,calc(100vw-1.5rem))] shadow-pop"}>
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2" style={{ color: getColor() }}>
                    {getIcon()}
                    <span className="font-semibold capitalize text-ink">{selectedEditOption}</span>
                </div>
                <span className="text-sm font-mono tabular-nums text-ink">
                    {getValue()}{getUnit()}
                </span>
            </div>

            <motion.div
                onHoverStart={() => animate(scale, 1.2)}
                onHoverEnd={() => animate(scale, 1)}
                onTouchStart={() => animate(scale, 1.2)}
                onTouchEnd={() => animate(scale, 1)}
                style={{
                    opacity: useTransform(scale, [1, 1.2], [0.7, 1])
                }}
                className="flex w-full touch-none select-none items-center justify-center gap-4"
            >
                <motion.div
                    animate={{
                        scale: region === 'left' ? [1, 1.4, 1] : 1,
                        transition: { duration: 0.25 }
                    }}
                    style={{
                        x: useTransform(() => (region === 'left' ? -overflow.get() / scale.get() : 0)),
                        color: getColor()
                    }}
                >
                    <Minus size={16} />
                </motion.div>

                <div
                    ref={sliderRef}
                    className="relative flex w-full grow cursor-grab touch-none select-none items-center py-4"
                    onPointerMove={handlePointerMove}
                    onPointerDown={handlePointerDown}
                    onPointerUp={handlePointerUp}
                >
                    <motion.div
                        style={{
                            scaleX: useTransform(() => {
                                if (sliderRef.current) {
                                    const { width } = sliderRef.current.getBoundingClientRect();
                                    return 1 + overflow.get() / width;
                                }
                            }),
                            scaleY: useTransform(overflow, [0, MAX_OVERFLOW], [1, 0.8]),
                            transformOrigin: useTransform(() => {
                                if (sliderRef.current) {
                                    const { left, width } = sliderRef.current.getBoundingClientRect();
                                    return clientX.get() < left + width / 2 ? 'right' : 'left';
                                }
                            }),
                            height: useTransform(scale, [1, 1.2], [6, 12]),
                            marginTop: useTransform(scale, [1, 1.2], [0, -3]),
                            marginBottom: useTransform(scale, [1, 1.2], [0, -3])
                        }}
                        className="flex grow"
                    >
                        <div className="relative h-full grow overflow-hidden rounded-full bg-white/20">
                            <div 
                                className="absolute h-full rounded-full transition-colors" 
                                style={{ 
                                    width: `${getRangePercentage()}%`,
                                    backgroundColor: getColor()
                                }} 
                            />
                        </div>
                    </motion.div>
                </div>

                <motion.div
                    animate={{
                        scale: region === 'right' ? [1, 1.4, 1] : 1,
                        transition: { duration: 0.25 }
                    }}
                    style={{
                        x: useTransform(() => (region === 'right' ? overflow.get() / scale.get() : 0)),
                        color: getColor()
                    }}
                >
                    <Plus size={16} />
                </motion.div>
            </motion.div>

            <div className="mt-5 flex items-center justify-between">
                <button
                    onClick={handleReset}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3.5 text-[13px] font-semibold text-neutral-900 transition-colors hover:bg-amber-400 active:scale-95"
                >
                    <RotateCcw size={15} /> Reset
                </button>
                <button
                    onClick={() => (onClose ? onClose() : setSelectedEditOption(null))}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-accent px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-hover active:scale-95"
                >
                    <Check size={16} /> Apply
                </button>
            </div>
        </div>
    );
}

function decay(value, max) {
    if (max === 0) {
        return 0;
    }

    const entry = value / max;
    const sigmoid = 2 * (1 / (1 + Math.exp(-entry)) - 0.5);

    return sigmoid * max;
}