import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Page to view submission and its feedback (rubric scores and comments)
 * This page shows both the submission content and any instructor feedback
 */
export default function SubmissionFeedbackPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();
  const [submission, setSubmission] = useState(null);
  const [feedback, setFeedback] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSubmissionAndFeedback();
  }, [submissionId]);

  const fetchSubmissionAndFeedback = async () => {
    try {
      // Fetch submission
      const response = await fetch(`${API_URL}/api/projects/submissions/${submissionId}`, {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        setSubmission(data.submission);

        // Also fetch feedback
        try {
          const feedbackRes = await fetch(`${API_URL}/api/feedback/submissions/${submissionId}/feedback`, {
            credentials: 'include',
          });
          if (feedbackRes.ok) {
            const feedbackData = await feedbackRes.json();
            if (feedbackData.feedback && feedbackData.feedback.length > 0) {
              setFeedback(feedbackData.feedback[0]);
            }
          }
        } catch (e) {
          console.log('No feedback available yet');
        }
      } else {
        setError('Submission not found');
      }
    } catch (err) {
      console.error('Error fetching submission:', err);
      setError('Failed to load submission');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'submitted':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'reviewed':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getScoreColor = (score, maxScore) => {
    const percentage = (score / maxScore) * 100;
    if (percentage >= 80) return 'text-green-600 dark:text-green-400';
    if (percentage >= 60) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
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
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="text-primary-600 hover:text-primary-700 text-sm mb-4 inline-flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Volver
          </button>
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Detalles de la Entrega
            </h1>
            {submission && (
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(submission.status)}`}>
                {submission.status === 'reviewed' ? 'Evaluado' :
                 submission.status === 'submitted' ? 'Enviado' : 'Pendiente'}
              </span>
            )}
          </div>
        </div>

        {submission && (
          <div className="space-y-6">
            {/* Submission Info Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Entrega #{submission.id}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Proyecto ID: {submission.project_id}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Enviado:</span>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {new Date(submission.submitted_at).toLocaleString('es-ES')}
                  </p>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Ultima actualizacion:</span>
                  <p className="text-gray-900 dark:text-white font-medium">
                    {new Date(submission.updated_at).toLocaleString('es-ES')}
                  </p>
                </div>
              </div>
            </div>

            {/* Content Card */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Contenido de la Entrega
              </h3>
              <div
                className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 whitespace-pre-wrap text-gray-800 dark:text-gray-200 font-mono text-sm max-h-64 overflow-auto"
                data-testid="submission-content"
              >
                {submission.content}
              </div>
            </div>

            {/* GitHub URL Card */}
            {submission.github_url && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Repositorio GitHub
                </h3>
                <a
                  href={submission.github_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-primary-600 hover:text-primary-700"
                  data-testid="github-url"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                  </svg>
                  {submission.github_url}
                </a>
              </div>
            )}

            {/* Feedback Section */}
            {feedback ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
                  Retroalimentacion del Instructor
                </h2>

                {/* Total Score */}
                <div className="bg-gradient-to-r from-primary-500 to-primary-600 rounded-lg p-6 mb-6 text-white">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-medium opacity-90">Puntuacion Total</span>
                    <span className="text-4xl font-bold" data-testid="total-score">
                      {feedback.total_score} / {feedback.max_score}
                    </span>
                  </div>
                  <div className="mt-4 w-full bg-white/30 rounded-full h-3">
                    <div
                      className="bg-white h-3 rounded-full transition-all duration-300"
                      style={{ width: `${(feedback.total_score / feedback.max_score) * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Criteria Breakdown */}
                {feedback.content?.criteria && (
                  <div className="space-y-4 mb-6">
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      Desglose por Criterio
                    </h3>
                    {feedback.content.criteria.map((criterion) => (
                      <div
                        key={criterion.id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        data-testid={`criterion-${criterion.id}`}
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {criterion.name}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {criterion.description}
                          </p>
                        </div>
                        <span className={`text-xl font-bold ${getScoreColor(criterion.score || feedback.scores?.[criterion.id] || 0, criterion.maxScore)}`}>
                          {criterion.score || feedback.scores?.[criterion.id] || 0} / {criterion.maxScore}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Comment */}
                {feedback.comment && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                      Comentarios del Instructor
                    </h3>
                    <div
                      className="bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 p-4 rounded-r-lg"
                      data-testid="feedback-comment"
                    >
                      <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                        {feedback.comment}
                      </p>
                    </div>
                  </div>
                )}

                {/* Feedback Date */}
                <div className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                  Evaluado el {new Date(feedback.created_at).toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </div>
              </div>
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                    Pendiente de Evaluacion
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Tu entrega esta siendo revisada. Recibiras una notificacion cuando el instructor complete la evaluacion.
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-4">
              <Link
                to="/dashboard"
                className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Volver al Dashboard
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
