import { useState } from 'react';
import { UploadCloud } from 'lucide-react';
import Sheet from '../../ui/Sheet';
import { cn } from '../../ui/cn';

export default function ImageUpload({
  setUploadedImage,
  handleImageUpload,
  closePopup,
  popupState,
  inputRef,
}) {
  const open = popupState === 'open-popup';
  const [dragging, setDragging] = useState(false);

  const processFile = async (file) => {
    if (!file) return;
    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';

        img.onload = () => {
          setUploadedImage(img);
          closePopup();
          handleImageUpload(file).catch((error) => {
            console.error('Database upload failed:', error);
          });
        };

        img.onerror = () => console.error('Failed to load uploaded image');
        img.src = event.target.result;
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Error in handleFileUpload:', error);
    }
  };

  const handleFileUpload = (e) => processFile(e.target.files?.[0]);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    processFile(e.dataTransfer.files?.[0]);
  };

  return (
    <>
      {/* Always mounted so the "Add image" button can open the native picker directly on
          mobile (where the drag-and-drop sheet would feel unnatural). */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Desktop only — popupState is set only on larger screens. */}
      <Sheet
        open={open}
        onClose={closePopup}
        title="Add an image"
        description="Upload a photo to start editing."
      >
        <div
          role="button"
          tabIndex={0}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={cn(
            'group flex cursor-pointer flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors',
            dragging
              ? 'border-accent bg-accent-soft'
              : 'border-line bg-surface-2/50 hover:border-accent/60 hover:bg-surface-2',
          )}
        >
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-surface-3 text-accent transition-transform group-hover:scale-105">
            <UploadCloud size={30} />
          </div>
          <div>
            <p className="text-base font-semibold text-ink">Click to browse</p>
            <p className="mt-1 text-sm text-muted">or drag &amp; drop · PNG, JPG, WEBP</p>
          </div>
        </div>
      </Sheet>
    </>
  );
}
