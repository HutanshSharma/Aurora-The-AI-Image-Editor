import { getAvailableLUTs } from "./LUTUtils"

const intentMap = {
    brightness: {
        keywords: ['bright', 'brightness', 'light', 'dark', 'darker', 'brighter', 'illuminate'],
        increase: ['increase', 'up', 'more', 'brighter', 'lighter', 'brighten'],
        decrease: ['decrease', 'down', 'less', 'darker', 'dimmer', 'darken'],
        param: 'brightness'
    },
    contrast: {
        keywords: ['contrast', 'sharp', 'definition', 'clarity'],
        increase: ['increase', 'up', 'more', 'higher', 'sharper'],
        decrease: ['decrease', 'down', 'less', 'lower', 'softer'],
        param: 'contrast'
    },
    saturation: {
        keywords: ['saturation', 'color', 'vibrant', 'vivid', 'colorful', 'saturate'],
        increase: ['increase', 'up', 'more', 'vibrant', 'vivid', 'colorful', 'pop'],
        decrease: ['decrease', 'down', 'less', 'muted', 'desaturate', 'gray'],
        param: 'saturation'
    },
    blur: {
        keywords: ['blur', 'blurry', 'focus', 'sharp'],
        increase: ['add', 'more', 'blur', 'soften', 'defocus'],
        decrease: ['remove', 'less', 'sharpen', 'focus', 'crisp'],
        param: 'blur'
    }
}

const filterKeywords = {
    warm: ['warm', 'golden', 'sunset', 'amber', 'cozy', 'coffee'],
    cool: ['cool', 'blue', 'cold', 'cyan', 'winter', 'ice', 'teal'],
    vintage: ['vintage', 'old', 'retro', 'analog', 'classic'],
    cinematic: ['cinematic', 'movie', 'cine', 'dramatic', 'cinema'],
    bright: ['bright', 'clean', 'fresh', 'commercial', 'glow', 'happy'],
    dark: ['dark', 'moody', 'shadow', 'noir', 'matte', 'grunge'],
    colorful: ['colorful', 'vibrant', 'neon', 'rainbow', 'vivid', 'punch']
}

export function processCommand(text, execute, Command, editorState){
    if (!execute || !Command || !editorState) {
        console.warn('Command execution not available - missing props')
        return false
    }
    const command = text.toLowerCase().trim()
    
    // Brightness commands
    if (command.includes('brightness')) {
        if (command.includes('increase') || command.includes('brighter') || command.includes('up')) {
            const newValue = Math.min(200, editorState.brightness + 20)
            execute(new Command(
                (s) => ({ ...s, brightness: newValue }),
                (s) => ({ ...s, brightness: editorState.brightness })
            ))
            return true
        } else if (command.includes('decrease') || command.includes('darker') || command.includes('down')) {
            const newValue = Math.max(0, editorState.brightness - 20)
            execute(new Command(
                (s) => ({ ...s, brightness: newValue }),
                (s) => ({ ...s, brightness: editorState.brightness })
            ))
            return true
        } else if (command.includes('reset')) {
            execute(new Command(
                (s) => ({ ...s, brightness: 100 }),
                (s) => ({ ...s, brightness: editorState.brightness })
            ))
            return true
        }
    }
    
    // Contrast commands
    if (command.includes('contrast')) {
        if (command.includes('increase') || command.includes('more') || command.includes('up')) {
            const newValue = Math.min(200, editorState.contrast + 20)
            execute(new Command(
                (s) => ({ ...s, contrast: newValue }),
                (s) => ({ ...s, contrast: editorState.contrast })
            ))
            return true
        } else if (command.includes('decrease') || command.includes('less') || command.includes('down')) {
            const newValue = Math.max(0, editorState.contrast - 20)
            execute(new Command(
                (s) => ({ ...s, contrast: newValue }),
                (s) => ({ ...s, contrast: editorState.contrast })
            ))
            return true
        }
    }
    
    // Saturation commands
    if (command.includes('saturation') || command.includes('color')) {
        if (command.includes('increase') || command.includes('more') || command.includes('vibrant') || command.includes('up')) {
            const newValue = Math.min(200, editorState.saturation + 20)
            execute(new Command(
                (s) => ({ ...s, saturation: newValue }),
                (s) => ({ ...s, saturation: editorState.saturation })
            ))
            return true
        } else if (command.includes('decrease') || command.includes('less') || command.includes('muted') || command.includes('down')) {
            const newValue = Math.max(0, editorState.saturation - 20)
            execute(new Command(
                (s) => ({ ...s, saturation: newValue }),
                (s) => ({ ...s, saturation: editorState.saturation })
            ))
            return true
        }
    }
    
    // Blur commands
    if (command.includes('blur')) {
       if (command.includes('add') || command.includes('more') || command.includes('increase')) {
            const newValue = Math.min(20, editorState.blur + 2)
            execute(new Command(
                (s) => ({ ...s, blur: newValue }),
                (s) => ({ ...s, blur: editorState.blur })
            ))
            return true
        } else if (command.includes('remove') || command.includes('less') || command.includes('decrease')) {
            const newValue = Math.max(0, editorState.blur - 2)
            execute(new Command(
                (s) => ({ ...s, blur: newValue }),
                (s) => ({ ...s, blur: editorState.blur })
            ))
            return true
        }
    }
    
    // LUT filter commands
    if (command.includes('filter') || command.includes('lut') || command.includes('look') || command.includes('style') || command.includes('make')) {
        const availableLUTs = getAvailableLUTs()        
        if (command.includes('remove') || command.includes('clear') || command.includes('none')) {
            execute(new Command(
                (s) => ({ ...s, selectedLUT: null }),
                (s) => ({ ...s, selectedLUT: editorState.selectedLUT })
            ))
            return true
        }        
        const matchingLUT = availableLUTs.find(lut => {
            const lutName = lut.name.toLowerCase()
            const lutWords = lutName.split(' ')            
            for (const word of lutWords) {
                if (command.includes(word) && word.length > 3) { 
                    return true
                }
            }            
            if (command.includes('warm')) {
                return lutName.includes('warm') || lutName.includes('coffee') || lutName.includes('amber')
            }
            
            if (command.includes('cool') && !command.includes('warm')) {
                return lutName.includes('cool') || lutName.includes('cyan') || lutName.includes('blue') || lutName.includes('teal')
            }
            
            if (command.includes('cinematic') || command.includes('cine')) {
                return lutName.includes('cine') || lutName.includes('film') || 
                       lut.name === 'Modern Cine' || lut.name === 'Warm Cine' || lut.name === 'Heroic Cine'
            }
            
            if (command.includes('vintage') || command.includes('retro')) {
                return lutName.includes('vintage') || lutName.includes('analog') || 
                       lut.name === 'Analog Film' || lut.name === 'Brown Film'
            }
            
            if (command.includes('bright') && !command.includes('dark')) {
                return lut.name === 'Clean Bright' || lut.name === 'Clean Commercial' || 
                       lut.name === 'Beauty Glow' || lut.name === 'Warm Happy'
            }
            
            if (command.includes('dark') && !command.includes('bright')) {
                return lut.name === 'Dark Matte' || lut.name === 'Moody Cyan' || 
                       lut.name === 'Muted Matte' || lut.name === 'Grunge Cyan'
            }
            
            if (command.includes('colorful') || command.includes('vibrant')) {
                return lut.name === 'Neon Glow' || lut.name === 'Pink Punch' || 
                       lut.name === 'Teal Orange' || lut.name === 'Warm Punch'
            }
            
            if (command.includes('matte')) {
                return lutName.includes('matte')
            }
            
            if (command.includes('neon')) {
                return lut.name === 'Neon Glow'
            }
            
            return false
        })
        
        if (matchingLUT) {
            execute(new Command(
                (s) => ({ ...s, selectedLUT: matchingLUT }),
                (s) => ({ ...s, selectedLUT: editorState.selectedLUT })
            ))
            return true
        }
    }
    
    // Transform commands
    if (command.includes('flip')) {
        if (command.includes('horizontal') || command.includes('left') || command.includes('right')) {
            execute(new Command(
                (s) => ({ ...s, flipH: !s.flipH }),
                (s) => ({ ...s, flipH: editorState.flipH })
            ))
            return true
        } else if (command.includes('vertical') || command.includes('up') || command.includes('down')) {
            execute(new Command(
                (s) => ({ ...s, flipV: !s.flipV }),
                (s) => ({ ...s, flipV: editorState.flipV })
            ))
            return true
        }
    }
    
    // Rotation commands
    if (command.includes('rotate')) {
        if (command.includes('left') || command.includes('counter')) {
            const newValue = (editorState.rotation - 90 + 360) % 360
            execute(new Command(
                (s) => ({ ...s, rotation: newValue }),
                (s) => ({ ...s, rotation: editorState.rotation })
            ))
            return true
        } else if (command.includes('right') || command.includes('clockwise')) {
            const newValue = (editorState.rotation + 90) % 360
            execute(new Command(
                (s) => ({ ...s, rotation: newValue }),
                (s) => ({ ...s, rotation: editorState.rotation })
            ))
            return true
        }
    }
    
    // Reset commands
    if (command.includes('reset') && !command.includes('brightness')) {
        execute(new Command(
            (s) => ({
                ...s,
                brightness: 100,
                contrast: 100,
                saturation: 100,
                blur: 0,
                rotation: 0,
                flipH: false,
                flipV: false,
                opacity: 100,
                sharpen: 0,
                hue: 0,
                selectedLUT: null
            }),
            (s) => ({ ...s })
        ))
        return true
    }
    return false
}

export function parseAmountFromCommand(command, paramType){
    const text = command.toLowerCase()    
    const byMatch = text.match(/by\s+(\d+)/)
    const toMatch = text.match(/to\s+(\d+)/)
    
    if(byMatch){
        return { mode: 'relative', value: parseInt(byMatch[1], 10) }
    }
    if(toMatch){
        return { mode: 'absolute', value: parseInt(toMatch[1], 10) }
    }
    if(text.includes('slightly') || text.includes('a bit') || text.includes('little')){
        return { mode: 'relative', value: 10 }
    }
    if(text.includes('a lot') || text.includes('significantly') || text.includes('strong')){
        return { mode: 'relative', value: 40 }
    }
    if(paramType === 'blur'){
        return { mode: 'relative', value: 2 }
    }
    return{ mode: 'relative', value: 20 }
}

export async function processCommandWithAI(text, execute, options, Command, editorState, aiModel){
    if (!execute || !Command || !editorState) {
        console.warn('Command execution not available - missing props')
        return false
    }
    const command = text.toLowerCase().trim()
    
    try {
        const intent = await determineIntent(command, aiModel)
        
        if (intent) {
            const success = executeAction(intent, options || {}, editorState, Command, execute)
            return success
        }
        
        return processCommand(text, execute, Command, editorState)
    } catch (error) {
        return processCommand(text, execute, Command, editorState)
    }
}

export async function determineIntent(command, aiModel){
    const c = command.toLowerCase()

    // reset
    if (c.includes('reset')) {
        if (c.includes('brightness')) return { type: 'parameter', param: 'brightness', action: 'reset' }
        if (c.includes('contrast'))  return { type: 'parameter', param: 'contrast',  action: 'reset' }
        if (c.includes('saturation') || c.includes('color')) return { type: 'parameter', param: 'saturation', action: 'reset' }
        if (c.includes('blur')) return { type: 'parameter', param: 'blur', action: 'reset' }
        return { type: 'reset' }
    }

    //flip
    if (c.includes('flip')) {
        if (c.includes('horizontal') || c.includes('left') || c.includes('right')) {
            return { type: 'flip', direction: 'horizontal' }
        }
        if (c.includes('vertical') || c.includes('up') || c.includes('down')) {
            return { type: 'flip', direction: 'vertical' }
        }
        return { type: 'flip', direction: 'horizontal' }
    }

    // rotate
    if (c.includes('rotate')) {
        if (c.includes('left') || c.includes('counter')) {
            return { type: 'rotate', direction: 'left' }
        }
        if (c.includes('right') || c.includes('clockwise')) {
            return { type: 'rotate', direction: 'right' }
        }
        return { type: 'rotate', direction: 'right' }
    }

    // filters
    if (c.includes('filter') || c.includes('lut') || c.includes('look') || c.includes('style')) {
        if (c.includes('remove') || c.includes('clear') || c.includes('none') || c.includes('off')) {
            return { type: 'filter', action: 'remove' }
        }
        for (const [filterType, keywords] of Object.entries(filterKeywords)) {
            if (keywords.some(k => c.includes(k))) {
                return { type: 'filter', filterType }
            }
        }
        return null
    }

    // brightness/contrast/saturation/blur
    for (const [paramType, config] of Object.entries(intentMap)) {
        if (config.keywords.some(k => c.includes(k))) {
            let action = null
            if (config.increase.some(k => c.includes(k))) action = 'increase'
            else if (config.decrease.some(k => c.includes(k))) action = 'decrease'
            if (!action && aiModel) {
                try {
                    const result = await aiModel(c)
                    const top = result?.[0]
                    if (top?.label === 'INCREASE' && top.score > 0.6) action = 'increase'
                    if (top?.label === 'DECREASE' && top.score > 0.6) action = 'decrease'
                } catch (err) {
                    console.warn('AI intent helper failed:', err)
                }
            }
            if (!action) action = 'increase'

            const amountInfo = parseAmountFromCommand(c, paramType)

            return { 
                type: 'parameter', 
                param: config.param, 
                action, 
                amountInfo 
            }
        }
    }
    return null
}

export function executeAction(intent, options = {}, editorState, Command, execute){
    const { command = '' } = options

    switch (intent.type) {
        case 'parameter': {
            const { param, action, amountInfo } = intent
            const currentValue = editorState[param]
            let newValue = currentValue

            if (action === 'reset') {
                const defaults = {
                    brightness: 100,
                    contrast: 100,
                    saturation: 100,
                    blur: 0
                }
                newValue = defaults[param] ?? currentValue
            } else {
                const { mode, value } = amountInfo || parseAmountFromCommand(command, param)

                if (param === 'blur') {
                    if (mode === 'absolute') {
                        newValue = Math.max(0, Math.min(20, value))
                    } else {
                        const delta = value / 10
                        newValue = action === 'increase'
                            ? Math.min(20, currentValue + delta)
                            : Math.max(0, currentValue - delta)
                    }
                } else {
                    if (mode === 'absolute') {
                        newValue = Math.max(0, Math.min(200, value))
                    } else {
                        newValue = action === 'increase'
                            ? Math.min(200, currentValue + value)
                            : Math.max(0, currentValue - value)
                    }
                }
            }

            execute(new Command(
                (s) => ({ ...s, [param]: newValue }),
                (s) => ({ ...s, [param]: currentValue })
            ))
            return true
        }

        case 'filter': {
            if (intent.action === 'remove') {
                const prev = editorState.selectedLUT
                execute(new Command(
                    (s) => ({ ...s, selectedLUT: null }),
                    (s) => ({ ...s, selectedLUT: prev })
                ))
                return true
            }

            const availableLUTs = getAvailableLUTs()
            let matchingLUT = null
            
            // Use the same matching logic as basic command processing
            const filterType = intent.filterType.toLowerCase()
            
            matchingLUT = availableLUTs.find(lut => {
                const lutName = lut.name.toLowerCase()
                
                switch(filterType) {
                    case 'warm':
                        return lutName.includes('warm') || lutName.includes('coffee') || lutName.includes('amber')
                    case 'cool':
                        return lutName.includes('cool') || lutName.includes('cyan') || lutName.includes('blue') || lutName.includes('teal')
                    case 'cinematic':
                        return lutName.includes('cine') || lutName.includes('film') || 
                               lut.name === 'Modern Cine' || lut.name === 'Warm Cine' || lut.name === 'Heroic Cine'
                    case 'vintage':
                        return lutName.includes('vintage') || lutName.includes('analog') || 
                               lut.name === 'Analog Film' || lut.name === 'Brown Film'
                    case 'bright':
                        return lut.name === 'Clean Bright' || lut.name === 'Clean Commercial' || 
                               lut.name === 'Beauty Glow' || lut.name === 'Warm Happy'
                    case 'dark':
                        return lut.name === 'Dark Matte' || lut.name === 'Moody Cyan' || 
                               lut.name === 'Muted Matte' || lut.name === 'Grunge Cyan'
                    case 'colorful':
                        return lut.name === 'Neon Glow' || lut.name === 'Pink Punch' || 
                               lut.name === 'Teal Orange' || lut.name === 'Warm Punch'
                    default:
                        return false
                }
            })

            if (matchingLUT) {
                const prev = editorState.selectedLUT
                execute(new Command(
                    (s) => ({ ...s, selectedLUT: matchingLUT }),
                    (s) => ({ ...s, selectedLUT: prev })
                ))
                return true
            } else {
                console.warn(`No LUT found for filter type: ${intent.filterType}`)
                return false
            }
        }

        case 'flip': {
            const flipProp = intent.direction === 'horizontal' ? 'flipH' : 'flipV'
            const prev = editorState[flipProp]
            execute(new Command(
                (s) => ({ ...s, [flipProp]: !s[flipProp] }),
                (s) => ({ ...s, [flipProp]: prev })
            ))
            return true
        }

        case 'rotate': {
            const currentRotation = editorState.rotation
            const newRotation = intent.direction === 'left'
                ? (currentRotation - 90 + 360) % 360
                : (currentRotation + 90) % 360

            execute(new Command(
                (s) => ({ ...s, rotation: newRotation }),
                (s) => ({ ...s, rotation: currentRotation })
            ))
            return true
        }

        case 'reset': {
            execute(new Command(
                (s) => ({
                    ...s,
                    brightness: 100,
                    contrast: 100,
                    saturation: 100,
                    blur: 0,
                    rotation: 0,
                    flipH: false,
                    flipV: false,
                    opacity: 100,
                    sharpen: 0,
                    hue: 0,
                    selectedLUT: null
                }),
                (s) => ({ ...s })
            ))
            return true
        }

        default:
            return false
    }
}