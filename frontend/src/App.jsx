import { Routes, Route } from 'react-router-dom';
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

// Course Catalog Page
function CourseCatalog() {
  // Sample courses data - in a real app this would come from an API
  const courses = [
    {
      id: 1,
      slug: 'python-fundamentos',
      title: 'Python: Fundamentos',
      description: 'Aprende Python desde cero con ejercicios practicos y proyectos reales.',
      category: 'Programacion',
      level: 'Principiante',
      duration: '20 horas',
      isPremium: false,
      thumbnail: null,
      instructor: 'Carlos Rodriguez',
      studentsCount: 1250,
      rating: 4.8,
    },
    {
      id: 2,
      slug: 'data-science-python',
      title: 'Data Science con Python',
      description: 'Domina pandas, numpy y matplotlib para analisis de datos.',
      category: 'Data Science',
      level: 'Intermedio',
      duration: '35 horas',
      isPremium: true,
      thumbnail: null,
      instructor: 'Maria Garcia',
      studentsCount: 890,
      rating: 4.9,
    },
    {
      id: 3,
      slug: 'sql-desde-cero',
      title: 'SQL desde Cero',
      description: 'Aprende a consultar y manipular bases de datos con SQL.',
      category: 'Bases de Datos',
      level: 'Principiante',
      duration: '15 horas',
      isPremium: false,
      thumbnail: null,
      instructor: 'Ana Martinez',
      studentsCount: 2100,
      rating: 4.7,
    },
    {
      id: 4,
      slug: 'machine-learning-basico',
      title: 'Machine Learning Basico',
      description: 'Introduccion a los algoritmos de aprendizaje automatico.',
      category: 'IA / ML',
      level: 'Avanzado',
      duration: '40 horas',
      isPremium: true,
      thumbnail: null,
      instructor: 'Pedro Sanchez',
      studentsCount: 650,
      rating: 4.6,
    },
    {
      id: 5,
      slug: 'r-estadistica',
      title: 'R para Estadistica',
      description: 'Analisis estadistico y visualizacion con R.',
      category: 'Data Science',
      level: 'Intermedio',
      duration: '25 horas',
      isPremium: false,
      thumbnail: null,
      instructor: 'Laura Fernandez',
      studentsCount: 480,
      rating: 4.5,
    },
    {
      id: 6,
      slug: 'web3-solidity',
      title: 'Web3 y Solidity',
      description: 'Desarrolla smart contracts y aplicaciones descentralizadas.',
      category: 'Web3',
      level: 'Avanzado',
      duration: '30 horas',
      isPremium: true,
      thumbnail: null,
      instructor: 'Diego Lopez',
      studentsCount: 320,
      rating: 4.8,
    },
  ];

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

        {/* Filters */}
        <div className="mb-6 flex flex-wrap gap-4">
          <select className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">Todas las categorias</option>
            <option value="programacion">Programacion</option>
            <option value="data-science">Data Science</option>
            <option value="ia-ml">IA / ML</option>
            <option value="web3">Web3</option>
            <option value="bases-datos">Bases de Datos</option>
          </select>
          <select className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">Todos los niveles</option>
            <option value="principiante">Principiante</option>
            <option value="intermedio">Intermedio</option>
            <option value="avanzado">Avanzado</option>
          </select>
          <select className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="">Todos</option>
            <option value="free">Gratuitos</option>
            <option value="premium">Premium</option>
          </select>
        </div>

        {/* Course Grid */}
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
                    <span className="text-yellow-500">\u2605</span>
                    <span>{course.rating}</span>
                    <span className="mx-1">\u00B7</span>
                    <span>{course.studentsCount.toLocaleString()} estudiantes</span>
                  </div>
                </div>
              </div>
            </a>
          ))}
        </div>
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
            <Route path="/course/:slug/lesson/:lessonId" element={<LessonPage />} />
            <Route path="/quiz/:quizId" element={<QuizPage />} />
            <Route path="/challenge/:challengeId" element={<CodeChallengePage />} />
            <Route path="/notebook/:notebookId" element={<NotebookPage />} />
            <Route path="/notebook" element={<NotebookPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/admin" element={<AdminCoursesPage />} />
            <Route path="/admin/courses" element={<AdminCoursesPage />} />
            <Route path="/admin/courses/new" element={<CourseCreatorPage />} />
            <Route path="/admin/courses/:courseId/edit" element={<CourseCreatorPage />} />
            <Route path="/admin/submissions" element={<SubmissionsReviewPage />} />
            <Route path="/admin/review/:submissionId" element={<InstructorFeedbackPage />} />
            <Route path="/feedback/:submissionId" element={<SubmissionFeedbackPage />} />
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
