import { useState, useRef } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

/**
 * VideoUploadButton - Upload video to Supabase Storage via signed URL
 * @param {function} onUploadComplete - callback with public URL
 * @param {function} onError - callback with error message
 * @param {string} className
 */
export default function VideoUploadButton({ onUploadComplete, onError, className = '' }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileInputRef = useRef(null);
  const xhrRef = useRef(null);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleCancel = () => {
    if (xhrRef.current) {
      xhrRef.current.abort();
      xhrRef.current = null;
    }
    setUploading(false);
    setProgress(0);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be re-selected
    e.target.value = '';

    // Client-side validation
    if (!ALLOWED_TYPES.includes(file.type)) {
      onError?.('Tipo de archivo no permitido. Solo MP4, WebM y QuickTime.');
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      onError?.(`Archivo demasiado grande. Maximo: ${MAX_FILE_SIZE / 1024 / 1024}MB`);
      return;
    }

    setUploading(true);
    setProgress(0);

    try {
      // 1. Get signed URL from backend
      const signedUrlResponse = await fetch(`${API_BASE}/video-upload/signed-url`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type,
          fileSize: file.size
        })
      });

      if (!signedUrlResponse.ok) {
        const err = await signedUrlResponse.json();
        throw new Error(err.error || 'Error al obtener URL de subida');
      }

      const { signedUrl, publicUrl } = await signedUrlResponse.json();

      // 2. Upload directly to Supabase Storage with XMLHttpRequest for progress
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;

        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            setProgress(Math.round((event.loaded / event.total) * 100));
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Upload failed with status ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => reject(new Error('Upload failed')));
        xhr.addEventListener('abort', () => reject(new Error('Upload cancelled')));

        xhr.open('PUT', signedUrl);
        xhr.setRequestHeader('Content-Type', file.type);
        xhr.send(file);
      });

      xhrRef.current = null;
      onUploadComplete?.(publicUrl);
    } catch (err) {
      if (err.message !== 'Upload cancelled') {
        console.error('Video upload error:', err);
        onError?.(err.message || 'Error al subir el video');
      }
    } finally {
      setUploading(false);
      setProgress(0);
    }
  };

  return (
    <div className={className}>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/mp4,video/webm,video/quicktime"
        onChange={handleFileSelect}
        className="hidden"
      />

      {uploading ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-500 dark:text-gray-400 w-10 text-right">{progress}%</span>
          <button
            type="button"
            onClick={handleCancel}
            className="text-gray-400 hover:text-red-500"
            title="Cancelar"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleClick}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 inline-flex items-center justify-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          Subir Video
        </button>
      )}
    </div>
  );
}
