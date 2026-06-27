import { useState } from 'react';
import {
  Sun, Contrast, Droplet, Sparkles, RotateCw, ImageIcon, Palette, Aperture,
  FlipHorizontal, FlipVertical, X, RotateCcw, Crop,
} from 'lucide-react';
import EditSlider from '../../SegmentEditor/UI/EditSlider';
import { cn } from '../../ui/cn';

const ADJUSTMENTS = [
  { key: 'brightness', icon: Sun, label: 'Brightness' },
  { key: 'contrast', icon: Contrast, label: 'Contrast' },
  { key: 'saturation', icon: Droplet, label: 'Saturation' },
  { key: 'blur', icon: Aperture, label: 'Blur' },
  { key: 'sharpen', icon: Sparkles, label: 'Sharpen' },
  { key: 'hue', icon: Palette, label: 'Hue' },
  { key: 'rotation', icon: RotateCw, label: 'Rotate' },
  { key: 'opacity', icon: ImageIcon, label: 'Opacity' },
];

function Option({ active, icon: Icon, label, onClick }) {
  return (
    <button onClick={onClick} className="flex w-20 shrink-0 flex-col items-center gap-2">
      <span
        className={cn(
          'flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all active:scale-90',
          active
            ? 'border-accent bg-accent-soft text-accent'
            : 'border-line bg-surface-2 text-muted hover:border-line-strong hover:text-ink',
        )}
      >
        <Icon size={22} />
      </span>
      <span className="w-full truncate text-center text-[11px] font-medium text-ink">{label}</span>
    </button>
  );
}

export default function AdjustBar({
  editorState,
  selectedEditOption,
  setSelectedEditOption,
  execute,
  Command,
  resetFilters,
  onStartCrop,
  onClose,
}) {
  const [sliderOpen, setSliderOpen] = useState(false);

  const toggleFlip = (axis) =>
    execute(
      new Command(
        (s) => ({ ...s, [axis]: !s[axis] }),
        (s) => ({ ...s, [axis]: !s[axis] }),
      ),
    );

  const openSlider = (key) => {
    setSelectedEditOption(key);
    setSliderOpen(true);
  };

  const sliderView = sliderOpen && selectedEditOption;

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 bg-black">
      <div className="mx-auto max-w-3xl overflow-hidden px-3 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.75rem)]">
        {sliderView ? (
          <div className="py-2">
            <EditSlider
              embedded
              selectedEditOption={selectedEditOption}
              editorState={editorState}
              execute={execute}
              setSelectedEditOption={setSelectedEditOption}
              onClose={() => setSliderOpen(false)}
            />
          </div>
        ) : (
          <>
            <div className="flex gap-1 overflow-x-auto px-1 pb-1 pt-1 scrollbar-slim">
              {ADJUSTMENTS.map(({ key, icon: Icon, label }) => (
                <Option
                  key={key}
                  icon={Icon}
                  label={label}
                  active={selectedEditOption === key}
                  onClick={() => openSlider(key)}
                />
              ))}
              <Option icon={FlipHorizontal} label="Flip H" active={editorState.flipH} onClick={() => toggleFlip('flipH')} />
              <Option icon={FlipVertical} label="Flip V" active={editorState.flipV} onClick={() => toggleFlip('flipV')} />
              {onStartCrop && <Option icon={Crop} label="Crop" onClick={onStartCrop} />}
            </div>

            <div className="mt-7 flex items-center justify-between border-t border-line px-1 pb-4 pt-7">
              <button
                onClick={resetFilters}
                className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3.5 text-[13px] font-semibold text-neutral-900 transition-colors hover:bg-amber-400 active:scale-95"
              >
                <RotateCcw size={15} /> Reset
              </button>
              <button
                onClick={onClose}
                className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-red-500 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-red-600 active:scale-95"
              >
                <X size={15} /> Close
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
