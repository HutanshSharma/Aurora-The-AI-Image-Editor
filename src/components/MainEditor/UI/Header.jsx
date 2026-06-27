import { Undo2, Redo2, Plus, Images, ZoomIn, History } from 'lucide-react';
import IconButton from '../../ui/IconButton';
import ProfileMenu from './ProfileMenu';
import EditorMenu from './EditorMenu';

export default function Header({
  openPopup,
  handleLoadImages,
  setShowEditor,
  droppedObjects,
  handleUndo,
  handleRedo,
  canUndo,
  canRedo,
  uploadedImage,
  zoom,
  onAdjust,
  onFilters,
  onHistory,
  onSave,
  onDownload,
  onReset,
  onSegment,
  onColorGrade,
  isSegmented,
  hasUnsavedChanges,
}) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 h-20 glass border-b border-line">
      <div className="mx-auto flex h-full max-w-7xl items-center justify-between gap-2 px-3 sm:px-5">
        <ProfileMenu />
        <div className="flex items-center gap-1.5">
          {uploadedImage && (
            <div className="hidden h-11 items-center gap-1.5 rounded-2xl border border-line bg-surface-2 px-3 text-[13px] text-muted sm:flex">
              <ZoomIn size={14} />
              <span className="tabular-nums text-ink">{Math.round((zoom || 1) * 100)}%</span>
            </div>
          )}
          {uploadedImage && (
            <IconButton size="md" variant="surface" label="Version history" onClick={onHistory} className="sm:hidden">
              <History size={20} />
            </IconButton>
          )}
          {uploadedImage && (
            <div className="flex h-11 items-center gap-0.5 rounded-2xl border border-line bg-surface-2/60 p-1">
              <IconButton size="sm" variant="ghost" label="Undo (Ctrl+Z)" onClick={handleUndo} disabled={!canUndo}>
                <Undo2 size={18} />
              </IconButton>
              <IconButton size="sm" variant="ghost" label="Redo (Ctrl+Y)" onClick={handleRedo} disabled={!canRedo}>
                <Redo2 size={18} />
              </IconButton>
            </div>
          )}

          {!uploadedImage && (
            <IconButton size="md" variant="surface" label="Image library" onClick={handleLoadImages}>
              <Images size={20} />
            </IconButton>
          )}

          <IconButton size="md" variant="accent" label="Add image" onClick={openPopup}>
            <Plus size={20} />
          </IconButton>

          {uploadedImage && (
            <EditorMenu
              onAdjust={onAdjust}
              onFilters={onFilters}
              onHistory={onHistory}
              onSegment={onSegment}
              onColorGrade={onColorGrade}
              isSegmented={isSegmented}
              onSave={onSave}
              onDownload={onDownload}
              onReset={onReset}
              onLibrary={handleLoadImages}
              onOpenCutout={() => setShowEditor(true)}
              showCutout={droppedObjects.length > 0}
              hasUnsavedChanges={hasUnsavedChanges}
            />
          )}
        </div>
      </div>
    </header>
  );
}
