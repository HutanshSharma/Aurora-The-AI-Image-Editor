import { X, Undo2, Redo2, Check } from 'lucide-react';
import IconButton from '../../ui/IconButton';
import Button from '../../ui/Button';
import Segmented from '../../ui/Segmented';

export default function SegmentHeader({
  setShowEditor,
  setViewMode,
  viewMode,
  handleUndo,
  handleRedo,
  canUndo,
  canRedo,
  onDone,
  isSaving,
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line bg-surface px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
      <div className="flex min-w-0 items-center gap-2">
        <IconButton size="sm" variant="surface" label="Close editor" onClick={() => setShowEditor(false)}>
          <X size={18} />
        </IconButton>
        <Segmented
          value={viewMode}
          onChange={setViewMode}
          options={[
            { value: 'edit', label: 'Edit' },
            { value: 'gallery', label: "Gallery" },
          ]}
        />
      </div>

      <div className="flex items-center gap-1.5">
        <div className="flex h-9 items-center gap-0.5 rounded-2xl border border-line bg-surface-2/60 p-1">
          <IconButton size="sm" variant="ghost" label="Undo (Ctrl+Z)" onClick={handleUndo} disabled={!canUndo}>
            <Undo2 size={16} />
          </IconButton>
          <IconButton size="sm" variant="ghost" label="Redo (Ctrl+Y)" onClick={handleRedo} disabled={!canRedo}>
            <Redo2 size={16} />
          </IconButton>
        </div>
        <Button size="sm" onClick={onDone} disabled={isSaving}>
          {isSaving ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
              Saving…
            </>
          ) : (
            <>
              <Check size={16} /> Done
            </>
          )}
        </Button>
      </div>
    </header>
  );
}
