import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import CodeBlock from '../components/CodeBlock';
import VideoPlayer from '../components/VideoPlayer';
import CourseSidebar from '../components/CourseSidebar';
import LessonComments from '../components/LessonComments';
import LessonContentRenderer from '../components/LessonContentRenderer';
import { csrfFetch } from '../utils/csrf';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Feature #136: Helper functions for localStorage code persistence
const LESSON_CODE_KEY_PREFIX = 'lesson_code_draft_';

const getCodeDraft = (lessonId, codeBlockIndex) => {
  try {
    const key = `${LESSON_CODE_KEY_PREFIX}${lessonId}_${codeBlockIndex}`;
    return localStorage.getItem(key);
  } catch (e) {
    console.warn('Failed to read code draft from localStorage:', e);
    return null;
  }
};

const saveCodeDraft = (lessonId, codeBlockIndex, code) => {
  try {
    const key = `${LESSON_CODE_KEY_PREFIX}${lessonId}_${codeBlockIndex}`;
    localStorage.setItem(key, code);
  } catch (e) {
    console.warn('Failed to save code draft to localStorage:', e);
  }
};

const clearCodeDraft = (lessonId, codeBlockIndex) => {
  try {
    const key = `${LESSON_CODE_KEY_PREFIX}${lessonId}_${codeBlockIndex}`;
    localStorage.removeItem(key);
  } catch (e) {
    console.warn('Failed to clear code draft from localStorage:', e);
  }
};

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
  // Feature #46: Sidebar state
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  // States for API-based lesson loading and error handling
  const [isLoading, setIsLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [apiLesson, setApiLesson] = useState(null);
  const [enrollmentRequired, setEnrollmentRequired] = useState(null); // { courseSlug, courseTitle }
  // Feature #15: State for premium content upgrade prompt
  const [premiumUpgradeRequired, setPremiumUpgradeRequired] = useState(null); // { courseSlug, courseTitle, upgradeUrl }
  // Feature #136: Track edited code for each code block (keyed by index)
  const [editedCode, setEditedCode] = useState({});
  // Inline exercise progress tracking (Phase 4)
  const [exerciseProgress, setExerciseProgress] = useState({});
  const [exerciseSummary, setExerciseSummary] = useState(null);

  const currentLessonId = parseInt(lessonId) || 1;

  const lesson = apiLesson;

  // Fetch lesson from API on mount
  useEffect(() => {
    let isMounted = true;

    const fetchLesson = async () => {
      setIsLoading(true);
      setNotFound(false);
      setLoadError(null);
      setApiLesson(null);
      setEnrollmentRequired(null);
      setPremiumUpgradeRequired(null); // Feature #15: Reset premium upgrade state

      try {
        // First, try to fetch from API
        const response = await fetch(
          `${API_BASE_URL}/lessons/${currentLessonId}`,
          { credentials: 'include' }
        );

        if (!isMounted) return;

        if (response.status === 404) {
          setNotFound(true);
        } else if (response.status === 401 || response.status === 403) {
          // User not authenticated or not enrolled - check response for enrollment requirement
          const data = await response.json();

          // Feature #15: Check if premium upgrade is required
          if (data.requiresUpgrade || data.isPremiumContent) {
            setPremiumUpgradeRequired({
              courseSlug: data.courseSlug || slug,
              courseId: data.courseId,
              courseTitle: data.courseTitle || 'este curso',
              upgradeUrl: data.upgradeUrl || '/upgrade',
              message: data.message || 'Este contenido es exclusivo para usuarios premium.'
            });
          } else if (data.requiresEnrollment) {
            setEnrollmentRequired({
              courseSlug: data.courseSlug || slug,
              courseId: data.courseId,
              courseTitle: data.courseTitle || 'este curso',
              requiresAuth: response.status === 401
            });
          } else {
            setEnrollmentRequired({
              courseSlug: slug,
              courseTitle: 'este curso',
              requiresAuth: response.status === 401
            });
          }
        } else if (!response.ok) {
          throw new Error('Failed to load lesson');
        } else {
          // Successfully fetched from API
          const data = await response.json();
          if (data.lesson && isMounted) {
            // Use navigation from API if available
            if (data.navigation) {
              setNavigation(data.navigation);
            }
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
                // Map 'video_url' to 'src' for video blocks
                if (c.type === 'video' && c.content?.video_url) {
                  transformed.src = c.content.video_url;
                  transformed.title = c.content.title || transformed.title || 'Video';
                }
                // If a 'code' block only has text (AI-generated markdown), treat as text
                if (c.type === 'code' && c.content?.text && !c.content?.code) {
                  transformed.type = 'text';
                  transformed.content = c.content.text;
                }
                // If a 'video' block only has text (AI-generated script), treat as text
                if (c.type === 'video' && c.content?.text && !c.content?.video_url && !transformed.src) {
                  transformed.type = 'text';
                  transformed.content = c.content.text;
                }
                // Map 'text' property to 'content' for text blocks (API uses 'text', component expects 'content')
                if (transformed.type === 'text' && c.content?.text && !transformed.content) {
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
        if (isMounted) {
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
        await csrfFetch(`${API_BASE_URL}/lessons/${currentLessonId}/start`, {
          method: 'POST'
        });
      } catch (error) {
        console.error('Error marking lesson as started:', error);
      }
    };

    fetchProgress();
    markLessonStarted();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentLessonId, isLoading, notFound, loadError]);

  // Feature #136: Load saved code drafts from localStorage when lesson loads
  useEffect(() => {
    if (!lesson || !lesson.content) return;

    const savedDrafts = {};
    lesson.content.forEach((block, index) => {
      if (block.type === 'code') {
        const savedCode = getCodeDraft(currentLessonId, index);
        if (savedCode !== null) {
          savedDrafts[index] = savedCode;
        }
      }
    });

    if (Object.keys(savedDrafts).length > 0) {
      setEditedCode(savedDrafts);
    }
  }, [lesson, currentLessonId]);

  // Feature #136: Handle code changes in editor
  const handleCodeChange = useCallback((index, newCode) => {
    setEditedCode(prev => ({
      ...prev,
      [index]: newCode
    }));
    // Save to localStorage
    saveCodeDraft(currentLessonId, index, newCode);
  }, [currentLessonId]);

  // Feature #136: Reset code to original
  const handleResetCode = useCallback((index, originalCode) => {
    setEditedCode(prev => {
      const updated = { ...prev };
      delete updated[index];
      return updated;
    });
    // Clear from localStorage
    clearCodeDraft(currentLessonId, index);
  }, [currentLessonId]);

  // Fetch inline exercise progress
  useEffect(() => {
    if (!lesson || isLoading) return;
    const fetchExerciseProgress = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/inline-exercises/${currentLessonId}/progress`,
          { credentials: 'include' }
        );
        if (response.ok) {
          const data = await response.json();
          setExerciseProgress(data.progress || {});
          setExerciseSummary(data.summary || null);
        }
      } catch (error) {
        // Silently fail - progress is optional
        console.debug('Could not fetch exercise progress:', error);
      }
    };
    fetchExerciseProgress();
  }, [currentLessonId, lesson, isLoading]);

  // Save inline exercise progress
  const handleExerciseComplete = useCallback(async (results) => {
    // Update local state immediately
    if (Array.isArray(results)) {
      // Quiz results
      const updates = {};
      results.forEach(r => {
        updates[r.questionIndex] = {
          status: 'completed',
          isCorrect: r.correct,
          attempts: 1
        };
      });
      setExerciseProgress(prev => ({ ...prev, ...updates }));
    }

    // Save to backend
    try {
      if (Array.isArray(results)) {
        // Save each quiz answer
        for (const r of results) {
          await csrfFetch(`${API_BASE_URL}/inline-exercises/${currentLessonId}/progress`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              exerciseIndex: r.questionIndex,
              exerciseType: 'quiz',
              status: 'completed',
              answer: r.selected,
              isCorrect: r.correct
            })
          });
        }
      } else if (results?.exerciseIndex !== undefined) {
        // Save code exercise attempt
        await csrfFetch(`${API_BASE_URL}/inline-exercises/${currentLessonId}/progress`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            exerciseIndex: results.exerciseIndex,
            exerciseType: 'code',
            status: results.attempted ? 'attempted' : 'completed',
            isCorrect: false
          })
        });
      }
    } catch (error) {
      console.debug('Could not save exercise progress:', error);
    }
  }, [currentLessonId]);

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
      const response = await csrfFetch(`${API_BASE_URL}/lessons/${currentLessonId}/complete`, {
        method: 'POST'
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
      window.scrollTo(0, 0);
    }
  };

  // Navigate to previous lesson
  const goToPreviousLesson = () => {
    if (navigation.previous) {
      navigate(`/course/${slug}/lesson/${navigation.previous.id}`);
      window.scrollTo(0, 0);
    }
  };

  // Feature #126: Execute code via backend API (not mocked)
  const [isExecutingCode, setIsExecutingCode] = useState(false);

  const handleRunCode = async (code) => {
    setIsExecutingCode(true);
    setCodeOutput('>>> Ejecutando codigo...');

    try {
      // Use challenges endpoint for code execution (Feature #126)
      // This provides real backend execution instead of mocked results
      const response = await csrfFetch(`${API_BASE_URL}/challenges/1/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ code, language: 'python' }),
      });

      const result = await response.json();

      if (!response.ok) {
        setCodeOutput(`>>> Error: ${result.error || 'Error al ejecutar el codigo'}`);
        return;
      }

      // Build output string based on result
      let output = '';

      if (result.syntax_error) {
        output = `>>> Error de sintaxis:\n${result.syntax_error_info?.message || 'Error de sintaxis en el codigo'}`;
        if (result.syntax_error_info?.line) {
          output += `\nLinea: ${result.syntax_error_info.line}`;
        }
      } else if (result.timeout) {
        output = `>>> ${result.timeout_message || 'Tiempo de ejecucion excedido'}`;
      } else if (result.memory_exceeded) {
        output = `>>> ${result.memory_error_message || 'Limite de memoria excedido'}`;
      } else if (result.error) {
        output = `>>> Error: ${result.error}`;
      } else if (result.output) {
        output = `>>> Salida:\n${result.output}`;
      } else {
        output = '>>> Codigo ejecutado (sin salida)';
      }

      if (result.execution_time_ms !== undefined) {
        output += `\n\n[Tiempo de ejecucion: ${result.execution_time_ms}ms]`;
      }

      setCodeOutput(output);
    } catch (error) {
      console.error('Error executing code:', error);
      setCodeOutput(`>>> Error de conexion: ${error.message}`);
    } finally {
      setIsExecutingCode(false);
    }
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

  // Feature #15: Premium upgrade required - Free user trying to access premium content
  if (premiumUpgradeRequired) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4">
        <div className="max-w-lg w-full">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            {/* Premium Crown Icon */}
            <div className="w-24 h-24 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg
                className="w-12 h-12 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
              </svg>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              Contenido Premium
            </h1>

            {/* Description */}
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {premiumUpgradeRequired.message}
            </p>

            {/* Premium benefits box */}
            <div className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl p-6 mb-8 text-left border border-amber-200 dark:border-amber-700">
              <h3 className="font-semibold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clipRule="evenodd" />
                </svg>
                Beneficios Premium
              </h3>
              <ul className="space-y-2 text-sm text-amber-800 dark:text-amber-200">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Acceso a todos los cursos premium
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Sugerencias de mejora con IA
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Acceso a webinars en vivo
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Certificados verificables
                </li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <Link
                to={premiumUpgradeRequired.upgradeUrl}
                className="w-full py-3 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-lg font-medium transition-all inline-flex items-center justify-center gap-2 shadow-lg hover:shadow-xl"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z"/>
                </svg>
                Actualizar a Premium
              </Link>

              <div className="flex gap-3">
                <Link
                  to={`/course/${premiumUpgradeRequired.courseSlug}`}
                  className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-center"
                >
                  Ver Curso
                </Link>
                <Link
                  to="/courses"
                  className="flex-1 py-3 px-4 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  Ver Cursos Gratis
                </Link>
              </div>
            </div>

            {/* Course info */}
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              Curso: {premiumUpgradeRequired.courseTitle}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Enrollment required - User not enrolled in the course
  if (enrollmentRequired) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center py-12 px-4">
        <div className="max-w-lg w-full">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 text-center">
            {/* Lock Icon */}
            <div className="w-24 h-24 bg-gradient-to-br from-primary-400 to-primary-600 rounded-full flex items-center justify-center mx-auto mb-6">
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
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>

            {/* Title */}
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {enrollmentRequired.requiresAuth ? 'Inicia sesion para continuar' : 'Inscripcion requerida'}
            </h1>

            {/* Description */}
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              {enrollmentRequired.requiresAuth
                ? 'Debes iniciar sesion para acceder a esta leccion.'
                : `Para acceder a esta leccion, necesitas estar inscrito en "${enrollmentRequired.courseTitle}".`
              }
            </p>

            {/* Info box */}
            <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-6 mb-8 text-left border border-primary-200 dark:border-primary-700">
              <h3 className="font-semibold text-primary-900 dark:text-primary-100 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {enrollmentRequired.requiresAuth ? 'Acceso restringido' : 'Como inscribirte'}
              </h3>
              <ul className="space-y-2 text-sm text-primary-800 dark:text-primary-200">
                {enrollmentRequired.requiresAuth ? (
                  <>
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Esta leccion es parte de un curso que requiere cuenta
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Inicia sesion o crea una cuenta para continuar
                    </li>
                  </>
                ) : (
                  <>
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      La inscripcion es rapida y sencilla
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Podras guardar tu progreso en cada leccion
                    </li>
                    <li className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-primary-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Recibiras certificado al completar el curso
                    </li>
                  </>
                )}
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              {enrollmentRequired.requiresAuth ? (
                <Link
                  to="/login"
                  className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Iniciar Sesion
                </Link>
              ) : (
                <Link
                  to={`/course/${enrollmentRequired.courseSlug}`}
                  className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors inline-flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Ver Curso e Inscribirme
                </Link>
              )}

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
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  Inicio
                </Link>
              </div>
            </div>

            {/* Lesson ID info */}
            <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
              Leccion ID: {currentLessonId} | Curso: {enrollmentRequired.courseSlug}
            </p>
          </div>
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Feature #46: Course Sidebar Navigation */}
      {isSidebarOpen && (
        <div className="hidden lg:block w-80 flex-shrink-0 transition-all duration-300">
          <div className="fixed top-0 left-0 h-screen w-80 pt-16 z-40">
            <CourseSidebar
              courseSlug={lesson.courseSlug || slug}
              currentLessonId={currentLessonId}
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Mobile sidebar toggle */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="lg:hidden fixed bottom-4 left-4 z-50 p-3 bg-primary-600 text-white rounded-full shadow-lg hover:bg-primary-700 transition-colors"
        aria-label={isSidebarOpen ? 'Cerrar menu de navegacion' : 'Abrir menu de navegacion'}
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Mobile sidebar overlay */}
      {isSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-80 pt-16">
            <CourseSidebar
              courseSlug={lesson.courseSlug || slug}
              currentLessonId={currentLessonId}
              isOpen={isSidebarOpen}
              onClose={() => setIsSidebarOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 min-w-0">
        {/* Progress bar */}
        <div className="bg-gray-200 dark:bg-gray-700 h-1">
          <div
            className="bg-primary-600 h-1 transition-all duration-300"
            style={{ width: `${lessonProgress.isCompleted ? 100 : lessonProgress.videoProgress}%` }}
          />
        </div>

        {/* Breadcrumb navigation - Feature #45: Home > Course > Module > Lesson */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="max-w-5xl mx-auto px-4 py-3">
            <div className="flex items-center gap-2">
              {/* Sidebar toggle button for desktop */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="hidden lg:flex items-center justify-center p-2 -ml-2 mr-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                aria-label={isSidebarOpen ? 'Ocultar navegacion' : 'Mostrar navegacion'}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {isSidebarOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
              <nav className="flex items-center gap-2 text-sm flex-wrap" aria-label="Breadcrumb">
                <Link to="/" className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400">
                  Inicio
                </Link>
                <span className="text-gray-400" aria-hidden="true">/</span>
                <Link to={`/course/${lesson.courseSlug || slug}`} className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400">
                  {lesson.course}
                </Link>
                <span className="text-gray-400" aria-hidden="true">/</span>
                <Link to={`/course/${lesson.courseSlug || slug}`} className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400">
                  {lesson.module}
                </Link>
                <span className="text-gray-400" aria-hidden="true">/</span>
                <span className="text-gray-700 dark:text-gray-300 font-medium" aria-current="page">{lesson.title}</span>
              </nav>
            </div>
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
                <div key={index} className="mb-8">
                  <LessonContentRenderer
                    content={typeof block.content === 'string' ? block.content : (block.content?.text || '')}
                    courseContext={{ language: lesson.courseSlug?.includes('sql') ? 'sql' : 'python' }}
                    interactive={true}
                    onExerciseComplete={handleExerciseComplete}
                    exerciseProgress={exerciseProgress}
                  />
                </div>
              );
            }
            if (block.type === 'code') {
              // Feature #136: Use edited code if available, otherwise use original
              const currentCode = editedCode[index] !== undefined ? editedCode[index] : block.code;
              const isModified = editedCode[index] !== undefined && editedCode[index] !== block.code;
              const lines = currentCode.split('\n');

              return (
                <div key={index} className="mb-8">
                  {/* Editable code editor (Feature #136) */}
                  <div className="rounded-lg overflow-hidden shadow-lg">
                    {/* Header bar */}
                    <div className="bg-gray-800 dark:bg-gray-700 px-4 py-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {/* Traffic light dots */}
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <div className="w-3 h-3 rounded-full bg-yellow-500" />
                          <div className="w-3 h-3 rounded-full bg-green-500" />
                        </div>
                        {block.title && (
                          <span className="ml-4 text-sm text-gray-400 font-mono">{block.title}</span>
                        )}
                        <span className="ml-2 text-xs text-gray-500 font-mono uppercase">{block.language}</span>
                        {isModified && (
                          <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-500 text-white">
                            Modificado
                          </span>
                        )}
                      </div>
                      <button
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(currentCode);
                          } catch (err) {
                            console.error('Failed to copy code:', err);
                          }
                        }}
                        className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                        Copiar
                      </button>
                    </div>

                    {/* Editable code area */}
                    <div className="relative bg-gray-900 dark:bg-gray-950">
                      <textarea
                        value={currentCode}
                        onChange={(e) => handleCodeChange(index, e.target.value)}
                        className="w-full min-h-[200px] p-4 pl-12 font-mono text-sm bg-transparent text-green-400 resize-y focus:outline-none focus:ring-2 focus:ring-primary-500 overflow-auto"
                        spellCheck={false}
                        placeholder="Escribe tu codigo aqui..."
                        style={{
                          height: `${Math.max(200, lines.length * 24 + 32)}px`,
                          tabSize: 4
                        }}
                      />
                      {/* Line numbers overlay */}
                      <div className="absolute left-0 top-0 p-4 font-mono text-sm pointer-events-none select-none overflow-hidden" style={{ height: `${Math.max(200, lines.length * 24 + 32)}px` }}>
                        {lines.map((_, idx) => (
                          <div key={idx} className="h-6 text-right pr-2 w-8 text-gray-500">
                            {idx + 1}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleRunCode(currentCode)}
                      disabled={isExecutingCode}
                      className="px-4 py-2 bg-success-700 hover:bg-success-800 disabled:bg-success-600 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      {isExecutingCode ? (
                        <>
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Ejecutando...
                        </>
                      ) : (
                        <>
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Ejecutar
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleResetCode(index, block.code)}
                      disabled={!isModified}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                        isModified
                          ? 'bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </svg>
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

        {/* Exercise progress indicator */}
        {exerciseSummary && exerciseSummary.total > 0 && (
          <div className="mt-8 p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
                  <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-medium text-indigo-900 dark:text-indigo-100">
                    Ejercicios completados
                  </h3>
                  <p className="text-sm text-indigo-700 dark:text-indigo-300">
                    {exerciseSummary.completed} de {exerciseSummary.total} ejercicios ({exerciseSummary.completionRate}%)
                  </p>
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-32 h-2 bg-indigo-200 dark:bg-indigo-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-600 dark:bg-indigo-400 rounded-full transition-all duration-500"
                  style={{ width: `${exerciseSummary.completionRate}%` }}
                />
              </div>
            </div>
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

        {/* Lesson Comments - Feature #74 */}
        <LessonComments lessonId={currentLessonId} />

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
      </div>{/* End of main content area */}
    </div>
  );
}

export default LessonPage;
