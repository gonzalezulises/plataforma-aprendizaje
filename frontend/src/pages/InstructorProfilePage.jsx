import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Feature #244: Public instructor profile page
 * Shows instructor information and their courses
 */
function InstructorProfilePage() {
  const { id } = useParams();
  const [instructor, setInstructor] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchInstructorData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch instructor info
        const instructorResponse = await fetch(`${API_URL}/instructors/${id}`, {
          credentials: 'include'
        });

        if (!instructorResponse.ok) {
          if (instructorResponse.status === 404) {
            setError('Instructor no encontrado');
          } else {
            setError('Error al cargar el perfil del instructor');
          }
          setLoading(false);
          return;
        }

        const instructorData = await instructorResponse.json();
        setInstructor(instructorData.instructor);
        setCourses(instructorData.courses || []);
      } catch (err) {
        console.error('Error fetching instructor:', err);
        setError('Error de conexion. Intenta de nuevo.');
      } finally {
        setLoading(false);
      }
    }

    fetchInstructorData();
  }, [id]);

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
          <Link
            to="/courses"
            className="inline-flex items-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Ver Catalogo de Cursos
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Hero Section */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-800 text-white">
        <div className="max-w-4xl mx-auto px-4 py-12">
          {/* Breadcrumb */}
          <nav className="text-primary-200 text-sm mb-6">
            <Link to="/" className="hover:text-white">Inicio</Link>
            <span className="mx-2">/</span>
            <Link to="/courses" className="hover:text-white">Cursos</Link>
            <span className="mx-2">/</span>
            <span className="text-white">Instructor</span>
          </nav>

          <div className="flex items-center gap-6">
            {/* Avatar */}
            {instructor?.avatar_url ? (
              <img
                src={instructor.avatar_url}
                alt={`Avatar de ${instructor.name}`}
                className="w-24 h-24 rounded-full object-cover border-4 border-white/20"
                data-testid="instructor-profile-avatar"
              />
            ) : (
              <div
                className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center text-4xl font-bold"
                data-testid="instructor-profile-avatar-placeholder"
              >
                {(instructor?.name || 'I').charAt(0)}
              </div>
            )}

            {/* Info */}
            <div>
              <h1 className="text-3xl font-bold mb-2" data-testid="instructor-profile-name">
                {instructor?.name || 'Instructor'}
              </h1>
              <p className="text-primary-200 text-lg" data-testid="instructor-profile-bio">
                {instructor?.bio || 'Instructor en la plataforma'}
              </p>
              <div className="mt-3 flex items-center gap-4 text-sm text-primary-200">
                <span>{courses.length} {courses.length === 1 ? 'curso' : 'cursos'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Courses Section */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Cursos de {instructor?.name || 'este instructor'}
        </h2>

        {courses.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg">
            <p className="text-gray-600 dark:text-gray-400">
              Este instructor aun no tiene cursos publicados.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {courses.map((course) => (
              <Link
                key={course.id}
                to={`/course/${course.slug}`}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden"
              >
                {/* Course Thumbnail */}
                <div className="h-32 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                  <span className="text-4xl opacity-50">
                    {course.category === 'Programacion' ? '💻' :
                     course.category === 'Data Science' ? '📊' :
                     course.category === 'IA / ML' ? '🤖' :
                     course.category === 'Web3' ? '🔗' :
                     course.category === 'Bases de Datos' ? '🗃️' : '📚'}
                  </span>
                </div>

                {/* Course Info */}
                <div className="p-4">
                  <div className="flex flex-wrap gap-2 mb-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getLevelColor(course.level)}`}>
                      {course.level}
                    </span>
                    {course.is_premium ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                        Premium
                      </span>
                    ) : null}
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {course.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                    {course.description}
                  </p>
                  <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
                    {course.duration_hours} horas
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default InstructorProfilePage;
