import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useNetworkAwareSubmit } from '../hooks/useNetworkAwareSubmit';
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning';
import { NetworkErrorBanner } from '../components/NetworkErrorBanner';
import UnsavedChangesModal from '../components/UnsavedChangesModal';
import { MAX_LENGTHS, getCharCountDisplay, getCharCountClasses, exceedsLimit } from '../utils/validationLimits';

// Strip trailing /api from VITE_API_URL to avoid double /api/api paths
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '');

function ForumPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [course, setCourse] = useState(null);
  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newThread, setNewThread] = useState({ title: '', content: '' });
  const [filter, setFilter] = useState('all'); // all, resolved, unresolved
  const [sort, setSort] = useState('newest');
  const [formRestored, setFormRestored] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ title: '', content: '' });

  // Network-aware form submission
  const {
    isSubmitting: creating,
    networkError,
    hasPendingRetry,
    submit,
    retry,
    clearError,
  } = useNetworkAwareSubmit();

  // Get user from session/localStorage
  const getUser = () => {
    const stored = localStorage.getItem('user');
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  };

  const user = getUser();

  // localStorage key for forum thread form persistence
  const formDataKey = `forum_thread_${slug}_form`;

  // Detect if form has unsaved content
  const hasUnsavedContent = showNewThread && (newThread.title.trim() !== '' || newThread.content.trim() !== '');

  // Unsaved changes warning hook
  const {
    showModal: showUnsavedModal,
    confirmNavigation,
    cancelNavigation,
    message: unsavedMessage,
  } = useUnsavedChangesWarning(
    hasUnsavedContent,
    'Tienes una pregunta sin publicar. Si sales ahora, perderas el contenido que has escrito.'
  );

  // Restore form data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem(formDataKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.title || parsed.content) {
          setNewThread({
            title: parsed.title || '',
            content: parsed.content || ''
          });
          setShowNewThread(true);
          setFormRestored(true);
        }
      } catch (e) {
        console.error('Error restoring forum form data:', e);
      }
    }
  }, [formDataKey]);

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    if (newThread.title || newThread.content) {
      const dataToSave = {
        title: newThread.title,
        content: newThread.content,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(formDataKey, JSON.stringify(dataToSave));
    }
  }, [newThread.title, newThread.content, formDataKey]);

  // Clear saved form data
  const clearSavedFormData = () => {
    localStorage.removeItem(formDataKey);
    setFormRestored(false);
  };

  useEffect(() => {
    fetchCourse();
  }, [slug]);

  useEffect(() => {
    if (course?.id) {
      fetchThreads();
    }
  }, [course?.id, filter, sort]);

  const fetchCourse = async () => {
    try {
      const res = await fetch(`${API_URL}/api/courses/${slug}`);
      if (!res.ok) throw new Error('Course not found');
      const data = await res.json();
      setCourse(data.course || data);
    } catch (error) {
      console.error('Error fetching course:', error);
      toast.error('Error al cargar el curso');
    }
  };

  const fetchThreads = async () => {
    if (!course?.id) return;

    setLoading(true);
    try {
      const params = new URLSearchParams({ sort });
      if (filter === 'resolved') params.append('resolved', 'true');
      if (filter === 'unresolved') params.append('resolved', 'false');

      const res = await fetch(`${API_URL}/api/forum/course/${course.id}?${params}`);
      if (!res.ok) throw new Error('Failed to fetch threads');
      const data = await res.json();
      setThreads(data.threads || []);
    } catch (error) {
      console.error('Error fetching threads:', error);
      toast.error('Error al cargar los hilos del foro');
    } finally {
      setLoading(false);
    }
  };

// Minimum length constants for validation
  const MIN_TITLE_LENGTH = 5;
  const MIN_CONTENT_LENGTH = 10;

  // Clear field error when user starts typing (and meets minimum length)
  const handleFieldChange = (field, value) => {
    setNewThread({ ...newThread, [field]: value });

    // Real-time validation - show errors as user types, clear when valid
    const trimmedValue = value.trim();

    if (field === 'title') {
      if (trimmedValue.length === 0) {
        // Only show "required" error if user has started typing and deleted all
        if (value.length > 0 && trimmedValue.length === 0) {
          setFieldErrors(prev => ({ ...prev, title: 'El titulo es requerido' }));
        }
      } else if (trimmedValue.length < MIN_TITLE_LENGTH) {
        setFieldErrors(prev => ({
          ...prev,
          title: `El titulo debe tener al menos ${MIN_TITLE_LENGTH} caracteres (${trimmedValue.length}/${MIN_TITLE_LENGTH})`
        }));
      } else {
        // Valid - clear error
        setFieldErrors(prev => ({ ...prev, title: '' }));
      }
    } else if (field === 'content') {
      if (trimmedValue.length === 0) {
        // Only show "required" error if user has started typing and deleted all
        if (value.length > 0 && trimmedValue.length === 0) {
          setFieldErrors(prev => ({ ...prev, content: 'El contenido es requerido' }));
        }
      } else if (trimmedValue.length < MIN_CONTENT_LENGTH) {
        setFieldErrors(prev => ({
          ...prev,
          content: `El contenido debe tener al menos ${MIN_CONTENT_LENGTH} caracteres (${trimmedValue.length}/${MIN_CONTENT_LENGTH})`
        }));
      } else {
        // Valid - clear error
        setFieldErrors(prev => ({ ...prev, content: '' }));
      }
    }
  };

  const handleCreateThread = async (e) => {
    e.preventDefault();

    // Validate required fields and minimum length
    const errors = { title: '', content: '' };
    let hasErrors = false;
    const trimmedTitle = newThread.title.trim();
    const trimmedContent = newThread.content.trim();

    if (!trimmedTitle) {
      errors.title = 'El titulo es requerido';
      hasErrors = true;
    } else if (trimmedTitle.length < MIN_TITLE_LENGTH) {
      errors.title = `El titulo debe tener al menos ${MIN_TITLE_LENGTH} caracteres`;
      hasErrors = true;
    }

    if (!trimmedContent) {
      errors.content = 'El contenido es requerido';
      hasErrors = true;
    } else if (trimmedContent.length < MIN_CONTENT_LENGTH) {
      errors.content = `El contenido debe tener al menos ${MIN_CONTENT_LENGTH} caracteres`;
      hasErrors = true;
    }

    setFieldErrors(errors);

    if (hasErrors) {
      toast.error('Por favor corrige los errores en el formulario');
      return;
    }

    const performSubmit = async () => {
      const res = await fetch(`${API_URL}/api/forum/course/${course.id}/thread`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: newThread.title,
          content: newThread.content,
          userId: user?.id || 'dev-user',
          userName: user?.name || 'Usuario de Prueba'
        })
      });

      // Handle server-side validation errors
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        // Throw structured error so it can be handled in onError
        const error = new Error(errorData.error || 'Failed to create thread');
        error.validationErrors = errorData.validationErrors;
        error.status = res.status;
        throw error;
      }
      return res.json();
    };

    const result = await submit(performSubmit, {
      preserveData: { title: newThread.title, content: newThread.content },
      onSuccess: (data) => {
        // Clear saved form data after successful submission
        clearSavedFormData();
        toast.success('Hilo creado exitosamente');
        setNewThread({ title: '', content: '' });
        setFieldErrors({ title: '', content: '' });
        setShowNewThread(false);
        // Navigate to the new thread
        navigate(`/forum/thread/${data.thread.id}`);
      },
      onError: (error) => {
        console.error('Error creating thread:', error);
        // Handle server-side validation errors
        if (error.validationErrors) {
          // Display server validation errors on the form fields
          setFieldErrors({
            title: error.validationErrors.title || '',
            content: error.validationErrors.content || ''
          });
          toast.error('Por favor corrige los errores en el formulario');
        } else {
          toast.error('Error al crear el hilo');
        }
      },
      onNetworkError: (error) => {
        console.error('Network error creating thread:', error);
        // Form data is preserved, network error banner will show
      },
    });
  };

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;

    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Ahora mismo';
    if (minutes < 60) return `Hace ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
    if (hours < 24) return `Hace ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    if (days < 7) return `Hace ${days} ${days === 1 ? 'dia' : 'dias'}`;

    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  if (!course) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <li><Link to="/courses" className="hover:text-primary-600">Cursos</Link></li>
            <li><span className="mx-2">/</span></li>
            <li><Link to={`/course/${slug}`} className="hover:text-primary-600">{course.title}</Link></li>
            <li><span className="mx-2">/</span></li>
            <li className="text-gray-900 dark:text-white font-medium">Foro</li>
          </ol>
        </nav>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Foro del Curso
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Discusiones y preguntas sobre {course.title}
            </p>
          </div>

          <button
            onClick={() => setShowNewThread(true)}
            aria-label="Crear nueva pregunta en el foro"
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Pregunta
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6" role="group" aria-label="Filtros del foro">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            aria-label="Filtrar por estado"
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Todos los hilos</option>
            <option value="unresolved">Sin resolver</option>
            <option value="resolved">Resueltos</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
            aria-label="Ordenar por"
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="newest">Mas recientes</option>
            <option value="oldest">Mas antiguos</option>
            <option value="most_replies">Mas respuestas</option>
          </select>
        </div>

        {/* New Thread Form */}
        {showNewThread && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Crear Nueva Pregunta
            </h2>

            {/* Form Data Restored Notification */}
            {formRestored && (
              <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm text-blue-700 dark:text-blue-300">
                  Tu pregunta anterior ha sido restaurada automáticamente.
                </span>
                <button
                  type="button"
                  onClick={() => setFormRestored(false)}
                  className="ml-auto text-blue-500 hover:text-blue-700"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            )}

            {/* Network Error Banner */}
            <NetworkErrorBanner
              networkError={networkError}
              onRetry={retry}
              onDismiss={clearError}
              isRetrying={creating}
            />

            <form onSubmit={handleCreateThread}>
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="thread-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Titulo <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-xs ${getCharCountClasses(newThread.title.length, MAX_LENGTHS.FORUM_TITLE)}`}>
                    {getCharCountDisplay(newThread.title.length, MAX_LENGTHS.FORUM_TITLE)}
                  </span>
                </div>
                <input
                  type="text"
                  id="thread-title"
                  value={newThread.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  placeholder="Escribe un titulo descriptivo para tu pregunta..."
                  maxLength={MAX_LENGTHS.FORUM_TITLE}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                    fieldErrors.title || exceedsLimit(newThread.title.length, MAX_LENGTHS.FORUM_TITLE)
                      ? 'border-red-500 dark:border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  disabled={creating}
                  aria-invalid={!!fieldErrors.title}
                  aria-describedby={fieldErrors.title ? 'title-error' : undefined}
                />
                {fieldErrors.title && (
                  <p id="title-error" className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {fieldErrors.title}
                  </p>
                )}
              </div>
              <div className="mb-4">
                <div className="flex justify-between items-center mb-2">
                  <label htmlFor="thread-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Contenido <span className="text-red-500">*</span>
                  </label>
                  <span className={`text-xs ${getCharCountClasses(newThread.content.length, MAX_LENGTHS.FORUM_CONTENT)}`}>
                    {getCharCountDisplay(newThread.content.length, MAX_LENGTHS.FORUM_CONTENT)}
                  </span>
                </div>
                <textarea
                  id="thread-content"
                  value={newThread.content}
                  onChange={(e) => handleFieldChange('content', e.target.value)}
                  placeholder="Describe tu pregunta con detalle. Incluye codigo si es relevante..."
                  rows={6}
                  maxLength={MAX_LENGTHS.FORUM_CONTENT}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono ${
                    fieldErrors.content || exceedsLimit(newThread.content.length, MAX_LENGTHS.FORUM_CONTENT)
                      ? 'border-red-500 dark:border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  disabled={creating}
                  aria-invalid={!!fieldErrors.content}
                  aria-describedby={fieldErrors.content ? 'content-error' : undefined}
                />
                {fieldErrors.content && (
                  <p id="content-error" className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {fieldErrors.content}
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {creating ? 'Creando...' : 'Publicar Pregunta'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNewThread(false);
                    setNewThread({ title: '', content: '' });
                    setFieldErrors({ title: '', content: '' });
                    clearSavedFormData();
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Threads List */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : threads.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-12 text-center">
            <div className="text-6xl mb-4">💬</div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              No hay hilos en el foro
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Se el primero en iniciar una discusion o hacer una pregunta.
            </p>
            <button
              onClick={() => setShowNewThread(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Crear Primera Pregunta
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {threads.map((thread) => (
              <Link
                key={thread.id}
                to={`/forum/thread/${thread.id}`}
                className="block bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 hover:shadow-lg transition-shadow"
              >
                <div className="flex items-start gap-4">
                  {/* Status indicator */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${
                    thread.is_resolved
                      ? 'bg-green-100 dark:bg-green-900 text-green-600 dark:text-green-400'
                      : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-600 dark:text-yellow-400'
                  }`}>
                    {thread.is_resolved ? (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    )}
                  </div>

                  <div className="flex-grow min-w-0">
                    {/* Title */}
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 truncate">
                      {thread.title}
                    </h3>

                    {/* Content preview */}
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-3 line-clamp-2">
                      {thread.content}
                    </p>

                    {/* Meta info */}
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        {thread.user_name}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {formatDate(thread.created_at)}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        {thread.reply_count || 0} {thread.reply_count === 1 ? 'respuesta' : 'respuestas'}
                      </span>
                      {thread.is_resolved && (
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          Resuelto
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Unsaved Changes Warning Modal */}
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
        message={unsavedMessage}
      />
    </div>
  );
}

export default ForumPage;
