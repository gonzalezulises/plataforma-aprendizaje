import { useState, useEffect, useRef } from 'react';

/**
 * Double confirmation modal for high-risk delete operations (like courses)
 * Feature #29: Course deletion requires double confirmation
 *
 * Step 1: Initial warning with option to proceed
 * Step 2: Type confirmation phrase to actually delete
 *
 * @param {boolean} isOpen - Whether the modal is visible
 * @param {Function} onConfirm - Called when user completes both confirmations
 * @param {Function} onCancel - Called when user cancels at any step
 * @param {string} itemName - Name of the item being deleted (for display)
 * @param {string} confirmationPhrase - Phrase user must type to confirm (default: "ELIMINAR")
 * @param {boolean} isDeleting - Whether the delete operation is in progress
 */
export function DoubleConfirmDeleteModal({
  isOpen,
  onConfirm,
  onCancel,
  itemName = 'este elemento',
  confirmationPhrase = 'ELIMINAR',
  isDeleting = false
}) {
  // Track which step we're on: 1 = first warning, 2 = type confirmation
  const [step, setStep] = useState(1);
  const [typedText, setTypedText] = useState('');
  const inputRef = useRef(null);

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      setTypedText('');
    }
  }, [isOpen]);

  // Focus input when step 2 is reached
  useEffect(() => {
    if (step === 2 && inputRef.current) {
      inputRef.current.focus();
    }
  }, [step]);

  // Handle escape key to cancel
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isOpen && !isDeleting) {
        handleCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [isOpen, isDeleting]);

  const handleCancel = () => {
    setStep(1);
    setTypedText('');
    onCancel();
  };

  const handleFirstConfirm = () => {
    setStep(2);
  };

  const handleSecondConfirm = () => {
    if (typedText.toUpperCase() === confirmationPhrase.toUpperCase()) {
      onConfirm();
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && typedText.toUpperCase() === confirmationPhrase.toUpperCase()) {
      handleSecondConfirm();
    }
  };

  if (!isOpen) return null;

  const isConfirmEnabled = typedText.toUpperCase() === confirmationPhrase.toUpperCase();

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      aria-labelledby="double-confirm-delete-title"
      role="dialog"
      aria-modal="true"
      data-testid="double-confirm-delete-modal"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={!isDeleting ? handleCancel : undefined}
        aria-hidden="true"
        data-testid="double-confirm-backdrop"
      />

      {/* Modal container */}
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full transform transition-all">
          {/* Step indicator */}
          <div className="px-6 pt-6">
            <div className="flex items-center justify-center gap-2 mb-4">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 1 ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              }`}>
                {step > 1 ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : '1'}
              </div>
              <div className={`w-12 h-1 rounded ${step >= 2 ? 'bg-red-600' : 'bg-gray-200 dark:bg-gray-700'}`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= 2 ? 'bg-red-600 text-white' : 'bg-gray-200 dark:bg-gray-700 text-gray-500'
              }`}>
                2
              </div>
            </div>
          </div>

          {/* Step 1: Initial warning */}
          {step === 1 && (
            <>
              <div className="p-6 pt-0">
                <div className="flex items-center gap-4">
                  {/* Warning icon */}
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
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                      />
                    </svg>
                  </div>

                  <div>
                    <h3
                      id="double-confirm-delete-title"
                      className="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                      Eliminar curso
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Paso 1 de 2: Confirmacion inicial
                    </p>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <p className="text-red-800 dark:text-red-200 font-medium mb-2">
                    Advertencia: Esta accion es irreversible
                  </p>
                  <p className="text-red-700 dark:text-red-300 text-sm">
                    Estas a punto de eliminar el curso <strong>"{itemName}"</strong>.
                  </p>
                  <ul className="mt-2 text-red-700 dark:text-red-300 text-sm list-disc list-inside space-y-1">
                    <li>Todos los modulos y lecciones seran eliminados</li>
                    <li>El progreso de los estudiantes se perdera</li>
                    <li>Las inscripciones seran canceladas</li>
                    <li>Esta accion NO se puede deshacer</li>
                  </ul>
                </div>
              </div>

              {/* Step 1 Actions */}
              <div className="px-6 pb-6 flex flex-col-reverse sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
                  data-testid="double-confirm-cancel-step1"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleFirstConfirm}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors flex items-center justify-center gap-2"
                  data-testid="double-confirm-proceed"
                >
                  Continuar
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </>
          )}

          {/* Step 2: Type to confirm */}
          {step === 2 && (
            <>
              <div className="p-6 pt-0">
                <div className="flex items-center gap-4">
                  {/* Delete icon */}
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
                      className="text-lg font-semibold text-gray-900 dark:text-white"
                    >
                      Confirmar eliminacion
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Paso 2 de 2: Confirmacion final
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    Para confirmar la eliminacion del curso <strong>"{itemName}"</strong>,
                    escribe <span className="font-mono font-bold text-red-600 dark:text-red-400">{confirmationPhrase}</span> a continuacion:
                  </p>

                  <input
                    ref={inputRef}
                    type="text"
                    value={typedText}
                    onChange={(e) => setTypedText(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder={`Escribe "${confirmationPhrase}" para confirmar`}
                    disabled={isDeleting}
                    className={`w-full px-4 py-3 border-2 rounded-lg text-center font-medium uppercase tracking-wider focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors ${
                      isConfirmEnabled
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 focus:ring-red-500'
                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-primary-500'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                    data-testid="double-confirm-input"
                    autoComplete="off"
                  />

                  {typedText && !isConfirmEnabled && (
                    <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 text-center">
                      Escribe exactamente: <span className="font-mono font-bold">{confirmationPhrase}</span>
                    </p>
                  )}
                </div>
              </div>

              {/* Step 2 Actions */}
              <div className="px-6 pb-6 flex flex-col-reverse sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  data-testid="double-confirm-cancel-step2"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSecondConfirm}
                  disabled={!isConfirmEnabled || isDeleting}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  data-testid="double-confirm-delete"
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
                      Eliminar permanentemente
                    </>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default DoubleConfirmDeleteModal;
