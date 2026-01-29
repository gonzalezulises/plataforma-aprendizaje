import React, { useRef, useEffect, useState, useCallback } from 'react';
import { parseVideoUrl } from '../utils/video-utils';

// API_BASE_URL already includes /api suffix from env
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * YouTube embed sub-component
 */
function YouTubeEmbed({ embedUrl, title, className = '' }) {
  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      <iframe
        src={embedUrl}
        title={title || 'Video de YouTube'}
        className="w-full aspect-video"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        referrerPolicy="strict-origin-when-cross-origin"
        allowFullScreen
      />
      {title && (
        <div className="p-4 bg-gray-800">
          <h3 className="text-white font-medium">{title}</h3>
        </div>
      )}
    </div>
  );
}

/**
 * Vimeo embed sub-component
 */
function VimeoEmbed({ embedUrl, title, className = '' }) {
  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      <iframe
        src={embedUrl}
        title={title || 'Video de Vimeo'}
        className="w-full aspect-video"
        frameBorder="0"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
      />
      {title && (
        <div className="p-4 bg-gray-800">
          <h3 className="text-white font-medium">{title}</h3>
        </div>
      )}
    </div>
  );
}

/**
 * Direct video sub-component with progress tracking and error handling
 * (preserves all original VideoPlayer functionality)
 */
function DirectVideo({
  src,
  title,
  lessonId,
  videoId = 'main',
  poster,
  onProgress,
  onComplete,
  onError,
  alternativeContent,
  className = ''
}) {
  const videoRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedTime, setSavedTime] = useState(null);
  const [hasRestored, setHasRestored] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [showAlternative, setShowAlternative] = useState(false);
  const lastSaveTimeRef = useRef(0);

  // Fetch saved progress on mount
  useEffect(() => {
    if (!lessonId) return;

    const fetchProgress = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/video-progress/${lessonId}/${videoId}`,
          { credentials: 'include' }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data.currentTime > 0) {
            setSavedTime(data.data.currentTime);
          }
        }
      } catch (error) {
        console.error('Error fetching video progress:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProgress();
  }, [lessonId, videoId]);

  // Restore position when video is loaded and we have saved time
  useEffect(() => {
    const video = videoRef.current;
    if (!video || savedTime === null || hasRestored) return;

    const restorePosition = () => {
      if (savedTime > 0 && savedTime < video.duration - 5) {
        requestAnimationFrame(() => {
          video.currentTime = savedTime;
          setHasRestored(true);
        });
      }
    };

    if (video.readyState >= 2) {
      restorePosition();
    } else if (video.readyState >= 1) {
      const handleCanPlay = () => {
        restorePosition();
        video.removeEventListener('canplay', handleCanPlay);
      };
      video.addEventListener('canplay', handleCanPlay);
      return () => video.removeEventListener('canplay', handleCanPlay);
    } else {
      const handleLoadedMetadata = () => {
        const handleCanPlay = () => {
          restorePosition();
          video.removeEventListener('canplay', handleCanPlay);
        };
        video.addEventListener('canplay', handleCanPlay);
      };
      video.addEventListener('loadedmetadata', handleLoadedMetadata);
      return () => video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    }
  }, [savedTime, hasRestored]);

  // Save progress function
  const saveProgress = useCallback(async (currentTime, duration, completed = false) => {
    if (!lessonId) return;

    try {
      await fetch(
        `${API_BASE_URL}/video-progress/${lessonId}/${videoId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          credentials: 'include',
          body: JSON.stringify({
            currentTime,
            duration,
            completed
          })
        }
      );
    } catch (error) {
      console.error('Error saving video progress:', error);
    }
  }, [lessonId, videoId]);

  // Handle time update - save progress periodically
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    const currentTime = video.currentTime;
    const duration = video.duration;

    // Save every 5 seconds
    if (currentTime - lastSaveTimeRef.current >= 5) {
      lastSaveTimeRef.current = currentTime;
      saveProgress(currentTime, duration);

      if (onProgress) {
        onProgress({
          currentTime,
          duration,
          percent: (currentTime / duration) * 100
        });
      }
    }
  }, [saveProgress, onProgress]);

  // Handle video end
  const handleEnded = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    saveProgress(video.duration, video.duration, true);

    if (onComplete) {
      onComplete();
    }
  }, [saveProgress, onComplete]);

  // Handle pause - save current position
  const handlePause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    saveProgress(video.currentTime, video.duration);
  }, [saveProgress]);

  // Handle video error - show fallback UI
  const handleVideoError = useCallback((event) => {
    if (window._videoLoadTimeout) {
      clearTimeout(window._videoLoadTimeout);
      window._videoLoadTimeout = null;
    }

    const video = videoRef.current;
    let message = 'El video no pudo cargarse.';

    if (video && video.error) {
      switch (video.error.code) {
        case 1:
          message = 'La reproduccion del video fue cancelada.';
          break;
        case 2:
          message = 'Error de red. Verifica tu conexion a internet.';
          break;
        case 3:
          message = 'El video no pudo ser decodificado.';
          break;
        case 4:
          message = 'El formato de video no es compatible.';
          break;
        default:
          message = 'Ocurrio un error al cargar el video.';
      }
    }

    setHasError(true);
    setErrorMessage(message);
    setIsLoading(false);

    if (onError) {
      onError({ code: video?.error?.code, message });
    }

    console.error('Video error:', message, video?.error);
  }, [onError]);

  // Retry loading the video
  const handleRetry = useCallback(() => {
    setHasError(false);
    setErrorMessage('');
    setIsLoading(true);
    setRetryCount(prev => prev + 1);
    setShowAlternative(false);

    const timeout = setTimeout(() => {
      setIsLoading(false);
      setHasError(true);
      setErrorMessage('El video no pudo cargarse. Tiempo de espera agotado.');
    }, 15000);

    if (window._videoLoadTimeout) {
      clearTimeout(window._videoLoadTimeout);
    }
    window._videoLoadTimeout = timeout;
  }, []);

  // Toggle alternative content view
  const toggleAlternative = useCallback(() => {
    setShowAlternative(prev => !prev);
  }, []);

  // Save progress before unmount or navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      const video = videoRef.current;
      if (video && video.currentTime > 0) {
        const data = JSON.stringify({
          currentTime: video.currentTime,
          duration: video.duration,
          completed: false
        });

        navigator.sendBeacon(
          `${API_BASE_URL}/video-progress/${lessonId}/${videoId}`,
          new Blob([data], { type: 'application/json' })
        );
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      const video = videoRef.current;
      if (video && video.currentTime > 0) {
        saveProgress(video.currentTime, video.duration);
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [lessonId, videoId, saveProgress]);

  // Format time as MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (isLoading && !hasError) {
    return (
      <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
        <div className="aspect-video flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
        </div>
      </div>
    );
  }

  // Error state - show fallback UI
  if (hasError) {
    return (
      <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
        <div className="aspect-video flex flex-col items-center justify-center p-8">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          <h3 className="text-white font-medium text-lg mb-2">
            Error al cargar el video
          </h3>
          <p className="text-gray-400 text-center mb-6 max-w-md">
            {errorMessage}
          </p>

          <div className="flex flex-wrap gap-3 justify-center">
            <button
              onClick={handleRetry}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reintentar{retryCount > 0 ? ` (${retryCount})` : ''}
            </button>

            {alternativeContent && (
              <button
                onClick={toggleAlternative}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Ver contenido alternativo
              </button>
            )}
          </div>

          {retryCount >= 2 && (
            <p className="text-gray-500 text-sm mt-4 text-center">
              Si el problema persiste, verifica tu conexion a internet o intenta mas tarde.
            </p>
          )}
        </div>

        {title && (
          <div className="p-4 bg-gray-800 border-t border-gray-700">
            <h3 className="text-white font-medium">{title}</h3>
          </div>
        )}

        {showAlternative && alternativeContent && (
          <div className="p-6 bg-gray-800 border-t border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-white font-medium">Contenido alternativo</h4>
              <button
                onClick={toggleAlternative}
                className="text-gray-400 hover:text-white"
                aria-label="Cerrar contenido alternativo"
                title="Cerrar"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="text-gray-300 prose prose-invert max-w-none">
              {typeof alternativeContent === 'string' ? (
                <p>{alternativeContent}</p>
              ) : (
                alternativeContent
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      {/* Resume notification */}
      {savedTime !== null && savedTime > 0 && !hasRestored && (
        <div className="absolute top-4 left-4 right-4 z-10 bg-black/75 text-white px-4 py-3 rounded-lg flex items-center justify-between">
          <span>
            Continuar desde {formatTime(savedTime)}?
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = savedTime;
                  setHasRestored(true);
                }
              }}
              className="px-3 py-1 bg-primary-600 hover:bg-primary-700 rounded text-sm font-medium"
            >
              Continuar
            </button>
            <button
              onClick={() => {
                setHasRestored(true);
              }}
              className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm font-medium"
            >
              Desde el inicio
            </button>
          </div>
        </div>
      )}

      <video
        key={retryCount}
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full aspect-video"
        controls
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPause={handlePause}
        onError={handleVideoError}
        onLoadedData={() => {
          if (window._videoLoadTimeout) {
            clearTimeout(window._videoLoadTimeout);
            window._videoLoadTimeout = null;
          }
          setIsLoading(false);
        }}
      >
        Tu navegador no soporta la reproduccion de video.
      </video>

      {title && (
        <div className="p-4 bg-gray-800">
          <h3 className="text-white font-medium">{title}</h3>
        </div>
      )}
    </div>
  );
}

/**
 * VideoPlayer component with progress tracking and error handling
 * Supports YouTube, Vimeo embeds and direct video playback
 * Saves playback position and resumes from saved position (direct video only)
 * Shows fallback UI when video fails to load
 */
function VideoPlayer({
  src,
  title,
  lessonId,
  videoId = 'main',
  poster,
  onProgress,
  onComplete,
  onError,
  alternativeContent,
  className = ''
}) {
  const videoInfo = parseVideoUrl(src);

  if (videoInfo.type === 'youtube') {
    return <YouTubeEmbed embedUrl={videoInfo.embedUrl} title={title} className={className} />;
  }

  if (videoInfo.type === 'vimeo') {
    return <VimeoEmbed embedUrl={videoInfo.embedUrl} title={title} className={className} />;
  }

  return (
    <DirectVideo
      src={src}
      title={title}
      lessonId={lessonId}
      videoId={videoId}
      poster={poster}
      onProgress={onProgress}
      onComplete={onComplete}
      onError={onError}
      alternativeContent={alternativeContent}
      className={className}
    />
  );
}

export default VideoPlayer;
