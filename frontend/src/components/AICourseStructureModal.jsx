import { useState } from 'react';
import toast from 'react-hot-toast';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

/**
 * AICourseStructureModal - Modal for generating course structure using AI
 *
 * Steps:
 * 1. User provides topic and learning goals
 * 2. AI generates course structure with modules and lessons
 * 3. User reviews and modifies suggestions
 * 4. User saves AI-generated structure to course
 */
export default function AICourseStructureModal({ isOpen, onClose, courseId, onStructureApplied }) {
  const [step, setStep] = useState(1); // 1: input, 2: review
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);

  // Input state
  const [topic, setTopic] = useState('');
  const [goals, setGoals] = useState('');
  const [level, setLevel] = useState('Principiante');
  const [targetAudience, setTargetAudience] = useState('');

  // Generated structure state
  const [generatedStructure, setGeneratedStructure] = useState(null);
  const [editingModuleIndex, setEditingModuleIndex] = useState(null);
  const [ragSources, setRagSources] = useState([]);
  const [generationMetadata, setGenerationMetadata] = useState(null);

  const handleGenerate = async () => {
    if (!topic.trim()) {
      toast.error('El tema del curso es obligatorio');
      return;
    }

    if (!goals.trim()) {
      toast.error('Los objetivos de aprendizaje son obligatorios');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(`${API_BASE}/api/ai/generate-course-structure`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          topic,
          goals,
          level,
          targetAudience
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al generar estructura');
      }

      const data = await response.json();
      setGeneratedStructure(data.structure);
      setRagSources(data.sources || []);
      setGenerationMetadata(data.metadata || null);
      setStep(2);

      const sourcesMsg = data.sources?.length > 0 ? ` usando ${data.sources.length} fuentes` : '';
      toast.success(`Se generaron ${data.structure.modules.length} modulos${sourcesMsg}`);
    } catch (error) {
      console.error('Error generating structure:', error);
      toast.error(error.message || 'Error al generar la estructura');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditModule = (index) => {
    setEditingModuleIndex(index);
  };

  const handleSaveModuleEdit = (index, updatedModule) => {
    const updated = { ...generatedStructure };
    updated.modules[index] = updatedModule;
    setGeneratedStructure(updated);
    setEditingModuleIndex(null);
    toast.success('Modulo actualizado');
  };

  const handleDeleteModule = (index) => {
    if (generatedStructure.modules.length <= 1) {
      toast.error('El curso debe tener al menos un modulo');
      return;
    }
    const updated = { ...generatedStructure };
    updated.modules = updated.modules.filter((_, i) => i !== index);
    setGeneratedStructure(updated);
    toast.success('Modulo eliminado');
  };

  const handleApplyStructure = async () => {
    if (!generatedStructure || generatedStructure.modules.length === 0) {
      toast.error('No hay estructura para aplicar');
      return;
    }

    setIsApplying(true);
    try {
      const response = await fetch(`${API_BASE}/api/ai/apply-course-structure/${courseId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          modules: generatedStructure.modules
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al aplicar estructura');
      }

      const data = await response.json();
      toast.success(data.message || 'Estructura aplicada exitosamente');

      if (onStructureApplied) {
        onStructureApplied(data.modules);
      }

      handleClose();
    } catch (error) {
      console.error('Error applying structure:', error);
      toast.error(error.message || 'Error al aplicar la estructura');
    } finally {
      setIsApplying(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setTopic('');
    setGoals('');
    setLevel('Principiante');
    setTargetAudience('');
    setGeneratedStructure(null);
    setEditingModuleIndex(null);
    setRagSources([]);
    setGenerationMetadata(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Generar Estructura con IA
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {step === 1 && 'Paso 1: Proporciona tema y objetivos'}
                {step === 2 && 'Paso 2: Revisa y modifica la estructura'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Cerrar modal"
            title="Cerrar"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Input */}
          {step === 1 && (
            <div className="space-y-6">
              {/* Topic */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tema del Curso *
                </label>
                <input
                  type="text"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="Ej: Python para principiantes, Machine Learning, Desarrollo Web..."
                />
              </div>

              {/* Goals */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Objetivos de Aprendizaje *
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Describe que deberian aprender los estudiantes al completar el curso
                </p>
                <textarea
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="Ej: Dominar las bases de Python, crear funciones, trabajar con estructuras de datos, desarrollar un proyecto practico..."
                />
              </div>

              {/* Level and Audience */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nivel
                  </label>
                  <select
                    value={level}
                    onChange={(e) => setLevel(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="Principiante">Principiante</option>
                    <option value="Intermedio">Intermedio</option>
                    <option value="Avanzado">Avanzado</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Audiencia (opcional)
                  </label>
                  <input
                    type="text"
                    value={targetAudience}
                    onChange={(e) => setTargetAudience(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                    placeholder="Ej: Estudiantes universitarios, profesionales..."
                  />
                </div>
              </div>

              {/* Quick Topics */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  O selecciona un tema popular
                </label>
                <div className="flex flex-wrap gap-2">
                  {['Python', 'JavaScript', 'Data Science', 'Machine Learning', 'SQL', 'React', 'Node.js'].map((t) => (
                    <button
                      key={t}
                      onClick={() => setTopic(t)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                        topic === t
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Review and Edit */}
          {step === 2 && generatedStructure && (
            <div className="space-y-6">
              {/* Suggested Info */}
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4 border border-green-200 dark:border-green-800">
                <div className="flex items-start gap-3">
                  <svg className="w-6 h-6 text-green-600 dark:text-green-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <h3 className="font-medium text-green-800 dark:text-green-300">
                      {generatedStructure.suggestedTitle}
                    </h3>
                    <p className="text-sm text-green-700 dark:text-green-400 mt-1">
                      {generatedStructure.suggestedDescription}
                    </p>
                    <div className="flex flex-wrap items-center gap-4 mt-2 text-sm text-green-600 dark:text-green-500">
                      <span>📚 {generatedStructure.modules.length} modulos</span>
                      <span>⏱️ ~{generatedStructure.estimatedDurationHours} horas</span>
                      <span>🎯 {generatedStructure.level}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* RAG Sources Info */}
              {ragSources.length > 0 && (
                <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300">
                      Generado con IA + RAG
                    </span>
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400">
                    Fuentes consultadas: {ragSources.map(s => s.book).filter((v, i, a) => a.indexOf(v) === i).slice(0, 3).join(', ')}
                    {ragSources.length > 3 && ` y ${ragSources.length - 3} más`}
                  </p>
                  {generationMetadata?.provider && (
                    <p className="text-xs text-purple-500 dark:text-purple-500 mt-1">
                      Modelo: {generationMetadata.provider === 'local' ? 'DGX Spark (Qwen3-14B)' : 'Claude'}
                    </p>
                  )}
                </div>
              )}

              {/* Learning Objectives */}
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                  Objetivos de Aprendizaje
                </h3>
                <ul className="space-y-2">
                  {generatedStructure.learningObjectives.map((obj, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <span className="text-primary-600">•</span>
                      {obj}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Modules List */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <span>Modulos del Curso</span>
                  <span className="px-2 py-0.5 bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 rounded-full text-sm">
                    {generatedStructure.modules.length}
                  </span>
                </h3>

                {generatedStructure.modules.map((module, moduleIndex) => (
                  <div
                    key={moduleIndex}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden"
                  >
                    {editingModuleIndex === moduleIndex ? (
                      <ModuleEditor
                        module={module}
                        onSave={(updated) => handleSaveModuleEdit(moduleIndex, updated)}
                        onCancel={() => setEditingModuleIndex(null)}
                      />
                    ) : (
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-8 h-8 bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 rounded-full flex items-center justify-center text-sm font-medium">
                                {moduleIndex + 1}
                              </span>
                              <h4 className="font-medium text-gray-900 dark:text-white">
                                {module.title}
                              </h4>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-3 ml-10">
                              {module.description}
                            </p>

                            {/* Lessons */}
                            <div className="ml-10 space-y-1">
                              {module.lessons.map((lesson, lessonIndex) => (
                                <div
                                  key={lessonIndex}
                                  className="text-sm py-2 px-3 bg-gray-50 dark:bg-gray-700 rounded space-y-2"
                                >
                                  <div className="flex items-center justify-between">
                                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                                      {lessonIndex + 1}. {lesson.title}
                                    </span>
                                    <span className="text-gray-500 dark:text-gray-400">
                                      {lesson.duration_minutes} min
                                    </span>
                                  </div>
                                  {/* 4C Pedagogical Structure */}
                                  {lesson.structure_4c && (
                                    <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-600">
                                      <div className="text-xs font-medium text-primary-600 dark:text-primary-400 mb-1">
                                        Estructura 4C:
                                      </div>
                                      <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="flex items-start gap-1">
                                          <span className="text-blue-600 dark:text-blue-400">🔗</span>
                                          <span className="text-gray-600 dark:text-gray-400">Conexiones</span>
                                        </div>
                                        <div className="flex items-start gap-1">
                                          <span className="text-green-600 dark:text-green-400">💡</span>
                                          <span className="text-gray-600 dark:text-gray-400">Conceptos</span>
                                        </div>
                                        <div className="flex items-start gap-1">
                                          <span className="text-orange-600 dark:text-orange-400">🛠️</span>
                                          <span className="text-gray-600 dark:text-gray-400">Practica</span>
                                        </div>
                                        <div className="flex items-start gap-1">
                                          <span className="text-purple-600 dark:text-purple-400">🎯</span>
                                          <span className="text-gray-600 dark:text-gray-400">Conclusion</span>
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditModule(moduleIndex)}
                              className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                              title="Editar"
                              aria-label="Editar modulo"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteModule(moduleIndex)}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                              title="Eliminar"
                              aria-label="Eliminar modulo"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900">
          {step === 1 && (
            <>
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating || !topic.trim() || !goals.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGenerating ? (
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
                    <span>Generar Estructura</span>
                  </>
                )}
              </button>
            </>
          )}

          {step === 2 && (
            <>
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Volver
              </button>
              <button
                onClick={handleApplyStructure}
                disabled={isApplying}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isApplying ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Aplicando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Aplicar Estructura</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * ModuleEditor - Inline editor for a module
 */
function ModuleEditor({ module, onSave, onCancel }) {
  const [editedModule, setEditedModule] = useState({ ...module });

  const handleLessonChange = (index, field, value) => {
    const newLessons = [...editedModule.lessons];
    newLessons[index] = { ...newLessons[index], [field]: value };
    setEditedModule({ ...editedModule, lessons: newLessons });
  };

  const handleAddLesson = () => {
    setEditedModule({
      ...editedModule,
      lessons: [...editedModule.lessons, { title: 'Nueva leccion', duration_minutes: 20 }]
    });
  };

  const handleDeleteLesson = (index) => {
    if (editedModule.lessons.length <= 1) {
      toast.error('El modulo debe tener al menos una leccion');
      return;
    }
    const newLessons = editedModule.lessons.filter((_, i) => i !== index);
    setEditedModule({ ...editedModule, lessons: newLessons });
  };

  return (
    <div className="p-4 bg-blue-50 dark:bg-blue-900/20">
      <div className="space-y-4">
        {/* Module title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Titulo del Modulo
          </label>
          <input
            type="text"
            value={editedModule.title}
            onChange={(e) => setEditedModule({ ...editedModule, title: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Descripcion
          </label>
          <textarea
            value={editedModule.description}
            onChange={(e) => setEditedModule({ ...editedModule, description: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>

        {/* Lessons */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Lecciones
            </label>
            <button
              onClick={handleAddLesson}
              className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Agregar
            </button>
          </div>
          <div className="space-y-2">
            {editedModule.lessons.map((lesson, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={lesson.title}
                  onChange={(e) => handleLessonChange(index, 'title', e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  placeholder="Titulo de la leccion"
                />
                <input
                  type="number"
                  value={lesson.duration_minutes}
                  onChange={(e) => handleLessonChange(index, 'duration_minutes', parseInt(e.target.value) || 15)}
                  className="w-20 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm text-center"
                  min="5"
                  max="120"
                />
                <span className="text-sm text-gray-500">min</span>
                <button
                  onClick={() => handleDeleteLesson(index)}
                  className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            Cancelar
          </button>
          <button
            onClick={() => onSave(editedModule)}
            className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
