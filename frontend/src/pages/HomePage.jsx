// Homepage component with hero, featured courses, and categories
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

function HomePage() {
  // Featured courses data - in production would come from API
  const featuredCourses = [
    {
      id: 1,
      slug: 'python-fundamentos',
      title: 'Python: Fundamentos',
      description: 'Aprende Python desde cero con ejercicios practicos y proyectos reales.',
      category: 'Programacion',
      level: 'Principiante',
      duration: '20 horas',
      isPremium: false,
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
      instructor: 'Ana Martinez',
      studentsCount: 2100,
      rating: 4.7,
    },
  ];

  // Categories data
  const categories = [
    { id: 1, name: 'Programacion', icon: '💻', slug: 'programacion', courseCount: 12 },
    { id: 2, name: 'Data Science', icon: '📊', slug: 'data-science', courseCount: 8 },
    { id: 3, name: 'IA / Machine Learning', icon: '🤖', slug: 'ia-ml', courseCount: 6 },
    { id: 4, name: 'Bases de Datos', icon: '🗃️', slug: 'bases-datos', courseCount: 5 },
    { id: 5, name: 'Web3 / Blockchain', icon: '🔗', slug: 'web3', courseCount: 4 },
    { id: 6, name: 'Estadistica', icon: '📈', slug: 'estadistica', courseCount: 3 },
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
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 via-primary-700 to-primary-800 text-white" data-testid="hero-section">
        <div className="max-w-7xl mx-auto px-4 py-16 md:py-24">
          <div className="text-center max-w-3xl mx-auto">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
              Aprende Haciendo
            </h1>
            <p className="text-xl md:text-2xl text-primary-100 mb-8">
              Cursos interactivos con ejecucion de codigo en vivo, asistencia de IA pedagogica y proyectos del mundo real
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="/courses"
                className="inline-flex items-center justify-center px-8 py-4 bg-white text-primary-700 font-semibold rounded-lg hover:bg-primary-50 transition-colors shadow-lg"
                data-testid="cta-explore-courses"
              >
                Explorar Cursos
              </a>
              <a
                href="/login"
                className="inline-flex items-center justify-center px-8 py-4 bg-primary-600 text-white font-semibold rounded-lg hover:bg-primary-500 transition-colors border-2 border-primary-500"
                data-testid="cta-start-free"
              >
                Comenzar Gratis
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid gap-8 md:grid-cols-3">
            <FeatureCard
              title="Codigo en Vivo"
              description="Ejecuta Python, SQL y R directamente en el navegador con feedback instantaneo"
              icon="code"
            />
            <FeatureCard
              title="IA Pedagogica"
              description="Asistencia basada en Taxonomia de Bloom, Modelo 4C y aprendizaje activo"
              icon="brain"
            />
            <FeatureCard
              title="Proyectos Reales"
              description="Aprende construyendo proyectos del mundo real con evaluacion automatica"
              icon="project"
            />
          </div>
        </div>
      </section>

      {/* Featured Courses Section */}
      <section className="py-16 bg-gray-50 dark:bg-gray-900" data-testid="featured-courses-section">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                Cursos Destacados
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Los cursos mas populares de nuestra plataforma
              </p>
            </div>
            <a
              href="/courses"
              className="hidden md:inline-flex items-center text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
            >
              Ver todos los cursos
              <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3" data-testid="featured-courses-grid">
            {featuredCourses.map((course) => (
              <a
                key={course.id}
                href={`/course/${course.slug}`}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden hover:shadow-lg transition-shadow group"
                data-testid={`featured-course-${course.id}`}
              >
                {/* Thumbnail placeholder */}
                <div className="h-40 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                  <span className="text-6xl opacity-50">
                    {course.category === 'Programacion' ? '💻' :
                     course.category === 'Data Science' ? '📊' :
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

          {/* Mobile "View all" link */}
          <div className="mt-8 text-center md:hidden">
            <a
              href="/courses"
              className="inline-flex items-center text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 font-medium"
            >
              Ver todos los cursos
              <svg className="w-5 h-5 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
      </section>

      {/* Categories Section */}
      <section className="py-16 bg-white dark:bg-gray-800" data-testid="categories-section">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
              Explora por Categoria
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              Encuentra cursos en tu area de interes
            </p>
          </div>

          <div className="grid gap-4 grid-cols-2 md:grid-cols-3 lg:grid-cols-6" data-testid="categories-grid">
            {categories.map((category) => (
              <a
                key={category.id}
                href={`/courses?category=${category.slug}`}
                className="bg-gray-50 dark:bg-gray-700 rounded-xl p-6 text-center hover:bg-primary-50 dark:hover:bg-gray-600 transition-colors group"
                data-testid={`category-${category.slug}`}
              >
                <div className="text-4xl mb-3">{category.icon}</div>
                <h3 className="font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors text-sm md:text-base">
                  {category.name}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {category.courseCount} cursos
                </p>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-primary-600 to-primary-800 text-white" data-testid="cta-section">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Comienza tu viaje de aprendizaje hoy
          </h2>
          <p className="text-xl text-primary-100 mb-8">
            Unete a miles de estudiantes que ya estan aprendiendo con nosotros
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/courses"
              className="inline-flex items-center justify-center px-8 py-4 bg-white text-primary-700 font-semibold rounded-lg hover:bg-primary-50 transition-colors shadow-lg"
              data-testid="cta-view-courses"
            >
              Ver Cursos
            </a>
            <a
              href="/login"
              className="inline-flex items-center justify-center px-8 py-4 bg-transparent text-white font-semibold rounded-lg hover:bg-primary-500 transition-colors border-2 border-white"
              data-testid="cta-register-free"
            >
              Registrarse Gratis
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}

export default HomePage;
