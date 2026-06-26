import { Trash2, Copy } from 'lucide-react';
import { cn } from '../../ui/cn';

export default function GalleryView({
  editedObjects,
  setSelectedObjectIndex,
  setViewMode,
  selectedObjectIndex,
  duplicateObject,
  deleteObject,
}) {
  return (
    <div className="flex-1 overflow-y-auto scrollbar-slim p-4 pb-10">
      <p className="mb-3 text-[12px] text-muted">
        {editedObjects.length} cut-out{editedObjects.length === 1 ? '' : 's'}
      </p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {editedObjects.map((obj, index) => (
          <div
            key={obj.id}
            onClick={() => {
              setSelectedObjectIndex(index);
              setViewMode('edit');
            }}
            className={cn(
              'group relative cursor-pointer overflow-hidden rounded-2xl border-2 bg-surface transition-all',
              index === selectedObjectIndex
                ? 'border-accent ring-2 ring-accent/50'
                : 'border-line hover:border-line-strong',
            )}
          >
            <div className="flex aspect-square items-center justify-center bg-surface-2 p-4">
              {obj.image?.complete ? (
                <img src={obj.image.src} alt={obj.name} className="max-h-full max-w-full object-contain" />
              ) : (
                <div className="h-full w-full rounded-lg bg-surface-3" />
              )}
            </div>

            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 to-transparent p-2.5 pt-8">
              <p className="truncate text-[13px] font-semibold text-white">{obj.name}</p>
              <p className="text-[11px] text-white/60">{obj.width} × {obj.height}</p>
            </div>

            <div className="absolute right-2 top-2 flex gap-1.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedObjectIndex(index);
                  duplicateObject();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-accent"
                title="Duplicate"
              >
                <Copy size={14} />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedObjectIndex(index);
                  deleteObject();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-danger"
                title="Delete"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
