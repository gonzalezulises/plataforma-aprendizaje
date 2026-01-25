import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useNetworkAwareSubmit } from '../hooks/useNetworkAwareSubmit';
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning';
import { NetworkErrorBanner } from '../components/NetworkErrorBanner';
import { FileUpload } from '../components/FileUpload';
import UnsavedChangesModal from '../components/UnsavedChangesModal';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export default function ProjectSubmissionPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [content, setContent] = useState('');
  const [githubUrl, setGithubUrl] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [formRestored, setFormRestored] = useState(false);

  // Network-aware form submission
  const {
    isSubmitting,
    networkError,
    hasPendingRetry,
    submit,
    retry,
    clearError,
  } = useNetworkAwareSubmit();

  // localStorage keys for form persistence
  const formDataKey = `project_submission_${projectId}_form`;

  // Restore form data from localStorage on mount
  useEffect(() => {
    const savedData = localStorage.getItem(formDataKey);
    if (savedData) {
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.content) setContent(parsed.content);
        if (parsed.githubUrl) setGithubUrl(parsed.githubUrl);
        setFormRestored(true);
        // Show a brief notification that data was restored
        console.log('Form data restored from previous session');
      } catch (e) {
        console.error('Error restoring form data:', e);
      }
    }
  }, [formDataKey]);

  // Save form data to localStorage whenever it changes
  useEffect(() => {
    // Only save if there's content to save
    if (content || githubUrl) {
      const dataToSave = {
        content,
        githubUrl,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(formDataKey, JSON.stringify(dataToSave));
    }
  }, [content, githubUrl, formDataKey]);

  // Clear saved form data after successful submission
  const clearSavedFormData = () => {
    localStorage.removeItem(formDataKey);
  };

  // Detect if form has unsaved content
  const hasUnsavedContent = content.trim() !== '' || githubUrl.trim() !== '' || uploadedFiles.length > 0;

  // Unsaved changes warning hook
  const {
    showModal: showUnsavedModal,
    confirmNavigation,
    cancelNavigation,
    message: unsavedMessage,
  } = useUnsavedChangesWarning(
    hasUnsavedContent,
    'Tienes cambios sin guardar en tu entrega. Si sales ahora, perderas el contenido.'
  );

  useEffect(() => {
    fetchProject();
  }, [projectId]);

  const fetchProject = async () => {
    try {
      const response = await fetch(`${API_URL}/projects/${projectId}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setProject(data.project);
      } else {
        setError('Project not found');
      }
    } catch (err) {
      console.error('Error fetching project:', err);
      setError('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const performSubmit = async () => {
      const response = await fetch(`${API_URL}/projects/${projectId}/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          content,
          github_url: githubUrl || null,
          uploaded_files: uploadedFiles.map(f => f.id),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit project');
      }

      return response.json();
    };

    await submit(performSubmit, {
      preserveData: { content, githubUrl },
      onSuccess: (data) => {
        // Clear saved form data after successful submission
        clearSavedFormData();
        toast.success('Proyecto enviado exitosamente!');
        navigate(`/project/submission/${data.submission.id}`);
      },
      onError: (err) => {
        console.error('Error submitting project:', err);
        toast.error(err.message || 'Error al enviar el proyecto');
      },
      onNetworkError: (err) => {
        console.error('Network error submitting project:', err);
        // Form data is preserved, network error banner will show
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-400">Loading project...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">{error}</h1>
          <Link to="/dashboard" className="text-primary-600 hover:text-primary-700">
            Return to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link
            to="/dashboard"
            className="text-primary-600 hover:text-primary-700 text-sm mb-4 inline-flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Submit Project
          </h1>
          {project && (
            <p className="mt-2 text-gray-600 dark:text-gray-400">
              {project.title}
            </p>
          )}
        </div>

        {/* Project Details */}
        {project && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Project Details
            </h2>
            {project.description && (
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                {project.description}
              </p>
            )}
            {project.requirements && (
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Requirements
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm whitespace-pre-wrap">
                  {project.requirements}
                </p>
              </div>
            )}
            {project.due_date && (
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Due: {new Date(project.due_date).toLocaleDateString()}
              </div>
            )}
          </div>
        )}

        {/* Submission Form */}
        <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Tu Entrega
          </h2>

          {/* Form Data Restored Notification */}
          {formRestored && (
            <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg flex items-center gap-2">
              <svg className="w-5 h-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-blue-700 dark:text-blue-300">
                Tu progreso anterior ha sido restaurado automáticamente.
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
            isRetrying={isSubmitting}
          />

          <div className="mb-6">
            <label
              htmlFor="content"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              Project Content <span className="text-red-500">*</span>
            </label>
            <textarea
              id="content"
              name="content"
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Describe your project submission, include code snippets, explanations, and any relevant details..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>

          <div className="mb-6">
            <label
              htmlFor="github_url"
              className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
            >
              GitHub Repository URL (optional)
            </label>
            <input
              type="url"
              id="github_url"
              name="github_url"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              placeholder="https://github.com/username/repository"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* File Upload Section */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Archivos Adjuntos (opcional)
            </label>
            <FileUpload
              uploadUrl={`${API_URL}/uploads/single`}
              accept=".pdf,.doc,.docx,.txt,.py,.js,.ts,.zip,.png,.jpg,.jpeg"
              maxSize={10 * 1024 * 1024}
              multiple={false}
              onUploadSuccess={(response) => {
                setUploadedFiles(prev => [...prev, response.upload]);
              }}
              onUploadError={(error, errorInfo) => {
                console.error('Upload error:', error);
              }}
              disabled={isSubmitting}
            />

            {/* Show uploaded files */}
            {uploadedFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Archivos subidos:
                </p>
                {uploadedFiles.map((file, index) => (
                  <div
                    key={file.id || index}
                    className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                  >
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        {file.original_name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setUploadedFiles(prev => prev.filter((_, i) => i !== index))}
                      className="text-red-500 hover:text-red-700"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-4">
            <Link
              to="/dashboard"
              className="px-6 py-3 text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || !content.trim()}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Project'}
            </button>
          </div>
        </form>

        {/* Unsaved Changes Warning Modal */}
        <UnsavedChangesModal
          isOpen={showUnsavedModal}
          onConfirm={confirmNavigation}
          onCancel={cancelNavigation}
          message={unsavedMessage}
        />
      </div>
    </div>
  );
}
