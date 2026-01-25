import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

// Default rubric criteria
const DEFAULT_CRITERIA = [
  {
    id: 'code_quality',
    name: 'Calidad del Codigo',
    description: 'Claridad, organizacion y buenas practicas de programacion',
    maxScore: 25
  },
  {
    id: 'functionality',
    name: 'Funcionalidad',
    description: 'El codigo funciona correctamente y cumple los requisitos',
    maxScore: 25
  },
  {
    id: 'documentation',
    name: 'Documentacion',
    description: 'Comentarios claros y documentacion apropiada',
    maxScore: 25
  },
  {
    id: 'creativity',
    name: 'Creatividad',
    description: 'Soluciones originales y mejoras adicionales',
    maxScore: 25
  }
];

function InstructorFeedbackPage() {
  const { submissionId } = useParams();
  const navigate = useNavigate();

  const [submission, setSubmission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scores, setScores] = useState({});
  const [comment, setComment] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [criteria] = useState(DEFAULT_CRITERIA);

  // Calculate total score
  const totalScore = Object.values(scores).reduce((sum, score) => sum + (score || 0), 0);
  const maxScore = criteria.reduce((sum, c) => sum + c.maxScore, 0);

  useEffect(() => {
    fetchSubmission();
  }, [submissionId]);

  const fetchSubmission = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/projects/submissions/${submissionId}`, {
        credentials: 'include'
      });

      if (!res.ok) {
        throw new Error('Submission not found');
      }

      const data = await res.json();
      setSubmission(data.submission);

      // Check if feedback already exists
      try {
        const feedbackRes = await fetch(`${API_BASE}/feedback/submissions/${submissionId}/feedback`, {
          credentials: 'include'
        });
        if (feedbackRes.ok) {
          const feedbackData = await feedbackRes.json();
          if (feedbackData.feedback && feedbackData.feedback.length > 0) {
            const existingFeedback = feedbackData.feedback[0];
            setScores(existingFeedback.scores || {});
            setComment(existingFeedback.comment || '');
            setVideoUrl(existingFeedback.video_url || '');
          }
        }
      } catch (e) {
        console.log('No existing feedback');
      }
    } catch (error) {
      console.error('Error fetching submission:', error);
      toast.error('Error al cargar la entrega');
    } finally {
      setLoading(false);
    }
  };

  const handleScoreChange = (criterionId, value) => {
    const criterion = criteria.find(c => c.id === criterionId);
    const numValue = Math.min(Math.max(0, parseInt(value) || 0), criterion.maxScore);
    setScores(prev => ({ ...prev, [criterionId]: numValue }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch(`${API_BASE}/feedback/submissions/${submissionId}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          type: 'rubric',
          scores,
          total_score: totalScore,
          max_score: maxScore,
          comment,
          video_url: videoUrl || null,
          content: { criteria: criteria.map(c => ({ ...c, score: scores[c.id] || 0 })) }
        })
      });

      if (!res.ok) {
        throw new Error('Failed to save feedback');
      }

      toast.success('Retroalimentacion guardada exitosamente');
      navigate(-1);
    } catch (error) {
      console.error('Error saving feedback:', error);
      toast.error('Error al guardar la retroalimentacion');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!submission) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Entrega no encontrada
          </h2>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Volver
          </button>
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
            className="text-primary-600 dark:text-primary-400 hover:underline mb-4 flex items-center gap-2"
          >
            <span>&larr;</span> Volver
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Evaluar Entrega
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Submission ID: {submissionId}
          </p>
        </div>

        {/* Submission Content Preview */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Contenido de la Entrega
          </h2>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 font-mono text-sm overflow-auto max-h-64">
            <pre className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
              {submission.content}
            </pre>
          </div>
          {submission.github_url && (
            <div className="mt-4">
              <a
                href={submission.github_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 dark:text-primary-400 hover:underline"
              >
                Ver en GitHub &rarr;
              </a>
            </div>
          )}
        </div>

        {/* Rubric Form */}
        <form onSubmit={handleSubmit}>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Rubrica de Evaluacion
            </h2>

            <div className="space-y-6">
              {criteria.map((criterion) => (
                <div
                  key={criterion.id}
                  className="border-b border-gray-200 dark:border-gray-700 pb-6 last:border-0 last:pb-0"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-white">
                        {criterion.name}
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {criterion.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        max={criterion.maxScore}
                        value={scores[criterion.id] || ''}
                        onChange={(e) => handleScoreChange(criterion.id, e.target.value)}
                        className="w-20 px-3 py-2 text-center border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        placeholder="0"
                      />
                      <span className="text-gray-500 dark:text-gray-400">
                        / {criterion.maxScore}
                      </span>
                    </div>
                  </div>

                  {/* Score slider */}
                  <input
                    type="range"
                    min="0"
                    max={criterion.maxScore}
                    value={scores[criterion.id] || 0}
                    onChange={(e) => handleScoreChange(criterion.id, e.target.value)}
                    className="w-full h-2 bg-gray-200 dark:bg-gray-600 rounded-lg appearance-none cursor-pointer"
                  />
                </div>
              ))}
            </div>

            {/* Total Score */}
            <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  Puntuacion Total
                </span>
                <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {totalScore} / {maxScore}
                </span>
              </div>
              <div className="mt-2 w-full bg-gray-200 dark:bg-gray-600 rounded-full h-3">
                <div
                  className="bg-primary-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${(totalScore / maxScore) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>

          {/* Comment Section */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              Comentarios Adicionales
            </h2>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Agrega comentarios o sugerencias para el estudiante..."
              rows={5}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          {/* Video Feedback Section (Optional) */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
              <span className="text-2xl">{'\uD83C\uDFA5'}</span>
              Video Feedback (Opcional)
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Puedes grabar un video de retroalimentacion y pegar el enlace aqui (YouTube, Loom, etc.)
            </p>
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=... o https://www.loom.com/share/..."
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {videoUrl && (
              <div className="mt-4">
                <a
                  href={videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-2"
                >
                  <span>{'\u25B6\uFE0F'}</span> Ver video de retroalimentacion
                </a>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end gap-4">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? (
                <>
                  <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                  Guardando...
                </>
              ) : (
                'Guardar Retroalimentacion'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default InstructorFeedbackPage;
