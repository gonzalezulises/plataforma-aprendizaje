import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { useAuth } from '../store/AuthContext';
import toast from 'react-hot-toast';
import AIQuizGeneratorModal from '../components/AIQuizGeneratorModal';
import AICourseStructureModal from '../components/AICourseStructureModal';
import QuizImportModal from '../components/QuizImportModal';
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning';
import { useWebSocket } from '../hooks/useWebSocket';
import UnsavedChangesModal from '../components/UnsavedChangesModal';
import { csrfFetch } from '../utils/csrf';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import LessonContentRenderer from '../components/LessonContentRenderer';

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
  const [courseVersion, setCourseVersion] = useState(null); // For optimistic locking
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [conflictData, setConflictData] = useState(null);
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

  // Content viewer state
  const [contentViewMode, setContentViewMode] = useState(true); // true = viewing, false = editing
  const [loadingContent, setLoadingContent] = useState(false);

  // Field-level errors for unique validation (Feature #191)
  const [fieldErrors, setFieldErrors] = useState({ title: '' });

  // AI Quiz Generator modal state
  const [showAIQuizModal, setShowAIQuizModal] = useState(false);
  const [aiQuizLessonId, setAIQuizLessonId] = useState(null);
  const [aiQuizLessonTitle, setAIQuizLessonTitle] = useState('');

  // AI Course Structure Generator modal state
  const [showAICourseModal, setShowAICourseModal] = useState(false);

  // Quiz Import modal state
  const [showQuizImportModal, setShowQuizImportModal] = useState(false);
  const [quizImportLessonId, setQuizImportLessonId] = useState(null);
  const [quizImportLessonTitle, setQuizImportLessonTitle] = useState('');

  // AI Content Generation state
  const [generatingContentForLesson, setGeneratingContentForLesson] = useState(null);

  // AI Objectives Generation state
  const [generatingObjectives, setGeneratingObjectives] = useState(false);
  const [generatedObjectives, setGeneratedObjectives] = useState([]);
  const [objectivesSources, setObjectivesSources] = useState([]);

  // AI Description Generation state
  const [generatingDescription, setGeneratingDescription] = useState(false);

  // Batch content generation state
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchId, setBatchId] = useState(null);
  const [batchProgress, setBatchProgress] = useState(null);
  const [batchLessonStatuses, setBatchLessonStatuses] = useState({});
  const [batchComplete, setBatchComplete] = useState(false);
  const [batchSummary, setBatchSummary] = useState(null);

  // WebSocket for batch progress
  const ws = useWebSocket();

  // Track original form state for unsaved changes detection
  const originalFormRef = useRef(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Draft persistence for new courses (localStorage)
  const autosaveTimerRef = useRef(null);
  const [draftRestored, setDraftRestored] = useState(false);

  // Autosave for existing courses
  const autosaveExistingTimerRef = useRef(null);
  const [autosaveStatus, setAutosaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'

  // Unsaved changes warning hook
  const {
    showModal: showUnsavedModal,
    confirmNavigation,
    cancelNavigation,
    message: unsavedMessage,
  } = useUnsavedChangesWarning(
    hasUnsavedChanges,
    'Tienes cambios sin guardar en este curso. Si sales ahora, perderas los cambios.'
  );

  // Restore draft from localStorage for new courses
  useEffect(() => {
    if (courseId) return; // Only for new courses
    try {
      const raw = localStorage.getItem('course_draft_new');
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft.courseForm?.title && !draft.courseForm?.description) return;
      setCourseForm(draft.courseForm);
      if (draft.generatedObjectives?.length > 0) {
        setGeneratedObjectives(draft.generatedObjectives);
      }
      if (draft.activeTab) {
        setActiveTab(draft.activeTab);
      }
      originalFormRef.current = JSON.stringify(draft.courseForm);
      setDraftRestored(true);
      toast.success('Borrador restaurado');
    } catch {
      // Ignore parse errors
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-save draft to localStorage for new courses (debounced 1s)
  useEffect(() => {
    if (courseId || course) return; // Only for new courses (not yet saved)
    if (!courseForm.title && !courseForm.description) return;

    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
    }
    autosaveTimerRef.current = setTimeout(() => {
      try {
        localStorage.setItem('course_draft_new', JSON.stringify({
          courseForm,
          generatedObjectives,
          activeTab,
          savedAt: new Date().toISOString()
        }));
      } catch {
        // Ignore storage errors
      }
    }, 1000);

    return () => {
      if (autosaveTimerRef.current) {
        clearTimeout(autosaveTimerRef.current);
      }
    };
  }, [courseForm, generatedObjectives, activeTab, courseId, course]);

  // Autosave for existing courses (debounced 3s)
  useEffect(() => {
    if (!courseId || !course || !hasUnsavedChanges || isSaving) return;

    if (autosaveExistingTimerRef.current) {
      clearTimeout(autosaveExistingTimerRef.current);
    }
    autosaveExistingTimerRef.current = setTimeout(async () => {
      setAutosaveStatus('saving');
      try {
        const response = await fetch(`${API_BASE}/courses/${course.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ ...courseForm, version: courseVersion })
        });

        if (response.status === 409) {
          setAutosaveStatus('error');
          return;
        }

        if (!response.ok) {
          setAutosaveStatus('error');
          return;
        }

        const data = await response.json();
        setCourseVersion(data.course.updated_at);
        originalFormRef.current = JSON.stringify(courseForm);
        setHasUnsavedChanges(false);
        setAutosaveStatus('saved');
        setTimeout(() => setAutosaveStatus(null), 3000);
      } catch {
        setAutosaveStatus('error');
      }
    }, 3000);

    return () => {
      if (autosaveExistingTimerRef.current) {
        clearTimeout(autosaveExistingTimerRef.current);
      }
    };
  }, [courseForm, courseId, course, hasUnsavedChanges, isSaving, courseVersion]);

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
      setCourseVersion(data.course.updated_at); // Store version for conflict detection
      const formData = {
        title: data.course.title || '',
        description: data.course.description || '',
        category: data.course.category || 'Programacion',
        level: data.course.level || 'Principiante',
        is_premium: !!data.course.is_premium,
        duration_hours: data.course.duration_hours || 0
      };
      setCourseForm(formData);
      // Store original state for comparison
      originalFormRef.current = JSON.stringify(formData);
      setHasUnsavedChanges(false);
      setModules(data.course.modules || []);

      // Restore objectives from database
      if (data.course.objectives) {
        try {
          const obj = typeof data.course.objectives === 'string'
            ? JSON.parse(data.course.objectives)
            : data.course.objectives;
          if (Array.isArray(obj) && obj.length > 0) {
            setGeneratedObjectives(obj);
          }
        } catch (e) { /* ignore parse errors */ }
      }
      if (data.course.objectives_sources) {
        try {
          const src = typeof data.course.objectives_sources === 'string'
            ? JSON.parse(data.course.objectives_sources)
            : data.course.objectives_sources;
          if (Array.isArray(src) && src.length > 0) {
            setObjectivesSources(src);
          }
        } catch (e) { /* ignore parse errors */ }
      }
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
    } else {
      // For new courses, set initial state
      originalFormRef.current = JSON.stringify(courseForm);
    }
  }, [courseId, loadCourse]);

  // Detect form changes
  useEffect(() => {
    if (originalFormRef.current) {
      const currentFormString = JSON.stringify(courseForm);
      setHasUnsavedChanges(currentFormString !== originalFormRef.current);
    }
  }, [courseForm]);

  // Redirect non-instructors (disabled in dev mode for testing)
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate('/login');
      return;
    }
    // Role-based access control: Only instructor/admin can create/edit courses
    const isAdmin = user?.role === 'instructor' || user?.role === 'instructor_admin';
    if (!authLoading && user && !isAdmin) {
      toast.error('Solo los instructores pueden crear cursos');
      navigate('/dashboard');
    }
  }, [authLoading, isAuthenticated, user, navigate]);

  // Save course details
  const saveCourse = async (overrideVersion = null) => {
    // Clear field errors on submit attempt
    setFieldErrors({ title: '' });

    if (!courseForm.title.trim()) {
      setFieldErrors({ title: 'El titulo es obligatorio' });
      toast.error('El titulo es obligatorio');
      return null;
    }

    setIsSaving(true);
    try {
      const url = course
        ? `${API_BASE}/courses/${course.id}`
        : `${API_BASE}/courses`;

      // Include version for optimistic locking when updating
      // Always include objectives so they persist to DB
      const bodyData = course
        ? { ...courseForm, objectives: generatedObjectives, objectives_sources: objectivesSources, version: overrideVersion || courseVersion }
        : { ...courseForm, objectives: generatedObjectives, objectives_sources: objectivesSources };

      const response = await fetch(url, {
        method: course ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(bodyData)
      });

      // Handle 409 Conflict - could be concurrent edit OR unique constraint violation
      if (response.status === 409) {
        const conflictResponse = await response.json();

        // Feature #191: Handle unique constraint violation (field-level error)
        if (conflictResponse.field === 'title') {
          setFieldErrors({ title: conflictResponse.message });
          toast.error('Ya existe un curso con un titulo similar');
          return null;
        }

        // Handle concurrent edit conflict
        if (conflictResponse.conflict) {
          setConflictData(conflictResponse.conflict);
          setShowConflictModal(true);
          return null;
        }
      }


      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save course');
      }


      const data = await response.json();
      setCourse(data.course);
      setCourseVersion(data.course.updated_at); // Update version after save

      // Reset unsaved changes tracking after successful save
      originalFormRef.current = JSON.stringify(courseForm);
      setHasUnsavedChanges(false);

      toast.success(course ? 'Curso actualizado' : 'Curso creado');

      // If new course, clear draft and update URL
      if (!course && data.course?.id) {
        localStorage.removeItem('course_draft_new');
        setDraftRestored(false);
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

  // Generate content with AI
  const handleGenerateContent = async (lesson, module) => {
    if (generatingContentForLesson) {
      toast.error('Ya hay una generacion en progreso');
      return;
    }

    setGeneratingContentForLesson(lesson.id);
    toast.loading('Generando contenido con IA...', { id: 'ai-content' });

    try {
      const response = await csrfFetch(`${API_BASE}/ai/generate-lesson-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          lessonType: lesson.content_type || 'text',
          courseTitle: course?.title || 'Curso',
          moduleTitle: module?.title || 'Modulo',
          level: course?.level || 'Principiante'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to generate content');
      }

      const data = await response.json();
      toast.success('Contenido generado exitosamente!', { id: 'ai-content' });

      // Update lesson in local state with new content and has_content flag
      setModules(modules.map(m => {
        if (m.id === module.id) {
          return {
            ...m,
            lessons: m.lessons.map(l => {
              if (l.id === lesson.id) {
                return { ...l, content: data.content, has_content: true, content_length: (data.content || '').length };
              }
              return l;
            })
          };
        }
        return m;
      }));

      // Open content modal in viewer mode to show generated content
      setSelectedLessonId(lesson.id);
      setContentForm({ type: lesson.content_type || 'text', content: { text: data.content } });
      setContentViewMode(true);
      setLoadingContent(false);
      setShowContentModal(true);
    } catch (error) {
      console.error('Error generating content:', error);
      toast.error(error.message || 'Error al generar contenido', { id: 'ai-content' });
    } finally {
      setGeneratingContentForLesson(null);
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

      // Update has_content flag on the lesson
      setModules(prev => prev.map(m => ({
        ...m,
        lessons: m.lessons?.map(l =>
          l.id === selectedLessonId ? { ...l, has_content: true } : l
        )
      })));
      setContentForm({ type: 'text', content: { text: '' } });
      setShowContentModal(false);
      toast.success('Contenido agregado');
    } catch (error) {
      console.error('Error adding content:', error);
      toast.error('Error al agregar contenido');
    }
  };

  // Open content modal: load existing content if any
  const handleOpenContentModal = async (lessonId) => {
    setSelectedLessonId(lessonId);
    setLoadingContent(true);
    setContentViewMode(true);
    setContentForm({ type: 'text', content: { text: '' } });
    setShowContentModal(true);

    const module = modules.find(m => m.lessons?.some(l => l.id === lessonId));
    if (!module) {
      setLoadingContent(false);
      setContentViewMode(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/courses/${course.id}/modules/${module.id}/lessons/${lessonId}/content`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        if (data.content && data.content.length > 0) {
          // Combine all content blocks into a single text for viewing
          const combinedText = data.content
            .map(c => c.content?.text || JSON.stringify(c.content))
            .join('\n\n');
          setContentForm({
            type: data.content[0].type || 'text',
            content: { text: combinedText }
          });
          setContentViewMode(true);
        } else {
          // No content - go straight to edit mode
          setContentViewMode(false);
        }
      } else {
        setContentViewMode(false);
      }
    } catch (error) {
      console.error('Error loading lesson content:', error);
      setContentViewMode(false);
    } finally {
      setLoadingContent(false);
    }
  };

  // Generate objectives with AI
  const handleGenerateObjectives = async () => {
    if (!courseForm.title.trim()) {
      toast.error('Primero ingresa el titulo del curso');
      return;
    }

    setGeneratingObjectives(true);
    toast.loading('Generando objetivos con IA...', { id: 'ai-objectives' });

    try {
      const response = await csrfFetch(`${API_BASE}/ai/generate-course-objectives`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: courseForm.title,
          level: courseForm.level,
          targetAudience: courseForm.category
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al generar objetivos');
      }

      const data = await response.json();
      setGeneratedObjectives(data.objectives || []);
      setObjectivesSources(data.sources || []);

      toast.success(`${data.objectives?.length || 0} objetivos generados!`, { id: 'ai-objectives' });
    } catch (error) {
      console.error('Error generating objectives:', error);
      toast.error(error.message || 'Error al generar objetivos', { id: 'ai-objectives' });
    } finally {
      setGeneratingObjectives(false);
    }
  };

  // Generate description with AI
  const handleGenerateDescription = async () => {
    if (!courseForm.title.trim()) {
      toast.error('Primero ingresa el titulo del curso');
      return;
    }

    setGeneratingDescription(true);
    toast.loading('Generando descripcion con IA...', { id: 'ai-description' });

    try {
      const response = await csrfFetch(`${API_BASE}/ai/generate-course-description`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: courseForm.title,
          level: courseForm.level,
          targetAudience: courseForm.category,
          objectives: generatedObjectives.length > 0 ? generatedObjectives : undefined
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al generar descripcion');
      }

      const data = await response.json();

      // Update form with generated description
      setCourseForm(prev => ({
        ...prev,
        description: data.description || prev.description
      }));

      toast.success('Descripcion generada!', { id: 'ai-description' });
    } catch (error) {
      console.error('Error generating description:', error);
      toast.error(error.message || 'Error al generar descripcion', { id: 'ai-description' });
    } finally {
      setGeneratingDescription(false);
    }
  };

  // WebSocket: listen for batch content progress
  useEffect(() => {
    if (!batchId) return;

    ws.connect();

    const cleanupProgress = ws.onMessage('batch_content_progress', (data) => {
      if (data.batchId !== batchId) return;

      setBatchProgress({
        currentLesson: data.currentLesson,
        totalLessons: data.totalLessons,
        lessonTitle: data.lessonTitle,
        moduleTitle: data.moduleTitle,
        status: data.status
      });

      if (data.status === 'completed' || data.status === 'failed') {
        setBatchLessonStatuses(prev => ({
          ...prev,
          [data.lessonId]: {
            status: data.status,
            contentLength: data.contentLength || 0,
            error: data.error || null,
            title: data.lessonTitle,
            moduleTitle: data.moduleTitle
          }
        }));
      }
    });

    const cleanupComplete = ws.onMessage('batch_content_complete', (data) => {
      if (data.batchId !== batchId) return;

      setBatchComplete(true);
      setBatchGenerating(false);
      setBatchSummary({
        completed: data.completed,
        failed: data.failed,
        total: data.total,
        cancelled: data.cancelled
      });

      if (data.completed > 0) {
        toast.success(`Contenido generado para ${data.completed} lecciones`);
        loadCourse(); // Reload to see content
      }
    });

    return () => {
      cleanupProgress();
      cleanupComplete();
    };
  }, [batchId, ws]);

  // Start batch content generation for all lessons
  const handleBatchGenerateContent = async () => {
    if (!course?.id) return;
    if (batchGenerating) {
      toast.error('Ya hay una generacion en progreso');
      return;
    }

    // Count total lessons
    const totalLessons = modules.reduce((sum, m) => sum + (m.lessons?.length || 0), 0);
    if (totalLessons === 0) {
      toast.error('No hay lecciones en el curso');
      return;
    }

    setBatchGenerating(true);
    setBatchComplete(false);
    setBatchSummary(null);
    setBatchLessonStatuses({});
    setBatchProgress(null);

    try {
      const response = await fetch(`${API_BASE}/ai/batch-generate-course-content/${course.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al iniciar generacion');
      }

      const data = await response.json();
      setBatchId(data.batchId);
      toast.success(`Generando contenido para ${data.totalLessons} lecciones...`);
    } catch (error) {
      console.error('Error starting batch generation:', error);
      toast.error(error.message || 'Error al iniciar generacion');
      setBatchGenerating(false);
    }
  };

  // Cancel batch generation
  const handleCancelBatch = async () => {
    if (!batchId) return;

    try {
      await fetch(`${API_BASE}/ai/batch-cancel/${batchId}`, {
        method: 'POST',
        credentials: 'include'
      });
      toast('Cancelando generacion...', { icon: '\u26A0\uFE0F' });
    } catch (error) {
      console.error('Error cancelling batch:', error);
    }
  };

  // Dismiss batch progress bar
  const handleDismissBatchProgress = () => {
    setBatchId(null);
    setBatchGenerating(false);
    setBatchComplete(false);
    setBatchSummary(null);
    setBatchLessonStatuses({});
    setBatchProgress(null);
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
      const response = await csrfFetch(`${API_BASE}/courses/${course.id}/publish`, {
        method: 'POST'
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

  // Unpublish course
  const handleUnpublish = async () => {
    if (!course?.id) return;

    if (!window.confirm('¿Estás seguro de que quieres despublicar este curso? Los estudiantes no podrán verlo en el catálogo.')) {
      return;
    }

    try {
      const response = await csrfFetch(`${API_BASE}/courses/${course.id}/unpublish`, {
        method: 'POST'
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to unpublish course');
      }

      const data = await response.json();
      setCourse(data.course);
      toast.success('Curso despublicado. Ahora está en modo borrador.');
    } catch (error) {
      console.error('Error unpublishing course:', error);
      toast.error(error.message || 'Error al despublicar el curso');
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
              {!course.is_published ? (
                <button
                  onClick={handlePublish}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  Publicar Curso
                </button>
              ) : (
                <button
                  onClick={handleUnpublish}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                >
                  Despublicar
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
            {/* Draft restored banner */}
            {draftRestored && !course && (
              <div className="mb-6 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <div className="flex items-center gap-3">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm text-blue-700 dark:text-blue-300">
                    Se restauro un borrador guardado anteriormente.
                  </span>
                </div>
                <button
                  onClick={() => {
                    localStorage.removeItem('course_draft_new');
                    setCourseForm({
                      title: '',
                      description: '',
                      category: 'Programacion',
                      level: 'Principiante',
                      is_premium: false,
                      duration_hours: 0
                    });
                    setGeneratedObjectives([]);
                    setDraftRestored(false);
                    originalFormRef.current = JSON.stringify({
                      title: '',
                      description: '',
                      category: 'Programacion',
                      level: 'Principiante',
                      is_premium: false,
                      duration_hours: 0
                    });
                    setHasUnsavedChanges(false);
                  }}
                  className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                >
                  Descartar
                </button>
              </div>
            )}

            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              Informacion del Curso
            </h2>

            <div className="space-y-6">
              {/* Title */}
              <div>
                <label htmlFor="course-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Titulo del Curso *
                </label>
                <input
                  type="text"
                  id="course-title"
                  value={courseForm.title}
                  onChange={(e) => {
                    setCourseForm({ ...courseForm, title: e.target.value });
                    // Clear error when user starts typing (Feature #191)
                    if (fieldErrors.title) {
                      setFieldErrors({ ...fieldErrors, title: '' });
                    }
                  }}
                  className={`w-full px-4 py-2 border rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent ${
                    fieldErrors.title
                      ? 'border-red-500 dark:border-red-500'
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  placeholder="Ej: Python desde Cero"
                  aria-invalid={!!fieldErrors.title}
                  aria-describedby={fieldErrors.title ? 'title-error' : undefined}
                />
                {fieldErrors.title && (
                  <p id="title-error" className="mt-2 text-sm text-red-600 dark:text-red-400 flex items-start gap-1">
                    <span className="flex-shrink-0">⚠</span>
                    <span>{fieldErrors.title}</span>
                  </p>
                )}
              </div>

              {/* Description */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label htmlFor="course-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Descripcion
                  </label>
                  <button
                    type="button"
                    onClick={handleGenerateDescription}
                    disabled={generatingDescription || !courseForm.title.trim()}
                    className="flex items-center gap-1.5 px-3 py-1 text-sm bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingDescription ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        <span>Generando...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Generar con IA</span>
                      </>
                    )}
                  </button>
                </div>
                <textarea
                  id="course-description"
                  value={courseForm.description}
                  onChange={(e) => setCourseForm({ ...courseForm, description: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Describe tu curso..."
                />
              </div>

              {/* AI Learning Objectives Section */}
              <div className="border border-purple-200 dark:border-purple-800 rounded-lg p-4 bg-purple-50 dark:bg-purple-900/20">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    <h3 className="font-medium text-purple-800 dark:text-purple-300">Objetivos de Aprendizaje (IA)</h3>
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateObjectives}
                    disabled={generatingObjectives || !courseForm.title.trim()}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {generatingObjectives ? (
                      <>
                        <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                        </svg>
                        <span>Generando...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Generar Objetivos</span>
                      </>
                    )}
                  </button>
                </div>

                {generatedObjectives.length > 0 ? (
                  <div className="space-y-2">
                    <ul className="space-y-2">
                      {generatedObjectives.map((objective, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                          <span className="text-purple-600 dark:text-purple-400 font-medium mt-0.5">{index + 1}.</span>
                          <span>{objective}</span>
                        </li>
                      ))}
                    </ul>
                    {objectivesSources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-purple-200 dark:border-purple-700">
                        <p className="text-xs text-purple-600 dark:text-purple-400 flex items-center gap-1">
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                          </svg>
                          Fuentes: {objectivesSources.map(s => s.book).join(', ')}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-purple-600 dark:text-purple-400">
                    Genera objetivos de aprendizaje automaticamente usando IA y la base de conocimiento de 128 libros de Data Science.
                  </p>
                )}
              </div>

              {/* Category & Level */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="course-category" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Categoria
                  </label>
                  <select
                    id="course-category"
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
                  <label htmlFor="course-level" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nivel
                  </label>
                  <select
                    id="course-level"
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
                      id="course-premium"
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
                  <label htmlFor="course-duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Duracion estimada (horas)
                  </label>
                  <input
                    type="number"
                    id="course-duration"
                    min="0"
                    step="0.5"
                    value={courseForm.duration_hours}
                    onChange={(e) => setCourseForm({ ...courseForm, duration_hours: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                {/* Autosave status indicator */}
                {autosaveStatus && (
                  <span className={`text-sm ${
                    autosaveStatus === 'saving' ? 'text-gray-500 dark:text-gray-400' :
                    autosaveStatus === 'saved' ? 'text-green-600 dark:text-green-400' :
                    'text-red-600 dark:text-red-400'
                  }`}>
                    {autosaveStatus === 'saving' && 'Guardando...'}
                    {autosaveStatus === 'saved' && 'Guardado automaticamente'}
                    {autosaveStatus === 'error' && 'Error al guardar'}
                  </span>
                )}
                <button
                  onClick={() => saveCourse()}
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
                {modules.length > 0 && modules.some(m => m.lessons?.length > 0) && (
                  <button
                    onClick={handleBatchGenerateContent}
                    disabled={batchGenerating}
                    className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {batchGenerating ? (
                      <>
                        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>Generando...</span>
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Generar Todo el Contenido</span>
                      </>
                    )}
                  </button>
                )}
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

            {/* Batch Content Generation Progress */}
            {batchId && (
              <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {!batchComplete && (
                      <svg className="w-5 h-5 animate-spin text-primary-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                    )}
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {batchComplete
                        ? (batchSummary?.cancelled ? 'Generacion Cancelada' : 'Generacion Completada')
                        : 'Generando Contenido del Curso'}
                    </h3>
                    {batchProgress && !batchComplete && (
                      <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
                        [{batchProgress.currentLesson}/{batchProgress.totalLessons}]
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {!batchComplete && (
                      <button
                        onClick={handleCancelBatch}
                        className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                      >
                        Cancelar
                      </button>
                    )}
                    {batchComplete && (
                      <button
                        onClick={handleDismissBatchProgress}
                        className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                      >
                        Cerrar
                      </button>
                    )}
                  </div>
                </div>

                {/* Progress bar */}
                {batchProgress && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full transition-all duration-500 ${
                        batchComplete
                          ? (batchSummary?.failed > 0 ? 'bg-yellow-500' : 'bg-green-500')
                          : 'bg-gradient-to-r from-green-500 to-blue-500'
                      }`}
                      style={{ width: `${Math.round((Object.keys(batchLessonStatuses).length / batchProgress.totalLessons) * 100)}%` }}
                    />
                  </div>
                )}

                {/* Current lesson */}
                {batchProgress && !batchComplete && batchProgress.status === 'generating' && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Generando: <strong>{batchProgress.lessonTitle}</strong>
                    <span className="text-gray-400 ml-1">({batchProgress.moduleTitle})</span>
                  </p>
                )}

                {/* Summary */}
                {batchComplete && batchSummary && (
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    <span className="text-green-600 font-medium">{batchSummary.completed} completadas</span>
                    {batchSummary.failed > 0 && (
                      <span className="text-red-600 font-medium ml-2">{batchSummary.failed} con error</span>
                    )}
                    <span className="ml-2">de {batchSummary.total} lecciones</span>
                  </p>
                )}

                {/* Completed lessons detail (collapsible) */}
                {Object.keys(batchLessonStatuses).length > 0 && (
                  <details className="text-sm">
                    <summary className="text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300">
                      Ver detalle ({Object.keys(batchLessonStatuses).length} procesadas)
                    </summary>
                    <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                      {Object.entries(batchLessonStatuses).map(([lessonId, info]) => (
                        <div key={lessonId} className="flex items-center justify-between py-1 px-2 rounded bg-gray-50 dark:bg-gray-900">
                          <div className="flex items-center gap-1.5">
                            {info.status === 'completed' ? (
                              <span className="text-green-600">&#10003;</span>
                            ) : (
                              <span className="text-red-600">&#10007;</span>
                            )}
                            <span className="text-gray-700 dark:text-gray-300 truncate">{info.title}</span>
                          </div>
                          <span className="text-xs text-gray-400 flex-shrink-0 ml-2">
                            {info.status === 'completed' ? `${(info.contentLength / 1000).toFixed(1)}k` : 'Error'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

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
                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                  <span className="text-sm text-gray-400 flex-shrink-0">
                                    {index + 1}.{lessonIndex + 1}
                                  </span>
                                  <div className="min-w-0">
                                    <p
                                      className="font-medium text-gray-900 dark:text-white truncate"
                                      title={lesson.title}
                                    >
                                      {lesson.title}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {lesson.content_type} &bull; {lesson.duration_minutes} min
                                      </p>
                                      {lesson.has_content && (
                                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 rounded">
                                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                          </svg>
                                          Contenido
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleOpenContentModal(lesson.id)}
                                    className="p-1.5 text-gray-400 hover:text-green-600 transition-colors"
                                    title={lesson.has_content ? "Ver contenido" : "Agregar contenido"}
                                    aria-label={lesson.has_content ? `Ver contenido de ${lesson.title}` : `Agregar contenido a ${lesson.title}`}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleGenerateContent(lesson, module)}
                                    disabled={generatingContentForLesson === lesson.id}
                                    className={`p-1.5 transition-colors ${
                                      generatingContentForLesson === lesson.id
                                        ? 'text-yellow-500 animate-pulse'
                                        : 'text-gray-400 hover:text-yellow-600'
                                    }`}
                                    title={generatingContentForLesson === lesson.id ? 'Generando...' : 'Generar contenido con IA'}
                                    aria-label={`Generar contenido con IA para ${lesson.title}`}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
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
                                    aria-label={`Generar Quiz con IA para ${lesson.title}`}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setQuizImportLessonId(lesson.id);
                                      setQuizImportLessonTitle(lesson.title);
                                      setShowQuizImportModal(true);
                                    }}
                                    className="p-1.5 text-gray-400 hover:text-teal-600 transition-colors"
                                    title="Importar Quiz desde CSV"
                                    aria-label={`Importar Quiz desde CSV para ${lesson.title}`}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
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
                                    title="Editar leccion"
                                    aria-label={`Editar leccion ${lesson.title}`}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                    </svg>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteLesson(module.id, lesson.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                    title="Eliminar leccion"
                                    aria-label={`Eliminar leccion ${lesson.title}`}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
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
            {/* Quick navigation back to edit tabs */}
            <div className="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
              <span className="text-sm text-gray-500 dark:text-gray-400">Editar:</span>
              <button
                onClick={() => setActiveTab(TABS.DETAILS)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Editar Detalles
              </button>
              <button
                onClick={() => setActiveTab(TABS.MODULES)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-800 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                Editar Modulos
              </button>
            </div>

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
                  {!course.is_published ? (
                    <button
                      onClick={handlePublish}
                      className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      Publicar Curso
                    </button>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Link
                        to={`/course/${course.slug}`}
                        className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                      >
                        Ver en Catalogo
                      </Link>
                      <button
                        onClick={handleUnpublish}
                        className="px-6 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                      >
                        Despublicar
                      </button>
                    </div>
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
                <label htmlFor="module-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Titulo *
                </label>
                <input
                  type="text"
                  id="module-title"
                  value={moduleForm.title}
                  onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="Ej: Introduccion a Python"
                />
              </div>
              <div>
                <label htmlFor="module-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descripcion
                </label>
                <textarea
                  id="module-description"
                  value={moduleForm.description}
                  onChange={(e) => setModuleForm({ ...moduleForm, description: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div>
                <label htmlFor="module-bloom" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Objetivo de Bloom
                </label>
                <select
                  id="module-bloom"
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
                <label htmlFor="lesson-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Titulo *
                </label>
                <input
                  type="text"
                  id="lesson-title"
                  value={lessonForm.title}
                  onChange={(e) => setLessonForm({ ...lessonForm, title: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="Ej: Variables y tipos de datos"
                />
              </div>
              <div>
                <label htmlFor="lesson-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Descripcion
                </label>
                <textarea
                  id="lesson-description"
                  value={lessonForm.description}
                  onChange={(e) => setLessonForm({ ...lessonForm, description: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="lesson-content-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Tipo de contenido
                  </label>
                  <select
                    id="lesson-content-type"
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
                  <label htmlFor="lesson-duration" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Duracion (min)
                  </label>
                  <input
                    type="number"
                    id="lesson-duration"
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

      {/* Content Modal (viewer + editor) */}
      {showContentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {contentViewMode && contentForm.content.text ? 'Contenido de la Leccion' : 'Agregar Contenido'}
              </h3>
              {contentViewMode && contentForm.content.text && (
                <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 rounded">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {contentForm.content.text.length > 1000
                    ? `${(contentForm.content.text.length / 1000).toFixed(1)}K caracteres`
                    : `${contentForm.content.text.length} caracteres`}
                </span>
              )}
            </div>

            {loadingContent ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : contentViewMode && contentForm.content.text ? (
              /* Viewer mode */
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="flex-1 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-white dark:bg-gray-900">
                  <LessonContentRenderer
                    content={contentForm.content.text}
                    interactive={false}
                  />
                </div>
                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowContentModal(false)}
                    className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
                  >
                    Cerrar
                  </button>
                  <button
                    onClick={() => setContentViewMode(false)}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 inline-flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Editar
                  </button>
                </div>
              </div>
            ) : (
              /* Editor mode */
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="space-y-4 flex-1 flex flex-col">
                  <div>
                    <label htmlFor="content-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tipo
                    </label>
                    <select
                      id="content-type"
                      value={contentForm.type}
                      onChange={(e) => setContentForm({ ...contentForm, type: e.target.value, content: { text: '' } })}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    >
                      <option value="text">Texto</option>
                      <option value="video">Video URL</option>
                      <option value="code">Codigo</option>
                    </select>
                  </div>
                  <div className="flex-1 flex flex-col">
                    <label htmlFor="content-text" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Contenido
                    </label>
                    <textarea
                      id="content-text"
                      value={contentForm.content.text || ''}
                      onChange={(e) => setContentForm({ ...contentForm, content: { text: e.target.value } })}
                      rows={12}
                      className="w-full flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 font-mono"
                      placeholder={
                        contentForm.type === 'video' ? 'URL del video...' :
                        contentForm.type === 'code' ? '# Tu codigo aqui...' :
                        'Escribe el contenido...'
                      }
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
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
            )}
          </div>
        </div>
      )}

      
      {/* Conflict Resolution Modal */}
      {showConflictModal && conflictData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 w-full max-w-lg mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Conflicto de Edicion
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Otro usuario modifico este curso mientras lo editabas
                </p>
              </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-4">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Datos actuales en el servidor:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                <li><strong>Titulo:</strong> {conflictData.currentData?.title}</li>
                <li><strong>Categoria:</strong> {conflictData.currentData?.category}</li>
                <li><strong>Nivel:</strong> {conflictData.currentData?.level}</li>
              </ul>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Puedes sobrescribir con tus cambios o recargar para ver los cambios del otro usuario.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowConflictModal(false);
                  setConflictData(null);
                  loadCourse();
                }}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg"
              >
                Recargar Datos
              </button>
              <button
                onClick={async () => {
                  const newVersion = conflictData.currentVersion;
                  setShowConflictModal(false);
                  setConflictData(null);
                  setCourseVersion(newVersion);
                  // Pass version directly to avoid React state timing issues
                  saveCourse(newVersion);
                }}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
              >
                Sobrescribir
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
        courseTitle={courseForm.title}
        courseDescription={courseForm.description}
        courseLevel={courseForm.level}
        courseCategory={courseForm.category}
        courseObjectives={generatedObjectives}
        onStructureApplied={(result) => {
          if (result?.reload) {
            // Coming from step 3 (content generation) - just reload
            loadCourse();
          } else if (result?.totalModules !== undefined) {
            toast.success(`Estructura aplicada: ${result.totalModules} modulos y ${result.totalLessons} lecciones creadas`);
            loadCourse();
          } else {
            loadCourse();
          }
          setShowAICourseModal(false);
        }}
      />

      {/* Unsaved Changes Warning Modal */}
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
        message={unsavedMessage}
      />

      {/* Quiz Import Modal */}
      <QuizImportModal
        isOpen={showQuizImportModal}
        onClose={() => {
          setShowQuizImportModal(false);
          setQuizImportLessonId(null);
          setQuizImportLessonTitle('');
        }}
        lessonId={quizImportLessonId}
        lessonTitle={quizImportLessonTitle}
        onQuizImported={(quizId) => {
          toast.success(`Quiz #${quizId} importado con exito`);
        }}
      />
    </div>
  );
}
