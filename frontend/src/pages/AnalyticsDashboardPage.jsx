import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import AdminLayout from '../components/AdminLayout';

// Use env variable for API URL, matching AuthContext pattern
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * AnalyticsDashboardPage - Instructor dashboard showing student activity analytics
 * Shows real data from the database including:
 * - Total students, courses, enrollments
 * - Completed lessons count
 * - Total time spent by students
 * - Recent lesson completions
 * - Course completion stats
 */
function AnalyticsDashboardPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCourseId, setExportCourseId] = useState('all');
  const [exportFormat, setExportFormat] = useState('json');
  const [exporting, setExporting] = useState(false);

  // Import state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPreview, setImportPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [duplicateAction, setDuplicateAction] = useState('skip');
  const [importResult, setImportResult] = useState(null);

  useEffect(() => {
    // Wait for auth to finish loading before making decisions
    if (authLoading) {
      return;
    }

    // Redirect if not authenticated or not an instructor
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    if (user?.role !== 'instructor') {
      navigate('/dashboard');
      return;
    }

    fetchAnalytics();
  }, [isAuthenticated, user, navigate, authLoading]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/analytics/dashboard`, {
        credentials: 'include'
      });

      if (!response.ok) {
        if (response.status === 403) {
          setError('You do not have permission to view analytics. Instructor access required.');
          return;
        }
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      console.error('Error fetching analytics:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds) return '0m';
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const url = exportCourseId === 'all'
        ? `${API_BASE_URL}/analytics/export-all?format=${exportFormat}`
        : `${API_BASE_URL}/analytics/export/${exportCourseId}?format=${exportFormat}`;

      const response = await fetch(url, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `export-${new Date().toISOString().split('T')[0]}.${exportFormat}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }

      // Create blob and download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(downloadUrl);

      setShowExportModal(false);
    } catch (err) {
      console.error('Export error:', err);
      alert('Error al exportar datos: ' + err.message);
    } finally {
      setExporting(false);
    }
  };

  // Handle file selection for import
  const handleFileSelect = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setImportFile(file);
    setImportResult(null);

    try {
      const text = await file.text();

      // Try to parse JSON - provide user-friendly error messages for malformed files
      let data;
      try {
        data = JSON.parse(text);
      } catch (parseError) {
        // Provide specific error messages based on JSON parse error type
        let userMessage = 'El archivo no contiene JSON valido.';

        if (parseError.message.includes('Unexpected token')) {
          const match = parseError.message.match(/position (\d+)/);
          const position = match ? match[1] : 'desconocida';
          userMessage = `El archivo contiene caracteres invalidos. Posicion: ${position}. Asegurate de que el archivo sea JSON valido exportado desde esta plataforma.`;
        } else if (parseError.message.includes("Expected ','") || parseError.message.includes("Expected '}'") || parseError.message.includes("Expected ']'")) {
          const lineMatch = parseError.message.match(/line (\d+)/);
          const line = lineMatch ? lineMatch[1] : 'desconocida';
          userMessage = `Error de sintaxis JSON en la linea ${line}. El archivo parece estar incompleto o mal formateado.`;
        } else if (parseError.message.includes('Unexpected end')) {
          userMessage = 'El archivo JSON esta incompleto o truncado. Asegurate de usar un archivo completo exportado desde esta plataforma.';
        }

        throw new Error(userMessage);
      }

      // Preview the import to detect duplicates
      const response = await fetch(`${API_BASE_URL}/analytics/import/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ data })
      });

      if (!response.ok) {
        // Handle specific HTTP error codes with user-friendly messages
        if (response.status === 401) {
          throw new Error('Tu sesion ha expirado. Por favor, recarga la pagina e inicia sesion nuevamente.');
        } else if (response.status === 403) {
          throw new Error('No tienes permisos para importar datos. Se requiere acceso de instructor.');
        } else if (response.status === 400) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'El formato del archivo no es compatible. Usa archivos exportados desde esta plataforma.');
        } else {
          throw new Error('Error del servidor al procesar el archivo. Por favor, intentalo de nuevo.');
        }
      }

      const preview = await response.json();
      setImportPreview(preview);
    } catch (err) {
      console.error('Error previewing import:', err);
      setImportPreview({ error: err.message });
    }
  };

  // Handle the actual import
  const handleImport = async () => {
    if (!importFile || !importPreview || importPreview.error) return;

    try {
      setImporting(true);
      const text = await importFile.text();
      const data = JSON.parse(text);

      const response = await fetch(`${API_BASE_URL}/analytics/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ data, duplicateAction })
      });

      if (!response.ok) {
        throw new Error('Import failed');
      }

      const result = await response.json();
      setImportResult(result);

      // Refresh analytics data after successful import
      if (result.success) {
        fetchAnalytics();
      }
    } catch (err) {
      console.error('Import error:', err);
      setImportResult({ error: err.message });
    } finally {
      setImporting(false);
    }
  };

  // Reset import modal state
  const resetImportModal = () => {
    setShowImportModal(false);
    setImportFile(null);
    setImportPreview(null);
    setImportResult(null);
    setDuplicateAction('skip');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Cargando analytics...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center max-w-md">
          <div className="bg-red-100 dark:bg-red-900 rounded-full p-3 w-16 h-16 mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Error</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Volver al Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Analytics Dashboard
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Vista general de la actividad de los estudiantes
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowImportModal(true)}
              className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 flex items-center gap-2"
              aria-label="Importar datos de cursos"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m4-8l-4-4m0 0l-4 4m4-4v12" />
              </svg>
              Importar
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="px-3 py-1.5 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 flex items-center gap-2"
              aria-label="Exportar datos del curso"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Exportar
            </button>
            <button
              onClick={fetchAnalytics}
              className="px-3 py-1.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="p-6">
        {/* Overview cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Estudiantes</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {analytics?.overview?.totalStudents || 0}
                </p>
              </div>
              <div className="bg-blue-100 dark:bg-blue-900 rounded-full p-3">
                <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Total Cursos</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {analytics?.overview?.totalCourses || 0}
                </p>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900 rounded-full p-3">
                <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Inscripciones</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {analytics?.overview?.totalEnrollments || 0}
                </p>
              </div>
              <div className="bg-green-100 dark:bg-green-900 rounded-full p-3">
                <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Lecciones Completadas</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {analytics?.overview?.completedLessons || 0}
                </p>
              </div>
              <div className="bg-yellow-100 dark:bg-yellow-900 rounded-full p-3">
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Tiempo Total</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white">
                  {analytics?.overview?.totalTimeSpentHours || 0}h
                </p>
              </div>
              <div className="bg-red-100 dark:bg-red-900 rounded-full p-3">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Recent completions and Course stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Completions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Lecciones Completadas Recientemente
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
              {analytics?.recentCompletions?.length > 0 ? (
                analytics.recentCompletions.map((completion, index) => (
                  <div key={index} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-750">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Leccion #{completion.lessonId}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {completion.studentName} ({completion.studentEmail})
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {formatTime(completion.timeSpentSeconds)}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">
                          {formatDate(completion.completedAt)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <p>No hay lecciones completadas aun</p>
                  <p className="text-sm mt-1">Los estudiantes aun no han completado ninguna leccion</p>
                </div>
              )}
            </div>
          </div>

          {/* Course Stats */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Estadisticas por Curso
              </h2>
            </div>
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-96 overflow-y-auto">
              {analytics?.courseStats?.length > 0 ? (
                analytics.courseStats.map((course, index) => (
                  <div key={index} className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-medium text-gray-900 dark:text-white">
                        {course.courseTitle || `Curso #${course.courseId}`}
                      </p>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {course.completedCount}/{course.enrolledCount} completados
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all"
                        style={{ width: `${course.avgProgress}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Progreso promedio: {course.avgProgress}%
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                  <svg className="w-12 h-12 mx-auto mb-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                  </svg>
                  <p>No hay cursos con inscripciones</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Lesson Stats */}
        {analytics?.lessonStats?.length > 0 && (
          <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Lecciones Mas Populares
              </h2>
            </div>
            <div className="p-6">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead>
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Leccion ID
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Completadas
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Tiempo Promedio
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {analytics.lessonStats.map((lesson, index) => (
                      <tr key={index}>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          #{lesson.lessonId}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {lesson.completionCount} veces
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                          {formatTime(lesson.avgTimeSeconds)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Export Modal */}
      {showExportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Exportar Datos del Curso
              </h3>
              <button
                onClick={() => setShowExportModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Cerrar modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="export-course" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Seleccionar Curso
                </label>
                <select
                  id="export-course"
                  value={exportCourseId}
                  onChange={(e) => setExportCourseId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="all">Todos los cursos (resumen)</option>
                  {analytics?.courseStats?.map((course) => (
                    <option key={course.courseId} value={course.courseId}>
                      {course.courseTitle || `Curso #${course.courseId}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="export-format" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Formato de Exportacion
                </label>
                <select
                  id="export-format"
                  value={exportFormat}
                  onChange={(e) => setExportFormat(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="json">JSON</option>
                  <option value="csv">CSV</option>
                </select>
              </div>

              <p className="text-sm text-gray-500 dark:text-gray-400">
                {exportCourseId === 'all'
                  ? 'Se exportara un resumen de todos los cursos con estadisticas generales.'
                  : 'Se exportaran datos detallados incluyendo inscripciones, progreso de lecciones, intentos de quizzes y envios de codigo.'}
              </p>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowExportModal(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {exporting ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Exportando...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Descargar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Importar Datos de Cursos
              </h3>
              <button
                onClick={resetImportModal}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                aria-label="Cerrar modal"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Import Result */}
            {importResult && (
              <div className={`mb-4 p-4 rounded-lg ${importResult.error ? 'bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800' : 'bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800'}`}>
                {importResult.error ? (
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-red-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="font-medium text-red-800 dark:text-red-300">Error de importacion</p>
                      <p className="text-sm text-red-600 dark:text-red-400">{importResult.error}</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-start gap-2 mb-2">
                      <svg className="w-5 h-5 text-green-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="font-medium text-green-800 dark:text-green-300">Importacion completada</p>
                    </div>
                    <div className="text-sm text-green-700 dark:text-green-400 space-y-1 ml-7">
                      <p>Nuevos: {importResult.summary?.imported || 0}</p>
                      <p>Omitidos: {importResult.summary?.skipped || 0}</p>
                      <p>Sobrescritos: {importResult.summary?.overwritten || 0}</p>
                      {importResult.summary?.errors > 0 && (
                        <p className="text-red-600 dark:text-red-400">Errores: {importResult.summary.errors}</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {!importResult && (
              <div className="space-y-4">
                {/* File Input */}
                <div>
                  <label htmlFor="import-file" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Seleccionar archivo JSON
                  </label>
                  <input
                    type="file"
                    id="import-file"
                    accept=".json"
                    onChange={handleFileSelect}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:text-sm file:bg-green-50 dark:file:bg-green-900 file:text-green-700 dark:file:text-green-300"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Usa archivos exportados desde esta plataforma
                  </p>
                </div>

                {/* Preview */}
                {importPreview && !importPreview.error && (
                  <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 dark:text-white mb-3">Vista previa</h4>

                    {/* New Items */}
                    {importPreview.preview?.newItems?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
                          Nuevos ({importPreview.preview.newItems.length}):
                        </p>
                        <ul className="text-sm text-gray-600 dark:text-gray-400 list-disc list-inside max-h-24 overflow-y-auto">
                          {importPreview.preview.newItems.map((item, i) => (
                            <li key={i}>{item.title}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Duplicates Warning */}
                    {importPreview.preview?.duplicates?.length > 0 && (
                      <div className="mb-3 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                        <div className="flex items-start gap-2 mb-2">
                          <svg className="w-5 h-5 text-yellow-500 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                          <p className="font-medium text-yellow-800 dark:text-yellow-300">
                            Duplicados encontrados ({importPreview.preview.duplicates.length})
                          </p>
                        </div>
                        <ul className="text-sm text-yellow-700 dark:text-yellow-400 list-disc list-inside max-h-24 overflow-y-auto mb-3">
                          {importPreview.preview.duplicates.map((dup, i) => (
                            <li key={i}>
                              {dup.importItem.title} (slug: {dup.importItem.slug})
                            </li>
                          ))}
                        </ul>

                        {/* Duplicate Action Selection */}
                        <div className="mt-2">
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            ¿Como manejar duplicados?
                          </p>
                          <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="duplicateAction"
                                value="skip"
                                checked={duplicateAction === 'skip'}
                                onChange={(e) => setDuplicateAction(e.target.value)}
                                className="text-green-600 focus:ring-green-500"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Omitir</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="radio"
                                name="duplicateAction"
                                value="overwrite"
                                checked={duplicateAction === 'overwrite'}
                                onChange={(e) => setDuplicateAction(e.target.value)}
                                className="text-green-600 focus:ring-green-500"
                              />
                              <span className="text-sm text-gray-700 dark:text-gray-300">Sobrescribir</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Invalid Items */}
                    {importPreview.preview?.invalid?.length > 0 && (
                      <div className="text-sm text-red-600 dark:text-red-400">
                        <p className="font-medium mb-1">Elementos invalidos ({importPreview.preview.invalid.length}):</p>
                        <ul className="list-disc list-inside">
                          {importPreview.preview.invalid.map((inv, i) => (
                            <li key={i}>{inv.item}: {inv.reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Preview Error */}
                {importPreview?.error && (
                  <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-3">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Error al leer el archivo: {importPreview.error}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={resetImportModal}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600"
              >
                {importResult ? 'Cerrar' : 'Cancelar'}
              </button>
              {!importResult && (
                <button
                  onClick={handleImport}
                  disabled={importing || !importPreview || importPreview.error || (importPreview.preview?.newItems?.length === 0 && importPreview.preview?.duplicates?.length === 0)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {importing ? (
                    <>
                      <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Importando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m4-8l-4-4m0 0l-4 4m4-4v12" />
                      </svg>
                      Importar
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </AdminLayout>
  );
}

export default AnalyticsDashboardPage;
