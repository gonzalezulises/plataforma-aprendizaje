import React from 'react';
import VideoPlayer from '../components/VideoPlayer';

/**
 * Test page for verifying VideoPlayer error handling (Feature #107)
 * This page intentionally uses a broken video URL to test the fallback UI
 */
function VideoTestPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          Video Error Handling Test
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-8">
          This page tests Feature #107: Video load failure shows fallback
        </p>

        {/* Test 1: Broken video URL */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Test 1: Invalid Video URL (Should show error)
          </h2>
          <VideoPlayer
            src="https://invalid-video-url-for-testing.com/nonexistent-video.mp4"
            title="Video con URL invalida"
            lessonId={999}
            videoId="test-error-1"
            alternativeContent="Esta es una leccion sobre funciones en Python. Las funciones te permiten encapsular codigo reutilizable. Incluye parametros, valores de retorno, y buenas practicas para escribir codigo limpio y mantenible."
          />
        </div>

        {/* Test 2: Working video URL */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Test 2: Working Video URL (Should play normally)
          </h2>
          <VideoPlayer
            src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
            title="Video funcionando correctamente"
            lessonId={998}
            videoId="test-working"
            alternativeContent="Este video muestra el cortometraje Big Buck Bunny, una animacion de codigo abierto."
          />
        </div>

        {/* Feature verification checklist */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-md">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Feature #107 Verification Checklist
          </h3>
          <ul className="space-y-2 text-gray-600 dark:text-gray-400">
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Navigate to video lesson (this page)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-green-500">✓</span>
              <span>Simulate video load failure (Test 1 uses invalid URL)</span>
            </li>
            <li className="flex items-start gap-2">
              <span>□</span>
              <span>Verify error message is shown ("Error al cargar el video")</span>
            </li>
            <li className="flex items-start gap-2">
              <span>□</span>
              <span>Verify retry option is available ("Reintentar" button)</span>
            </li>
            <li className="flex items-start gap-2">
              <span>□</span>
              <span>Verify alternative content suggestion ("Ver contenido alternativo" button)</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default VideoTestPage;
