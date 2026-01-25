import { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useSearchParams } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from './store/AuthContext';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import HomePage from './pages/HomePage';
import LessonPage from './pages/LessonPage';
import NotebookPage from './pages/NotebookPage';
import DashboardPage from './pages/DashboardPage';
import CourseCreatorPage from './pages/CourseCreatorPage';
import AdminCoursesPage from './pages/AdminCoursesPage';
import CourseDetailPage from './pages/CourseDetailPage';
import QuizPage from './pages/QuizPage';
import CodeChallengePage from './pages/CodeChallengePage';
import SubmissionsReviewPage from './pages/SubmissionsReviewPage';
import InstructorFeedbackPage from './pages/InstructorFeedbackPage';
import SubmissionFeedbackPage from './pages/SubmissionFeedbackPage';
import ForumPage from './pages/ForumPage';
import ThreadDetailPage from './pages/ThreadDetailPage';
import WebinarsPage from './pages/WebinarsPage';
import WebinarSchedulePage from './pages/WebinarSchedulePage';
import CertificatesPage from './pages/CertificatesPage';
import CertificateVerifyPage from './pages/CertificateVerifyPage';
import UpgradePage from './pages/UpgradePage';
import UpgradeSuccessPage from './pages/UpgradeSuccessPage';
import UpgradeErrorPage from './pages/UpgradeErrorPage';
import CareerPathsPage from './pages/CareerPathsPage';
import ServerErrorPage from './pages/ServerErrorPage';
import ErrorTestPage from './pages/ErrorTestPage';
import ProjectSubmissionPage from './pages/ProjectSubmissionPage';
import FileUploadTestPage from './pages/FileUploadTestPage';
import VideoTestPage from './pages/VideoTestPage';
import AnalyticsDashboardPage from './pages/AnalyticsDashboardPage';

// Placeholder pages - to be implemented
function Home() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
          Plataforma de Aprendizaje
        </h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
          Aprende haciendo con cursos interactivos y ejecucion de codigo en vivo
        </p>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <FeatureCard
            title="Codigo en Vivo"
            description="Ejecuta Python, SQL y R directamente en el navegador"
            icon="code"
          />
          <FeatureCard
            title="IA Pedagogica"
            description="Asistencia basada en Taxonomia de Bloom y Modelo 4C"
            icon="brain"
          />
          <FeatureCard
            title="Proyectos Reales"
            description="Aprende construyendo proyectos del mundo real"
            icon="project"
          />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ title, description, icon }) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-lg flex items-center justify-center mb-4">
        <span className="text-2xl">{icon === 'code' ? '\uD83D\uDCBB' : icon === 'brain' ? '\uD83E\uDDE0' : '\uD83D\uDE80'}</span>
      </div>
      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{title}</h3>
      <p className="text-gray-600 dark:text-gray-300">{description}</p>
    </div>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-900 dark:text-white mb-4">404</h1>
        <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">Pagina no encontrada</p>
        <a
          href="/"
          className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Volver al inicio
        </a>
      </div>
    </div>
  );
}

// API URL - use environment variable or default to port 3001
const CATALOG_API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Course Catalog Page
function CourseCatalog() {
  // Use URL search params for filter persistence (Feature #142)
  const [searchParams, setSearchParams] = useSearchParams();

  // Initialize filters from URL search params
  const [categoryFilter, setCategoryFilter] = useState(() => searchParams.get('category') || '');
  const [levelFilter, setLevelFilter] = useState(() => searchParams.get('level') || '');
  const [priceFilter, setPriceFilter] = useState(() => searchParams.get('price') || '');
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('search') || '');
  const [searchInput, setSearchInput] = useState(() => searchParams.get('search') || '');
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiResponseData, setApiResponseData] = useState(null); // Store raw API response for verification
  const [availableLevels, setAvailableLevels] = useState([]); // Dynamic levels from database
  const [availableCategories, setAvailableCategories] = useState([]); // Dynamic categories from database (Feature #120)

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

  // Wrapper functions to update both state and URL
  const handleCategoryChange = useCallback((value) => {
    setCategoryFilter(value);
    updateURLParams({ category: value });
  }, [updateURLParams]);

  const handleLevelChange = useCallback((value) => {
    setLevelFilter(value);
    updateURLParams({ level: value });
  }, [updateURLParams]);

  const handlePriceChange = useCallback((value) => {
    setPriceFilter(value);
    updateURLParams({ price: value });
  }, [updateURLParams]);

  // Fetch available categories from database (Feature #120)
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch(`${CATALOG_API_URL}/courses/categories`);
        if (response.ok) {
          const data = await response.json();
          console.log('[CourseCatalog] Available categories from database:', data.categories);
          setAvailableCategories(data.categories || []);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
        // Fallback to default categories if API fails
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
          console.log('[CourseCatalog] Available levels from database:', data.levels);
          setAvailableLevels(data.levels || []);
        }
      } catch (err) {
        console.error('Error fetching levels:', err);
        // Fallback to default levels if API fails
        setAvailableLevels(['Principiante', 'Intermedio', 'Avanzado']);
      }
    };
    fetchLevels();
  }, []);

  // Fetch courses from API with search and filters
  useEffect(() => {
    const fetchCourses = async () => {
      try {
        setLoading(true);
        setError(null);

        // Build query string with search and filters
        const params = new URLSearchParams();
        if (searchQuery) params.append('search', searchQuery);
        if (categoryFilter) params.append('category', categoryFilter);
        if (levelFilter) params.append('level', levelFilter);
        if (priceFilter) params.append('premium', priceFilter === 'premium' ? 'true' : priceFilter === 'free' ? 'false' : '');

        const queryString = params.toString();
        const url = `${CATALOG_API_URL}/courses${queryString ? `?${queryString}` : ''}`;

        console.log('[Search] Fetching courses from:', url);

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();

        // Store raw API response for verification (Feature #119)
        setApiResponseData(data);
        console.log('[Search] API Response:', data);

        // Map API response to component format WITHOUT client-side filtering
        // The API already handles search/filtering - we just display results
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
        console.error('Error fetching courses:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchCourses();
  }, [searchQuery, categoryFilter, levelFilter, priceFilter]);

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

  // Handle search form submission (Feature #142 - persist to URL)
  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setSearchQuery(searchInput);
    updateURLParams({ search: searchInput });
  };

  // Handle clearing search (Feature #142)
  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
    updateURLParams({ search: '' });
  };

  // No client-side filtering - API returns pre-filtered results
  // This ensures UI displays exactly what the API returns (Feature #119)
  const filteredCourses = courses;

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
        <form onSubmit={handleSearchSubmit} className="mb-6" data-testid="search-form">
          <div className="flex gap-2">
            <div className="relative flex-1 max-w-md">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Buscar cursos por nombre o descripcion..."
                className="w-full px-4 py-2 pl-10 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                data-testid="search-input"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
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
              {!loading && ` - ${filteredCourses.length} curso(s) encontrado(s)`}
            </p>
          )}
        </form>

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <select
            value={categoryFilter}
            onChange={(e) => handleCategoryChange(e.target.value)}
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
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            data-testid="price-filter"
          >
            <option value="">Todos</option>
            <option value="free">Gratuitos</option>
            <option value="premium">Premium</option>
          </select>
        </div>

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
        {!loading && !error && filteredCourses.length === 0 && (
          <div className="text-center py-16">
            <span className="text-6xl mb-4 block">📚</span>
            <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No hay cursos disponibles</h3>
            <p className="text-gray-500 dark:text-gray-400">Intenta con otros filtros o vuelve mas tarde.</p>
          </div>
        )}

        {/* Course Grid */}
        {!loading && !error && filteredCourses.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredCourses.map((course) => (
            <a
              key={course.id}
              href={`/course/${course.slug}`}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow group"
            >
              {/* Thumbnail placeholder */}
              <div className="h-40 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                <span className="text-6xl opacity-50">
                  {course.category === 'Programacion' ? '\uD83D\uDCBB' :
                   course.category === 'Data Science' ? '\uD83D\uDCCA' :
                   course.category === 'IA / ML' ? '\uD83E\uDD16' :
                   course.category === 'Web3' ? '\uD83D\uDD17' :
                   course.category === 'Bases de Datos' ? '\uD83D\uDDC3\uFE0F' : '\uD83D\uDCDA'}
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
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
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
        )}
      </div>
    </div>
  );
}

// Dashboard is now imported from DashboardPage.jsx

function App() {
  return (
    <AuthProvider>
      <div className="flex flex-col min-h-screen">
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#363636',
              color: '#fff',
            },
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#fff',
              },
            },
            error: {
              iconTheme: {
                primary: '#ef4444',
                secondary: '#fff',
              },
            },
          }}
        />
        <Navbar />
        <main className="flex-grow">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/courses" element={<CourseCatalog />} />
            <Route path="/course/:slug" element={<CourseDetailPage />} />
            <Route path="/course/:slug/forum" element={<ForumPage />} />
            <Route path="/forum/thread/:threadId" element={<ThreadDetailPage />} />
            <Route path="/course/:slug/lesson/:lessonId" element={<LessonPage />} />
            <Route path="/quiz/:quizId" element={<QuizPage />} />
            <Route path="/challenge/:challengeId" element={<CodeChallengePage />} />
            <Route path="/notebook/:notebookId" element={<NotebookPage />} />
            <Route path="/notebook" element={<NotebookPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/admin" element={<AdminCoursesPage />} />
            <Route path="/admin/courses" element={<AdminCoursesPage />} />
            <Route path="/admin/analytics" element={<AnalyticsDashboardPage />} />
            <Route path="/admin/courses/new" element={<CourseCreatorPage />} />
            <Route path="/admin/courses/:courseId/edit" element={<CourseCreatorPage />} />
            <Route path="/admin/submissions" element={<SubmissionsReviewPage />} />
            <Route path="/admin/review/:submissionId" element={<InstructorFeedbackPage />} />
            <Route path="/feedback/:submissionId" element={<SubmissionFeedbackPage />} />
            <Route path="/project/:projectId/submit" element={<ProjectSubmissionPage />} />
            <Route path="/webinars" element={<WebinarsPage />} />
            <Route path="/webinars/schedule" element={<WebinarSchedulePage />} />
            <Route path="/certificates" element={<CertificatesPage />} />
            <Route path="/certificate/verify/:code" element={<CertificateVerifyPage />} />
            <Route path="/certificate/verify" element={<CertificateVerifyPage />} />
            <Route path="/upgrade" element={<UpgradePage />} />
            <Route path="/upgrade/success" element={<UpgradeSuccessPage />} />
            <Route path="/upgrade/error" element={<UpgradeErrorPage />} />
            <Route path="/career-paths" element={<CareerPathsPage />} />
            <Route path="/career-paths/:slug" element={<CareerPathsPage />} />
            <Route path="/server-error" element={<ServerErrorPage />} />
            <Route path="/test-error" element={<ErrorTestPage />} />
            <Route path="/test-upload" element={<FileUploadTestPage />} />
            <Route path="/test-video" element={<VideoTestPage />} />
            <Route path="/profile" element={<div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-8"><h1 className="text-2xl font-bold text-gray-900 dark:text-white">User Profile</h1></div>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
}

export default App;
