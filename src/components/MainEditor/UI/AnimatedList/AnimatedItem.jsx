import { useRef, useState, useEffect } from 'react';
// eslint-disable-next-line no-unused-vars
import { motion, useInView } from 'framer-motion';
import { Trash2, ImageOff } from 'lucide-react';
import { useUser } from '../../../../store/UserContext';
import { API_BASE } from '../../../../utils/config';
import {
  handleCancelDelete,
  handleDeleteClick,
  handleConfirmDelete,
} from '../../Utils/AnimatedListUtils';
import Skeleton from '../../../ui/Skeleton';
import { cn } from '../../../ui/cn';

export default function AnimatedItem({
  item,
  delay = 0,
  index,
  onMouseEnter,
  onClick,
  onDelete,
  selected,
  loaded,
}) {
  const ref = useRef(null);
  const inView = useInView(ref, { amount: 0.5, triggerOnce: false });
  const { fetchImage } = useUser();
  const [imageData, setImageData] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const imageName =
    loaded && item.original_name ? item.original_name : `Item ${index + 1}`;

  useEffect(() => {
    if (inView && loaded && item.stored_name && !imageData && !isLoading && !error) {
      setIsLoading(true);
      const fetchThumbnail = async () => {
        try {
          const accessToken = sessionStorage.getItem('access_token');
          if (!accessToken) throw new Error('No access token available');

          const response = await fetch(
            `${API_BASE}/user/image/${item.stored_name}/thumbnail?size=300`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${accessToken}`,
              },
            },
          );
          if (response.ok) {
            const data = await response.json();
            if (data && data.base64) {
              setImageData(data);
              return;
            }
          }
          const fullImageData = await fetchImage(item.stored_name);
          if (fullImageData && fullImageData.base64) setImageData(fullImageData);
          else setError(true);
        } catch (err) {
          console.error('Failed to load image:', err);
          setError(true);
        } finally {
          setIsLoading(false);
        }
      };
      fetchThumbnail();
    }
  }, [inView, loaded, item.stored_name, imageData, isLoading, error, fetchImage]);

  let imageSrc;
  if (loaded && imageData?.base64) imageSrc = `data:image/jpeg;base64,${imageData.base64}`;
  else if (!loaded && item.src) imageSrc = item.src;
  else imageSrc = null;

  return (
    <motion.div
      ref={ref}
      data-index={index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      initial={{ scale: 0.96, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.96, opacity: 0 }}
      transition={{ duration: 0.25, delay }}
      className={cn(
        'group relative cursor-pointer overflow-hidden rounded-2xl border bg-surface shadow-soft transition-all duration-200',
        selected
          ? 'border-accent ring-2 ring-accent/60'
          : 'border-line hover:border-line-strong',
      )}
    >
      {isLoading && <Skeleton className="h-52 w-full rounded-none" />}

      {error && (
        <div className="flex h-52 w-full flex-col items-center justify-center gap-2 bg-surface-2 text-faint">
          <ImageOff size={26} />
          <p className="text-xs">Failed to load</p>
        </div>
      )}

      {imageSrc && !isLoading && !error && (
        <img
          src={imageSrc}
          alt={imageName}
          className="pointer-events-none h-52 w-full select-none object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          onError={() => setError(true)}
        />
      )}

      {!imageSrc && !isLoading && !error && (
        <div className="flex h-52 w-full flex-col items-center justify-center gap-2 bg-surface-2 text-faint">
          <ImageOff size={26} />
          <p className="text-xs">No image</p>
        </div>
      )}

      {loaded && item.stored_name && (
        <button
          onClick={(e) => handleDeleteClick(e, setShowDeleteConfirm)}
          className="absolute right-2.5 top-2.5 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm transition-colors duration-200 hover:bg-danger active:scale-95"
          title="Delete image"
          aria-label={`Delete ${imageName}`}
        >
          <Trash2 size={16} />
        </button>
      )}

      {showDeleteConfirm && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className="mx-4 w-full max-w-xs rounded-2xl border border-line bg-surface p-4 text-center shadow-pop">
            <p className="mb-4 text-sm text-ink">
              Delete <span className="font-medium">“{imageName}”</span>?
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={(e) => handleCancelDelete(e, setShowDeleteConfirm)}
                disabled={isDeleting}
                className="flex-1 rounded-xl bg-surface-2 px-3 py-2 text-[13px] font-medium text-ink transition-colors hover:bg-surface-3 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={(e) =>
                  handleConfirmDelete(e, item, setIsDeleting, onDelete, setShowDeleteConfirm)
                }
                disabled={isDeleting}
                className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-danger px-3 py-2 text-[13px] font-medium text-white transition-colors hover:bg-danger/85 disabled:opacity-50"
              >
                {isDeleting && (
                  <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
                )}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/80 via-black/30 to-transparent p-3 pt-8">
        <p className="truncate text-sm font-medium text-white">{imageName}</p>
      </div>
    </motion.div>
  );
}
