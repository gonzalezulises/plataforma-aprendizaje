import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../store/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * LessonComments - Feature #74
 * Displays and allows users to add comments on lessons
 * Supports voting, instructor answers, and nested replies
 */
function LessonComments({ lessonId }) {
  const { user, isAuthenticated } = useAuth();
  const [comments, setComments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch comments on mount
  const fetchComments = useCallback(async () => {
    if (!lessonId) return;

    try {
      setIsLoading(true);
      const response = await fetch(`${API_BASE_URL}/lesson-comments/${lessonId}`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setComments(data.comments || []);
        setError(null);
      } else {
        throw new Error('Failed to fetch comments');
      }
    } catch (err) {
      console.error('Error fetching comments:', err);
      setError('No se pudieron cargar los comentarios');
    } finally {
      setIsLoading(false);
    }
  }, [lessonId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Submit a new comment
  const handleSubmitComment = async (e) => {
    e.preventDefault();

    if (!newComment.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/lesson-comments/${lessonId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ content: newComment.trim() })
      });

      if (response.ok) {
        const data = await response.json();
        setComments(prev => [data.comment, ...prev]);
        setNewComment('');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit comment');
      }
    } catch (err) {
      console.error('Error submitting comment:', err);
      setError('No se pudo publicar el comentario');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Vote on a comment
  const handleVote = async (commentId) => {
    if (!isAuthenticated) return;

    try {
      const response = await fetch(`${API_BASE_URL}/lesson-comments/${lessonId}/${commentId}/vote`, {
        method: 'POST',
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setComments(prev =>
          prev.map(c =>
            c.id === commentId
              ? { ...c, votes: data.votes, userVoted: data.voted }
              : c
          )
        );
      }
    } catch (err) {
      console.error('Error voting on comment:', err);
    }
  };

  // Delete a comment
  const handleDelete = async (commentId) => {
    if (!window.confirm('¿Estás seguro de que deseas eliminar este comentario?')) return;

    try {
      const response = await fetch(`${API_BASE_URL}/lesson-comments/${lessonId}/${commentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (response.ok) {
        setComments(prev => prev.filter(c => c.id !== commentId));
      }
    } catch (err) {
      console.error('Error deleting comment:', err);
    }
  };

  // Format date for display
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays < 7) return `Hace ${diffDays} días`;

    return date.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });
  };

  return (
    <div className="mt-12 border-t border-gray-200 dark:border-gray-700 pt-8">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
        </svg>
        Comentarios y Preguntas
        {comments.length > 0 && (
          <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
            ({comments.length})
          </span>
        )}
      </h2>

      {/* New comment form */}
      {isAuthenticated ? (
        <form onSubmit={handleSubmitComment} className="mb-8">
          <div className="flex gap-4">
            {/* Avatar */}
            <div className="flex-shrink-0">
              {user?.avatar_url ? (
                <img
                  src={user.avatar_url}
                  alt={user.name}
                  className="w-10 h-10 rounded-full"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-300 font-medium">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
            </div>

            {/* Comment input */}
            <div className="flex-1">
              <textarea
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Escribe un comentario o pregunta..."
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 resize-none"
                rows={3}
              />
              <div className="mt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={!newComment.trim() || isSubmitting}
                  className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:bg-primary-400 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Publicando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                      </svg>
                      Publicar
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </form>
      ) : (
        <div className="mb-8 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg text-center">
          <p className="text-gray-600 dark:text-gray-400">
            <a href="/login" className="text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium">
              Inicia sesión
            </a>
            {' '}para comentar
          </p>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <svg className="w-8 h-8 animate-spin text-primary-600" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      )}

      {/* Error state */}
      {error && !isLoading && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg mb-4">
          {error}
        </div>
      )}

      {/* Comments list */}
      {!isLoading && comments.length === 0 && (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p>Sé el primero en comentar</p>
        </div>
      )}

      {!isLoading && comments.length > 0 && (
        <div className="space-y-6">
          {comments.map((comment) => (
            <div
              key={comment.id}
              className={`flex gap-4 p-4 rounded-lg ${
                comment.is_instructor_answer
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-gray-50 dark:bg-gray-800'
              }`}
            >
              {/* Avatar */}
              <div className="flex-shrink-0">
                {comment.author_avatar ? (
                  <img
                    src={comment.author_avatar}
                    alt={comment.author_name}
                    className="w-10 h-10 rounded-full"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-300 font-medium">
                    {comment.author_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                )}
              </div>

              {/* Comment content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {comment.author_name || 'Usuario'}
                  </span>
                  {comment.is_instructor_answer === 1 && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 rounded-full">
                      Respuesta del instructor
                    </span>
                  )}
                  {comment.author_role === 'instructor_admin' && (
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300 rounded-full">
                      Instructor
                    </span>
                  )}
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {formatDate(comment.created_at)}
                  </span>
                </div>

                <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">
                  {comment.content}
                </p>

                {/* Actions */}
                <div className="mt-3 flex items-center gap-4">
                  {/* Vote button */}
                  <button
                    onClick={() => handleVote(comment.id)}
                    disabled={!isAuthenticated}
                    className={`flex items-center gap-1 text-sm transition-colors ${
                      comment.userVoted
                        ? 'text-primary-600 dark:text-primary-400'
                        : 'text-gray-500 dark:text-gray-400 hover:text-primary-600 dark:hover:text-primary-400'
                    } ${!isAuthenticated ? 'cursor-not-allowed opacity-50' : ''}`}
                    title={isAuthenticated ? (comment.userVoted ? 'Quitar voto' : 'Votar útil') : 'Inicia sesión para votar'}
                  >
                    <svg className="w-4 h-4" fill={comment.userVoted ? 'currentColor' : 'none'} viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
                    </svg>
                    <span>{comment.votes || 0}</span>
                  </button>

                  {/* Delete button (only for comment owner or admin) */}
                  {isAuthenticated && (user?.id === comment.user_id || user?.role === 'instructor_admin') && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Eliminar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default LessonComments;
