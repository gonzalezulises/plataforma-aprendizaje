import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

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
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState('all'); // all, resolved, unresolved
  const [sort, setSort] = useState('newest');

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

  const handleCreateThread = async (e) => {
    e.preventDefault();

    if (!newThread.title.trim() || !newThread.content.trim()) {
      toast.error('Por favor completa el titulo y contenido');
      return;
    }

    setCreating(true);
    try {
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

      if (!res.ok) throw new Error('Failed to create thread');

      const data = await res.json();
      toast.success('Hilo creado exitosamente');
      setNewThread({ title: '', content: '' });
      setShowNewThread(false);

      // Navigate to the new thread
      navigate(`/forum/thread/${data.thread.id}`);
    } catch (error) {
      console.error('Error creating thread:', error);
      toast.error('Error al crear el hilo');
    } finally {
      setCreating(false);
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
        <nav className="mb-6">
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Nueva Pregunta
          </button>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="all">Todos los hilos</option>
            <option value="unresolved">Sin resolver</option>
            <option value="resolved">Resueltos</option>
          </select>

          <select
            value={sort}
            onChange={(e) => setSort(e.target.value)}
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
            <form onSubmit={handleCreateThread}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Titulo
                </label>
                <input
                  type="text"
                  value={newThread.title}
                  onChange={(e) => setNewThread({ ...newThread, title: e.target.value })}
                  placeholder="Escribe un titulo descriptivo para tu pregunta..."
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  disabled={creating}
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Contenido
                </label>
                <textarea
                  value={newThread.content}
                  onChange={(e) => setNewThread({ ...newThread, content: e.target.value })}
                  placeholder="Describe tu pregunta con detalle. Incluye codigo si es relevante..."
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 font-mono"
                  disabled={creating}
                />
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
                  onClick={() => setShowNewThread(false)}
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
    </div>
  );
}

export default ForumPage;
