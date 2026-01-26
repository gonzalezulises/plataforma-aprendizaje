import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import toast from 'react-hot-toast';
import ConfirmDeleteModal from '../components/ConfirmDeleteModal';
import AdminLayout from '../components/AdminLayout';

// Use the base URL - env var already includes /api
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export default function AdminCoursesPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, course: null });
  const [isDeleting, setIsDeleting] = useState(false);

  // Redirect non-instructors - security check for admin access
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
      return;
    }
    // Role-based access control: Only instructor_admin can access admin pages
    if (!authLoading && user && user.role !== 'instructor_admin') {
      toast.error('Solo los instructores pueden acceder a esta pagina');
      navigate('/dashboard');
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  // Load courses
  useEffect(() => {
    const loadCourses = async () => {
      if (!user) return;

      try {
        const response = await fetch(`${API_BASE}/courses`, {
          credentials: 'include'
        });

        if (!response.ok) {
          throw new Error('Failed to load courses');
        }

        const data = await response.json();
        setCourses(data.courses || []);
      } catch (error) {
        console.error('Error loading courses:', error);
        toast.error('Error al cargar los cursos');
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading && user) {
      loadCourses();
    }
  }, [authLoading, user]);

  // Open delete confirmation modal
  const openDeleteModal = (course) => {
    setDeleteModal({ isOpen: true, course });
  };

  // Close delete confirmation modal
  const closeDeleteModal = () => {
    if (!isDeleting) {
      setDeleteModal({ isOpen: false, course: null });
    }
  };

  // Confirm and execute deletion
  const confirmDelete = async () => {
    if (!deleteModal.course) return;

    setIsDeleting(true);
    try {
      const response = await fetch(`${API_BASE}/courses/${deleteModal.course.id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete course');
      }

      setCourses(courses.filter(c => c.id !== deleteModal.course.id));
      toast.success('Curso eliminado');
      setDeleteModal({ isOpen: false, course: null });
    } catch (error) {
      console.error('Error deleting course:', error);
      toast.error('Error al eliminar el curso');
    } finally {
      setIsDeleting(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Mis Cursos
            </h2>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
              Gestiona tus cursos y contenido
            </p>
          </div>
          <Link
            to="/admin/courses/new"
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Crear Nuevo Curso
          </Link>
        </div>

        {/* Courses List */}
        <div className="p-6">
          {courses.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                No tienes cursos todavia
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-4">
                Crea tu primer curso para comenzar a compartir tu conocimiento
              </p>
              <Link
                to="/admin/courses/new"
                className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Crear Primer Curso
              </Link>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="bg-gray-50 dark:bg-gray-750 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700"
                >
                  {/* Thumbnail */}
                  <div className="h-36 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center relative">
                    <span className="text-5xl opacity-50">
                      {course.category === 'Programacion' ? '\uD83D\uDCBB' :
                       course.category === 'Data Science' ? '\uD83D\uDCCA' :
                       course.category === 'IA / ML' ? '\uD83E\uDD16' :
                       course.category === 'Web3' ? '\uD83D\uDD17' :
                       course.category === 'Bases de Datos' ? '\uD83D\uDDC3\uFE0F' : '\uD83D\uDCDA'}
                    </span>
                    {/* Status Badge */}
                    <span className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium ${
                      course.is_published
                        ? 'bg-green-100 text-green-800'
                        : 'bg-yellow-100 text-yellow-800'
                    }`}>
                      {course.is_published ? 'Publicado' : 'Borrador'}
                    </span>
                  </div>

                  <div className="p-4">
                    {/* Course Info */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        course.level === 'Principiante'
                          ? 'bg-green-100 text-green-800'
                          : course.level === 'Intermedio'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}>
                        {course.level}
                      </span>
                      {course.is_premium && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                          Premium
                        </span>
                      )}
                    </div>

                    <h3 className="font-semibold text-gray-900 dark:text-white mb-1 line-clamp-1">
                      {course.title}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 line-clamp-2">
                      {course.description || 'Sin descripcion'}
                    </p>

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-3 border-t border-gray-200 dark:border-gray-600">
                      <Link
                        to={`/admin/courses/${course.id}/edit`}
                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                      >
                        Editar
                      </Link>
                      <div className="flex items-center gap-2">
                        {course.is_published && (
                          <Link
                            to={`/course/${course.slug}`}
                            className="p-1.5 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Ver curso"
                            aria-label={`Ver curso ${course.title}`}
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Link>
                        )}
                        <button
                          onClick={() => openDeleteModal(course)}
                          className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                          title="Eliminar curso"
                          aria-label={`Eliminar curso ${course.title}`}
                          data-testid={`delete-course-${course.id}`}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={deleteModal.isOpen}
        onConfirm={confirmDelete}
        onCancel={closeDeleteModal}
        title={deleteModal.course ? `"${deleteModal.course.title}"` : 'este curso'}
        message={deleteModal.course ? `¿Estas seguro de que quieres eliminar el curso "${deleteModal.course.title}"? Todos los modulos, lecciones y el progreso de los estudiantes se perderan. Esta accion no se puede deshacer.` : undefined}
        isDeleting={isDeleting}
      />
    </AdminLayout>
  );
}
