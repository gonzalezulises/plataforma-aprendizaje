import { useEffect } from 'react';

/**
 * Modal component for confirming delete actions
 *
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {Function} onConfirm - Called when user confirms deletion
 * @param {Function} onCancel - Called when user cancels deletion
 * @param {string} title - The title of the item being deleted (e.g., "Curso: Python Fundamentos")
 * @param {string} message - Optional custom message to display
 * @param {boolean} isDeleting - Whether the delete operation is in progress
 */
export function ConfirmDeleteModal({
  isOpen,
  onConfirm,
  onCancel,
  title = 'este elemento',
  message,
  isDeleting = false
}) {
  // Handle escape key to cancel
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen && !isDeleting) {
        onCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Prevent body scroll when modal is open
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, onCancel, isDeleting]);

  if (!isOpen) return null;

  const defaultMessage = `¿Estas seguro de que quieres eliminar ${title}? Esta accion no se puede deshacer.`;

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="confirm-delete-title"
      role="dialog"
      aria-modal="true"
      data-testid="confirm-delete-modal"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={!isDeleting ? onCancel : undefined}
        aria-hidden="true"
        data-testid="confirm-delete-backdrop"
      />

      {/* Modal container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full transform transition-all">
          {/* Icon and header */}
          <div className="p-6">
            <div className="flex items-center gap-4">
              {/* Warning/Delete icon */}
              <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </div>

              <div>
                <h3
                  id="confirm-delete-title"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  Confirmar eliminacion
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Esta accion es permanente
                </p>
              </div>
            </div>

            {/* Message */}
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              {message || defaultMessage}
            </p>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex flex-col-reverse sm:flex-row gap-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="confirm-delete-cancel"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isDeleting}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              data-testid="confirm-delete-confirm"
            >
              {isDeleting ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Eliminando...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Eliminar
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ConfirmDeleteModal;
