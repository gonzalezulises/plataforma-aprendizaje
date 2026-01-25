import { useState, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';

/**
 * FileUpload Component
 * Handles file uploads with comprehensive error handling:
 * - File type validation
 * - File size validation
 * - Network error handling
 * - Upload progress tracking
 * - Retry functionality
 */
export function FileUpload({
  onUploadSuccess,
  onUploadError,
  accept = '*/*',
  maxSize = 10 * 1024 * 1024, // 10MB default
  multiple = false,
  uploadUrl,
  fieldName = 'file',
  disabled = false,
  className = '',
}) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const fileInputRef = useRef(null);
  const abortControllerRef = useRef(null);

  // File size formatter
  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Validate files
  const validateFiles = (files) => {
    const errors = [];
    const validFiles = [];

    Array.from(files).forEach((file) => {
      // Check file size
      if (file.size > maxSize) {
        errors.push({
          file: file.name,
          error: `El archivo excede el tamano maximo de ${formatFileSize(maxSize)}`,
        });
        return;
      }

      // Check file type if accept is specified
      if (accept !== '*/*') {
        const acceptedTypes = accept.split(',').map(t => t.trim());
        const fileType = file.type;
        const fileExtension = '.' + file.name.split('.').pop().toLowerCase();

        const isAccepted = acceptedTypes.some(type => {
          if (type.startsWith('.')) {
            return fileExtension === type.toLowerCase();
          }
          if (type.endsWith('/*')) {
            return fileType.startsWith(type.replace('/*', '/'));
          }
          return fileType === type;
        });

        if (!isAccepted) {
          errors.push({
            file: file.name,
            error: `Tipo de archivo no permitido. Tipos aceptados: ${accept}`,
          });
          return;
        }
      }

      validFiles.push(file);
    });

    return { validFiles, errors };
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const { validFiles, errors } = validateFiles(files);

    if (errors.length > 0) {
      errors.forEach(err => {
        toast.error(`${err.file}: ${err.error}`, { duration: 5000 });
      });
      setUploadError({
        type: 'validation',
        message: 'Algunos archivos no pudieron ser seleccionados',
        details: errors,
      });
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      setUploadError(null);
    }

    // Reset input to allow re-selecting same file
    e.target.value = '';
  };

  // Handle drag and drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const { validFiles, errors } = validateFiles(files);

    if (errors.length > 0) {
      errors.forEach(err => {
        toast.error(`${err.file}: ${err.error}`, { duration: 5000 });
      });
      setUploadError({
        type: 'validation',
        message: 'Algunos archivos no pudieron ser seleccionados',
        details: errors,
      });
    }

    if (validFiles.length > 0) {
      setSelectedFiles(validFiles);
      setUploadError(null);
    }
  }, [accept, maxSize]);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  // Upload files
  const uploadFiles = async () => {
    if (!selectedFiles.length || !uploadUrl) return;

    setIsUploading(true);
    setUploadProgress(0);
    setUploadError(null);

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    const formData = new FormData();
    selectedFiles.forEach((file, index) => {
      formData.append(multiple ? `${fieldName}[${index}]` : fieldName, file);
    });

    try {
      const xhr = new XMLHttpRequest();

      // Track progress
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const progress = Math.round((e.loaded / e.total) * 100);
          setUploadProgress(progress);
        }
      });

      // Handle response
      const response = await new Promise((resolve, reject) => {
        xhr.onreadystatechange = () => {
          if (xhr.readyState === 4) {
            if (xhr.status >= 200 && xhr.status < 300) {
              try {
                resolve(JSON.parse(xhr.responseText));
              } catch {
                resolve({ success: true });
              }
            } else if (xhr.status === 0) {
              // Network error
              reject(new Error('Error de red: No se pudo conectar con el servidor'));
            } else {
              // Server error
              try {
                const errorData = JSON.parse(xhr.responseText);
                reject(new Error(errorData.error || `Error del servidor (${xhr.status})`));
              } catch {
                reject(new Error(`Error del servidor (${xhr.status})`));
              }
            }
          }
        };

        xhr.onerror = () => {
          reject(new Error('Error de red: No se pudo conectar con el servidor'));
        };

        xhr.ontimeout = () => {
          reject(new Error('Tiempo de espera agotado. El servidor no responde.'));
        };

        xhr.open('POST', uploadUrl, true);
        xhr.withCredentials = true;
        xhr.timeout = 60000; // 60 second timeout
        xhr.send(formData);

        // Handle abort
        abortControllerRef.current.signal.addEventListener('abort', () => {
          xhr.abort();
          reject(new Error('Subida cancelada'));
        });
      });

      setIsUploading(false);
      setUploadProgress(100);
      setSelectedFiles([]);
      setRetryCount(0);

      toast.success('Archivo(s) subido(s) exitosamente');

      if (onUploadSuccess) {
        onUploadSuccess(response);
      }

    } catch (error) {
      setIsUploading(false);

      const isNetworkError = error.message.includes('Error de red') ||
                            error.message.includes('Tiempo de espera');

      const errorInfo = {
        type: isNetworkError ? 'network' : 'server',
        message: error.message,
        canRetry: isNetworkError,
        retryCount: retryCount,
      };

      setUploadError(errorInfo);

      if (isNetworkError) {
        toast.error('Error de conexion. Puedes reintentar la subida.', { duration: 5000 });
      } else {
        toast.error(error.message, { duration: 5000 });
      }

      if (onUploadError) {
        onUploadError(error, errorInfo);
      }
    }
  };

  // Retry upload
  const handleRetry = () => {
    setRetryCount(prev => prev + 1);
    uploadFiles();
  };

  // Cancel upload
  const handleCancel = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsUploading(false);
    setUploadProgress(0);
  };

  // Remove selected file
  const removeFile = (index) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setUploadError(null);
  };

  // Clear all
  const clearAll = () => {
    setSelectedFiles([]);
    setUploadError(null);
    setUploadProgress(0);
    setRetryCount(0);
  };

  // Trigger file input click
  const openFileDialog = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleFileSelect}
        disabled={disabled || isUploading}
        className="hidden"
        aria-hidden="true"
      />

      {/* Drag and drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={openFileDialog}
        className={`
          relative border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
          transition-colors duration-200
          ${disabled || isUploading
            ? 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 cursor-not-allowed'
            : 'border-gray-300 dark:border-gray-600 hover:border-primary-500 dark:hover:border-primary-400 bg-white dark:bg-gray-800'
          }
          ${uploadError ? 'border-red-300 dark:border-red-600' : ''}
        `}
      >
        {/* Upload icon */}
        <div className="mb-3">
          <svg
            className={`w-10 h-10 mx-auto ${
              disabled || isUploading
                ? 'text-gray-300 dark:text-gray-600'
                : 'text-gray-400 dark:text-gray-500'
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
        </div>

        <p className="text-sm text-gray-600 dark:text-gray-400">
          {disabled
            ? 'Subida de archivos deshabilitada'
            : isUploading
            ? 'Subiendo archivos...'
            : 'Arrastra y suelta archivos aqui o haz clic para seleccionar'}
        </p>

        <p className="mt-1 text-xs text-gray-500 dark:text-gray-500">
          Max {formatFileSize(maxSize)} {accept !== '*/*' && `| ${accept}`}
        </p>
      </div>

      {/* Selected files list */}
      {selectedFiles.length > 0 && !isUploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Archivos seleccionados ({selectedFiles.length})
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-red-600 hover:text-red-700 dark:text-red-400"
            >
              Limpiar todo
            </button>
          </div>

          {selectedFiles.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    {file.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {formatFileSize(file.size)}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => removeFile(index)}
                className="p-1 text-gray-400 hover:text-red-500 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}

          {/* Upload button */}
          <button
            type="button"
            onClick={uploadFiles}
            disabled={disabled}
            className="w-full py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            Subir {selectedFiles.length > 1 ? 'archivos' : 'archivo'}
          </button>
        </div>
      )}

      {/* Upload progress */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Subiendo...</span>
            <span className="text-gray-600 dark:text-gray-400">{uploadProgress}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary-600 transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
          >
            Cancelar subida
          </button>
        </div>
      )}

      {/* Error display */}
      {uploadError && (
        <div
          className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <svg
              className="w-5 h-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div className="flex-grow">
              <h4 className="text-sm font-semibold text-red-800 dark:text-red-300">
                {uploadError.type === 'network' ? 'Error de Conexion' : 'Error al Subir Archivo'}
              </h4>
              <p className="mt-1 text-sm text-red-700 dark:text-red-400">
                {uploadError.message}
              </p>

              {/* Validation errors details */}
              {uploadError.details && uploadError.details.length > 0 && (
                <ul className="mt-2 text-xs text-red-600 dark:text-red-400 list-disc list-inside">
                  {uploadError.details.map((err, i) => (
                    <li key={i}>{err.file}: {err.error}</li>
                  ))}
                </ul>
              )}

              {/* Retry button for network errors */}
              {uploadError.canRetry && selectedFiles.length > 0 && (
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleRetry}
                    className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                      />
                    </svg>
                    Reintentar {retryCount > 0 && `(${retryCount})`}
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="text-sm text-red-600 dark:text-red-400 hover:text-red-800"
                  >
                    Cancelar
                  </button>
                </div>
              )}

              {/* Re-select file button for validation errors */}
              {uploadError.type === 'validation' && (
                <button
                  type="button"
                  onClick={openFileDialog}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 border border-primary-300 dark:border-primary-600 rounded-md transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Seleccionar otro archivo
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FileUpload;
