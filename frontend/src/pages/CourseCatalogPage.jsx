/**
 * Course Catalog Page (Feature #174: Pagination resets on context change)
 * Feature #184: Filter persistence across sessions
 * Feature #228: Late API response handled - prevents stale responses from overriding newer data
 * Displays courses with filtering and pagination
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import Pagination from '../components/Pagination';

// API URL - use environment variable or default to port 3001
const CATALOG_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// LocalStorage key for filter persistence (Feature #184)
const FILTER_STORAGE_KEY = 'courseCatalogFilters';

// Feature #184: Helper to get saved filters from localStorage
const getSavedFilters = () => {
  try {
    const saved = localStorage.getItem(FILTER_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Validate saved data structure
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          category: parsed.category || '',
          level: parsed.level || '',
          price: parsed.price || '',
        };
      }
    }
  } catch (err) {
    console.warn('[CourseCatalog] Error reading saved filters:', err);
  }
  return null;
};

// Feature #184: Helper to save filters to localStorage
const saveFilters = (filters) => {
  try {
    localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
  } catch (err) {
    console.warn('[CourseCatalog] Error saving filters:', err);
  }
};

export default function CourseCatalogPage() {
  // Use URL search params for filter persistence (Feature #142)
  const [searchParams, setSearchParams] = useSearchParams();

  // Feature #184: Initialize filters from URL params first, then localStorage
  // URL params take priority (for shareable links), otherwise use saved filters
  const [categoryFilter, setCategoryFilter] = useState(() => {
    const urlValue = searchParams.get('category');
    if (urlValue) return urlValue;
    const savedFilters = getSavedFilters();
    return savedFilters?.category || '';
  });
  const [levelFilter, setLevelFilter] = useState(() => {
    const urlValue = searchParams.get('level');
    if (urlValue) return urlValue;
    const savedFilters = getSavedFilters();
    return savedFilters?.level || '';
  });
  const [priceFilter, setPriceFilter] = useState(() => {
    const urlValue = searchParams.get('price');
    if (urlValue) return urlValue;
    const savedFilters = getSavedFilters();
    return savedFilters?.price || '';
  });
  // Note: Search query is NOT persisted across sessions (intentional - search is contextual)
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [availableLevels, setAvailableLevels] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);

  // Pagination state (Feature #174: Pagination resets on context change)
  const [currentPage, setCurrentPage] = useState(() => parseInt(searchParams.get('page')) || 1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1, hasNext: false, hasPrev: false });
  const ITEMS_PER_PAGE = 6;

  // Feature #184: Save filters to localStorage whenever they change
  useEffect(() => {
    const currentFilters = {
      category: categoryFilter,
      level: levelFilter,
      price: priceFilter,
    };
    // Only save non-empty filters
    const hasFilters = categoryFilter || levelFilter || priceFilter;
    if (hasFilters) {
      saveFilters(currentFilters);
    } else {
      // Clear saved filters if all are reset
      try {
        localStorage.removeItem(FILTER_STORAGE_KEY);
      } catch (err) {
        // Ignore localStorage errors
      }
    }
  }, [categoryFilter, levelFilter, priceFilter]);

  // Feature #184: Sync URL with restored filters on initial load (when no URL params present)
  useEffect(() => {
    // Only run once on mount - check if we need to update URL with restored filters
    const hasUrlFilters = searchParams.get('category') || searchParams.get('level') || searchParams.get('price');
    if (!hasUrlFilters && (categoryFilter || levelFilter || priceFilter)) {
      // Filters were restored from localStorage but not in URL - update URL to match
      const updates = {};
      if (categoryFilter) updates.category = categoryFilter;
      if (levelFilter) updates.level = levelFilter;
      if (priceFilter) updates.price = priceFilter;
      setSearchParams(prevParams => {
        const newParams = new URLSearchParams(prevParams);
        Object.entries(updates).forEach(([key, value]) => {
          if (value) newParams.set(key, value);
        });
        return newParams;
      }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run on mount

  // Update URL when filters change (Feature #142)
  const updateURLParams = useCallback((updates) => {
    setSearchParams(prevParams => {
      const newParams = new URLSearchParams(prevParams);
      Object.entries(updates).forEach(([key, value]) => {
        if (value) {
          newParams.set(key, value);
        } else {
          newParams.delete(key);
        }
      });
      return newParams;
    }, { replace: true });
  }, [setSearchParams]);

  // Feature #174: Reset pagination to page 1 when filters change
  const resetPaginationOnFilterChange = useCallback(() => {
    setCurrentPage(1);
  }, []);

  // Wrapper functions to update both state and URL (Feature #174: also reset pagination)
  // Feature #61: Update URL with filter parameter for shareable links
  const handleCategoryChange = useCallback((value) => {
    setCategoryFilter(value);
    // Combine category and page reset in single URL update to avoid race condition
    updateURLParams({ category: value, page: '' });
    resetPaginationOnFilterChange(); // Feature #174
  }, [updateURLParams, resetPaginationOnFilterChange]);

  const handleLevelChange = useCallback((value) => {
    setLevelFilter(value);
    // Combine level and page reset in single URL update to avoid race condition
    updateURLParams({ level: value, page: '' });
    resetPaginationOnFilterChange(); // Feature #174
  }, [updateURLParams, resetPaginationOnFilterChange]);

  const handlePriceChange = useCallback((value) => {
    setPriceFilter(value);
    // Combine price and page reset in single URL update to avoid race condition
    updateURLParams({ price: value, page: '' });
    resetPaginationOnFilterChange(); // Feature #174
  }, [updateURLParams, resetPaginationOnFilterChange]);

  // Handle page change
  const handlePageChange = useCallback((page) => {
    setCurrentPage(page);
    updateURLParams({ page: page.toString() });
    // Scroll to top when page changes
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [updateURLParams]);

  // Fetch available categories from database (Feature #120)
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${CATALOG_API_URL}/courses/categories`);
        if (response.ok) {
          const data = await response.json();
          setAvailableCategories(data.categories || []);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
        setAvailableCategories(['Programacion', 'Data Science', 'IA / ML', 'Web3', 'Bases de Datos']);
      }
    };
    fetchCategories();
  }, []);

  // Fetch available levels from database (Feature #121)
  useEffect(() => {
    const fetchLevels = async () => {
      try {
        const response = await fetch(`${CATALOG_API_URL}/courses/levels`);
        if (response.ok) {
          const data = await response.json();
          setAvailableLevels(data.levels || []);
        }
      } catch (err) {
        console.error('Error fetching levels:', err);
        setAvailableLevels(['Principiante', 'Intermedio', 'Avanzado']);
      }
    };
    fetchLevels();
  }, []);

  // Feature #228: Track request ID to handle race conditions
  const requestIdRef = useRef(0);

  // Fetch courses from API with search, filters, and pagination
  // Feature #228: Uses AbortController and request ID to prevent stale responses
  useEffect(() => {
    // Feature #228: Create abort controller for this request
    const abortController = new AbortController();
    const currentRequestId = ++requestIdRef.current;

    const fetchCourses = async () => {
      try {
        setLoading(true);
        setError(null);

        // Build query string with search, filters, and pagination
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        if (categoryFilter) params.append('category', categoryFilter);
        if (levelFilter) params.append('level', levelFilter);
        if (priceFilter) params.append('premium', priceFilter === 'premium' ? 'true' : priceFilter === 'free' ? 'false' : '');
        params.append('page', currentPage.toString());
        params.append('limit', ITEMS_PER_PAGE.toString());

        const queryString = params.toString();
        const url = `${CATALOG_API_URL}/courses${queryString ? `?${queryString}` : ''}`;


        const response = await fetch(url, { signal: abortController.signal });

        // Feature #228: Check if this request is still the current one
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();

        // Feature #228: Double-check after JSON parsing
        if (currentRequestId !== requestIdRef.current) {
          return;
        }


        // Update pagination info from API response
        if (data.pagination) {
          setPagination(data.pagination);
        } else {
          // Client-side pagination fallback for API that doesn't support pagination yet
          const allCourses = data.courses || [];
          const total = allCourses.length;
          const totalPages = Math.ceil(total / ITEMS_PER_PAGE);
          setPagination({
            total,
            totalPages,
            hasNext: currentPage < totalPages,
            hasPrev: currentPage > 1
          });
          // Apply client-side pagination
          const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
          data.courses = allCourses.slice(startIndex, startIndex + ITEMS_PER_PAGE);
        }

        // Map API response to component format
        const mappedCourses = (data.courses || []).map(course => ({
          id: course.id,
          slug: course.slug,
          title: course.title,
          description: course.description,
          category: course.category,
          level: course.level,
          duration: `${course.duration_hours} horas`,
          isPremium: course.is_premium === 1 || course.is_premium === true,
          thumbnail: course.thumbnail_url,
          instructor: course.instructor_name || 'Instructor',
          studentsCount: course.students_count || 0,
          rating: course.rating || 4.5,
        }));
        setCourses(mappedCourses);
      } catch (err) {
        // Feature #228: Don't update state if request was aborted
        if (err.name === 'AbortError') {
          return;
        }

        // Feature #228: Only update error state if this is still the current request
        if (currentRequestId !== requestIdRef.current) {
          return;
        }

        console.error('Error fetching courses:', err);
        setError(err.message);
      } finally {
        // Feature #228: Only update loading state if this is still the current request
        if (currentRequestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    };
    fetchCourses();

    // Feature #228: Cleanup - abort request on unmount or dependency change
    return () => {
      abortController.abort();
    };
  }, [searchQuery, categoryFilter, levelFilter, priceFilter, currentPage]);

  const getLevelColor = (level) => {
    switch (level) {
      case 'Principiante':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'Intermedio':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'Avanzado':
        return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  // Handle search form submission (Feature #142 + Feature #174: reset pagination + Feature #177: whitespace handling)
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    // Feature #177: Trim whitespace and treat whitespace-only as empty search
    const trimmedSearch = searchInput.trim();
    setSearchInput(trimmedSearch); // Also update the input to show trimmed value
    setSearchQuery(trimmedSearch);
    // Combine search and page reset in single URL update
    updateURLParams({ search: trimmedSearch || '', page: '' });
    resetPaginationOnFilterChange(); // Feature #174: reset to page 1
  };

  // Handle clearing search (Feature #142 + Feature #174: reset pagination)
  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    // Combine search clear and page reset in single URL update
    updateURLParams({ search: '', page: '' });
    resetPaginationOnFilterChange(); // Feature #174
  };

  // Handle resetting all filters (Feature #171 + Feature #174: reset pagination + Feature #184: clear localStorage)
  const handleResetFilters = useCallback(() => {
    setCategoryFilter('');
    setLevelFilter('');
    setPriceFilter('');
    setSearchInput('');
    setSearchQuery('');
    setCurrentPage(1); // Feature #174
    setSearchParams({}, { replace: true });
    // Feature #184: Clear saved filters from localStorage
    try {
      localStorage.removeItem(FILTER_STORAGE_KEY);
    } catch (err) {
      // Ignore localStorage errors
    }
  }, [setSearchParams]);

  // Check if any filters are applied (Feature #171)
  const hasActiveFilters = categoryFilter || levelFilter || priceFilter || searchQuery;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Catalogo de Cursos
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Explora nuestra coleccion de cursos interactivos con ejecucion de codigo en vivo
          </p>
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="mb-6" data-testid="search-form" role="search">
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar cursos por nombre o descripcion..."
                aria-label="Buscar cursos"
                className="w-full px-4 py-2 pl-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                data-testid="search-input"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <button
              type="submit"
              className="px-6 py-2 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
              data-testid="search-button"
            >
              Buscar
            </button>
            {searchQuery && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 focus:outline-none focus:ring-2 focus:ring-gray-500 transition-colors"
                data-testid="clear-search-button"
              >
                Limpiar
              </button>
            )}
          </div>
          {searchQuery && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400" data-testid="search-results-info">
              Resultados para: <span className="font-medium">"{searchQuery}"</span>
              {!loading && ` - ${pagination.total} curso(s) encontrado(s)`}
            </p>
          )}
        </form>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4" role="group" aria-label="Filtros de cursos">
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryChange(e.target.value)}
            aria-label="Filtrar por categoria"
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            data-testid="category-filter"
          >
            <option value="">Todas las categorias</option>
            {availableCategories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select
            value={levelFilter}
            onChange={(e) => handleLevelChange(e.target.value)}
            aria-label="Filtrar por nivel"
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            data-testid="level-filter"
          >
            <option value="">Todos los niveles</option>
            {availableLevels.map(level => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
          <select
            value={priceFilter}
            onChange={(e) => handlePriceChange(e.target.value)}
            aria-label="Filtrar por precio"
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            data-testid="price-filter"
          >
            <option value="">Todos</option>
            <option value="free">Gratuitos</option>
            <option value="premium">Premium</option>
          </select>
          {/* Reset Filters Button (Feature #171) */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              aria-label="Restablecer todos los filtros"
              className="px-4 py-2 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 font-medium rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors flex items-center gap-2"
              data-testid="reset-filters-button"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Restablecer filtros
            </button>
          )}
        </div>

        {/* Current page indicator (Feature #174) */}
        {pagination.totalPages > 1 && (
          <div className="mb-4 text-sm text-gray-600 dark:text-gray-400" data-testid="current-page-indicator">
            Página {currentPage} de {pagination.totalPages}
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
            <span className="ml-4 text-gray-600 dark:text-gray-400">Cargando cursos...</span>
          </div>
        )}

        {/* Error State */}
        {error && !loading && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-3">
              <span className="text-red-500 text-2xl">⚠️</span>
              <div>
                <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">Error al cargar cursos</h3>
                <p className="text-red-600 dark:text-red-300">{error}</p>
              </div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && courses.length === 0 && (
          <div className="text-center py-16">
            <span className="text-6xl mb-4 block">📚</span>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No hay cursos disponibles</h3>
            <p className="text-gray-500 dark:text-gray-400">Intenta con otros filtros o vuelve mas tarde.</p>
          </div>
        )}

        {/* Course Grid */}
        {!loading && !error && courses.length > 0 && (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <a
                  key={course.id}
                  href={`/course/${course.slug}`}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow group"
                >
                  {/* Thumbnail placeholder */}
                  <div className="h-40 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                    <span className="text-6xl opacity-50">
                      {course.category === 'Programacion' ? '💻' :
                       course.category === 'Data Science' ? '📊' :
                       course.category === 'IA / ML' ? '🤖' :
                       course.category === 'Web3' ? '🔗' :
                       course.category === 'Bases de Datos' ? '🗃️' : '📚'}
                    </span>
                  </div>

                  <div className="p-5">
                    {/* Tags row */}
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(course.level)}`}>
                        {course.level}
                      </span>
                      {course.isPremium && (
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300">
                          Premium
                        </span>
                      )}
                      <span className="text-xs text-gray-500 dark:text-gray-400 ml-auto">
                        {course.duration}
                      </span>
                    </div>

                    {/* Title */}
                    <h3
                      className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors line-clamp-2"
                      title={course.title}
                    >
                      {course.title}
                    </h3>

                    {/* Description */}
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 line-clamp-2">
                      {course.description}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">
                        {course.instructor}
                      </span>
                      <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                        <span className="text-yellow-500">★</span>
                        <span>{course.rating}</span>
                        <span className="mx-1">·</span>
                        <span>{course.studentsCount.toLocaleString()} estudiantes</span>
                      </div>
                    </div>
                  </div>
                </a>
              ))}
            </div>

            {/* Pagination (Feature #174) */}
            <Pagination
              currentPage={currentPage}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              hasNext={pagination.hasNext}
              hasPrev={pagination.hasPrev}
              total={pagination.total}
              limit={ITEMS_PER_PAGE}
            />
          </>
        )}
      </div>
    </div>
  );
}
