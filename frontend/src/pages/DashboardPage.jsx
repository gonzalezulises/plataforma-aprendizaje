/**
 * Dashboard Page
 * Feature #228: Late API response handled - prevents stale responses from overriding newer data
 */
import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import { ServerErrorBanner } from '../components/ServerErrorBanner';
import { isServerError, formatApiError } from '../utils/apiErrorHandler';
import { DueCountdownBadge } from '../components/DueCountdown';

function DashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [enrollments, setEnrollments] = useState([]);
  const [pendingProjects, setPendingProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [isRetrying, setIsRetrying] = useState(false);

  // Feature #228: Track request ID to handle race conditions
  const requestIdRef = useRef(0);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!authLoading && !isAuthenticated) {
      navigate('/login', { state: { from: '/dashboard' } });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Feature #228: Uses AbortController and request ID to prevent stale responses
  useEffect(() => {
    if (!isAuthenticated) return;

    // Feature #228: Create abort controller for this request
    const abortController = new AbortController();
    const currentRequestId = ++requestIdRef.current;

    async function fetchEnrollments() {
      try {
        setIsLoading(true);
        setError(null);
        const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

        console.log(`[Dashboard] Request #${currentRequestId} fetching enrollments`);

        const response = await fetch(`${API_BASE}/enrollments`, {
          credentials: 'include',
          signal: abortController.signal
        });

        // Feature #228: Check if this request is still the current one
        if (currentRequestId !== requestIdRef.current) {
          console.log(`[Dashboard] Request #${currentRequestId} superseded by #${requestIdRef.current}, ignoring`);
          return;
        }

        if (!response.ok) {
          if (response.status === 401) {
            navigate('/login', { state: { from: '/dashboard' } });
            return;
          }
          // If API returns 404 (not found), treat as empty enrollments
          if (response.status === 404) {
            setEnrollments([]);
            return;
          }
          // Handle 500 server errors specially
          if (response.status >= 500) {
            const errorData = await response.json().catch(() => ({}));
            const serverErr = {
              status: response.status,
              message: 'Internal Server Error',
              id: errorData.id,
            };
            setServerError(formatApiError(serverErr));
            return;
          }
          throw new Error('Failed to fetch enrollments');
        }

        const data = await response.json();

        // Feature #228: Double-check after JSON parsing
        if (currentRequestId !== requestIdRef.current) {
          console.log(`[Dashboard] Request #${currentRequestId} superseded during JSON parse, ignoring`);
          return;
        }

        setEnrollments(data.enrollments || []);
        console.log(`[Dashboard] Request #${currentRequestId} completed successfully`);

        // Also fetch pending projects (with same abort controller)
        try {
          const projectsResponse = await fetch(`${API_BASE}/projects/my/pending`, {
            credentials: 'include',
            signal: abortController.signal
          });

          // Feature #228: Check again before updating state
          if (currentRequestId !== requestIdRef.current) {
            console.log(`[Dashboard] Projects request #${currentRequestId} superseded, ignoring`);
            return;
          }

          if (projectsResponse.ok) {
            const projectsData = await projectsResponse.json();
            setPendingProjects(projectsData.projects || []);
          }
        } catch (projectErr) {
          // Feature #228: Don't log abort errors
          if (projectErr.name !== 'AbortError') {
            console.error('Error fetching pending projects:', projectErr);
          }
          // Don't fail the whole page if projects fail
        }
      } catch (err) {
        // Feature #228: Don't update state if request was aborted
        if (err.name === 'AbortError') {
          console.log(`[Dashboard] Request #${currentRequestId} was aborted (navigation)`);
          return;
        }

        // Feature #228: Only update error state if this is still the current request
        if (currentRequestId !== requestIdRef.current) {
          console.log(`[Dashboard] Request #${currentRequestId} superseded during error handling`);
          return;
        }

        console.error('Error fetching enrollments:', err);
        setError(err.message);
      } finally {
        // Feature #228: Only update loading state if this is still the current request
        if (currentRequestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    }

    fetchEnrollments();

    // Feature #228: Cleanup - abort request on unmount or dependency change
    return () => {
      console.log(`[Dashboard] Aborting request #${currentRequestId} due to cleanup`);
      abortController.abort();
    };
  }, [isAuthenticated, navigate]);

  // Loading state
  if (authLoading || (isAuthenticated && isLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando tu dashboard...</p>
        </div>
      </div>
    );
  }

  // Retry function for server errors
  const handleRetry = async () => {
    setIsRetrying(true);
    setServerError(null);
    setError(null);

    try {
      const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
      const response = await fetch(`${API_BASE}/enrollments`, {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status >= 500) {
          const errorData = await response.json().catch(() => ({}));
          setServerError(formatApiError({ status: response.status, id: errorData.id }));
          return;
        }
        throw new Error('Failed to fetch enrollments');
      }

      const data = await response.json();
      setEnrollments(data.enrollments || []);
    } catch (err) {
      console.error('Error retrying:', err);
      if (isServerError(err)) {
        setServerError(formatApiError(err));
      } else {
        setError(err.message);
      }
    } finally {
      setIsRetrying(false);
    }
  };

  // Server error state (500 errors)
  if (serverError) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-lg mx-auto">
          <ServerErrorBanner
            error={serverError}
            onRetry={handleRetry}
            onDismiss={() => setServerError(null)}
            isRetrying={isRetrying}
          />
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">Error al cargar tus cursos: {error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              Reintentar
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Helper function for level colors
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Mi Dashboard
          </h1>
          {user && (
            <p className="text-gray-600 dark:text-gray-400">
              Bienvenido de vuelta, {user.name}
            </p>
          )}
        </div>

        {/* Upgrade Banner for Free Users */}
        {user && user.role === 'student_free' && (
          <div className="mb-8 bg-gradient-to-r from-amber-500 to-amber-600 rounded-xl p-6 text-white shadow-lg" data-testid="upgrade-banner">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Desbloquea todo el contenido</h3>
                  <p className="text-white/90 text-sm">Accede a todos los cursos premium, proyectos avanzados y certificados verificables</p>
                </div>
              </div>
              <Link
                to="/upgrade"
                className="px-6 py-2.5 bg-white text-amber-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
                data-testid="upgrade-button"
              >
                Actualizar a Premium
              </Link>
            </div>
          </div>
        )}

        {/* Premium Badge for Premium Users */}
        {user && (user.role === 'student_premium' || user.role === 'instructor') && (
          <div className="mb-8 bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl p-4 text-white shadow-lg" data-testid="premium-badge">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5 2a2 2 0 00-2 2v14l3.5-2 3.5 2 3.5-2 3.5 2V4a2 2 0 00-2-2H5zm2.5 3a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6.207.293a1 1 0 00-1.414 0l-6 6a1 1 0 101.414 1.414l6-6a1 1 0 000-1.414zM12.5 10a1.5 1.5 0 100 3 1.5 1.5 0 000-3z" clipRule="evenodd" />
                </svg>
              </div>
              <span className="font-medium">Tienes acceso Premium - Disfruta de todos los cursos y funciones exclusivas</span>
            </div>
          </div>
        )}

        {/* Pending Projects Section */}
        {pendingProjects.length > 0 && (
          <div className="mb-8" data-testid="pending-projects-section">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Entregables Pendientes ({pendingProjects.length})
              </h2>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
              <div className="divide-y divide-gray-200 dark:divide-gray-700">
                {pendingProjects.map((project) => (
                  <Link
                    key={project.id}
                    to={`/project/submit/${project.id}`}
                    className="flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group"
                    data-testid={`pending-project-${project.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                        {project.title}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                        {project.course_title || `Curso: ${project.course_id}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 ml-4">
                      {project.due_date ? (
                        <DueCountdownBadge dueDate={project.due_date} />
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500">
                          Sin fecha limite
                        </span>
                      )}
                      <svg
                        className="w-5 h-5 text-gray-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {enrollments.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center" data-testid="empty-state">
            {/* Empty state illustration */}
            <div className="w-24 h-24 mx-auto mb-6 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
              <svg
                className="w-12 h-12 text-primary-600 dark:text-primary-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </div>

            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-3">
              Aun no estas inscrito en ningun curso
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md mx-auto">
              Explora nuestro catalogo de cursos interactivos con ejecucion de codigo en vivo y comienza a aprender haciendo.
            </p>

            <Link
              to="/courses"
              className="inline-flex items-center px-6 py-3 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 transition-colors"
              data-testid="browse-courses-link"
            >
              <svg
                className="w-5 h-5 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Explorar Cursos
            </Link>

            {/* Additional suggestions */}
            <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-6">
                Sugerencias para empezar
              </h3>
              <div className="grid gap-4 md:grid-cols-3 max-w-3xl mx-auto">
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-left">
                  <div className="text-2xl mb-2">1</div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                    Explora el catalogo
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Encuentra cursos que se ajusten a tus intereses y nivel
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-left">
                  <div className="text-2xl mb-2">2</div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                    Inscribete gratis
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Muchos cursos son gratuitos y puedes comenzar de inmediato
                  </p>
                </div>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-left">
                  <div className="text-2xl mb-2">3</div>
                  <h4 className="font-medium text-gray-900 dark:text-white mb-1">
                    Aprende haciendo
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Ejecuta codigo en vivo y completa proyectos reales
                  </p>
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* Enrolled Courses Grid */
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Mis Cursos ({enrollments.length})
              </h2>
              <Link
                to="/courses"
                className="text-primary-600 dark:text-primary-400 hover:underline text-sm font-medium"
              >
                Ver todos los cursos
              </Link>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {enrollments.map((enrollment) => (
                <Link
                  key={enrollment.id}
                  to={`/course/${enrollment.course.slug}`}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow group"
                >
                  {/* Course thumbnail */}
                  <div className="h-32 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center relative">
                    {enrollment.course.thumbnailUrl ? (
                      <img
                        src={enrollment.course.thumbnailUrl}
                        alt={enrollment.course.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-4xl opacity-50">
                        {enrollment.course.category === 'Programacion' ? '\uD83D\uDCBB' :
                         enrollment.course.category === 'Data Science' ? '\uD83D\uDCCA' :
                         enrollment.course.category === 'IA / ML' ? '\uD83E\uDD16' :
                         enrollment.course.category === 'Web3' ? '\uD83D\uDD17' :
                         enrollment.course.category === 'Bases de Datos' ? '\uD83D\uDDC3\uFE0F' : '\uD83D\uDCDA'}
                      </span>
                    )}
                    {/* Progress bar overlay */}
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/20">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${enrollment.progressPercent}%` }}
                      ></div>
                    </div>
                  </div>

                  <div className="p-4">
                    {/* Tags */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getLevelColor(enrollment.course.level)}`}>
                        {enrollment.course.level}
                      </span>
                      {enrollment.course.isPremium && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                          Premium
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-1">
                      {enrollment.course.title}
                    </h3>

                    {/* Progress */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        {Math.round(enrollment.progressPercent)}% completado
                      </span>
                      {enrollment.completedAt && (
                        <span className="text-green-600 dark:text-green-400 font-medium">
                          Completado
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default DashboardPage;
