import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import toast from 'react-hot-toast';

// Sample course data - in production this would come from API
const SAMPLE_COURSES = {
  'python-fundamentos': {
    id: 1,
    slug: 'python-fundamentos',
    title: 'Python: Fundamentos',
    description: 'Aprende Python desde cero con ejercicios practicos y proyectos reales. Este curso te llevara desde los conceptos basicos hasta la creacion de programas funcionales.',
    category: 'Programacion',
    level: 'Principiante',
    duration: '20 horas',
    isPremium: false,
    instructor: {
      name: 'Carlos Rodriguez',
      bio: 'Desarrollador senior con 10+ anos de experiencia en Python',
      avatar: null
    },
    studentsCount: 1250,
    rating: 4.8,
    reviewsCount: 324,
    modules: [
      {
        id: 1,
        title: 'Introduccion a Python',
        description: 'Conoce el lenguaje y configura tu entorno',
        lessons: [
          { id: 1, title: 'Bienvenida al curso', duration: '5 min', type: 'video' },
          { id: 2, title: 'Instalacion de Python', duration: '10 min', type: 'video' },
          { id: 3, title: 'Tu primer programa', duration: '15 min', type: 'code' }
        ]
      },
      {
        id: 2,
        title: 'Variables y Tipos de Datos',
        description: 'Aprende a trabajar con datos en Python',
        lessons: [
          { id: 4, title: 'Variables y asignacion', duration: '12 min', type: 'video' },
          { id: 5, title: 'Numeros y operaciones', duration: '15 min', type: 'code' },
          { id: 6, title: 'Strings y formateo', duration: '18 min', type: 'code' }
        ]
      },
      {
        id: 3,
        title: 'Estructuras de Control',
        description: 'Controla el flujo de tu programa',
        lessons: [
          { id: 7, title: 'Condicionales if/else', duration: '20 min', type: 'video' },
          { id: 8, title: 'Bucles for y while', duration: '25 min', type: 'code' },
          { id: 9, title: 'Proyecto: Calculadora', duration: '30 min', type: 'project' }
        ]
      }
    ],
    learningObjectives: [
      'Entender los fundamentos de la programacion',
      'Escribir programas en Python desde cero',
      'Trabajar con variables, funciones y estructuras de datos',
      'Resolver problemas usando pensamiento algoritmico',
      'Crear proyectos practicos aplicando lo aprendido'
    ],
    requirements: [
      'Computadora con Windows, Mac o Linux',
      'Conexion a internet',
      'Ganas de aprender - no se requiere experiencia previa'
    ]
  },
  'data-science-python': {
    id: 2,
    slug: 'data-science-python',
    title: 'Data Science con Python',
    description: 'Domina pandas, numpy y matplotlib para analisis de datos. Aprende a limpiar, explorar y visualizar datos como un profesional.',
    category: 'Data Science',
    level: 'Intermedio',
    duration: '35 horas',
    isPremium: true,
    instructor: {
      name: 'Maria Garcia',
      bio: 'Data Scientist en empresas Fortune 500',
      avatar: null
    },
    studentsCount: 890,
    rating: 4.9,
    reviewsCount: 256,
    modules: [
      {
        id: 1,
        title: 'Introduccion a Data Science',
        lessons: [
          { id: 1, title: 'Que es Data Science', duration: '10 min', type: 'video' },
          { id: 2, title: 'Configuracion del entorno', duration: '15 min', type: 'video' }
        ]
      },
      {
        id: 2,
        title: 'NumPy Fundamentals',
        lessons: [
          { id: 3, title: 'Arrays y operaciones', duration: '20 min', type: 'code' },
          { id: 4, title: 'Algebra lineal basica', duration: '25 min', type: 'code' }
        ]
      }
    ],
    learningObjectives: [
      'Dominar pandas para manipulacion de datos',
      'Crear visualizaciones profesionales con matplotlib',
      'Analizar datasets reales',
      'Aplicar estadistica descriptiva'
    ],
    requirements: [
      'Conocimientos basicos de Python',
      'Matematicas basicas'
    ]
  },
  'sql-desde-cero': {
    id: 3,
    slug: 'sql-desde-cero',
    title: 'SQL desde Cero',
    description: 'Aprende a consultar y manipular bases de datos con SQL. Desde las consultas mas basicas hasta joins complejos y subconsultas.',
    category: 'Bases de Datos',
    level: 'Principiante',
    duration: '15 horas',
    isPremium: false,
    instructor: {
      name: 'Ana Martinez',
      bio: 'DBA con experiencia en sistemas empresariales',
      avatar: null
    },
    studentsCount: 2100,
    rating: 4.7,
    reviewsCount: 489,
    modules: [
      {
        id: 1,
        title: 'Fundamentos de SQL',
        lessons: [
          { id: 1, title: 'Introduccion a bases de datos', duration: '8 min', type: 'video' },
          { id: 2, title: 'Tu primera consulta SELECT', duration: '12 min', type: 'code' }
        ]
      }
    ],
    learningObjectives: [
      'Escribir consultas SQL efectivas',
      'Entender el modelo relacional',
      'Realizar joins entre tablas',
      'Optimizar consultas'
    ],
    requirements: [
      'No se requiere experiencia previa'
    ]
  }
};

function CourseDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [course, setCourse] = useState(null);
  const [loading, setLoading] = useState(true);
  const [enrolling, setEnrolling] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [showUnenrollModal, setShowUnenrollModal] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);

  useEffect(() => {
    async function fetchCourseData() {
      setLoading(true);

      try {
        // First try to fetch actual course from API by slug
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
        const response = await fetch(`${API_BASE}/courses/${slug}`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          const apiCourse = data.course;

          // Merge API data with sample data for additional fields (modules, etc.)
          const sampleCourse = SAMPLE_COURSES[slug];

          // Use API modules if available
          // IMPORTANT: Only use sample modules for DISPLAY purposes, never for navigation
          // because sample lesson IDs don't match real database IDs
          const hasApiModules = apiCourse.modules && apiCourse.modules.length > 0;
          const modulesToUse = hasApiModules
            ? apiCourse.modules
            : sampleCourse?.modules || [];

          const mergedCourse = {
            ...sampleCourse,
            id: apiCourse.id, // Use actual database ID!
            title: apiCourse.title,
            description: apiCourse.description,
            category: apiCourse.category,
            level: apiCourse.level,
            isPremium: !!apiCourse.is_premium,
            duration: `${apiCourse.duration_hours || 0} horas`,
            modules: modulesToUse, // For display purposes
            _hasRealLessons: hasApiModules, // Flag to indicate if navigation is safe
          };

          setCourse(mergedCourse);

          // Check enrollment status with the correct database ID
          if (isAuthenticated) {
            checkEnrollmentStatus(apiCourse.id);
          }
        } else {
          // Fallback to sample data if API fails
          const courseData = SAMPLE_COURSES[slug];
          if (courseData) {
            setCourse(courseData);
            if (isAuthenticated) {
              checkEnrollmentStatus(courseData.id);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching course:', error);
        // Fallback to sample data
        const courseData = SAMPLE_COURSES[slug];
        if (courseData) {
          setCourse(courseData);
          if (isAuthenticated) {
            checkEnrollmentStatus(courseData.id);
          }
        }
      } finally {
        setLoading(false);
      }
    }

    fetchCourseData();
  }, [slug, isAuthenticated]);

  const checkEnrollmentStatus = async (courseId) => {
    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_BASE}/enrollments/${courseId}`, {
        credentials: 'include'
      });
      if (response.ok) {
        setIsEnrolled(true);
      }
    } catch (error) {
      console.error('Error checking enrollment:', error);
    }
  };

  const handleEnrollClick = () => {
    if (!isAuthenticated) {
      toast.error('Debes iniciar sesion para inscribirte');
      navigate('/login', { state: { from: `/course/${slug}` } });
      return;
    }

    setShowEnrollModal(true);
  };

  const handleConfirmEnroll = async () => {
    setEnrolling(true);

    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_BASE}/enrollments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ courseId: course.id })
      });

      if (response.ok) {
        toast.success('Te has inscrito exitosamente!');
        setIsEnrolled(true);
        setShowEnrollModal(false);

        // Redirect to first lesson only if we have real lessons from API
        // Sample data lesson IDs don't match real database IDs
        if (course._hasRealLessons && course.modules?.[0]?.lessons?.[0]) {
          const firstLesson = course.modules[0].lessons[0];
          navigate(`/course/${slug}/lesson/${firstLesson.id}`);
        }
        // If no real lessons, user stays on course page (already enrolled)
      } else if (response.status === 409) {
        toast('Ya estas inscrito en este curso', { icon: 'ℹ️' });
        setIsEnrolled(true);
        setShowEnrollModal(false);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Error al inscribirse');
      }
    } catch (error) {
      console.error('Enrollment error:', error);
      toast.error('Error de conexion. Intenta de nuevo.');
    } finally {
      setEnrolling(false);
    }
  };

  const handleGoToCourse = () => {
    // Only navigate if we have real lessons from the API (not sample data)
    // Sample data lesson IDs don't match real database IDs
    if (course._hasRealLessons && course.modules?.[0]?.lessons?.[0]) {
      const firstLesson = course.modules[0].lessons[0];
      navigate(`/course/${slug}/lesson/${firstLesson.id}`);
    } else {
      // If no real lessons available, stay on course page and show message
      toast('Este curso aun no tiene lecciones disponibles', { icon: 'ℹ️' });
    }
  };

  const handleUnenrollClick = () => {
    setShowUnenrollModal(true);
  };

  const handleConfirmUnenroll = async () => {
    setUnenrolling(true);

    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_BASE}/enrollments/${course.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Te has desinscrito del curso');
        setIsEnrolled(false);
        setShowUnenrollModal(false);
      } else {
        const data = await response.json();
        toast.error(data.error || 'Error al desinscribirse');
      }
    } catch (error) {
      console.error('Unenroll error:', error);
      toast.error('Error de conexion. Intenta de nuevo.');
    } finally {
      setUnenrolling(false);
    }
  };

  const getLevelColor = (level) => {
    switch (level) {
      case 'Principiante':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Intermedio':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Avanzado':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getContentTypeIcon = (type) => {
    switch (type) {
      case 'video':
        return '🎥';
      case 'code':
        return '💻';
      case 'project':
        return '🚀';
      case 'quiz':
        return '📝';
      default:
        return '📄';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Curso no encontrado</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">El curso que buscas no existe o ha sido eliminado.</p>
          <Link
            to="/courses"
            className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Ver Catalogo
          </Link>
        </div>
      </div>
    );
  }

  const totalLessons = course.modules?.reduce((acc, module) => acc + (module.lessons?.length || 0), 0) || 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 py-12">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Course Info */}
            <div className="md:col-span-2">
              {/* Breadcrumb */}
              <nav className="text-primary-200 text-sm mb-4">
                <Link to="/" className="hover:text-white">Inicio</Link>
                <span className="mx-2">/</span>
                <Link to="/courses" className="hover:text-white">Cursos</Link>
                <span className="mx-2">/</span>
                <span className="text-white">{course.title}</span>
              </nav>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${getLevelColor(course.level)}`}>
                  {course.level}
                </span>
                {course.isPremium && (
                  <span className="px-3 py-1 rounded-full text-sm font-medium bg-amber-100 text-amber-800">
                    Premium
                  </span>
                )}
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-white/20 text-white">
                  {course.category}
                </span>
              </div>

              {/* Title */}
              <h1 className="text-3xl md:text-4xl font-bold mb-4">{course.title}</h1>

              {/* Description */}
              <p className="text-lg text-primary-100 mb-6">{course.description}</p>

              {/* Stats */}
              <div className="flex flex-wrap items-center gap-4 text-sm text-primary-200">
                <div className="flex items-center gap-1">
                  <span className="text-yellow-400">★</span>
                  <span className="text-white font-medium">{course.rating || 4.5}</span>
                  <span>({course.reviewsCount || 0} resenas)</span>
                </div>
                <span>•</span>
                <span>{(course.studentsCount || 0).toLocaleString()} estudiantes</span>
                <span>•</span>
                <span>{course.duration}</span>
                <span>•</span>
                <span>{totalLessons} lecciones</span>
              </div>

              {/* Instructor */}
              <div className="mt-6 flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-lg">
                  {(course.instructor?.name || "I").charAt(0)}
                </div>
                <div>
                  <p className="font-medium">{course.instructor?.name || "Instructor"}</p>
                  <p className="text-sm text-primary-200">{course.instructor?.bio || "Instructor del curso"}</p>
                </div>
              </div>
            </div>

            {/* Enrollment Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 text-gray-900 dark:text-white h-fit">
              {/* Course Thumbnail */}
              <div className="h-40 bg-gradient-to-br from-primary-400 to-primary-600 rounded-lg mb-6 flex items-center justify-center">
                <span className="text-6xl opacity-50">
                  {course.category === 'Programacion' ? '💻' :
                   course.category === 'Data Science' ? '📊' :
                   course.category === 'IA / ML' ? '🤖' :
                   course.category === 'Web3' ? '🔗' :
                   course.category === 'Bases de Datos' ? '🗃️' : '📚'}
                </span>
              </div>

              {/* Price / Status */}
              <div className="mb-6">
                {course.isPremium ? (
                  <div className="text-2xl font-bold">Premium</div>
                ) : (
                  <div className="text-2xl font-bold text-green-600">Gratis</div>
                )}
              </div>

              {/* CTA Button */}
              {isEnrolled ? (
                <div className="space-y-2">
                  <button
                    onClick={handleGoToCourse}
                    className="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Continuar Curso
                  </button>
                  <button
                    onClick={handleUnenrollClick}
                    className="w-full py-2 px-4 text-red-600 dark:text-red-400 text-sm hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                    Cancelar inscripcion
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleEnrollClick}
                  className="w-full py-3 px-4 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
                >
                  Inscribirse {course.isPremium ? '' : 'Gratis'}
                </button>
              )}

              {/* Course includes */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h4 className="font-medium mb-3">Este curso incluye:</h4>
                <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li className="flex items-center gap-2">
                    <span>🎥</span>
                    <span>{course.duration} de video</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span>💻</span>
                    <span>Ejercicios de codigo interactivos</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span>🚀</span>
                    <span>Proyectos practicos</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span>📜</span>
                    <span>Certificado de finalizacion</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span>♾️</span>
                    <span>Acceso de por vida</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <span>💬</span>
                    <span>Foro de discusion</span>
                  </li>
                </ul>
              </div>

              {/* Forum Link */}
              <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <Link
                  to={`/course/${slug}/forum`}
                  className="w-full py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  Ir al Foro
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Course Content */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="md:col-span-2 space-y-8">
            {/* Learning Objectives */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Lo que aprenderas</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {course.learningObjectives?.map((objective, index) => (
                  <div key={index} className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-gray-700 dark:text-gray-300">{objective}</span>
                  </div>
                ))}
              </div>
            </section>

            {/* Course Content / Modules */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Contenido del curso</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {course.modules?.length || 0} modulos • {totalLessons} lecciones • {course.duration}
              </p>

              <div className="space-y-3">
                {course.modules?.map((module, moduleIndex) => (
                  <div key={module.id} className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                    {/* Module Header */}
                    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-gray-900 dark:text-white">
                          {moduleIndex + 1}. {module.title}
                        </h3>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {module.lessons?.length || 0} lecciones
                        </span>
                      </div>
                      {module.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{module.description}</p>
                      )}
                    </div>

                    {/* Lessons */}
                    <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                      {module.lessons?.map((lesson) => (
                        <li key={lesson.id} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <div className="flex items-center gap-3">
                            <span className="text-lg">{getContentTypeIcon(lesson.type)}</span>
                            <div className="flex-grow">
                              <span className="text-gray-900 dark:text-white">{lesson.title}</span>
                            </div>
                            <span className="text-sm text-gray-500 dark:text-gray-400">{lesson.duration}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </section>

            {/* Requirements */}
            <section>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Requisitos</h2>
              <ul className="space-y-2">
                {course.requirements?.map((req, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-primary-600">•</span>
                    <span className="text-gray-700 dark:text-gray-300">{req}</span>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Sidebar - Desktop sticky enrollment card */}
          <div className="hidden md:block">
            {/* This space is intentionally empty since the enrollment card is in the hero on desktop */}
          </div>
        </div>
      </div>

      {/* Enrollment Confirmation Modal */}
      {showEnrollModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Confirmar Inscripcion
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Estas a punto de inscribirte en <strong>{course.title}</strong>.
              {course.isPremium
                ? ' Este es un curso premium que requiere suscripcion.'
                : ' Este curso es completamente gratis.'}
            </p>

            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center text-2xl">
                  {course.category === 'Programacion' ? '💻' : '📚'}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">{course.title}</h4>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{course.duration} • {totalLessons} lecciones</p>
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowEnrollModal(false)}
                className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={enrolling}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmEnroll}
                disabled={enrolling}
                className="flex-1 py-2 px-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {enrolling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Inscribiendo...
                  </>
                ) : (
                  'Confirmar Inscripcion'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Unenroll Confirmation Modal */}
      {showUnenrollModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full p-6">
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Cancelar Inscripcion
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Estas seguro de que deseas cancelar tu inscripcion en <strong>{course.title}</strong>?
              Perderas tu progreso en el curso.
            </p>

            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <div className="flex items-center gap-3">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <p className="text-sm text-red-700 dark:text-red-300">
                  Esta accion no se puede deshacer.
                </p>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowUnenrollModal(false)}
                className="flex-1 py-2 px-4 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                disabled={unenrolling}
              >
                Mantener inscripcion
              </button>
              <button
                onClick={handleConfirmUnenroll}
                disabled={unenrolling}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {unenrolling ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Cancelando...
                  </>
                ) : (
                  'Cancelar inscripcion'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CourseDetailPage;
