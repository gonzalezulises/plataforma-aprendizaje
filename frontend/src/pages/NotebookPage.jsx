import React from 'react';
import { useParams, Link } from 'react-router-dom';
import InteractiveNotebook from '../components/InteractiveNotebook';

/**
 * NotebookPage - Page wrapper for interactive notebooks
 * Allows viewing and interacting with Jupyter-style notebooks
 */
function NotebookPage() {
  const { notebookId } = useParams();

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Breadcrumb */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto px-4 py-3">
          <nav className="flex items-center gap-2 text-sm">
            <Link
              to="/"
              className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
            >
              Inicio
            </Link>
            <span className="text-gray-400">/</span>
            <Link
              to="/courses"
              className="text-gray-500 hover:text-primary-600 dark:text-gray-400 dark:hover:text-primary-400"
            >
              Cursos
            </Link>
            <span className="text-gray-400">/</span>
            <span className="text-gray-700 dark:text-gray-300">Notebook Interactivo</span>
          </nav>
        </div>
      </div>

      {/* Notebook content */}
      <div className="max-w-5xl mx-auto px-4 py-8">
        <InteractiveNotebook notebookId={notebookId || 'demo'} />

        {/* Navigation */}
        <div className="mt-8 flex justify-between">
          <Link
            to="/courses"
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
          >
            Volver a cursos
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotebookPage;
