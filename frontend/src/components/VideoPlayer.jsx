import React, { useRef, useEffect, useState, useCallback } from 'react';

// API_BASE_URL already includes /api suffix from env
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * VideoPlayer component with progress tracking
 * Saves playback position and resumes from saved position
 */
function VideoPlayer({
  src,
  title,
  lessonId,
  videoId = 'main',
  poster,
  onProgress,
  onComplete,
  className = ''
}) {
  const videoRef = useRef(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savedTime, setSavedTime] = useState(null);
  const [hasRestored, setHasRestored] = useState(false);
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

    const handleLoadedMetadata = () => {
      if (savedTime > 0 && savedTime < video.duration - 5) {
        video.currentTime = savedTime;
        setHasRestored(true);
      }
    };

    // If metadata is already loaded
    if (video.readyState >= 1) {
      handleLoadedMetadata();
    } else {
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

  // Save progress before unmount or navigation
  useEffect(() => {
    const handleBeforeUnload = () => {
      const video = videoRef.current;
      if (video && video.currentTime > 0) {
        // Use sendBeacon for reliable saving during navigation
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
      // Save progress on component unmount
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

  if (isLoading) {
    return (
      <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
        <div className="aspect-video flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
        </div>
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
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full aspect-video"
        controls
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onPause={handlePause}
      >
        Tu navegador no soporta la reproduccion de video.
      </video>

      {/* Video title */}
      {title && (
        <div className="p-4 bg-gray-800">
          <h3 className="text-white font-medium">{title}</h3>
        </div>
      )}
    </div>
  );
}

export default VideoPlayer;
