import { useState, useEffect } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import toast from 'react-hot-toast';
import { csrfFetch } from '../utils/csrf';

// Feature #230: Export student progress report
// Feature #64: Profile tabs navigate correctly
// Feature #75: Profile updates are saved

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api');
// Strip trailing /api from VITE_API_URL to avoid double /api/api paths for some endpoints
const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '');

// Notification preference labels in Spanish
const NOTIFICATION_LABELS = {
  email_new_course: 'Nuevos cursos disponibles',
  email_enrollment_confirmed: 'Confirmacion de inscripcion',
  email_feedback_received: 'Retroalimentacion recibida',
  email_webinar_reminder: 'Recordatorios de webinars',
  email_weekly_progress: 'Reporte semanal de progreso',
  email_forum_replies: 'Respuestas en el foro'
};

// Tab configuration
const TABS = [
  { id: 'info', label: 'Mi Perfil', path: '/profile' },
  { id: 'certificates', label: 'Certificados', path: '/profile/certificates' },
  { id: 'badges', label: 'Insignias', path: '/profile/badges' }
];

function ProfilePage() {
  const { user, isAuthenticated, isLoading: authLoading, refreshAuth } = useAuth();
  const navigate = useNavigate();
  const { tab } = useParams();

  // Determine active tab from URL
  const activeTab = tab || 'info';

  const [preferences, setPreferences] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);
  const [isExporting, setIsExporting] = useState(false);

  // Feature #75: Profile editing state
  const [profileData, setProfileData] = useState({ bio: '' });
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Certificates state
  const [certificates, setCertificates] = useState([]);
  const [certificatesLoading, setCertificatesLoading] = useState(false);

  // Badges state
  const [badges, setBadges] = useState([]);
  const [badgesLoading, setBadgesLoading] = useState(false);

  // Feature #28: Account deletion state
  const [deletionStatus, setDeletionStatus] = useState({ hasPendingRequest: false });
  const [isDeletionLoading, setIsDeletionLoading] = useState(false);
  const [showDeletionConfirm, setShowDeletionConfirm] = useState(false);

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

  // Feature #75: Fetch user profile data (including bio) on mount
  useEffect(() => {
    async function fetchProfile() {
      if (!isAuthenticated) return;

      try {
        const response = await fetch(`${API_URL}/users/me`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setProfileData({ bio: data.user.bio || '' });
          }
        }
      } catch (err) {
        console.error('Error fetching profile:', err);
      }
    }

    if (isAuthenticated) {
      fetchProfile();
    }
  }, [isAuthenticated]);

  // Feature #75: Handle profile save
  const handleSaveProfile = async () => {
    setIsSavingProfile(true);

    try {
      const response = await csrfFetch(`${API_URL}/users/me`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ bio: profileData.bio })
      });

      if (!response.ok) {
        if (response.status === 401) {
          navigate('/login', { state: { from: '/profile' } });
          return;
        }
        throw new Error('Error al guardar el perfil');
      }

      const data = await response.json();
      if (data.success) {
        toast.success('Perfil actualizado exitosamente');
        setIsEditingProfile(false);
        // Refresh user data in auth context if available
        if (refreshAuth) {
          refreshAuth();
        }
      } else {
        throw new Error(data.error || 'Error al guardar el perfil');
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      toast.error(err.message || 'Error al guardar el perfil');
    } finally {
      setIsSavingProfile(false);
    }
  };

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

  // Fetch certificates when tab is active
  useEffect(() => {
    async function fetchCertificates() {
      if (!isAuthenticated || activeTab !== 'certificates') return;

      try {
        setCertificatesLoading(true);
        const response = await fetch(`${BASE_URL}/api/certificates?userId=${user?.id || 'dev-user'}`, {
          credentials: 'include'
        });

        if (!response.ok) {
          if (response.status === 401) {
            navigate('/login', { state: { from: '/profile/certificates' } });
            return;
          }
          throw new Error('Failed to fetch certificates');
        }

        const data = await response.json();
        setCertificates(data.certificates || []);
      } catch (error) {
        console.error('Error fetching certificates:', error);
        toast.error('Error al cargar los certificados');
      } finally {
        setCertificatesLoading(false);
      }
    }

    if (isAuthenticated && activeTab === 'certificates' && certificates.length === 0) {
      fetchCertificates();
    }
  }, [isAuthenticated, activeTab, user, navigate]);

  // Fetch badges when tab is active
  useEffect(() => {
    async function fetchBadges() {
      if (!isAuthenticated || activeTab !== 'badges') return;

      try {
        setBadgesLoading(true);
        const response = await fetch(`${API_URL}/career-paths/user/badges`, {
          credentials: 'include'
        });

        if (!response.ok) {
          if (response.status === 401) {
            navigate('/login', { state: { from: '/profile/badges' } });
            return;
          }
          throw new Error('Failed to fetch badges');
        }

        const data = await response.json();
        setBadges(data.badges || []);
      } catch (error) {
        console.error('Error fetching badges:', error);
        toast.error('Error al cargar las insignias');
      } finally {
        setBadgesLoading(false);
      }
    }

    if (isAuthenticated && activeTab === 'badges' && badges.length === 0) {
      fetchBadges();
    }
  }, [isAuthenticated, activeTab, navigate]);

  // Feature #28: Fetch deletion request status
  useEffect(() => {
    async function fetchDeletionStatus() {
      if (!isAuthenticated) return;

      try {
        const response = await fetch(`${API_URL}/users/me/deletion-status`, {
          credentials: 'include'
        });

        if (response.ok) {
          const data = await response.json();
          setDeletionStatus(data);
        }
      } catch (err) {
        console.error('Error fetching deletion status:', err);
      }
    }

    if (isAuthenticated) {
      fetchDeletionStatus();
    }
  }, [isAuthenticated]);

  // Feature #28: Request account deletion
  const handleRequestDeletion = async () => {
    setIsDeletionLoading(true);

    try {
      const response = await csrfFetch(`${API_URL}/users/me/request-deletion`, {
        method: 'POST'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al solicitar eliminacion');
      }

      toast.success(data.message || 'Se ha enviado un correo de confirmacion');
      setDeletionStatus({ hasPendingRequest: true, requestedAt: new Date().toISOString() });
      setShowDeletionConfirm(false);
    } catch (err) {
      console.error('Error requesting deletion:', err);
      toast.error(err.message || 'Error al solicitar eliminacion de cuenta');
    } finally {
      setIsDeletionLoading(false);
    }
  };

  // Feature #28: Cancel pending deletion request
  const handleCancelDeletion = async () => {
    setIsDeletionLoading(true);

    try {
      const response = await csrfFetch(`${API_URL}/users/me/cancel-deletion`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Error al cancelar eliminacion');
      }

      toast.success(data.message || 'Solicitud de eliminacion cancelada');
      setDeletionStatus({ hasPendingRequest: false });
    } catch (err) {
      console.error('Error canceling deletion:', err);
      toast.error(err.message || 'Error al cancelar la solicitud');
    } finally {
      setIsDeletionLoading(false);
    }
  };

  // Initialize default preferences
  const initializeDefaults = async () => {
    try {
      const response = await csrfFetch(`${API_URL}/notifications/init-defaults`, {
        method: 'POST'
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

      const response = await csrfFetch(`${API_URL}/notifications/preferences`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
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

  // Certificate download handler
  const handleDownloadCertificate = async (certId) => {
    try {
      window.open(`${BASE_URL}/api/certificates/${certId}/pdf?userId=${user?.id || 'dev-user'}`, '_blank');
    } catch (error) {
      console.error('Error downloading certificate:', error);
      toast.error('Error al descargar el certificado');
    }
  };

  // Format date helper
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  // Loading state
  if (authLoading || (isAuthenticated && isLoading && activeTab === 'info')) {
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
  if (error && !preferences && activeTab === 'info') {
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

  // Render Profile Info Tab Content
  const renderProfileInfo = () => (
    <>
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
                 user.role === 'instructor' ? 'Instructor/Admin' : user.role}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Feature #75: Bio Section - Editable */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Acerca de mi
          </h2>
          {!isEditingProfile && (
            <button
              onClick={() => setIsEditingProfile(true)}
              className="text-primary-600 hover:text-primary-700 text-sm font-medium flex items-center gap-1"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              </svg>
              Editar
            </button>
          )}
        </div>

        {isEditingProfile ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Biografia
              </label>
              <textarea
                id="bio"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white"
                placeholder="Escribe algo sobre ti..."
                value={profileData.bio}
                onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
              />
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Cuenta a otros estudiantes e instructores sobre ti, tus intereses y objetivos de aprendizaje.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className={`px-4 py-2 rounded-lg text-white transition-colors ${
                  isSavingProfile
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-primary-600 hover:bg-primary-700'
                }`}
              >
                {isSavingProfile ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Guardando...
                  </span>
                ) : (
                  'Guardar Cambios'
                )}
              </button>
              <button
                onClick={() => setIsEditingProfile(false)}
                className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div>
            {profileData.bio ? (
              <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{profileData.bio}</p>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 italic">
                No has agregado informacion sobre ti. Haz clic en "Editar" para agregar tu biografia.
              </p>
            )}
          </div>
        )}
      </div>

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

      {/* Feature #28: Account Deletion Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mt-6 border border-red-200 dark:border-red-900">
        <div className="mb-4">
          <h2 className="text-xl font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Eliminar Cuenta
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Eliminar tu cuenta es permanente e irreversible. Todos tus datos seran borrados.
          </p>
        </div>

        {deletionStatus.hasPendingRequest ? (
          // Show pending deletion request status
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-yellow-600 dark:text-yellow-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
                  Solicitud de eliminacion pendiente
                </h3>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  Se ha enviado un correo de confirmacion a tu email. Haz clic en el enlace del correo para confirmar la eliminacion.
                </p>
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                  El enlace expira en 24 horas. Revisa tu carpeta de spam si no lo encuentras.
                </p>
              </div>
            </div>
            <button
              onClick={handleCancelDeletion}
              disabled={isDeletionLoading}
              className={`mt-4 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isDeletionLoading
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {isDeletionLoading ? 'Cancelando...' : 'Cancelar solicitud'}
            </button>
          </div>
        ) : showDeletionConfirm ? (
          // Show confirmation dialog
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <h3 className="font-medium text-red-800 dark:text-red-200 mb-2">
              ¿Estas seguro que deseas eliminar tu cuenta?
            </h3>
            <ul className="text-sm text-red-700 dark:text-red-300 mb-4 space-y-1">
              <li>• Se eliminaran todos tus cursos inscritos</li>
              <li>• Se borraran tus envios y calificaciones</li>
              <li>• Se eliminaran tus certificados e insignias</li>
              <li>• Esta accion no se puede deshacer</li>
            </ul>
            <p className="text-sm text-red-600 dark:text-red-400 mb-4">
              Se enviara un correo de confirmacion a tu email. Debes hacer clic en el enlace para completar la eliminacion.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleRequestDeletion}
                disabled={isDeletionLoading}
                className={`px-4 py-2 rounded-lg text-white font-medium transition-colors ${
                  isDeletionLoading
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isDeletionLoading ? (
                  <span className="flex items-center gap-2">
                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Enviando...
                  </span>
                ) : (
                  'Si, enviar correo de confirmacion'
                )}
              </button>
              <button
                onClick={() => setShowDeletionConfirm(false)}
                className="px-4 py-2 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          // Show initial deletion button
          <button
            onClick={() => setShowDeletionConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Solicitar eliminacion de cuenta
          </button>
        )}
      </div>
    </>
  );

  // Render Certificates Tab Content
  const renderCertificates = () => {
    if (certificatesLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      );
    }

    if (certificates.length === 0) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center">
          <div className="text-6xl mb-4">🎓</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Aun no tienes certificados
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Completa cursos para obtener certificados de finalizacion.
          </p>
          <Link
            to="/courses"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
            Explorar Cursos
          </Link>
        </div>
      );
    }

    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {certificates.map((cert) => (
          <div
            key={cert.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow"
          >
            {/* Certificate Preview */}
            <div className="bg-gradient-to-br from-primary-500 to-primary-700 p-6 text-white">
              <div className="text-sm opacity-75 mb-1">cursos.rizo.ma</div>
              <h3 className="font-bold text-lg mb-2 line-clamp-2">{cert.courseTitle}</h3>
              <div className="flex items-center gap-2 text-sm opacity-90">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                {cert.userName}
              </div>
            </div>

            {/* Certificate Info */}
            <div className="p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                {formatDate(cert.issuedAt)}
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-2 mb-4">
                {cert.courseCategory && (
                  <span className="px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 text-xs rounded-full">
                    {cert.courseCategory}
                  </span>
                )}
                {cert.courseLevel && (
                  <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs rounded-full">
                    {cert.courseLevel}
                  </span>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => handleDownloadCertificate(cert.id)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Descargar
                </button>
                <Link
                  to={`/certificate/verify/${cert.verificationCode}`}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Verificar
                </Link>
              </div>

              {/* Verification Code */}
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Codigo de verificacion:
                </div>
                <code className="text-xs text-primary-600 dark:text-primary-400 font-mono">
                  {cert.verificationCode}
                </code>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Render Badges Tab Content
  const renderBadges = () => {
    if (badgesLoading) {
      return (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      );
    }

    if (badges.length === 0) {
      return (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center">
          <div className="text-6xl mb-4">🏆</div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Aun no tienes insignias
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Completa rutas de carrera para obtener insignias de logro.
          </p>
          <Link
            to="/career-paths"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            Ver Rutas de Carrera
          </Link>
        </div>
      );
    }

    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {badges.map((badge) => (
          <div
            key={badge.id}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow"
          >
            {/* Badge Header */}
            <div
              className="p-6 text-white text-center"
              style={{ backgroundColor: badge.color || '#2563EB' }}
            >
              <div className="text-5xl mb-3">🏆</div>
              <h3 className="font-bold text-lg">{badge.career_path_name}</h3>
            </div>

            {/* Badge Info */}
            <div className="p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-3">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Obtenida: {formatDate(badge.earned_at)}
              </div>

              <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
                Ruta de carrera completada
              </div>

              {badge.career_path_slug && (
                <Link
                  to={`/career-paths/${badge.career_path_slug}`}
                  className="mt-4 block text-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-sm"
                >
                  Ver Ruta de Carrera
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Mi Perfil
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Administra tu informacion personal, certificados e insignias
          </p>
        </div>

        {/* Tabs Navigation */}
        <div className="mb-6">
          <nav className="flex space-x-1 bg-white dark:bg-gray-800 rounded-lg shadow-md p-1" aria-label="Tabs">
            {TABS.map((tabItem) => (
              <Link
                key={tabItem.id}
                to={tabItem.path}
                className={`
                  flex-1 text-center px-4 py-2 rounded-md text-sm font-medium transition-colors
                  ${activeTab === tabItem.id
                    ? 'bg-primary-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                  }
                `}
                aria-current={activeTab === tabItem.id ? 'page' : undefined}
              >
                {tabItem.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="tab-content">
          {activeTab === 'info' && renderProfileInfo()}
          {activeTab === 'certificates' && renderCertificates()}
          {activeTab === 'badges' && renderBadges()}
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;
