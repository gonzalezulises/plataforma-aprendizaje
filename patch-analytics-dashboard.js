const fs = require('fs');

const filePath = 'C:/Users/gonza/claude-projects/frontend/src/pages/AnalyticsDashboardPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add new state variables after existing state declarations
const oldStateDeclarations = `const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {`;

const newStateDeclarations = `const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportCourseId, setExportCourseId] = useState('all');
  const [exportFormat, setExportFormat] = useState('json');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {`;

content = content.replace(oldStateDeclarations, newStateDeclarations);

// 2. Add the export function after formatDate function
const oldFormatDate = `const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  if (loading) {`;

const newFormatDate = `const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString();
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      const url = exportCourseId === 'all'
        ? \`/api/analytics/export-all?format=\${exportFormat}\`
        : \`/api/analytics/export/\${exportCourseId}?format=\${exportFormat}\`;

      const response = await fetch(url, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Export failed');
      }

      // Get the filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = \`export-\${new Date().toISOString().split('T')[0]}.\${exportFormat}\`;
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

  if (loading) {`;

content = content.replace(oldFormatDate, newFormatDate);

// 3. Add export button next to refresh button
const oldRefreshButton = `<button
              onClick={fetchAnalytics}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar
            </button>`;

const newButtons = `<div className="flex items-center gap-2">
              <button
                onClick={() => setShowExportModal(true)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center gap-2"
                aria-label="Exportar datos del curso"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Exportar
              </button>
              <button
                onClick={fetchAnalytics}
                className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Actualizar
              </button>
            </div>`;

content = content.replace(oldRefreshButton, newButtons);

// 4. Add the export modal at the end of the return, before the final closing div
const oldClosingDiv = `      </div>
    </div>
  );
}

export default AnalyticsDashboardPage;`;

const newClosingWithModal = `      </div>

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
                      {course.courseTitle || \`Curso #\${course.courseId}\`}
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
    </div>
  );
}

export default AnalyticsDashboardPage;`;

content = content.replace(oldClosingDiv, newClosingWithModal);

fs.writeFileSync(filePath, content);
console.log('Successfully patched AnalyticsDashboardPage.jsx');
