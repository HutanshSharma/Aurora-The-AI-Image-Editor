export function handleDeleteClick(e,setShowDeleteConfirm) {
    e.stopPropagation();
    setShowDeleteConfirm(true);
}

export async function handleConfirmDelete(e,item,setIsDeleting,onDelete,setShowDeleteConfirm) {
    e.stopPropagation();
    if (!onDelete || !item.stored_name) return;

    setIsDeleting(true);
    try {
        await onDelete(item.stored_name, item.original_name);
    } catch (error) {
        console.error('Delete failed:', error);
    } finally {
        setIsDeleting(false);
        setShowDeleteConfirm(false);
    }
}

export function handleCancelDelete(e,setShowDeleteConfirm) {
    e.stopPropagation();
    setShowDeleteConfirm(false);
}