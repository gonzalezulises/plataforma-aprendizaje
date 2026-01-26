import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import AdminLayout from '../components/AdminLayout';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

function SubmissionsReviewPage() {
  const navigate = useNavigate();
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('submitted'); // 'all', 'submitted', 'reviewed'

  useEffect(() => {
    fetchSubmissions();
  }, [filter]);

  const fetchSubmissions = async () => {
    try {
      setLoading(true);
      const url = filter === 'all'
        ? `${API_BASE}/projects/all/submissions`
        : `${API_BASE}/projects/all/submissions?status=${filter}`;

      const res = await fetch(url, {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Failed to fetch submissions');
      }

      const data = await res.json();
      setSubmissions(data.submissions || []);
    } catch (error) {
      console.error('Error fetching submissions:', error);
      toast.error('Error al cargar las entregas');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'submitted':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
            Pendiente
          </span>
        );
      case 'reviewed':
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300">
            Revisado
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            {status}
          </span>
        );
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <AdminLayout>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
            Entregas para Revisar
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-sm">
            Revisa y proporciona retroalimentacion a las entregas de los estudiantes
          </p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Filters */}
          <div className="mb-6 flex gap-4">
            <button
              onClick={() => setFilter('submitted')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'submitted'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Pendientes
            </button>
            <button
              onClick={() => setFilter('reviewed')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'reviewed'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Revisados
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                filter === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              Todos
            </button>
          </div>

          {/* Submissions List */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            </div>
          ) : submissions.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">
                {filter === 'submitted' ? '\uD83D\uDCED' : '\u2705'}
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                {filter === 'submitted' ? 'No hay entregas pendientes' : 'No hay entregas'}
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {filter === 'submitted'
                  ? 'Todas las entregas han sido revisadas'
                  : 'No hay entregas que coincidan con el filtro seleccionado'}
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Proyecto
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Estudiante
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Fecha de Entrega
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Estado
                    </th>
                    <th className="px-6 py-4 text-right text-sm font-semibold text-gray-900 dark:text-white">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {submissions.map((submission) => (
                    <tr
                      key={submission.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
                    >
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 dark:text-white">
                          {submission.project_title || `Proyecto #${submission.project_id}`}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          ID: {submission.id}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-gray-700 dark:text-gray-300">
                          {submission.user_id}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-gray-600 dark:text-gray-400">
                        {formatDate(submission.submitted_at)}
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(submission.status)}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => navigate(`/admin/review/${submission.id}`)}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            submission.status === 'submitted'
                              ? 'bg-primary-600 text-white hover:bg-primary-700'
                              : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                          }`}
                        >
                          {submission.status === 'submitted' ? 'Evaluar' : 'Ver'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

export default SubmissionsReviewPage;
