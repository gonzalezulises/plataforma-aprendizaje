import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import InteractiveNotebook from '../components/InteractiveNotebook';

const API_BASE = 'http://localhost:3001/api';

/**
 * NotebookPage - Page wrapper for interactive notebooks
 * Allows viewing and interacting with Jupyter-style notebooks
 */
function NotebookPage() {
  const { notebookId } = useParams();
  const [isCompleting, setIsCompleting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  // Mark the notebook/lesson as complete
  const handleMarkComplete = async () => {
    setIsCompleting(true);
    try {
      // Use the notebookId as the lesson ID for marking completion
      const lessonId = notebookId || 'demo';
      const response = await fetch(`${API_BASE}/lessons/${lessonId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (response.ok) {
        setIsCompleted(true);
        toast.success('Leccion completada exitosamente!');
      } else {
        const error = await response.json();
        toast.error(error.message || 'Error al marcar como completada');
      }
    } catch (error) {
      console.error('Error marking lesson complete:', error);
      toast.error('Error al conectar con el servidor');
    } finally {
      setIsCompleting(false);
    }
  };

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

        {/* Navigation and completion */}
        <div className="mt-8 flex justify-between items-center">
          <Link
            to="/courses"
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors"
          >
            Volver a cursos
          </Link>

          {/* Mark as Complete button */}
          <button
            onClick={handleMarkComplete}
            disabled={isCompleting || isCompleted}
            className={`px-6 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${
              isCompleted
                ? 'bg-success-100 text-success-700 dark:bg-success-900 dark:text-success-300 cursor-default'
                : 'bg-success-700 hover:bg-success-800 text-white disabled:bg-gray-400'
            }`}
          >
            {isCompleting ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Guardando...
              </>
            ) : isCompleted ? (
              <>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Completada
              </>
            ) : (
              <>
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Marcar como Completada
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default NotebookPage;
