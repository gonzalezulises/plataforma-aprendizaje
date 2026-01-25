import { Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';

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
        <span className="text-2xl">{icon === 'code' ? '💻' : icon === 'brain' ? '🧠' : '🚀'}</span>
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

function App() {
  return (
    <>
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
      <Routes>
        <Route path="/" element={<Home />} />
        {/* Placeholder routes - to be implemented */}
        <Route path="/courses" element={<div>Course Catalog</div>} />
        <Route path="/course/:slug" element={<div>Course Detail</div>} />
        <Route path="/course/:slug/lesson/:lessonId" element={<div>Lesson Player</div>} />
        <Route path="/dashboard" element={<div>Student Dashboard</div>} />
        <Route path="/admin" element={<div>Admin Panel</div>} />
        <Route path="/profile" element={<div>User Profile</div>} />
        <Route path="/login" element={<div>Login</div>} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

export default App;
