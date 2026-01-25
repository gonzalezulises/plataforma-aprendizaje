import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import CodeBlock from '../components/CodeBlock';
import VideoPlayer from '../components/VideoPlayer';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * LessonPage - Displays lesson content including code blocks and videos
 * Supports video progress tracking - videos resume from where users left off
 * Tracks lesson completion and course progress
 */
function LessonPage() {
  const { slug, lessonId } = useParams();
  const navigate = useNavigate();
  const [codeOutput, setCodeOutput] = useState(null);
  const [lessonProgress, setLessonProgress] = useState({
    status: 'not_started',
    videoProgress: 0,
    isCompleted: false
  });
  const [isMarkingComplete, setIsMarkingComplete] = useState(false);
  const [navigation, setNavigation] = useState({ previous: null, next: null });

  // Sample lesson data with multiple lessons for navigation testing
  const lessonsData = {
    1: {
      id: 1,
      title: 'Introduccion a Python: Variables y Tipos de Datos',
      module: 'Modulo 1: Fundamentos',
      course: 'Python: Fundamentos',
      bloomLevel: 'Comprender',
      duration: 15,
      description: 'En esta leccion aprenderemos los conceptos basicos de variables y tipos de datos en Python.',
      content: [
        {
          type: 'video',
          id: 'intro-video',
          title: 'Video: Introduccion a Variables en Python',
          src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
          poster: null
        },
        {
          type: 'text',
          content: `## Variables en Python

Las variables en Python son contenedores para almacenar valores de datos. A diferencia de otros lenguajes de programacion, Python no requiere declarar el tipo de variable explicitamente.

### Reglas para nombrar variables:
- Deben comenzar con una letra o guion bajo
- Solo pueden contener caracteres alfanumericos y guiones bajos
- Son sensibles a mayusculas y minusculas`
        },
        {
          type: 'code',
          language: 'python',
          title: 'ejemplo_variables.py',
          code: `# Asignacion de variables
nombre = "Maria"
edad = 25
altura = 1.65
es_estudiante = True

# Imprimiendo variables
print(f"Nombre: {nombre}")
print(f"Edad: {edad}")
print(f"Altura: {altura}m")
print(f"Es estudiante: {es_estudiante}")

# Tipo de cada variable
print(type(nombre))    # <class 'str'>
print(type(edad))      # <class 'int'>
print(type(altura))    # <class 'float'>
print(type(es_estudiante))  # <class 'bool'>`
        }
      ]
    },
    2: {
      id: 2,
      title: 'Estructuras de Control: Condicionales',
      module: 'Modulo 1: Fundamentos',
      course: 'Python: Fundamentos',
      bloomLevel: 'Aplicar',
      duration: 20,
      description: 'Aprende a controlar el flujo de tu programa con if, elif y else.',
      content: [
        {
          type: 'video',
          id: 'conditionals-video',
          title: 'Video: Condicionales en Python',
          src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
          poster: null
        },
        {
          type: 'text',
          content: `## Condicionales en Python

Las estructuras condicionales permiten ejecutar codigo basandose en condiciones.

### Sintaxis basica:
- if: evalua una condicion
- elif: evalua condiciones adicionales
- else: se ejecuta si ninguna condicion es verdadera`
        }
      ]
    },
    3: {
      id: 3,
      title: 'Bucles: for y while',
      module: 'Modulo 1: Fundamentos',
      course: 'Python: Fundamentos',
      bloomLevel: 'Aplicar',
      duration: 25,
      description: 'Domina los bucles para repetir acciones en tu codigo.',
      content: [
        {
          type: 'video',
          id: 'loops-video',
          title: 'Video: Bucles en Python',
          src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
          poster: null
        },
        {
          type: 'text',
          content: `## Bucles en Python

Los bucles permiten repetir bloques de codigo.

### Tipos de bucles:
- for: itera sobre una secuencia
- while: repite mientras una condicion sea verdadera`
        }
      ]
    }
  };

  const currentLessonId = parseInt(lessonId) || 1;
  const lesson = lessonsData[currentLessonId] || lessonsData[1];

  // Fetch lesson progress on mount
  useEffect(() => {
    const fetchProgress = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/lessons/${currentLessonId}/progress`,
          { credentials: 'include' }
        );
        if (response.ok) {
          const data = await response.json();
          setLessonProgress(prev => ({
            ...prev,
            status: data.status,
            isCompleted: data.status === 'completed'
          }));
        }
      } catch (error) {
        console.error('Error fetching lesson progress:', error);
      }
    };

    fetchProgress();
    // Mark lesson as started
    markLessonStarted();

    // Set up navigation
    const lessonIds = Object.keys(lessonsData).map(Number);
    const currentIndex = lessonIds.indexOf(currentLessonId);
    setNavigation({
      previous: currentIndex > 0 ? { id: lessonIds[currentIndex - 1], title: lessonsData[lessonIds[currentIndex - 1]]?.title } : null,
      next: currentIndex < lessonIds.length - 1 ? { id: lessonIds[currentIndex + 1], title: lessonsData[lessonIds[currentIndex + 1]]?.title } : null
    });
  }, [currentLessonId]);

  // Mark lesson as started
  const markLessonStarted = async () => {
    try {
      await fetch(`${API_BASE_URL}/lessons/${currentLessonId}/start`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.error('Error marking lesson as started:', error);
    }
  };

  // Handle video progress update
  const handleVideoProgress = useCallback((progressData) => {
    const { percent } = progressData;
    setLessonProgress(prev => ({
      ...prev,
      videoProgress: Math.round(percent)
    }));
  }, []);

  // Handle video completion
  const handleVideoComplete = useCallback(() => {
    setLessonProgress(prev => ({
      ...prev,
      videoProgress: 100
    }));
  }, []);

  // Mark lesson as complete
  const markLessonComplete = async () => {
    if (isMarkingComplete || lessonProgress.isCompleted) return;

    setIsMarkingComplete(true);
    try {
      const response = await fetch(`${API_BASE_URL}/lessons/${currentLessonId}/complete`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setLessonProgress(prev => ({
          ...prev,
          status: 'completed',
          isCompleted: true
        }));

        // Update navigation from response if available
        if (data.navigation) {
          setNavigation(data.navigation);
        }
      }
    } catch (error) {
      console.error('Error marking lesson as complete:', error);
    } finally {
      setIsMarkingComplete(false);
    }
  };

  // Navigate to next lesson
  const goToNextLesson = () => {
    if (navigation.next) {
      navigate(`/course/${slug}/lesson/${navigation.next.id}`);
    }
  };

  // Navigate to previous lesson
  const goToPreviousLesson = () => {
    if (navigation.previous) {
      navigate(`/course/${slug}/lesson/${navigation.previous.id}`);
    }
  };

  const handleRunCode = (code) => {
    setCodeOutput(`>>> Ejecutando codigo...
Nombre: Maria
Edad: 25
Altura: 1.65m
Es estudiante: True
<class 'str'>
<class 'int'>
<class 'float'>
<class 'bool'>`);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Progress bar */}
      <div className="bg-gray-200 dark:bg-gray-700 h-1">
        <div
          className="bg-primary-600 h-1 transition-all duration-300"
          style={{ width: `${lessonProgress.isCompleted ? 100 : lessonProgress.videoProgress}%` }}
        />
      </div>

      {/* Breadcrumb navigation */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link to="/courses" className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400">
              Cursos
            </Link>
            <span className="text-gray-400">/</span>
            <Link to={`/course/${slug}`} className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400">
              {lesson.course}
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-700 dark:text-gray-300">{lesson.module}</span>
          </nav>
        </div>
      </div>

      {/* Lesson header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-3">
            <span className="px-2 py-1 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300">
              {lesson.bloomLevel}
            </span>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {lesson.duration} min
            </span>
            {lessonProgress.isCompleted && (
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 flex items-center gap-1">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Completada
              </span>
            )}
            {!lessonProgress.isCompleted && lessonProgress.videoProgress > 0 && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Progreso: {lessonProgress.videoProgress}%
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {lesson.title}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {lesson.description}
          </p>
        </div>
      </div>

      {/* Lesson content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="prose dark:prose-invert max-w-none">
          {lesson.content.map((block, index) => {
            if (block.type === 'text') {
              return (
                <div key={index} className="mb-8 text-gray-700 dark:text-gray-300">
                  {block.content.split('\n').map((line, lineIndex) => {
                    if (line.startsWith('## ')) {
                      return (
                        <h2 key={lineIndex} className="text-xl font-bold text-gray-900 dark:text-white mt-6 mb-3">
                          {line.replace('## ', '')}
                        </h2>
                      );
                    }
                    if (line.startsWith('### ')) {
                      return (
                        <h3 key={lineIndex} className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
                          {line.replace('### ', '')}
                        </h3>
                      );
                    }
                    if (line.startsWith('- ')) {
                      return (
                        <li key={lineIndex} className="ml-4 text-gray-600 dark:text-gray-400">
                          {line.replace('- ', '')}
                        </li>
                      );
                    }
                    if (line.startsWith('| ')) {
                      if (line.includes('---')) return null;
                      const cells = line.split('|').filter(c => c.trim());
                      return (
                        <div key={lineIndex} className="font-mono text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 grid grid-cols-3 gap-2 border-b border-gray-200 dark:border-gray-700">
                          {cells.map((cell, cellIndex) => (
                            <span key={cellIndex} className="truncate">{cell.trim()}</span>
                          ))}
                        </div>
                      );
                    }
                    return line ? (
                      <p key={lineIndex} className="mb-2">{line}</p>
                    ) : null;
                  })}
                </div>
              );
            }
            if (block.type === 'code') {
              return (
                <div key={index} className="mb-8">
                  <CodeBlock
                    code={block.code}
                    language={block.language}
                    title={block.title}
                    showLineNumbers={true}
                  />
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleRunCode(block.code)}
                      className="px-4 py-2 bg-success-500 hover:bg-success-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Ejecutar
                    </button>
                    <button className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors">
                      Resetear
                    </button>
                  </div>
                </div>
              );
            }
            if (block.type === 'video') {
              return (
                <div key={index} className="mb-8">
                  <VideoPlayer
                    src={block.src}
                    title={block.title}
                    lessonId={lesson.id}
                    videoId={block.id || `video-${index}`}
                    poster={block.poster}
                    onProgress={handleVideoProgress}
                    onComplete={handleVideoComplete}
                  />
                </div>
              );
            }
            return null;
          })}
        </div>

        {/* Code output panel */}
        {codeOutput && (
          <div className="mt-6 bg-gray-900 dark:bg-gray-950 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-400">Salida</h3>
              <button
                onClick={() => setCodeOutput(null)}
                className="text-gray-500 hover:text-gray-400"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <pre className="font-mono text-sm text-green-400 whitespace-pre-wrap">{codeOutput}</pre>
          </div>
        )}

        {/* Mark Complete button */}
        {!lessonProgress.isCompleted && (
          <div className="mt-8 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-medium text-blue-900 dark:text-blue-100">
                  Marcar leccion como completada
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  {lessonProgress.videoProgress >= 80
                    ? 'Has visto suficiente del video. Puedes marcar la leccion como completada.'
                    : `Progreso del video: ${lessonProgress.videoProgress}%. Mira al menos 80% para completar automaticamente.`}
                </p>
              </div>
              <button
                onClick={markLessonComplete}
                disabled={isMarkingComplete}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {isMarkingComplete ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Guardando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Marcar como completada
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Success message when completed */}
        {lessonProgress.isCompleted && (
          <div className="mt-8 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="font-medium text-green-900 dark:text-green-100">
                  Leccion completada
                </h3>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Excelente trabajo! Tu progreso ha sido guardado.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-12 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {navigation.previous ? (
              <button
                onClick={goToPreviousLesson}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Anterior
              </button>
            ) : (
              <Link
                to={`/course/${slug}`}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
              >
                Volver al curso
              </Link>
            )}
          </div>

          {navigation.next ? (
            <button
              onClick={goToNextLesson}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              Siguiente leccion
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <Link
              to={`/course/${slug}`}
              className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
            >
              Finalizar curso
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default LessonPage;
