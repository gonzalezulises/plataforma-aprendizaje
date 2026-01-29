import { useState, useEffect, useCallback } from 'react';
import { csrfFetch } from '../utils/csrf';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * YouTubeSearchModal - search YouTube and select a video
 * @param {boolean} isOpen
 * @param {function} onClose
 * @param {string} initialQuery - pre-filled search query (lesson title)
 * @param {function} onSelect - callback with selected video { id, title, url, thumbnail, duration, author }
 */
export default function YouTubeSearchModal({ isOpen, onClose, initialQuery = '', onSelect }) {
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Auto-search on open if there's an initial query
  useEffect(() => {
    if (isOpen && initialQuery && !hasSearched) {
      handleSearch(initialQuery);
    }
  }, [isOpen, initialQuery]);

  const handleSearch = useCallback(async (searchQuery) => {
    const q = searchQuery || query;
    if (!q.trim()) return;

    setLoading(true);
    setError('');
    setHasSearched(true);

    try {
      const response = await fetch(`${API_BASE}/youtube/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ query: q.trim(), maxResults: 8 })
      });

      if (!response.ok) {
        throw new Error('Error al buscar en YouTube');
      }

      const data = await response.json();
      setResults(data.videos || []);
    } catch (err) {
      console.error('YouTube search error:', err);
      setError(err.message || 'Error al buscar');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[60]">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl mx-4 max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
            Buscar en YouTube
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
              placeholder="Buscar videos en YouTube..."
              autoFocus
            />
            <button
              onClick={() => handleSearch()}
              disabled={loading || !query.trim()}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-400 text-white rounded-lg font-medium flex items-center gap-2"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              )}
              Buscar
            </button>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="text-center py-8">
              <p className="text-red-500">{error}</p>
            </div>
          )}

          {!loading && hasSearched && results.length === 0 && !error && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">No se encontraron resultados</p>
            </div>
          )}

          {!hasSearched && !loading && (
            <div className="text-center py-8">
              <p className="text-gray-500 dark:text-gray-400">Escribe un termino de busqueda para encontrar videos</p>
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            </div>
          )}

          {!loading && results.length > 0 && (
            <div className="grid gap-3">
              {results.map((video) => (
                <div
                  key={video.id}
                  className="flex gap-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors group"
                >
                  {/* Thumbnail */}
                  <div className="flex-shrink-0 w-40 relative">
                    <img
                      src={video.thumbnail}
                      alt={video.title}
                      className="w-full aspect-video object-cover rounded"
                      loading="lazy"
                    />
                    {video.duration && (
                      <span className="absolute bottom-1 right-1 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                        {video.duration}
                      </span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2 mb-1">
                      {video.title}
                    </h4>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      {video.author}
                      {video.views ? ` · ${typeof video.views === 'number' ? video.views.toLocaleString() : video.views} vistas` : ''}
                    </p>
                    <button
                      onClick={() => onSelect(video)}
                      className="px-3 py-1 text-xs font-medium bg-primary-600 hover:bg-primary-700 text-white rounded transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
                    >
                      Seleccionar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
