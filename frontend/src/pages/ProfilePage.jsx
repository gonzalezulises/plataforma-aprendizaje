import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import toast from 'react-hot-toast';

// Feature #230: Export student progress report

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');

// Notification preference labels in Spanish
const NOTIFICATION_LABELS = {
  email_new_course: 'Nuevos cursos disponibles',
  email_enrollment_confirmed: 'Confirmacion de inscripcion',
  email_feedback_received: 'Retroalimentacion recibida',
  email_webinar_reminder: 'Recordatorios de webinars',
  email_weekly_progress: 'Reporte semanal de progreso',
  email_forum_replies: 'Respuestas en el foro'
};

function ProfilePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [preferences, setPreferences] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false); // Feature #230

  // Feature #230: Export progress function
  const handleExportProgress = async () => {
    setIsExporting(true);

    try {
      const response = await fetch(`${API_URL}/users/me/progress/export`, {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login', { state: { from: '/profile' } });
          return;
        }
        throw new Error('Error al exportar el progreso');
      }

      // Get the filename from the Content-Disposition header if available
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `progreso-${new Date().toISOString().split('T')[0]}.json`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) {
          filename = match[1];
        }
      }

      // Get the data and create download
      const data = await response.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);

      // Create download link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast.success('Progreso exportado exitosamente');
    } catch (err) {
      console.error('Error exporting progress:', err);
      toast.error('Error al exportar el progreso');
    } finally {
      setIsExporting(false);
    }
  };

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login', { state: { from: '/profile' } });
    }
  }, [isAuthenticated, authLoading, navigate]);

  // Fetch notification preferences on mount
  useEffect(() => {
    async function fetchPreferences() {
      if (!isAuthenticated) return;

      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(`${API_URL}/notifications/preferences`, {
          credentials: 'include'
        });

        if (!response.ok) {
          if (response.status === 401) {
            navigate('/login', { state: { from: '/profile' } });
            return;
          }

          // If preferences don't exist (404), initialize defaults
          if (response.status === 404) {
            await initializeDefaults();
            return;
          }

          throw new Error('Error al cargar preferencias de notificacion');
        }

        const data = await response.json();
        setPreferences(data.preferences || data);
      } catch (err) {
        console.error('Error fetching preferences:', err);
        setError(err.message);
        toast.error('Error al cargar preferencias de notificacion');
      } finally {
        setIsLoading(false);
      }
    }

    if (isAuthenticated) {
      fetchPreferences();
    }
  }, [isAuthenticated, navigate]);

  // Initialize default preferences
  const initializeDefaults = async () => {
    try {
      const response = await fetch(`${API_URL}/notifications/init-defaults`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Error al inicializar preferencias');
      }

      const data = await response.json();
      setPreferences(data.preferences || data);
      toast.success('Preferencias de notificacion inicializadas');
    } catch (err) {
      console.error('Error initializing defaults:', err);
      setError(err.message);
      toast.error('Error al inicializar preferencias');
    }
  };

  // Handle toggle change
  const handleToggle = async (preferenceKey) => {
    if (!preferences) return;

    const newValue = !preferences[preferenceKey];

    // Optimistic update
    const updatedPreferences = {
      ...preferences,
      [preferenceKey]: newValue
    };
    setPreferences(updatedPreferences);

    try {
      setIsSaving(true);

      const response = await fetch(`${API_URL}/notifications/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(updatedPreferences)
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login', { state: { from: '/profile' } });
          return;
        }
        throw new Error('Error al guardar preferencias');
      }

      const data = await response.json();
      setPreferences(data.preferences || data);
      toast.success('Preferencias actualizadas');
    } catch (err) {
      console.error('Error saving preferences:', err);
      // Revert optimistic update on error
      setPreferences(preferences);
      toast.error('Error al guardar preferencias');
    } finally {
      setIsSaving(false);
    }
  };

  // Loading state
  if (authLoading || (isAuthenticated && isLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Cargando tu perfil...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !preferences) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
            <p className="text-red-600 dark:text-red-400 mb-4">Error: {error}</p>
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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Mi Perfil
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Administra tu informacion personal y preferencias de notificacion
          </p>
        </div>

        {/* User Profile Info */}
        {user && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Informacion Personal
            </h2>
            <div className="space-y-3">
              <div className="flex items-center">
                <span className="text-gray-600 dark:text-gray-400 w-32">Nombre:</span>
                <span className="text-gray-900 dark:text-white font-medium">{user.name}</span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-600 dark:text-gray-400 w-32">Email:</span>
                <span className="text-gray-900 dark:text-white font-medium">{user.email}</span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-600 dark:text-gray-400 w-32">Rol:</span>
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800 dark:bg-primary-900 dark:text-primary-300">
                  {user.role === 'student_free' ? 'Estudiante Gratis' :
                   user.role === 'student_premium' ? 'Estudiante Premium' :
                   user.role === 'instructor_admin' ? 'Instructor/Admin' : user.role}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Feature #230: Export Progress Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Exportar Mi Progreso
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Descarga un archivo con todo tu progreso, cursos completados, calificaciones de quizzes y retos
            </p>
          </div>

          <button
            onClick={handleExportProgress}
            disabled={isExporting}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg transition-colors
              ${isExporting
                ? 'bg-gray-300 dark:bg-gray-600 cursor-not-allowed'
                : 'bg-primary-600 hover:bg-primary-700 text-white'
              }
            `}
            aria-label="Exportar progreso"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Exportando...</span>
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
                <span>Exportar Progreso</span>
              </>
            )}
          </button>
        </div>

        {/* Notification Preferences */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Preferencias de Notificacion
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Elige que notificaciones por correo electronico deseas recibir
            </p>
          </div>

          {preferences ? (
            <div className="space-y-4">
              {Object.keys(NOTIFICATION_LABELS).map((key) => (
                <div
                  key={key}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <label
                    htmlFor={key}
                    className="flex-1 cursor-pointer"
                  >
                    <span className="text-gray-900 dark:text-white font-medium">
                      {NOTIFICATION_LABELS[key]}
                    </span>
                  </label>

                  {/* Toggle Switch */}
                  <button
                    id={key}
                    role="switch"
                    aria-checked={preferences[key]}
                    onClick={() => handleToggle(key)}
                    disabled={isSaving}
                    className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                      ${preferences[key]
                        ? 'bg-primary-600'
                        : 'bg-gray-300 dark:bg-gray-600'
                      }
                      ${isSaving ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                    `}
                  >
                    <span
                      className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${preferences[key] ? 'translate-x-6' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">
                Cargando preferencias...
              </p>
            </div>
          )}

          {/* Saving indicator */}
          {isSaving && (
            <div className="mt-4 flex items-center justify-center text-sm text-primary-600 dark:text-primary-400">
              <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-600 border-t-transparent mr-2"></div>
              Guardando...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
