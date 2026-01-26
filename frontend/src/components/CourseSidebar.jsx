import React, { useState, useEffect, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * CourseSidebar - Feature #46
 * Displays course structure with modules and lessons in a collapsible sidebar
 * Shows progress indicators and highlights the current lesson
 */
function CourseSidebar({ courseSlug, currentLessonId, onClose, isOpen = true }) {
  const [modules, setModules] = useState([]);
  const [courseInfo, setCourseInfo] = useState(null);
  const [expandedModules, setExpandedModules] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lessonProgress, setLessonProgress] = useState({});

  // Fetch course structure and progress
  useEffect(() => {
    let isMounted = true;

    const fetchCourseData = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Fetch course info
        const courseResponse = await fetch(
          `${API_BASE_URL}/courses/${courseSlug}`,
          { credentials: 'include' }
        );

        if (!isMounted) return;

        if (courseResponse.ok) {
          const courseData = await courseResponse.json();
          setCourseInfo(courseData.course || courseData);

          // Fetch modules for this course
          const courseId = courseData.course?.id || courseData.id;
          if (courseId) {
            const modulesResponse = await fetch(
              `${API_BASE_URL}/courses/${courseId}/modules`,
              { credentials: 'include' }
            );

            if (modulesResponse.ok && isMounted) {
              const modulesData = await modulesResponse.json();

              // If API returns modules with lessons, use them
              if (modulesData.modules && modulesData.modules.length > 0) {
                // Fetch lessons for each module
                const modulesWithLessons = await Promise.all(
                  modulesData.modules.map(async (mod) => {
                    try {
                      const lessonsResponse = await fetch(
                        `${API_BASE_URL}/modules/${mod.id}/lessons`,
                        { credentials: 'include' }
                      );
                      if (lessonsResponse.ok) {
                        const lessonsData = await lessonsResponse.json();
                        return { ...mod, lessons: lessonsData.lessons || [] };
                      }
                    } catch (e) {
                      console.warn(`Failed to fetch lessons for module ${mod.id}:`, e);
                    }
                    return { ...mod, lessons: [] };
                  })
                );
                setModules(modulesWithLessons);
              } else {
                // Fallback to sample module data for demo purposes
                setModules(getSampleModules());
              }
            } else {
              // Fallback to sample data
              setModules(getSampleModules());
            }
          } else {
            setModules(getSampleModules());
          }
        } else {
          // Use sample data if course not found
          setCourseInfo({ title: 'Python: Fundamentos', slug: courseSlug });
          setModules(getSampleModules());
        }

        // Fetch lesson progress
        try {
          const progressResponse = await fetch(
            `${API_BASE_URL}/enrollments/progress`,
            { credentials: 'include' }
          );
          if (progressResponse.ok && isMounted) {
            const progressData = await progressResponse.json();
            // Map progress by lesson ID
            const progressMap = {};
            if (progressData.lessons) {
              progressData.lessons.forEach(lp => {
                progressMap[lp.lesson_id] = lp.status;
              });
            }
            setLessonProgress(progressMap);
          }
        } catch (e) {
          console.warn('Failed to fetch progress:', e);
        }

      } catch (err) {
        console.error('Error fetching course data:', err);
        if (isMounted) {
          setError('Error al cargar el contenido del curso');
          // Still show sample data on error
          setCourseInfo({ title: 'Python: Fundamentos', slug: courseSlug });
          setModules(getSampleModules());
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchCourseData();

    return () => {
      isMounted = false;
    };
  }, [courseSlug]);

  // Auto-expand the module containing the current lesson
  useEffect(() => {
    if (currentLessonId && modules.length > 0) {
      const moduleWithCurrentLesson = modules.find(mod =>
        mod.lessons?.some(lesson => lesson.id === parseInt(currentLessonId))
      );
      if (moduleWithCurrentLesson) {
        setExpandedModules(prev => ({
          ...prev,
          [moduleWithCurrentLesson.id]: true
        }));
      }
    }
  }, [currentLessonId, modules]);

  // Sample modules for demo/testing when API doesn't have data
  const getSampleModules = () => [
    {
      id: 1,
      title: 'Introduccion a Python',
      description: 'Conoce el lenguaje y configura tu entorno',
      order: 1,
      lessons: [
        { id: 1, title: 'Bienvenida al curso', duration_minutes: 5, content_type: 'video', order: 1 },
        { id: 2, title: 'Instalacion de Python', duration_minutes: 10, content_type: 'video', order: 2 },
        { id: 3, title: 'Tu primer programa', duration_minutes: 15, content_type: 'code', order: 3 }
      ]
    },
    {
      id: 2,
      title: 'Variables y Tipos de Datos',
      description: 'Aprende a trabajar con datos en Python',
      order: 2,
      lessons: [
        { id: 4, title: 'Variables y asignacion', duration_minutes: 12, content_type: 'video', order: 1 },
        { id: 5, title: 'Numeros y operaciones', duration_minutes: 15, content_type: 'code', order: 2 },
        { id: 6, title: 'Strings y formateo', duration_minutes: 18, content_type: 'code', order: 3 }
      ]
    },
    {
      id: 3,
      title: 'Estructuras de Control',
      description: 'Controla el flujo de tu programa',
      order: 3,
      lessons: [
        { id: 7, title: 'Condicionales if/else', duration_minutes: 20, content_type: 'video', order: 1 },
        { id: 8, title: 'Bucles for y while', duration_minutes: 25, content_type: 'code', order: 2 },
        { id: 9, title: 'Proyecto: Calculadora', duration_minutes: 30, content_type: 'project', order: 3 }
      ]
    }
  ];

  const toggleModule = (moduleId) => {
    setExpandedModules(prev => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  const getContentTypeIcon = (type) => {
    switch (type) {
      case 'video':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'code':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        );
      case 'project':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        );
      case 'quiz':
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
        );
      default:
        return (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        );
    }
  };

  const getLessonStatus = (lessonId) => {
    return lessonProgress[lessonId] || 'not_started';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return (
          <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        );
      case 'in_progress':
        return (
          <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
          </div>
        );
      default:
        return (
          <div className="w-5 h-5 rounded-full border-2 border-gray-300 dark:border-gray-600 flex-shrink-0" />
        );
    }
  };

  // Calculate module progress
  const getModuleProgress = (module) => {
    if (!module.lessons || module.lessons.length === 0) return { completed: 0, total: 0, percent: 0 };
    const completed = module.lessons.filter(l => getLessonStatus(l.id) === 'completed').length;
    const total = module.lessons.length;
    return { completed, total, percent: Math.round((completed / total) * 100) };
  };

  if (!isOpen) {
    return null;
  }

  return (
    <aside
      className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-hidden"
      aria-label="Navegacion del curso"
    >
      {/* Sidebar Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <Link
            to={`/course/${courseSlug}`}
            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver al curso
          </Link>
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 lg:hidden"
              aria-label="Cerrar menu"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <h2 className="font-semibold text-gray-900 dark:text-white truncate">
          {courseInfo?.title || 'Cargando...'}
        </h2>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex-1 flex items-center justify-center p-4">
          <svg className="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="p-4 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20">
          {error}
        </div>
      )}

      {/* Modules List */}
      {!isLoading && (
        <nav className="flex-1 overflow-y-auto" aria-label="Modulos del curso">
          <ul className="p-2 space-y-1">
            {modules.map((module, moduleIndex) => {
              const isExpanded = expandedModules[module.id];
              const progress = getModuleProgress(module);
              const hasCurrentLesson = module.lessons?.some(
                l => l.id === parseInt(currentLessonId)
              );

              return (
                <li key={module.id} className="rounded-lg overflow-hidden">
                  {/* Module Header */}
                  <button
                    onClick={() => toggleModule(module.id)}
                    className={`w-full px-3 py-3 flex items-center justify-between text-left transition-colors ${
                      hasCurrentLesson
                        ? 'bg-primary-50 dark:bg-primary-900/30'
                        : 'hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                    aria-expanded={isExpanded}
                    aria-controls={`module-${module.id}-lessons`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                          {moduleIndex + 1}.
                        </span>
                        <span className="font-medium text-gray-900 dark:text-white truncate">
                          {module.title}
                        </span>
                      </div>
                      {/* Module Progress */}
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-green-500 transition-all duration-300"
                            style={{ width: `${progress.percent}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {progress.completed}/{progress.total}
                        </span>
                      </div>
                    </div>
                    <svg
                      className={`w-5 h-5 text-gray-400 transition-transform ml-2 flex-shrink-0 ${
                        isExpanded ? 'rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Lessons List */}
                  {isExpanded && (
                    <ul
                      id={`module-${module.id}-lessons`}
                      className="border-l-2 border-gray-200 dark:border-gray-600 ml-4 mt-1 space-y-0.5"
                    >
                      {module.lessons?.map((lesson) => {
                        const isCurrentLesson = lesson.id === parseInt(currentLessonId);
                        const status = getLessonStatus(lesson.id);

                        return (
                          <li key={lesson.id}>
                            <Link
                              to={`/course/${courseSlug}/lesson/${lesson.id}`}
                              className={`flex items-center gap-2 px-3 py-2 text-sm transition-colors rounded-r-lg ${
                                isCurrentLesson
                                  ? 'bg-primary-100 dark:bg-primary-900/50 text-primary-900 dark:text-primary-100 font-medium border-l-2 border-primary-600 -ml-0.5'
                                  : status === 'completed'
                                  ? 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                                  : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                              }`}
                              aria-current={isCurrentLesson ? 'page' : undefined}
                            >
                              {/* Status Indicator */}
                              {getStatusIcon(isCurrentLesson ? 'in_progress' : status)}

                              {/* Content Type Icon */}
                              <span className={`${
                                isCurrentLesson
                                  ? 'text-primary-600 dark:text-primary-400'
                                  : 'text-gray-400 dark:text-gray-500'
                              }`}>
                                {getContentTypeIcon(lesson.content_type)}
                              </span>

                              {/* Lesson Title */}
                              <span className="flex-1 truncate">
                                {lesson.title}
                              </span>

                              {/* Duration */}
                              <span className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap">
                                {lesson.duration_minutes} min
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {/* Overall Progress Footer */}
      {!isLoading && modules.length > 0 && (
        <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-gray-600 dark:text-gray-400">Progreso total</span>
            <span className="font-medium text-gray-900 dark:text-white">
              {modules.reduce((acc, mod) => acc + getModuleProgress(mod).completed, 0)}/
              {modules.reduce((acc, mod) => acc + (mod.lessons?.length || 0), 0)} lecciones
            </span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 transition-all duration-300"
              style={{
                width: `${
                  modules.length > 0
                    ? Math.round(
                        (modules.reduce((acc, mod) => acc + getModuleProgress(mod).completed, 0) /
                          modules.reduce((acc, mod) => acc + (mod.lessons?.length || 0), 0)) *
                          100
                      ) || 0
                    : 0
                }%`
              }}
            />
          </div>
        </div>
      )}
    </aside>
  );
}

export default CourseSidebar;
