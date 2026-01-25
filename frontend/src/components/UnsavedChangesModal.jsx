import { useEffect } from 'react';

/**
 * Modal component for confirming navigation when there are unsaved changes
 *
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {Function} onConfirm - Called when user confirms they want to leave
 * @param {Function} onCancel - Called when user wants to stay
 * @param {string} message - The warning message to display
 */
export function UnsavedChangesModal({ isOpen, onConfirm, onCancel, message }) {
  // Handle escape key to cancel
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen) {
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
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto" aria-labelledby="unsaved-changes-title" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onCancel}
        aria-hidden="true"
      />

      {/* Modal container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full transform transition-all">
          {/* Icon and header */}
          <div className="p-6">
            <div className="flex items-center gap-4">
              {/* Warning icon */}
              <div className="flex-shrink-0 w-12 h-12 bg-yellow-100 dark:bg-yellow-900/50 rounded-full flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-yellow-600 dark:text-yellow-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>

              <div>
                <h3
                  id="unsaved-changes-title"
                  className="text-lg font-semibold text-gray-900 dark:text-white"
                >
                  Cambios sin guardar
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Tu trabajo puede perderse
                </p>
              </div>
            </div>

            {/* Message */}
            <p className="mt-4 text-gray-600 dark:text-gray-300">
              {message || 'Tienes cambios sin guardar. ¿Estas seguro de que quieres salir sin guardar?'}
            </p>
          </div>

          {/* Actions */}
          <div className="px-6 pb-6 flex flex-col-reverse sm:flex-row gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
            >
              Seguir editando
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
            >
              Salir sin guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UnsavedChangesModal;
