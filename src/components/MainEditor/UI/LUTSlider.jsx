import { useState, useEffect, useRef } from 'react';
import { X, RotateCcw } from 'lucide-react';
import { getAvailableLUTs, parseCubeLUT, applyLUT } from '../Utils/LUTUtils';
import { cn } from '../../ui/cn';

const lutParseCache = {};

function FilterTile({ active, preview, label, onClick }) {
  return (
    <button onClick={onClick} className="flex w-20 shrink-0 flex-col items-center gap-2">
      <span
        className={cn(
          'flex h-14 w-14 items-center justify-center overflow-hidden rounded-full border-2 bg-surface-2 transition-all active:scale-90',
          active ? 'border-accent' : 'border-line hover:border-line-strong',
        )}
      >
        {preview ? (
          <img src={preview} alt={label} className="h-full w-full object-cover" />
        ) : (
          <span className="h-full w-full animate-pulse bg-surface-3" />
        )}
      </span>
      <span className="w-full truncate text-center text-[11px] font-medium text-ink">{label}</span>
    </button>
  );
}

export default function LUTSlider({ onSelect, currentLUT, onClose, uploadedImage }) {
  const [luts, setLuts] = useState([]);
  const [previews, setPreviews] = useState({});
  const baseRef = useRef(null);

  useEffect(() => {
    setLuts(getAvailableLUTs());
  }, []);

  useEffect(() => {
    if (!uploadedImage) return;
    const size = 120;
    const scale = Math.min(size / uploadedImage.width, size / uploadedImage.height) || 1;
    const w = Math.max(1, Math.round(uploadedImage.width * scale));
    const h = Math.max(1, Math.round(uploadedImage.height * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(uploadedImage, 0, 0, w, h);
    baseRef.current = { data: ctx.getImageData(0, 0, w, h), w, h };
    setPreviews({});
  }, [uploadedImage]);

  useEffect(() => {
    if (!luts.length || !baseRef.current) return;
    let cancelled = false;
    (async () => {
      for (const lut of luts) {
        if (cancelled) return;
        try {
          let parsed = lutParseCache[lut.file];
          if (!parsed) {
            const res = await fetch(`/luts/${lut.file}`);
            parsed = parseCubeLUT(await res.text());
            lutParseCache[lut.file] = parsed;
          }
          const { data, w, h } = baseRef.current;
          const copy = new ImageData(new Uint8ClampedArray(data.data), w, h);
          const out = applyLUT(copy, parsed);
          const c = document.createElement('canvas');
          c.width = w;
          c.height = h;
          c.getContext('2d').putImageData(out, 0, 0);
          const url = c.toDataURL('image/jpeg', 0.82);
          if (!cancelled) setPreviews((p) => ({ ...p, [lut.file]: url }));
        } catch {
          /* preview generation failed for this LUT — skip it */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [luts, uploadedImage]);

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 bg-black">
      <div className="mx-auto max-w-3xl overflow-hidden px-3 pt-5 pb-[calc(env(safe-area-inset-bottom)+1.75rem)]">
        <div className="flex gap-1 overflow-x-auto px-1 pb-1 pt-1 scrollbar-slim">
          {luts.map((lut) => (
            <FilterTile
              key={lut.file}
              active={currentLUT?.file === lut.file}
              preview={previews[lut.file]}
              label={lut.name}
              onClick={() => onSelect(lut)}
            />
          ))}
        </div>

        <div className="mt-7 flex items-center justify-between border-t border-line px-1 pb-4 pt-7">
          <button
            onClick={() => onSelect(null)}
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
      </div>
    </div>
  );
}
