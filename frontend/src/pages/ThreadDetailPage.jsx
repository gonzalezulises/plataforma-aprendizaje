import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useNetworkAwareSubmit } from '../hooks/useNetworkAwareSubmit';
import { NetworkErrorBanner } from '../components/NetworkErrorBanner';
import useWebSocket from '../hooks/useWebSocket';
import { useAuth } from '../store/AuthContext';
import { MAX_LENGTHS, getCharCountDisplay, getCharCountClasses, exceedsLimit } from '../utils/validationLimits';

// Strip trailing /api from VITE_API_URL to avoid double /api/api paths
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/api$/, '');

function ThreadDetailPage() {
  const { threadId } = useParams();
  const navigate = useNavigate();
  const [thread, setThread] = useState(null);
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newReply, setNewReply] = useState('');
  const [course, setCourse] = useState(null);
  const [replyError, setReplyError] = useState('');

  // WebSocket for real-time updates
  const ws = useWebSocket();
  const [wsStatus, setWsStatus] = useState('disconnected');
  const repliesRef = useRef(replies);

  // Keep repliesRef in sync with replies state
  useEffect(() => {
    repliesRef.current = replies;
  }, [replies]);

  // Network-aware form submission
  const {
    isSubmitting: submitting,
    networkError,
    hasPendingRetry,
    submit,
    retry,
    clearError,
  } = useNetworkAwareSubmit();

  // Get user from AuthContext
  const { user } = useAuth();
  const isOwner = user && thread && (String(user.id) === String(thread.user_id));
  const isInstructor = user && user.role === 'instructor_admin';

  useEffect(() => {
    fetchThread();
  }, [threadId]);

  // WebSocket connection and subscription
  useEffect(() => {
    if (!threadId) return;

    // Connect to WebSocket
    ws.connect();

    // Subscribe to thread updates when connected
    const checkAndSubscribe = () => {
      if (ws.isConnected) {
        ws.subscribe(threadId);
        setWsStatus('connected');
      }
    };

    // Check connection status periodically until connected
    const connectionCheck = setInterval(() => {
      if (ws.isConnected) {
        checkAndSubscribe();
        clearInterval(connectionCheck);
      }
    }, 200);

    // Set up message handler for new replies
    const cleanup = ws.onMessage('new_reply', (data) => {
      if (data.threadId === parseInt(threadId) && data.reply) {
        // Check if we already have this reply (avoid duplicates from own posts)
        const existingReply = repliesRef.current.find(r => r.id === data.reply.id);
        if (!existingReply) {
          setReplies(prev => [...prev, data.reply]);
          setThread(prev => prev ? { ...prev, reply_count: (prev.reply_count || 0) + 1 } : prev);
          toast.success('Nueva respuesta recibida', {
            icon: '💬',
            duration: 3000
          });
        }
      }
    });

    // Cleanup on unmount
    return () => {
      clearInterval(connectionCheck);
      ws.unsubscribe(threadId);
      cleanup();
      setWsStatus('disconnected');
    };
  }, [threadId, ws.isConnected]);

  // Update status when connection changes
  useEffect(() => {
    setWsStatus(ws.isConnected ? 'connected' : 'disconnected');
  }, [ws.isConnected]);

  useEffect(() => {
    if (thread?.course_id) {
      fetchCourse(thread.course_id);
    }
  }, [thread?.course_id]);

  const fetchThread = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/forum/thread/${threadId}`);
      if (!res.ok) throw new Error('Thread not found');
      const data = await res.json();
      setThread(data.thread);
      setReplies(data.replies || []);
    } catch (error) {
      console.error('Error fetching thread:', error);
      toast.error('Error al cargar el hilo');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourse = async (courseId) => {
    try {
      // Get course by ID - we'll need to fetch all courses and find by ID
      // For now, we'll construct a simple slug lookup
      const res = await fetch(`${API_URL}/api/courses`);
      if (res.ok) {
        const data = await res.json();
        const courses = data.courses || data;
        const foundCourse = courses.find(c => c.id === courseId);
        if (foundCourse) {
          setCourse(foundCourse);
        }
      }
    } catch (error) {
      console.error('Error fetching course:', error);
    }
  };

  const handleAddReply = async (e) => {
    e.preventDefault();

    if (!newReply.trim()) {
      toast.error('Por favor escribe una respuesta');
      return;
    }

    // Clear any previous error
    setReplyError('');

    const performSubmit = async () => {
      const res = await fetch(`${API_URL}/api/forum/thread/${threadId}/reply`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          content: newReply,
          userId: user?.id || 'dev-user',
          userName: user?.name || 'Usuario de Prueba',
          isInstructorAnswer: isInstructor
        })
      });

      // Handle server-side validation errors
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const error = new Error(errorData.error || 'Failed to add reply');
        error.validationErrors = errorData.validationErrors;
        error.status = res.status;
        throw error;
      }
      return res.json();
    };

    await submit(performSubmit, {
      preserveData: { content: newReply },
      onSuccess: (data) => {
        // Only add reply if it's valid (not null)
        if (data.reply) {
          setReplies([...replies, data.reply]);
        } else {
          // Refetch replies if the API didn't return the created reply
          fetchThread();
        }
        setNewReply('');
        setReplyError('');
        toast.success('Respuesta publicada');
        // Update thread reply count
        setThread({ ...thread, reply_count: (thread.reply_count || 0) + 1 });
      },
      onError: (error) => {
        console.error('Error adding reply:', error);
        // Handle thread deleted (404) - redirect user to valid page
        if (error.status === 404) {
          toast.error('Este hilo ha sido eliminado por otro usuario');
          // Set thread to null to show 404 page
          setThread(null);
          return;
        }
        // Handle server-side validation errors
        if (error.validationErrors) {
          setReplyError(error.validationErrors.content || '');
          toast.error('Por favor corrige los errores en el formulario');
        } else {
          toast.error('Error al publicar la respuesta');
        }
      },
      onNetworkError: (error) => {
        console.error('Network error adding reply:', error);
        // Form data is preserved, network error banner will show
      },
    });
  };

  const handleVote = async (replyId) => {
    try {
      const res = await fetch(`${API_URL}/api/forum/reply/${replyId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          userId: user?.id || 'dev-user',
          voteType: 'upvote'
        })
      });

      // Handle deleted thread/reply (404)
      if (res.status === 404) {
        toast.error('Este hilo o respuesta ha sido eliminado');
        setThread(null);
        return;
      }

      if (!res.ok) throw new Error('Failed to vote');

      const data = await res.json();

      // Update local state
      setReplies(replies.map(r => {
        if (r.id === replyId) {
          const change = data.action === 'added' ? 1 : data.action === 'removed' ? -1 : 0;
          return { ...r, votes: (r.votes || 0) + change };
        }
        return r;
      }));

      toast.success(data.action === 'added' ? 'Voto registrado' : 'Voto removido');
    } catch (error) {
      console.error('Error voting:', error);
      toast.error('Error al votar');
    }
  };

  const handleMarkResolved = async () => {
    try {
      const res = await fetch(`${API_URL}/api/forum/thread/${threadId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ resolved: !thread.is_resolved })
      });

      // Handle deleted thread (404)
      if (res.status === 404) {
        toast.error('Este hilo ha sido eliminado por otro usuario');
        setThread(null);
        return;
      }

      if (!res.ok) throw new Error('Failed to update thread');

      const data = await res.json();
      setThread(data.thread);
      toast.success(data.thread.is_resolved ? 'Hilo marcado como resuelto' : 'Hilo reabierto');
    } catch (error) {
      console.error('Error updating thread:', error);
      toast.error('Error al actualizar el hilo');
    }
  };

  const handleDeleteThread = async () => {
    // Show confirmation dialog
    if (!window.confirm('¿Estás seguro de que quieres eliminar este hilo? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/forum/thread/${threadId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete thread');
      }

      toast.success('Hilo eliminado correctamente');

      // Navigate back to forum
      if (course) {
        navigate(`/course/${course.slug}/forum`);
      } else {
        navigate('/courses');
      }
    } catch (error) {
      console.error('Error deleting thread:', error);
      toast.error('Error al eliminar el hilo');
    }
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

    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!thread) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">404</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Hilo no encontrado</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">El hilo que buscas no existe o fue eliminado.</p>
          <Link to="/courses" className="text-primary-600 hover:underline">
            Volver a cursos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6">
          <ol className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
            <li><Link to="/courses" className="hover:text-primary-600">Cursos</Link></li>
            {course && (
              <>
                <li><span className="mx-2">/</span></li>
                <li><Link to={`/course/${course.slug}`} className="hover:text-primary-600">{course.title}</Link></li>
                <li><span className="mx-2">/</span></li>
                <li><Link to={`/course/${course.slug}/forum`} className="hover:text-primary-600">Foro</Link></li>
              </>
            )}
            <li><span className="mx-2">/</span></li>
            <li className="text-gray-900 dark:text-white font-medium truncate max-w-xs">{thread.title}</li>
          </ol>
        </nav>

        {/* Thread Header */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              {thread.is_resolved ? (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Resuelto
                </span>
              ) : (
                <span className="px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Abierto
                </span>
              )}
            </div>

            {(isOwner || isInstructor) && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleMarkResolved}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    thread.is_resolved
                      ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-800'
                      : 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800'
                  }`}
                >
                  {thread.is_resolved ? 'Reabrir Hilo' : 'Marcar como Resuelto'}
                </button>
                <button
                  onClick={handleDeleteThread}
                  className="px-4 py-2 rounded-lg text-sm font-medium transition-colors bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 flex items-center gap-1"
                  title="Eliminar hilo"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Eliminar
                </button>
              </div>
            )}
          </div>

          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {thread.title}
          </h1>

          <div className="prose dark:prose-invert max-w-none mb-4">
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {thread.content}
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 pt-4 border-t border-gray-200 dark:border-gray-700">
            <span className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-400 font-medium">
                {thread.user_name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <span className="font-medium text-gray-700 dark:text-gray-300">{thread.user_name}</span>
            </span>
            <span>{formatDate(thread.created_at)}</span>
          </div>
        </div>

        {/* Replies Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {replies.length} {replies.length === 1 ? 'Respuesta' : 'Respuestas'}
            </h2>

            {/* WebSocket connection status indicator */}
            <div className="flex items-center gap-2 text-sm">
              <div className={`w-2 h-2 rounded-full ${wsStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className={`${wsStatus === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {wsStatus === 'connected' ? 'En vivo' : 'Sin conexion'}
              </span>
            </div>
          </div>

          {replies.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-8 text-center">
              <div className="text-4xl mb-3">💬</div>
              <p className="text-gray-600 dark:text-gray-400">
                Aun no hay respuestas. Se el primero en responder.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {replies.map((reply) => (
                <div
                  key={reply.id}
                  className={`bg-white dark:bg-gray-800 rounded-xl shadow-md p-5 ${
                    reply.is_instructor_answer ? 'ring-2 ring-primary-500' : ''
                  }`}
                >
                  {reply.is_instructor_answer && (
                    <div className="flex items-center gap-2 mb-3 text-primary-600 dark:text-primary-400">
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-sm font-medium">Respuesta del Instructor</span>
                    </div>
                  )}

                  <div className="prose dark:prose-invert max-w-none mb-4">
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {reply.content}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <span className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xs font-medium">
                          {reply.user_name?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <span>{reply.user_name}</span>
                      </span>
                      <span>{formatDate(reply.created_at)}</span>
                    </div>

                    <button
                      onClick={() => handleVote(reply.id)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title="Marcar como util"
                      aria-label={`Marcar respuesta como util. Votos actuales: ${reply.votes || 0}`}
                    >
                      <svg className="w-5 h-5 text-gray-400 hover:text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                      </svg>
                      <span className={`font-medium ${reply.votes > 0 ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`} aria-hidden="true">
                        {reply.votes || 0}
                      </span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Reply Form */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Agregar Respuesta
          </h3>

          {/* Network Error Banner */}
          <NetworkErrorBanner
            networkError={networkError}
            onRetry={retry}
            onDismiss={clearError}
            isRetrying={submitting}
          />

          <form onSubmit={handleAddReply}>
            <div className="mb-4">
              <div className="flex justify-between items-center mb-2">
                <label htmlFor="reply-content" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tu respuesta
                </label>
                <span className={`text-xs ${getCharCountClasses(newReply.length, MAX_LENGTHS.FORUM_REPLY)}`}>
                  {getCharCountDisplay(newReply.length, MAX_LENGTHS.FORUM_REPLY)}
                </span>
              </div>
              <textarea
                id="reply-content"
                value={newReply}
                onChange={(e) => {
                  setNewReply(e.target.value);
                  // Clear error when user types enough characters
                  if (replyError && e.target.value.trim().length >= 5) {
                    setReplyError('');
                  }
                }}
                placeholder="Escribe tu respuesta aqui..."
                rows={5}
                maxLength={MAX_LENGTHS.FORUM_REPLY}
                className={`w-full px-4 py-3 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                  replyError || exceedsLimit(newReply.length, MAX_LENGTHS.FORUM_REPLY)
                    ? 'border-red-500 dark:border-red-500'
                    : 'border-gray-300 dark:border-gray-600'
                }`}
                disabled={submitting}
                aria-invalid={!!replyError}
                aria-describedby={replyError ? 'reply-error' : undefined}
              />
              {replyError && (
                <p id="reply-error" className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {replyError}
                </p>
              )}
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting || !newReply.trim()}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Publicando...' : 'Publicar Respuesta'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default ThreadDetailPage;
