import { useState } from 'react';
import { X, Upload, Check, Palette, Move, ChevronRight, RotateCcw } from 'lucide-react';
import { cn } from '../../ui/cn';
import Segmented from '../../ui/Segmented';

class Command {
  constructor(doFn, undoFn) {
    this.do = doFn;
    this.undo = undoFn;
  }
}

const COLORS = [
  { id: 'bg-white', name: 'White', color: '#ffffff' },
  { id: 'bg-black', name: 'Black', color: '#000000' },
  { id: 'bg-light-gray', name: 'Light Gray', color: '#e5e7eb' },
  { id: 'bg-dark-gray', name: 'Dark Gray', color: '#1f2937' },
  { id: 'bg-blue', name: 'Blue', color: '#3b82f6' },
  { id: 'bg-red', name: 'Red', color: '#ef4444' },
  { id: 'bg-green', name: 'Green', color: '#10b981' },
  { id: 'bg-purple', name: 'Purple', color: '#8b5cf6' },
  { id: 'bg-yellow', name: 'Yellow', color: '#fbbf24' },
  { id: 'bg-pink', name: 'Pink', color: '#ec4899' },
  { id: 'bg-cyan', name: 'Cyan', color: '#06b6d4' },
  { id: 'bg-orange', name: 'Orange', color: '#f97316' },
];

function MenuRow({ icon: Icon, label, hint, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface-2 px-4 py-3.5 text-left transition-colors hover:bg-surface-3"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-3 text-accent">
        <Icon size={18} />
      </span>
      <span className="flex-1">
        <span className="block text-sm font-medium text-ink">{label}</span>
        {hint && <span className="block text-[12px] text-muted">{hint}</span>}
      </span>
      <ChevronRight size={18} className="text-faint" />
    </button>
  );
}

function Slider({ label, value, min, max, step, display, onChange }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <label className="text-[12px] text-muted">{label}</label>
        <span className="text-[12px] tabular-nums text-faint">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-surface-3 accent-accent"
      />
    </div>
  );
}

function BottomActions({ onReset, resetLabel, onCancel }) {
  return (
    <div className="mt-6 flex items-center justify-between border-t border-line px-1 pb-1 pt-5">
      <button
        onClick={onReset}
        className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-amber-500 px-3.5 text-[13px] font-semibold text-neutral-900 transition-colors hover:bg-amber-400 active:scale-95"
      >
        <RotateCcw size={15} /> {resetLabel}
      </button>
      <button
        onClick={onCancel}
        className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-red-500 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-red-600 active:scale-95"
      >
        <X size={15} /> Cancel
      </button>
    </div>
  );
}

export default function BackgroundPanel({
  editorState,
  execute,
  backgroundInputRef,
  handleCustomBackgroundUpload,
  onClose,
}) {
  const [view, setView] = useState('menu');
  const [adjustTab, setAdjustTab] = useState('segment');
  const hasBg = editorState.backgroundColor || editorState.customBackground;

  const setColor = (color) =>
    execute(
      new Command(
        (s) => ({ ...s, backgroundColor: color, customBackground: null }),
        (s) => ({ ...s, backgroundColor: s.backgroundColor, customBackground: s.customBackground }),
      ),
    );

  const clearBg = () =>
    execute(
      new Command(
        (s) => ({ ...s, backgroundColor: null, customBackground: null }),
        (s) => ({ ...s, backgroundColor: s.backgroundColor, customBackground: s.customBackground }),
      ),
    );

  const resetTransforms = () =>
    execute(
      new Command(
        (s) => ({ ...s, backgroundScale: 1, backgroundPos: { x: 0, y: 0 }, imageScale: 1, imagePos: { x: 0, y: 0 } }),
        (s) => ({ ...s }),
      ),
    );

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 bg-black">
      <div className="mx-auto max-h-[62vh] max-w-3xl overflow-y-auto scrollbar-slim px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1.25rem)]">
        {/* Hidden file input — available from the menu's Upload row */}
        <input
          ref={backgroundInputRef}
          type="file"
          accept="image/*"
          onChange={handleCustomBackgroundUpload}
          className="hidden"
        />

        {view === 'menu' && (
          <>
            <div className="space-y-2">
              <MenuRow icon={Palette} label="Color background" hint="Pick a solid color" onClick={() => setView('color')} />
              <MenuRow
                icon={Upload}
                label="Upload background"
                hint={editorState.customBackground ? 'Image loaded' : 'Use your own image'}
                onClick={() => backgroundInputRef.current?.click()}
              />
              <MenuRow icon={Move} label="Adjust background & segment" hint="Scale & position" onClick={() => setView('adjust')} />
            </div>
            <div className="mt-5 flex justify-end border-t border-line pt-5">
              <button
                onClick={onClose}
                className="flex h-9 items-center justify-center gap-1.5 rounded-xl bg-red-500 px-3.5 text-[13px] font-semibold text-white transition-colors hover:bg-red-600 active:scale-95"
              >
                <X size={15} /> Close
              </button>
            </div>
          </>
        )}

        {view === 'color' && (
          <>
            <div className="flex gap-2.5 overflow-x-auto px-1 pb-1 pt-1 scrollbar-slim">
              <button onClick={clearBg} className="flex w-16 shrink-0 flex-col items-center gap-2">
                <span
                  className={cn(
                    'flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all active:scale-90',
                    !editorState.backgroundColor && !editorState.customBackground ? 'border-accent' : 'border-line',
                  )}
                  style={{
                    backgroundColor: '#fff',
                    backgroundImage:
                      'linear-gradient(45deg, #cbd5e1 25%, transparent 25%), linear-gradient(-45deg, #cbd5e1 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #cbd5e1 75%), linear-gradient(-45deg, transparent 75%, #cbd5e1 75%)',
                    backgroundSize: '10px 10px',
                    backgroundPosition: '0 0, 0 5px, 5px -5px, -5px 0px',
                  }}
                >
                  {!editorState.backgroundColor && !editorState.customBackground && (
                    <Check size={16} className="text-accent drop-shadow" />
                  )}
                </span>
                <span className="w-full truncate text-center text-[11px] font-medium text-ink">Transparent</span>
              </button>
              {COLORS.map((bg) => (
                <button key={bg.id} onClick={() => setColor(bg.color)} className="flex w-16 shrink-0 flex-col items-center gap-2">
                  <span
                    className={cn(
                      'flex h-14 w-14 items-center justify-center rounded-full border-2 transition-all active:scale-90',
                      editorState.backgroundColor === bg.color ? 'border-accent' : 'border-line',
                    )}
                    style={{ backgroundColor: bg.color }}
                  >
                    {editorState.backgroundColor === bg.color && (
                      <Check size={16} className="text-white mix-blend-difference" />
                    )}
                  </span>
                  <span className="w-full truncate text-center text-[11px] font-medium text-ink">{bg.name}</span>
                </button>
              ))}
            </div>
            <BottomActions onReset={clearBg} resetLabel="Clear" onCancel={() => setView('menu')} />
          </>
        )}

        {view === 'adjust' && (
          <>
            <Segmented
              className="mb-4"
              value={adjustTab}
              onChange={setAdjustTab}
              options={[
                { value: 'segment', label: 'Segment' },
                { value: 'background', label: 'Background' },
              ]}
            />

            {adjustTab === 'segment' ? (
              <div className="space-y-3">
                <Slider
                  label="Scale"
                  min={0.1}
                  max={3}
                  step={0.1}
                  value={editorState.imageScale}
                  display={`${Math.round(editorState.imageScale * 100)}%`}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    execute(new Command((s) => ({ ...s, imageScale: v }), (s) => ({ ...s, imageScale: s.imageScale })), true);
                  }}
                />
                <Slider
                  label="Position X"
                  min={-500}
                  max={500}
                  step={1}
                  value={editorState.imagePos.x}
                  display={`${editorState.imagePos.x}px`}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    execute(new Command((s) => ({ ...s, imagePos: { ...s.imagePos, x: v } }), (s) => ({ ...s, imagePos: { ...s.imagePos, x: s.imagePos.x } })), true);
                  }}
                />
                <Slider
                  label="Position Y"
                  min={-500}
                  max={500}
                  step={1}
                  value={editorState.imagePos.y}
                  display={`${editorState.imagePos.y}px`}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    execute(new Command((s) => ({ ...s, imagePos: { ...s.imagePos, y: v } }), (s) => ({ ...s, imagePos: { ...s.imagePos, y: s.imagePos.y } })), true);
                  }}
                />
              </div>
            ) : hasBg ? (
              <div className="space-y-3">
                <Slider
                  label="Scale"
                  min={0.1}
                  max={3}
                  step={0.1}
                  value={editorState.backgroundScale}
                  display={`${Math.round(editorState.backgroundScale * 100)}%`}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    execute(new Command((s) => ({ ...s, backgroundScale: v }), (s) => ({ ...s, backgroundScale: s.backgroundScale })), true);
                  }}
                />
                <Slider
                  label="Position X"
                  min={-500}
                  max={500}
                  step={1}
                  value={editorState.backgroundPos.x}
                  display={`${editorState.backgroundPos.x}px`}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    execute(new Command((s) => ({ ...s, backgroundPos: { ...s.backgroundPos, x: v } }), (s) => ({ ...s, backgroundPos: { ...s.backgroundPos, x: s.backgroundPos.x } })), true);
                  }}
                />
                <Slider
                  label="Position Y"
                  min={-500}
                  max={500}
                  step={1}
                  value={editorState.backgroundPos.y}
                  display={`${editorState.backgroundPos.y}px`}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    execute(new Command((s) => ({ ...s, backgroundPos: { ...s.backgroundPos, y: v } }), (s) => ({ ...s, backgroundPos: { ...s.backgroundPos, y: s.backgroundPos.y } })), true);
                  }}
                />
              </div>
            ) : (
              <p className="py-8 text-center text-sm text-muted">
                No background set yet — add one from the Background menu first.
              </p>
            )}

            <BottomActions onReset={resetTransforms} resetLabel="Reset" onCancel={() => setView('menu')} />
          </>
        )}
      </div>
    </div>
  );
}
