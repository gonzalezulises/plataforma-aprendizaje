import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuth } from '../store/AuthContext';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

// Icon components
const icons = {
  'chart-bar': (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    </svg>
  ),
  'code': (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  ),
  'cube': (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
    </svg>
  ),
  'briefcase': (
    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  'trophy': (
    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  )
};

function CareerPathCard({ path, onStart }) {
  const { user } = useAuth();
  const isEnrolled = path.user_progress !== null;
  const progress = path.user_progress?.progress_percent || 0;
  const isComplete = progress === 100;

  const getIcon = () => icons[path.icon] || icons['briefcase'];

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
      {/* Header with gradient */}
      <div
        className="h-32 p-6 flex items-center justify-between"
        style={{ background: `linear-gradient(135deg, ${path.color}22 0%, ${path.color}44 100%)` }}
      >
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: path.color, color: 'white' }}
        >
          {getIcon()}
        </div>
        {path.badge_earned && (
          <div className="flex items-center gap-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-3 py-1 rounded-full">
            {icons['trophy']}
            <span className="text-sm font-medium">Completado</span>
          </div>
        )}
      </div>

      <div className="p-6">
        <h3
          className="text-xl font-bold text-gray-900 dark:text-white mb-2 line-clamp-2"
          title={path.name}
        >
          {path.name}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
          {path.description}
        </p>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            <span>{path.total_courses} cursos</span>
          </div>
          <div className="flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{path.total_hours} horas</span>
          </div>
        </div>

        {/* Progress bar (if enrolled) */}
        {isEnrolled && (
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">Progreso</span>
              <span className="font-medium" style={{ color: path.color }}>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, backgroundColor: path.color }}
              />
            </div>
          </div>
        )}

        {/* Action button */}
        {isEnrolled ? (
          <Link
            to={`/career-paths/${path.slug}`}
            className="block w-full py-3 px-4 text-center rounded-lg font-medium transition-colors"
            style={{
              backgroundColor: `${path.color}15`,
              color: path.color,
              border: `1px solid ${path.color}40`
            }}
          >
            {isComplete ? 'Ver Detalles' : 'Continuar Ruta'}
          </Link>
        ) : user ? (
          <button
            onClick={() => onStart(path.slug)}
            className="w-full py-3 px-4 rounded-lg font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: path.color }}
          >
            Comenzar Ruta
          </button>
        ) : (
          <Link
            to="/login"
            className="block w-full py-3 px-4 text-center rounded-lg font-medium text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: path.color }}
          >
            Iniciar Sesion para Comenzar
          </Link>
        )}
      </div>
    </div>
  );
}

function CareerPathDetail({ path, onCompleteCourseMock, onSyncProgress }) {
  const { user } = useAuth();
  const isEnrolled = path.user_progress !== null;
  const progress = path.user_progress?.progress_percent || 0;
  const coursesCompleted = path.user_progress?.courses_completed
    ? JSON.parse(path.user_progress.courses_completed)
    : [];

  const getIcon = () => icons[path.icon] || icons['briefcase'];

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div
        className="rounded-2xl p-8 mb-8"
        style={{ background: `linear-gradient(135deg, ${path.color}22 0%, ${path.color}44 100%)` }}
      >
        <div className="flex items-start gap-6">
          <div
            className="w-20 h-20 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: path.color, color: 'white' }}
          >
            {getIcon()}
          </div>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              {path.name}
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-4">
              {path.description}
            </p>
            <div className="flex items-center gap-6 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span>{path.total_courses} cursos</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{path.total_hours} horas totales</span>
              </div>
            </div>
          </div>
          {path.badge_earned && (
            <div className="flex flex-col items-center gap-2 bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200 px-4 py-3 rounded-xl">
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
              <span className="text-sm font-bold">Completado!</span>
            </div>
          )}
        </div>

        {/* Progress bar */}
        {isEnrolled && (
          <div className="mt-6">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-600 dark:text-gray-400">Progreso de la ruta</span>
              <span className="font-bold" style={{ color: path.color }}>{Math.round(progress)}%</span>
            </div>
            <div className="h-3 bg-white/50 dark:bg-gray-700/50 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progress}%`, backgroundColor: path.color }}
              />
            </div>
            <div className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {coursesCompleted.length} de {path.total_courses} cursos completados
            </div>
          </div>
        )}
      </div>

      {/* Course list */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            Cursos en esta ruta
          </h2>
          {isEnrolled && (
            <button
              onClick={onSyncProgress}
              className="text-sm px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Sincronizar Progreso
            </button>
          )}
        </div>

        <div className="space-y-4">
          {path.courses.map((course, index) => {
            const isCompleted = coursesCompleted.includes(course.id);
            const isCurrent = isEnrolled && !isCompleted &&
              coursesCompleted.length === index;

            return (
              <div
                key={course.id}
                className={`bg-white dark:bg-gray-800 rounded-xl p-5 border-2 transition-all ${
                  isCompleted
                    ? 'border-green-500 dark:border-green-600'
                    : isCurrent
                      ? `border-2`
                      : 'border-gray-200 dark:border-gray-700'
                }`}
                style={isCurrent ? { borderColor: path.color } : undefined}
              >
                <div className="flex items-center gap-4">
                  {/* Step number or check */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                      isCompleted
                        ? 'bg-green-500 text-white'
                        : isCurrent
                          ? 'text-white'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                    }`}
                    style={isCurrent ? { backgroundColor: path.color } : undefined}
                  >
                    {isCompleted ? (
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span className="font-bold">{index + 1}</span>
                    )}
                  </div>

                  {/* Course info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                        {course.title}
                      </h3>
                      {course.is_premium === 1 && (
                        <span className="px-2 py-0.5 text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200 rounded-full">
                          Premium
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                      {course.description}
                    </p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 dark:text-gray-500">
                      <span>{course.level}</span>
                      <span>{course.duration_hours} horas</span>
                      {course.enrolled && (
                        <span className="text-blue-500">Inscrito - {Math.round(course.progress)}% completado</span>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  <div className="flex-shrink-0">
                    {isCompleted ? (
                      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400 font-medium text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Completado
                      </span>
                    ) : (
                      <Link
                        to={`/course/${course.slug}`}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        style={{
                          backgroundColor: isCurrent ? path.color : '#e5e7eb',
                          color: isCurrent ? 'white' : '#374151'
                        }}
                      >
                        {isCurrent ? 'Continuar' : 'Ver Curso'}
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Back link */}
      <Link
        to="/career-paths"
        className="inline-flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Volver a Rutas de Carrera
      </Link>
    </div>
  );
}

export default function CareerPathsPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [careerPaths, setCareerPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch career paths
  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        const headers = { 'Content-Type': 'application/json' };
        if (user?.id) {
          headers['x-user-id'] = user.id.toString();
        }

        if (slug) {
          // Fetch single career path
          const response = await fetch(`${API_URL}/api/career-paths/${slug}`, { headers });
          if (!response.ok) {
            if (response.status === 404) {
              setError('Ruta de carrera no encontrada');
            } else {
              throw new Error('Failed to fetch career path');
            }
            return;
          }
          const data = await response.json();
          setCurrentPath(data);
        } else {
          // Fetch all career paths
          const response = await fetch(`${API_URL}/api/career-paths`, { headers });
          if (!response.ok) throw new Error('Failed to fetch career paths');
          const data = await response.json();
          setCareerPaths(data.career_paths || []);
        }
      } catch (err) {
        console.error('Error fetching career paths:', err);
        setError('Error al cargar las rutas de carrera');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [slug, user?.id]);

  // Start a career path
  const handleStart = async (pathSlug) => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/career-paths/${pathSlug}/start`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id.toString()
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start career path');
      }

      const data = await response.json();
      toast.success('Has comenzado la ruta de carrera!');

      // Navigate to the career path detail
      navigate(`/career-paths/${pathSlug}`);
    } catch (err) {
      console.error('Error starting career path:', err);
      toast.error(err.message || 'Error al iniciar la ruta de carrera');
    }
  };

  // Sync progress with actual course completions
  const handleSyncProgress = async () => {
    if (!user || !currentPath) return;

    try {
      const response = await fetch(`${API_URL}/api/career-paths/${currentPath.slug}/sync-progress`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': user.id.toString()
        }
      });

      if (!response.ok) throw new Error('Failed to sync progress');

      const data = await response.json();
      setCurrentPath(data.career_path);

      if (data.badge) {
        toast.success('Felicidades! Has ganado una insignia: ' + data.badge.badge_name, {
          duration: 6000,
          icon: '🏆'
        });
      } else {
        toast.success('Progreso sincronizado');
      }
    } catch (err) {
      console.error('Error syncing progress:', err);
      toast.error('Error al sincronizar el progreso');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{error}</p>
          <Link
            to="/career-paths"
            className="text-primary-600 hover:text-primary-700 dark:text-primary-400"
          >
            Volver a Rutas de Carrera
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {slug && currentPath ? (
          <CareerPathDetail
            path={currentPath}
            onSyncProgress={handleSyncProgress}
          />
        ) : (
          <>
            {/* Header */}
            <div className="text-center mb-12">
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
                Rutas de Carrera
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                Sigue una ruta estructurada de cursos para dominar un area especifica
                y obtener una insignia al completarla.
              </p>
            </div>

            {/* Career paths grid */}
            {careerPaths.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400">
                  No hay rutas de carrera disponibles en este momento.
                </p>
              </div>
            ) : (
              <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
                {careerPaths.map((path) => (
                  <CareerPathCard
                    key={path.id}
                    path={path}
                    onStart={handleStart}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
