import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import toast from 'react-hot-toast';

// Strip trailing /api from VITE_API_URL to avoid double /api/api paths
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '');

// Helper to check if user has premium access (Feature #16)
function isPremiumUser(user) {
  return user && (user.role === 'student_premium' || user.role === 'instructor');
}

function WebinarsPage() {
  const [webinars, setWebinars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list' or 'calendar'
  const [filter, setFilter] = useState('all'); // 'all', 'upcoming', 'past'
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Check if user is a free user (logged in but not premium) - Feature #16
  const isFreeUser = isAuthenticated && user && user.role === 'student_free';

  useEffect(() => {
    fetchWebinars();
  }, [filter]);

  const fetchWebinars = async () => {
    try {
      setLoading(true);
      let url = `${API_URL}/api/webinars`;
      if (filter === 'upcoming') {
        url += '?upcoming=true';
      } else if (filter === 'past') {
        url += '?status=completed';
      }

      const response = await fetch(url, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setWebinars(data);
      }
    } catch (error) {
      console.error('Error fetching webinars:', error);
      toast.error('Error al cargar los webinars');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (webinarId) => {
    if (!isAuthenticated) {
      toast.error('Debes iniciar sesion para registrarte');
      navigate('/login');
      return;
    }

    // Check for premium access (Feature #16)
    if (isFreeUser) {
      toast.error('Los webinars son una funcion premium. Actualiza tu cuenta para acceder.');
      navigate('/upgrade');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/webinars/${webinarId}/register`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        toast.success('Te has registrado exitosamente');
        fetchWebinars();
      } else {
        const data = await response.json();
        // Handle premium required error from backend
        if (data.code === 'PREMIUM_REQUIRED') {
          toast.error(data.message || 'Funcion premium requerida');
          navigate('/upgrade');
          return;
        }
        toast.error(data.error || 'Error al registrarse');
      }
    } catch (error) {
      console.error('Error registering:', error);
      toast.error('Error al registrarse');
    }
  };

  const handleJoin = async (webinar) => {
    if (!isAuthenticated) {
      toast.error('Debes iniciar sesion para unirte');
      navigate('/login');
      return;
    }

    // Check for premium access (Feature #16)
    if (isFreeUser) {
      toast.error('Los webinars son una funcion premium. Actualiza tu cuenta para acceder.');
      navigate('/upgrade');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/webinars/${webinar.id}/join`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        // Open Google Meet link in new tab
        window.open(data.meet_link, '_blank');
        toast.success('Te has unido al webinar');
      } else {
        const data = await response.json();
        // Handle premium required error from backend
        if (data.code === 'PREMIUM_REQUIRED') {
          toast.error(data.message || 'Funcion premium requerida');
          navigate('/upgrade');
          return;
        }
        toast.error(data.error || 'Error al unirse');
      }
    } catch (error) {
      console.error('Error joining:', error);
      toast.error('Error al unirse al webinar');
    }
  };

  const handleViewRecording = async (webinar) => {
    if (!isAuthenticated) {
      toast.error('Debes iniciar sesion para ver la grabacion');
      navigate('/login');
      return;
    }

    // Check for premium access (Feature #16)
    if (isFreeUser) {
      toast.error('Las grabaciones de webinars son una funcion premium. Actualiza tu cuenta para acceder.');
      navigate('/upgrade');
      return;
    }

    try {
      const response = await fetch(`${API_URL}/api/webinars/${webinar.id}/recording`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        window.open(data.recording_url, '_blank');
      } else {
        const data = await response.json();
        // Handle premium required error from backend
        if (data.code === 'PREMIUM_REQUIRED') {
          toast.error(data.message || 'Funcion premium requerida');
          navigate('/upgrade');
          return;
        }
        toast.error(data.error || 'Grabacion no disponible');
      }
    } catch (error) {
      console.error('Error getting recording:', error);
      toast.error('Error al obtener la grabacion');
    }
  };

  const formatDate = (dateString) => {
    // Handle both ISO timestamps (2026-01-22T07:18:56.255Z) and date-only strings (2026-01-22)
    // For date-only strings (YYYY-MM-DD), parse as local date to avoid timezone shift
    let date;
    if (dateString.includes('T')) {
      // Full ISO timestamp - convert to local time
      date = new Date(dateString);
    } else {
      // Date-only string (YYYY-MM-DD) - parse as local date components
      const [year, month, day] = dateString.split('-').map(Number);
      date = new Date(year, month - 1, day); // month is 0-indexed
    }
    return date.toLocaleDateString('es-ES', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatTime = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const isUpcoming = (dateString) => {
    return new Date(dateString) > new Date();
  };

  const isLive = (webinar) => {
    const now = new Date();
    const start = new Date(webinar.scheduled_at);
    const end = new Date(start.getTime() + webinar.duration_minutes * 60 * 1000);
    return now >= start && now <= end;
  };

  const getStatusBadge = (webinar) => {
    if (webinar.status === 'completed') {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
          Finalizado
        </span>
      );
    }
    if (webinar.status === 'live' || isLive(webinar)) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300 animate-pulse">
          EN VIVO
        </span>
      );
    }
    if (webinar.status === 'cancelled') {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
          Cancelado
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
        Programado
      </span>
    );
  };

  const getActionButton = (webinar) => {
    // For free users, show lock icon and upgrade button (Feature #16)
    if (isFreeUser) {
      return (
        <Link
          to="/upgrade"
          className="px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2"
          data-testid="upgrade-button"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          Actualizar
        </Link>
      );
    }

    if (webinar.status === 'completed' && webinar.recording_url) {
      return (
        <button
          onClick={() => handleViewRecording(webinar)}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Ver Grabacion
        </button>
      );
    }

    if (webinar.status === 'live' || isLive(webinar)) {
      return (
        <button
          onClick={() => handleJoin(webinar)}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2 animate-pulse"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          Unirse Ahora
        </button>
      );
    }

    if (isUpcoming(webinar.scheduled_at)) {
      return (
        <button
          onClick={() => handleRegister(webinar.id)}
          className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Registrarse
        </button>
      );
    }

    return null;
  };

  // Group webinars by LOCAL date for calendar view (ensures consistency across timezones)
  // Using toISOString on a local date to get YYYY-MM-DD format for grouping key
  const getLocalDateKey = (dateString) => {
    const date = new Date(dateString);
    // Get local date components
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const groupedWebinars = webinars.reduce((acc, webinar) => {
    const date = getLocalDateKey(webinar.scheduled_at);
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(webinar);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Premium Upgrade Banner for Free Users (Feature #16) */}
        {isFreeUser && (
          <div className="mb-6 bg-gradient-to-r from-amber-500 to-orange-500 rounded-xl shadow-lg overflow-hidden" data-testid="premium-upgrade-banner">
            <div className="p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="flex-shrink-0 w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    Contenido Premium
                  </h3>
                  <p className="text-white/90 text-sm">
                    Los webinars en vivo y grabaciones son exclusivos para usuarios premium. Actualiza tu cuenta para acceder a sesiones en vivo con instructores expertos.
                  </p>
                </div>
              </div>
              <Link
                to="/upgrade"
                className="flex-shrink-0 px-6 py-3 bg-white text-orange-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors shadow-md"
              >
                Actualizar a Premium
              </Link>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Webinars
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Sesiones en vivo con instructores expertos
            </p>
          </div>

          {user?.role === 'instructor' && (
            <Link
              to="/webinars/schedule"
              className="mt-4 md:mt-0 inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Programar Webinar
            </Link>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilter('upcoming')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'upcoming'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Proximos
            </button>
            <button
              onClick={() => setFilter('past')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                filter === 'past'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Finalizados
            </button>
          </div>

          <div className="flex gap-2 sm:ml-auto" role="group" aria-label="Vista de webinars">
            <button
              onClick={() => setView('list')}
              className={`p-2 rounded-lg transition-colors ${
                view === 'list'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Vista de lista"
              aria-label="Cambiar a vista de lista"
              aria-pressed={view === 'list'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
              </svg>
            </button>
            <button
              onClick={() => setView('calendar')}
              className={`p-2 rounded-lg transition-colors ${
                view === 'calendar'
                  ? 'bg-primary-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Vista de calendario"
              aria-label="Cambiar a vista de calendario"
              aria-pressed={view === 'calendar'}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Empty State */}
        {webinars.length === 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center">
            <svg className="w-16 h-16 mx-auto text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No hay webinars disponibles
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              {filter === 'upcoming'
                ? 'No hay webinars programados proximamente.'
                : filter === 'past'
                ? 'No hay webinars finalizados.'
                : 'Aun no se han programado webinars.'}
            </p>
          </div>
        )}

        {/* List View */}
        {view === 'list' && webinars.length > 0 && (
          <div className="space-y-4">
            {webinars.map((webinar) => (
              <div
                key={webinar.id}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow"
              >
                <div className="p-6">
                  <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        {getStatusBadge(webinar)}
                        {webinar.course_title && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {webinar.course_title}
                          </span>
                        )}
                      </div>
                      <h3
                        className="text-xl font-semibold text-gray-900 dark:text-white mb-2 line-clamp-2"
                        title={webinar.title}
                      >
                        {webinar.title}
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                        {webinar.description}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          {formatDate(webinar.scheduled_at)}
                        </div>
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          {formatTime(webinar.scheduled_at)} ({webinar.duration_minutes} min)
                        </div>
                        <div className="flex items-center gap-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                          {webinar.registered_count} registrados
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {getActionButton(webinar)}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Calendar View */}
        {view === 'calendar' && webinars.length > 0 && (
          <div className="space-y-6">
            {Object.entries(groupedWebinars)
              .sort(([a], [b]) => new Date(a) - new Date(b))
              .map(([date, dateWebinars]) => (
                <div key={date}>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {formatDate(date)}
                  </h3>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {dateWebinars.map((webinar) => (
                      <div
                        key={webinar.id}
                        className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 hover:shadow-lg transition-shadow"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          {getStatusBadge(webinar)}
                        </div>
                        <h4
                          className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1"
                          title={webinar.title}
                        >
                          {webinar.title}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {formatTime(webinar.scheduled_at)} - {webinar.duration_minutes} min
                        </p>
                        {getActionButton(webinar)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default WebinarsPage;
