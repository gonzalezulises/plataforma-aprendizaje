import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import toast from 'react-hot-toast';
import AIQuizGeneratorModal from '../components/AIQuizGeneratorModal';
import AICourseStructureModal from '../components/AICourseStructureModal';

// Use the base URL without /api since the env var already includes it
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Tab components for different stages of course creation
const TABS = {
  DETAILS: 'details',
  MODULES: 'modules',
  PREVIEW: 'preview'
};

export default function CourseCreatorPage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { courseId } = useParams();

  const [activeTab, setActiveTab] = useState(TABS.DETAILS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Course state
  const [course, setCourse] = useState(null);
  const [courseForm, setCourseForm] = useState({
    title: '',
    description: '',
    category: 'Programacion',
    level: 'Principiante',
    is_premium: false,
    duration_hours: 0
  });

  // Modules state
  const [modules, setModules] = useState([]);
  const [expandedModule, setExpandedModule] = useState(null);
  const [editingModule, setEditingModule] = useState(null);
  const [editingLesson, setEditingLesson] = useState(null);

  // Modal states
  const [showModuleModal, setShowModuleModal] = useState(false);
  const [showLessonModal, setShowLessonModal] = useState(false);
  const [showContentModal, setShowContentModal] = useState(false);
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [selectedLessonId, setSelectedLessonId] = useState(null);

  // Form states for modals
  const [moduleForm, setModuleForm] = useState({ title: '', description: '', bloom_objective: '' });
  const [lessonForm, setLessonForm] = useState({ title: '', description: '', content_type: 'text', duration_minutes: 15 });
  const [contentForm, setContentForm] = useState({ type: 'text', content: { text: '' } });

  // AI Quiz Generator modal state
  const [showAIQuizModal, setShowAIQuizModal] = useState(false);
  const [aiQuizLessonId, setAIQuizLessonId] = useState(null);
  const [aiQuizLessonTitle, setAIQuizLessonTitle] = useState('');

  // AI Course Structure Generator modal state
  const [showAICourseModal, setShowAICourseModal] = useState(false);

  // Load course data if editing
  const loadCourse = useCallback(async () => {
    if (!courseId) return;

    setIsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/courses/${courseId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to load course');
      }

      const data = await response.json();
      setCourse(data.course);
      setCourseForm({
        title: data.course.title || '',
        description: data.course.description || '',
        category: data.course.category || 'Programacion',
        level: data.course.level || 'Principiante',
        is_premium: !!data.course.is_premium,
        duration_hours: data.course.duration_hours || 0
      });
      setModules(data.course.modules || []);
    } catch (error) {
      console.error('Error loading course:', error);
      toast.error('Error al cargar el curso');
    } finally {
      setIsLoading(false);
    }
  }, [courseId]);

  useEffect(() => {
    if (courseId) {
      loadCourse();
    }
  }, [courseId, loadCourse]);

  // Redirect non-instructors (disabled in dev mode for testing)
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
      return;
    }
    // In development, allow any authenticated user to access course creator for testing
    // In production, uncomment the role check below
    // if (!authLoading && user && user.role !== 'instructor_admin') {
    //   toast.error('Solo los instructores pueden crear cursos');
    //   navigate('/dashboard');
    // }
  }, [authLoading, isAuthenticated, user, navigate]);

  // Save course details
  const saveCourse = async () => {
    if (!courseForm.title.trim()) {
      toast.error('El titulo es obligatorio');
      return null;
    }

    setIsSaving(true);
    try {
      const url = course
        ? `${API_BASE}/courses/${course.id}`
        : `${API_BASE}/courses`;

      const response = await fetch(url, {
        method: course ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(courseForm)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save course');
      }

      const data = await response.json();
      setCourse(data.course);
      toast.success(course ? 'Curso actualizado' : 'Curso creado');

      // If new course, update URL without triggering a navigation/reload
      if (!course && data.course?.id) {
        window.history.replaceState(null, '', `/admin/courses/${data.course.id}/edit`);
      }

      return data.course;
    } catch (error) {
      console.error('Error saving course:', error);
      toast.error(error.message || 'Error al guardar el curso');
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  // Save and continue to modules
  const handleContinueToModules = async () => {
    const savedCourse = await saveCourse();
    if (savedCourse) {
      setActiveTab(TABS.MODULES);
    }
  };

  // Add new module
  const handleAddModule = async () => {
    if (!moduleForm.title.trim()) {
      toast.error('El titulo del modulo es obligatorio');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/courses/${course.id}/modules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(moduleForm)
      });

      if (!response.ok) {
        throw new Error('Failed to create module');
      }

      const data = await response.json();
      setModules([...modules, { ...data.module, lessons: [] }]);
      setModuleForm({ title: '', description: '', bloom_objective: '' });
      setShowModuleModal(false);
      toast.success('Modulo creado');
    } catch (error) {
      console.error('Error creating module:', error);
      toast.error('Error al crear el modulo');
    }
  };

  // Update module
  const handleUpdateModule = async () => {
    if (!editingModule || !moduleForm.title.trim()) {
      toast.error('El titulo del modulo es obligatorio');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/courses/${course.id}/modules/${editingModule.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(moduleForm)
      });

      if (!response.ok) {
        throw new Error('Failed to update module');
      }

      const data = await response.json();
      setModules(modules.map(m => m.id === editingModule.id ? { ...data.module, lessons: m.lessons } : m));
      setModuleForm({ title: '', description: '', bloom_objective: '' });
      setEditingModule(null);
      setShowModuleModal(false);
      toast.success('Modulo actualizado');
    } catch (error) {
      console.error('Error updating module:', error);
      toast.error('Error al actualizar el modulo');
    }
  };

  // Delete module
  const handleDeleteModule = async (moduleId) => {
    if (!confirm('Esta seguro de eliminar este modulo y todas sus lecciones?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/courses/${course.id}/modules/${moduleId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete module');
      }

      setModules(modules.filter(m => m.id !== moduleId));
      toast.success('Modulo eliminado');
    } catch (error) {
      console.error('Error deleting module:', error);
      toast.error('Error al eliminar el modulo');
    }
  };

  // Add lesson to module
  const handleAddLesson = async () => {
    if (!lessonForm.title.trim()) {
      toast.error('El titulo de la leccion es obligatorio');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/courses/${course.id}/modules/${selectedModuleId}/lessons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(lessonForm)
      });

      if (!response.ok) {
        throw new Error('Failed to create lesson');
      }

      const data = await response.json();
      setModules(modules.map(m => {
        if (m.id === selectedModuleId) {
          return { ...m, lessons: [...(m.lessons || []), data.lesson] };
        }
        return m;
      }));
      setLessonForm({ title: '', description: '', content_type: 'text', duration_minutes: 15 });
      setShowLessonModal(false);
      toast.success('Leccion creada');
    } catch (error) {
      console.error('Error creating lesson:', error);
      toast.error('Error al crear la leccion');
    }
  };

  // Update lesson
  const handleUpdateLesson = async () => {
    if (!editingLesson || !lessonForm.title.trim()) {
      toast.error('El titulo de la leccion es obligatorio');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/courses/${course.id}/modules/${selectedModuleId}/lessons/${editingLesson.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(lessonForm)
      });

      if (!response.ok) {
        throw new Error('Failed to update lesson');
      }

      const data = await response.json();
      setModules(modules.map(m => {
        if (m.id === selectedModuleId) {
          return {
            ...m,
            lessons: m.lessons.map(l => l.id === editingLesson.id ? data.lesson : l)
          };
        }
        return m;
      }));
      setLessonForm({ title: '', description: '', content_type: 'text', duration_minutes: 15 });
      setEditingLesson(null);
      setShowLessonModal(false);
      toast.success('Leccion actualizada');
    } catch (error) {
      console.error('Error updating lesson:', error);
      toast.error('Error al actualizar la leccion');
    }
  };

  // Delete lesson
  const handleDeleteLesson = async (moduleId, lessonId) => {
    if (!confirm('Esta seguro de eliminar esta leccion?')) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/courses/${course.id}/modules/${moduleId}/lessons/${lessonId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete lesson');
      }

      setModules(modules.map(m => {
        if (m.id === moduleId) {
          return { ...m, lessons: m.lessons.filter(l => l.id !== lessonId) };
        }
        return m;
      }));
      toast.success('Leccion eliminada');
    } catch (error) {
      console.error('Error deleting lesson:', error);
      toast.error('Error al eliminar la leccion');
    }
  };

  // Add content to lesson
  const handleAddContent = async () => {
    if (!contentForm.content.text?.trim() && contentForm.type === 'text') {
      toast.error('El contenido no puede estar vacio');
      return;
    }

    const module = modules.find(m => m.lessons?.some(l => l.id === selectedLessonId));
    if (!module) return;

    try {
      const response = await fetch(`${API_BASE}/courses/${course.id}/modules/${module.id}/lessons/${selectedLessonId}/content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(contentForm)
      });

      if (!response.ok) {
        throw new Error('Failed to add content');
      }

      setContentForm({ type: 'text', content: { text: '' } });
      setShowContentModal(false);
      toast.success('Contenido agregado');
    } catch (error) {
      console.error('Error adding content:', error);
      toast.error('Error al agregar contenido');
    }
  };

  // Publish course
  const handlePublish = async () => {
    if (!course) return;

    // Validate course has content
    if (modules.length === 0) {
      toast.error('El curso debe tener al menos un modulo');
      return;
    }

    const hasLessons = modules.some(m => m.lessons && m.lessons.length > 0);
    if (!hasLessons) {
      toast.error('El curso debe tener al menos una leccion');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/courses/${course.id}/publish`, {
        method: 'POST',
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to publish course');
      }

      const data = await response.json();
      setCourse(data.course);
      toast.success('Curso publicado exitosamente!');
    } catch (error) {
      console.error('Error publishing course:', error);
      toast.error(error.message || 'Error al publicar el curso');
    }
  };

  // Show loading state
  if (authLoading || (courseId && isLoading)) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link to="/admin/courses" className="text-sm text-gray-500 hover:text-primary-600 mb-2 inline-block">
              &larr; Volver a cursos
            </Link>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {course ? 'Editar Curso' : 'Crear Nuevo Curso'}
            </h1>
          </div>
          {course && (
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                course.is_published
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300'
              }`}>
                {course.is_published ? 'Publicado' : 'Borrador'}
              </span>
              {!course.is_published && (
                <button
                  onClick={handlePublish}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Publicar Curso
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700 mb-8">
          <nav className="flex gap-8">
            <button
              onClick={() => setActiveTab(TABS.DETAILS)}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === TABS.DETAILS
                  ? 'border-primary-600 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              1. Detalles del Curso
            </button>
            <button
              onClick={() => course && setActiveTab(TABS.MODULES)}
              disabled={!course}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === TABS.MODULES
                  ? 'border-primary-600 text-primary-600'
                  : !course
                    ? 'border-transparent text-gray-300 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              2. Modulos y Lecciones
            </button>
            <button
              onClick={() => course && setActiveTab(TABS.PREVIEW)}
              disabled={!course}
              className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === TABS.PREVIEW
                  ? 'border-primary-600 text-primary-600'
                  : !course
                    ? 'border-transparent text-gray-300 cursor-not-allowed'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              3. Vista Previa
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        {activeTab === TABS.DETAILS && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Informacion del Curso
            </h2>

            <div className="space-y-6">
              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Titulo del Curso *
                </label>
                <input
                  type="text"
                  value={courseForm.title}
                  onChange={(e) => setCourseForm({ ...courseForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Ej: Python desde Cero"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descripcion
                </label>
                <textarea
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Describe tu curso..."
                />
              </div>

              {/* Category & Level */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Categoria
                  </label>
                  <select
                    value={courseForm.category}
                    onChange={(e) => setCourseForm({ ...courseForm, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="Programacion">Programacion</option>
                    <option value="Data Science">Data Science</option>
                    <option value="IA / ML">IA / ML</option>
                    <option value="Web3">Web3</option>
                    <option value="Bases de Datos">Bases de Datos</option>
                    <option value="DevOps">DevOps</option>
                    <option value="Diseno">Diseno</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nivel
                  </label>
                  <select
                    value={courseForm.level}
                    onChange={(e) => setCourseForm({ ...courseForm, level: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="Principiante">Principiante</option>
                    <option value="Intermedio">Intermedio</option>
                    <option value="Avanzado">Avanzado</option>
                  </select>
                </div>
              </div>

              {/* Premium & Duration */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      checked={courseForm.is_premium}
                      onChange={(e) => setCourseForm({ ...courseForm, is_premium: e.target.checked })}
                      className="w-5 h-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Curso Premium (requiere pago)
                    </span>
                  </label>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Duracion estimada (horas)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={courseForm.duration_hours}
                    onChange={(e) => setCourseForm({ ...courseForm, duration_hours: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={saveCourse}
                  disabled={isSaving}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? 'Guardando...' : 'Guardar Borrador'}
                </button>
                <button
                  onClick={handleContinueToModules}
                  disabled={isSaving}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  Continuar a Modulos &rarr;
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === TABS.MODULES && course && (
          <div className="space-y-6">
            {/* Add Module Button */}
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Modulos del Curso
              </h2>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowAICourseModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                  </svg>
                  Generar con IA
                </button>
                <button
                  onClick={() => {
                    setModuleForm({ title: '', description: '', bloom_objective: '' });
                    setEditingModule(null);
                    setShowModuleModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Agregar Modulo
                </button>
              </div>
            </div>

            {/* Modules List */}
            {modules.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-12 text-center">
                <div className="w-16 h-16 mx-auto bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                  <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No hay modulos todavia
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Comienza agregando el primer modulo a tu curso
                </p>
                <button
                  onClick={() => setShowModuleModal(true)}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Agregar primer modulo
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {modules.map((module, index) => (
                  <div key={module.id} className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
                    {/* Module Header */}
                    <div
                      className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                      onClick={() => setExpandedModule(expandedModule === module.id ? null : module.id)}
                    >
                      <div className="flex items-center gap-4">
                        <span className="w-8 h-8 bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-400 rounded-full flex items-center justify-center font-medium">
                          {index + 1}
                        </span>
                        <div>
                          <h3 className="font-medium text-gray-900 dark:text-white">{module.title}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {module.lessons?.length || 0} lecciones
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setModuleForm({
                              title: module.title,
                              description: module.description || '',
                              bloom_objective: module.bloom_objective || ''
                            });
                            setEditingModule(module);
                            setShowModuleModal(true);
                          }}
                          className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteModule(module.id);
                          }}
                          className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                        <svg
                          className={`w-5 h-5 text-gray-400 transition-transform ${expandedModule === module.id ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>

                    {/* Lessons (expandable) */}
                    {expandedModule === module.id && (
                      <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
                        {/* Lessons List */}
                        {module.lessons && module.lessons.length > 0 ? (
                          <div className="space-y-2 mb-4">
                            {module.lessons.map((lesson, lessonIndex) => (
                              <div
                                key={lesson.id}
                                className="flex items-center justify-between p-3 bg-white dark:bg-gray-800 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <span className="text-sm text-gray-400">
                                    {index + 1}.{lessonIndex + 1}
                                  </span>
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-white">{lesson.title}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {lesson.content_type} &bull; {lesson.duration_minutes} min
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => {
                                      setSelectedLessonId(lesson.id);
                                      setShowContentModal(true);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-green-600 transition-colors"
                                    title="Agregar contenido"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAIQuizLessonId(lesson.id);
                                      setAIQuizLessonTitle(lesson.title);
                                      setShowAIQuizModal(true);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-purple-600 transition-colors"
                                    title="Generar Quiz con IA"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedModuleId(module.id);
                                      setLessonForm({
                                        title: lesson.title,
                                        description: lesson.description || '',
                                        content_type: lesson.content_type || 'text',
                                        duration_minutes: lesson.duration_minutes || 15
                                      });
                                      setEditingLesson(lesson);
                                      setShowLessonModal(true);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-primary-600 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLesson(module.id, lesson.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                            No hay lecciones en este modulo
                          </p>
                        )}

                        {/* Add Lesson Button */}
                        <button
                          onClick={() => {
                            setSelectedModuleId(module.id);
                            setLessonForm({ title: '', description: '', content_type: 'text', duration_minutes: 15 });
                            setEditingLesson(null);
                            setShowLessonModal(true);
                          }}
                          className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                          </svg>
                          Agregar leccion
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Continue to Preview */}
            <div className="flex justify-end pt-4">
              <button
                onClick={() => setActiveTab(TABS.PREVIEW)}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Continuar a Vista Previa &rarr;
              </button>
            </div>
          </div>
        )}

        {activeTab === TABS.PREVIEW && course && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            {/* Course Preview Header */}
            <div className="h-48 bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
              <span className="text-8xl opacity-50">
                {courseForm.category === 'Programacion' ? '\uD83D\uDCBB' :
                 courseForm.category === 'Data Science' ? '\uD83D\uDCCA' :
                 courseForm.category === 'IA / ML' ? '\uD83E\uDD16' :
                 courseForm.category === 'Web3' ? '\uD83D\uDD17' :
                 courseForm.category === 'Bases de Datos' ? '\uD83D\uDDC3\uFE0F' : '\uD83D\uDCDA'}
              </span>
            </div>

            <div className="p-6">
              {/* Course Info */}
              <div className="flex items-center gap-3 mb-4">
                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                  courseForm.level === 'Principiante'
                    ? 'bg-green-100 text-green-800'
                    : courseForm.level === 'Intermedio'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-red-100 text-red-800'
                }`}>
                  {courseForm.level}
                </span>
                {courseForm.is_premium && (
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                    Premium
                  </span>
                )}
                <span className="text-sm text-gray-500">
                  {courseForm.duration_hours} horas
                </span>
              </div>

              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                {courseForm.title || 'Sin titulo'}
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {courseForm.description || 'Sin descripcion'}
              </p>

              {/* Modules Preview */}
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Contenido del Curso
              </h3>
              {modules.length > 0 ? (
                <div className="space-y-4">
                  {modules.map((module, index) => (
                    <div key={module.id} className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">
                          {index + 1}
                        </span>
                        <h4 className="font-medium text-gray-900 dark:text-white">{module.title}</h4>
                      </div>
                      {module.lessons && module.lessons.length > 0 && (
                        <ul className="ml-9 space-y-1">
                          {module.lessons.map((lesson) => (
                            <li key={lesson.id} className="text-sm text-gray-600 dark:text-gray-400 flex items-center gap-2">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              {lesson.title} ({lesson.duration_minutes} min)
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 dark:text-gray-400">No hay modulos todavia</p>
              )}

              {/* Publish Section */}
              <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {course.is_published ? 'Este curso esta publicado' : 'Listo para publicar?'}
                    </h4>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {course.is_published
                        ? 'El curso es visible en el catalogo publico'
                        : 'Publica el curso para que los estudiantes puedan verlo'
                      }
                    </p>
                  </div>
                  {!course.is_published && (
                    <button
                      onClick={handlePublish}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Publicar Curso
                    </button>
                  )}
                  {course.is_published && (
                    <Link
                      to={`/course/${course.slug}`}
                      className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Ver en Catalogo
                    </Link>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Module Modal */}
      {showModuleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingModule ? 'Editar Modulo' : 'Nuevo Modulo'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Titulo *
                </label>
                <input
                  type="text"
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="Ej: Introduccion a Python"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descripcion
                </label>
                <textarea
                  value={moduleForm.description}
                  onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Objetivo de Bloom
                </label>
                <select
                  value={moduleForm.bloom_objective}
                  onChange={(e) => setModuleForm({ ...moduleForm, bloom_objective: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Seleccionar...</option>
                  <option value="recordar">Recordar</option>
                  <option value="comprender">Comprender</option>
                  <option value="aplicar">Aplicar</option>
                  <option value="analizar">Analizar</option>
                  <option value="evaluar">Evaluar</option>
                  <option value="crear">Crear</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowModuleModal(false);
                  setEditingModule(null);
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={editingModule ? handleUpdateModule : handleAddModule}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {editingModule ? 'Guardar Cambios' : 'Crear Modulo'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lesson Modal */}
      {showLessonModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {editingLesson ? 'Editar Leccion' : 'Nueva Leccion'}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Titulo *
                </label>
                <input
                  type="text"
                  value={lessonForm.title}
                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="Ej: Variables y tipos de datos"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descripcion
                </label>
                <textarea
                  value={lessonForm.description}
                  onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tipo de contenido
                  </label>
                  <select
                    value={lessonForm.content_type}
                    onChange={(e) => setLessonForm({ ...lessonForm, content_type: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="text">Texto</option>
                    <option value="video">Video</option>
                    <option value="code">Codigo</option>
                    <option value="notebook">Notebook</option>
                    <option value="quiz">Quiz</option>
                    <option value="challenge">Reto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Duracion (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={lessonForm.duration_minutes}
                    onChange={(e) => setLessonForm({ ...lessonForm, duration_minutes: parseInt(e.target.value) || 15 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowLessonModal(false);
                  setEditingLesson(null);
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={editingLesson ? handleUpdateLesson : handleAddLesson}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                {editingLesson ? 'Guardar Cambios' : 'Crear Leccion'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Content Modal */}
      {showContentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Agregar Contenido
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tipo
                </label>
                <select
                  value={contentForm.type}
                  onChange={(e) => setContentForm({ ...contentForm, type: e.target.value, content: { text: '' } })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                >
                  <option value="text">Texto</option>
                  <option value="video">Video URL</option>
                  <option value="code">Codigo</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Contenido
                </label>
                <textarea
                  value={contentForm.content.text || ''}
                  onChange={(e) => setContentForm({ ...contentForm, content: { text: e.target.value } })}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 font-mono"
                  placeholder={
                    contentForm.type === 'video' ? 'URL del video...' :
                    contentForm.type === 'code' ? '# Tu codigo aqui...' :
                    'Escribe el contenido...'
                  }
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowContentModal(false)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
              >
                Cancelar
              </button>
              <button
                onClick={handleAddContent}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Agregar Contenido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AI Quiz Generator Modal */}
      <AIQuizGeneratorModal
        isOpen={showAIQuizModal}
        onClose={() => {
          setShowAIQuizModal(false);
          setAIQuizLessonId(null);
          setAIQuizLessonTitle('');
        }}
        lessonId={aiQuizLessonId}
        lessonTitle={aiQuizLessonTitle}
        onQuizSaved={(quizId) => {
          toast.success(`Quiz #${quizId} creado con exito`);
          // Optionally refresh the lesson data
        }}
      />

      {/* AI Course Structure Modal */}
      <AICourseStructureModal
        isOpen={showAICourseModal}
        onClose={() => setShowAICourseModal(false)}
        courseId={course?.id}
        onStructureApplied={(result) => {
          toast.success(`Estructura aplicada: ${result.totalModules} modulos y ${result.totalLessons} lecciones creadas`);
          loadCourse();
          setShowAICourseModal(false);
        }}
      />
    </div>
  );
}
