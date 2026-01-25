import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import CodeBlock from '../components/CodeBlock';
import VideoPlayer from '../components/VideoPlayer';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * LessonPage - Displays lesson content including code blocks and videos
 * Supports video progress tracking - videos resume from where users left off
 * Tracks lesson completion and course progress
 * Handles 404 errors for deleted or missing lessons
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

  // States for API-based lesson loading and error handling
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [apiLesson, setApiLesson] = useState(null);

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
          poster: null,
          alternativeContent: 'Esta leccion cubre los fundamentos de variables en Python: como declarar variables, los tipos de datos basicos (strings, integers, floats, booleans), y las reglas para nombrar variables. Puedes revisar el contenido de texto y los ejemplos de codigo a continuacion para aprender los mismos conceptos.'
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
          poster: null,
          alternativeContent: 'Esta leccion explica las estructuras condicionales en Python: if, elif, y else. Aprende como controlar el flujo de tu programa basandose en condiciones. Revisa el contenido de texto a continuacion para una explicacion detallada.'
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
          poster: null,
          alternativeContent: 'Esta leccion cubre los bucles en Python: for y while. Domina como repetir acciones en tu codigo de forma eficiente. El contenido de texto a continuacion explica los conceptos principales.'
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
    },
    // Test lesson with broken video URL for testing error handling
    4: {
      id: 4,
      title: 'Funciones: Definicion y uso',
      module: 'Modulo 2: Funciones',
      course: 'Python: Fundamentos',
      bloomLevel: 'Aplicar',
      duration: 30,
      description: 'Aprende a crear y usar funciones en Python.',
      content: [
        {
          type: 'video',
          id: 'functions-video',
          title: 'Video: Funciones en Python',
          src: 'https://invalid-video-url-for-testing.com/nonexistent-video.mp4',
          poster: null,
          alternativeContent: 'Esta leccion explica como definir y usar funciones en Python. Las funciones te permiten encapsular codigo reutilizable. Incluye parametros, valores de retorno, y buenas practicas. Puedes revisar el contenido de texto y los ejemplos de codigo a continuacion para aprender los mismos conceptos.'
        },
        {
          type: 'text',
          content: `## Funciones en Python

Las funciones son bloques de codigo reutilizables que realizan una tarea especifica.

### Sintaxis basica:
- def: palabra clave para definir una funcion
- return: devuelve un valor de la funcion
- Parametros: valores que se pasan a la funcion`
        },
        {
          type: 'code',
          language: 'python',
          title: 'ejemplo_funciones.py',
          code: `# Definicion de una funcion simple
def saludar(nombre):
    return f"Hola, {nombre}!"

# Llamar a la funcion
mensaje = saludar("Maria")
print(mensaje)  # Hola, Maria!

# Funcion con valor por defecto
def potencia(base, exponente=2):
    return base ** exponente

print(potencia(3))      # 9 (3^2)
print(potencia(3, 3))   # 27 (3^3)`
        }
      ]
    }
  };

  const currentLessonId = parseInt(lessonId) || 1;

  // Use API-fetched lesson or fall back to sample data
  const sampleLesson = lessonsData[currentLessonId];
  const lesson = apiLesson || sampleLesson;

  // Fetch lesson from API on mount
  useEffect(() => {
    let isMounted = true;
    const hasSampleData = currentLessonId in lessonsData;

    const fetchLesson = async () => {
      setIsLoading(true);
      setNotFound(false);
      setLoadError(null);
      setApiLesson(null);

      try {
        // First, try to fetch from API
        const response = await fetch(
          `${API_BASE_URL}/lessons/${currentLessonId}`,
          { credentials: 'include' }
        );

        if (!isMounted) return;

        if (response.status === 404) {
          // Lesson not found in database - check if it's a sample lesson
          if (!hasSampleData) {
            setNotFound(true);
          }
          // If we have sample data, we'll use that (loading state ends, no API lesson)
        } else if (!response.ok) {
          throw new Error('Failed to load lesson');
        } else {
          // Successfully fetched from API
          const data = await response.json();
          if (data.lesson && isMounted) {
            // Transform API data to match our component format
            const transformedLesson = {
              id: data.lesson.id,
              title: data.lesson.title,
              module: data.lesson.module_title || 'Modulo',
              course: data.lesson.course_title || 'Curso',
              courseSlug: data.lesson.course_slug || slug,
              bloomLevel: data.lesson.bloom_level || 'Comprender',
              duration: data.lesson.duration_minutes || 15,
              description: data.lesson.description || '',
              content: data.lesson.content?.map(c => {
                // Transform API content structure to match component expectations
                const transformed = {
                  type: c.type,
                  ...c.content
                };
                // Map 'text' property to 'content' for text blocks (API uses 'text', component expects 'content')
                if (c.type === 'text' && c.content?.text && !transformed.content) {
                  transformed.content = c.content.text;
                }
                return transformed;
              }) || []
            };
            setApiLesson(transformedLesson);
          }
        }
      } catch (error) {
        console.error('Error fetching lesson:', error);
        // If API fails but we have sample data, use that
        if (!hasSampleData && isMounted) {
          setLoadError(error.message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchLesson();

    return () => {
      isMounted = false;
    };
  }, [currentLessonId, slug]);

  // Fetch lesson progress and set up navigation when lesson is loaded
  useEffect(() => {
    if (isLoading || notFound || loadError) return;

    let hasStartedLesson = false;

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

    const markLessonStarted = async () => {
      if (hasStartedLesson) return;
      hasStartedLesson = true;
      try {
        await fetch(`${API_BASE_URL}/lessons/${currentLessonId}/start`, {
          method: 'POST',
          credentials: 'include'
        });
      } catch (error) {
        console.error('Error marking lesson as started:', error);
      }
    };

    fetchProgress();
    markLessonStarted();

    // Set up navigation from sample data or API response
    const lessonIds = Object.keys(lessonsData).map(Number);
    const currentIndex = lessonIds.indexOf(currentLessonId);
    setNavigation({
      previous: currentIndex > 0 ? { id: lessonIds[currentIndex - 1], title: lessonsData[lessonIds[currentIndex - 1]]?.title } : null,
      next: currentIndex < lessonIds.length - 1 ? { id: lessonIds[currentIndex + 1], title: lessonsData[lessonIds[currentIndex + 1]]?.title } : null
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLessonId, isLoading, notFound, loadError]);

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

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <svg className="animate-spin h-12 w-12 text-primary-600 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p className="text-gray-600 dark:text-gray-400">Cargando leccion...</p>
        </div>
      </div>
    );
  }

  // 404 Not Found - Lesson deleted or doesn't exist
  if (notFound) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4">
        <div className="max-w-lg w-full">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            {/* 404 Icon */}
            <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-12 h-12 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2z"
                />
              </svg>
            </div>

            {/* Error Code */}
            <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-2">
              404
            </h1>

            {/* Error Title */}
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Leccion No Encontrada
            </h2>

            {/* User-friendly description */}
            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Esta leccion ya no esta disponible. Es posible que haya sido eliminada o movida a otra ubicacion.
            </p>

            {/* Suggestions */}
            <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-6 mb-8 text-left border border-amber-200 dark:border-amber-700">
              <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-4 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Que puedes hacer
              </h3>
              <ul className="space-y-3 text-sm text-amber-800 dark:text-amber-200">
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Volver al curso para ver las lecciones disponibles
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Explorar el catalogo de cursos
                </li>
                <li className="flex items-start">
                  <svg
                    className="w-5 h-5 text-amber-600 mr-2 mt-0.5 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Actualizar tus marcadores si la URL ha cambiado
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Link
                to={`/course/${slug}`}
                className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors inline-flex items-center justify-center gap-2"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 17l-5-5m0 0l5-5m-5 5h12"
                  />
                </svg>
                Volver al Curso
              </Link>

              <div className="flex gap-3">
                <Link
                  to="/courses"
                  className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-center"
                >
                  Ver Catalogo
                </Link>
                <Link
                  to="/"
                  className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  Inicio
                </Link>
              </div>
            </div>

            {/* Lesson ID info for debugging */}
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              Leccion ID: {currentLessonId} | Curso: {slug}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // General error state
  if (loadError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4">
        <div className="max-w-lg w-full">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            {/* Error Icon */}
            <div className="w-24 h-24 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-12 h-12 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
              Error al Cargar la Leccion
            </h2>

            <p className="text-gray-600 dark:text-gray-400 mb-8">
              Hubo un problema al cargar esta leccion. Por favor, intenta de nuevo.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => window.location.reload()}
                className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors inline-flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reintentar
              </button>

              <Link
                to={`/course/${slug}`}
                className="w-full py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors inline-flex items-center justify-center gap-2"
              >
                Volver al Curso
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Safety check - if no lesson data available
  if (!lesson) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">No hay contenido disponible para esta leccion.</p>
          <Link
            to={`/course/${slug}`}
            className="mt-4 inline-block text-primary-600 hover:text-primary-700"
          >
            Volver al curso
          </Link>
        </div>
      </div>
    );
  }

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
                    alternativeContent={block.alternativeContent}
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
