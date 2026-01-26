import { useState } from 'react';
import toast from 'react-hot-toast';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:4000/api').replace(/\/api$/, '');

/**
 * AIQuizGeneratorModal - Modal for generating quizzes using AI
 *
 * Steps:
 * 1. User provides source content or selects a topic
 * 2. AI generates quiz questions
 * 3. User reviews and edits questions as needed
 * 4. User saves quiz to lesson
 */
export default function AIQuizGeneratorModal({ isOpen, onClose, lessonId, lessonTitle, onQuizSaved }) {
  const [step, setStep] = useState(1); // 1: input, 2: review, 3: preview
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Input state
  const [sourceContent, setSourceContent] = useState('');
  const [selectedTopic, setSelectedTopic] = useState('');
  const [customTopic, setCustomTopic] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState('medium');

  // Generated quiz state
  const [generatedQuiz, setGeneratedQuiz] = useState(null);
  const [generatedQuestions, setGeneratedQuestions] = useState([]);
  const [editingQuestionIndex, setEditingQuestionIndex] = useState(null);

  // Topics list
  const topics = [
    { id: 'python-basics', name: 'Python Basico' },
    { id: 'python-functions', name: 'Funciones en Python' },
    { id: 'python-oop', name: 'Programacion Orientada a Objetos' },
    { id: 'python-data-structures', name: 'Estructuras de Datos' },
    { id: 'sql-basics', name: 'SQL Basico' },
    { id: 'sql-joins', name: 'JOINs en SQL' },
    { id: 'pandas-basics', name: 'Pandas y DataFrames' },
    { id: 'machine-learning-intro', name: 'Introduccion a ML' }
  ];

  const handleGenerate = async () => {
    if (!sourceContent && !selectedTopic && !customTopic) {
      toast.error('Proporciona contenido fuente o selecciona un tema');
      return;
    }

    setIsGenerating(true);
    try {
      const response = await fetch(`${API_BASE}/api/ai/generate-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          sourceContent,
          topic: customTopic || selectedTopic,
          questionCount,
          difficulty,
          lessonId
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al generar quiz');
      }

      const data = await response.json();
      setGeneratedQuiz(data.quiz);
      setGeneratedQuestions(data.questions);
      setStep(2);
      toast.success(`Se generaron ${data.questions.length} preguntas`);
    } catch (error) {
      console.error('Error generating quiz:', error);
      toast.error(error.message || 'Error al generar el quiz');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleEditQuestion = (index) => {
    setEditingQuestionIndex(index);
  };

  const handleSaveQuestionEdit = (index, updatedQuestion) => {
    const updated = [...generatedQuestions];
    updated[index] = updatedQuestion;
    setGeneratedQuestions(updated);
    setEditingQuestionIndex(null);
    toast.success('Pregunta actualizada');
  };

  const handleDeleteQuestion = (index) => {
    if (generatedQuestions.length <= 1) {
      toast.error('El quiz debe tener al menos una pregunta');
      return;
    }
    const updated = generatedQuestions.filter((_, i) => i !== index);
    setGeneratedQuestions(updated);
    toast.success('Pregunta eliminada');
  };

  const handleSaveQuiz = async () => {
    if (generatedQuestions.length === 0) {
      toast.error('El quiz debe tener al menos una pregunta');
      return;
    }

    setIsSaving(true);
    try {
      const response = await fetch(`${API_BASE}/api/ai/save-generated-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          lessonId,
          quiz: generatedQuiz,
          questions: generatedQuestions
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al guardar quiz');
      }

      const data = await response.json();
      toast.success('Quiz guardado exitosamente');

      if (onQuizSaved) {
        onQuizSaved(data.quizId);
      }

      handleClose();
    } catch (error) {
      console.error('Error saving quiz:', error);
      toast.error(error.message || 'Error al guardar el quiz');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setSourceContent('');
    setSelectedTopic('');
    setCustomTopic('');
    setQuestionCount(5);
    setDifficulty('medium');
    setGeneratedQuiz(null);
    setGeneratedQuestions([]);
    setEditingQuestionIndex(null);
    onClose();
  };

  const handlePreviewAsStudent = () => {
    setStep(3);
  };

  const handleBackToEdit = () => {
    setStep(2);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Generar Quiz con IA
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {step === 1 && 'Paso 1: Proporciona contenido o tema'}
                {step === 2 && 'Paso 2: Revisa y edita las preguntas'}
                {step === 3 && 'Paso 3: Vista previa como estudiante'}
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
              {/* Source Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Contenido Fuente (opcional)
                </label>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                  Pega el contenido de la leccion o material del cual generar preguntas
                </p>
                <textarea
                  value={sourceContent}
                  onChange={(e) => setSourceContent(e.target.value)}
                  rows={6}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                  placeholder="# Variables en Python&#10;&#10;Las variables son contenedores para almacenar datos...&#10;&#10;x = 5&#10;nombre = 'Juan'"
                />
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">o selecciona un tema</span>
                </div>
              </div>

              {/* Topic Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Tema Predefinido
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {topics.map((topic) => (
                    <button
                      key={topic.id}
                      onClick={() => {
                        setSelectedTopic(topic.name);
                        setCustomTopic('');
                      }}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        selectedTopic === topic.name
                          ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 border-2 border-primary-500'
                          : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 border-2 border-transparent hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {topic.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Custom Topic */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  O escribe un tema personalizado
                </label>
                <input
                  type="text"
                  value={customTopic}
                  onChange={(e) => {
                    setCustomTopic(e.target.value);
                    setSelectedTopic('');
                  }}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  placeholder="Ej: Decoradores en Python"
                />
              </div>

              {/* Options */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Numero de Preguntas
                  </label>
                  <select
                    value={questionCount}
                    onChange={(e) => setQuestionCount(parseInt(e.target.value))}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    <option value={3}>3 preguntas</option>
                    <option value={5}>5 preguntas</option>
                    <option value={8}>8 preguntas</option>
                    <option value={10}>10 preguntas</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Dificultad
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="easy">Facil</option>
                    <option value="medium">Media</option>
                    <option value="hard">Dificil</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Review and Edit */}
          {step === 2 && generatedQuestions.length > 0 && (
            <div className="space-y-6">
              {/* Quiz Settings */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                  Configuracion del Quiz
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Titulo</label>
                    <input
                      type="text"
                      value={generatedQuiz.title}
                      onChange={(e) => setGeneratedQuiz({ ...generatedQuiz, title: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">Tiempo limite (min)</label>
                    <input
                      type="number"
                      value={generatedQuiz.timeLimitMinutes}
                      onChange={(e) => setGeneratedQuiz({ ...generatedQuiz, timeLimitMinutes: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <span>Preguntas Generadas</span>
                  <span className="px-2 py-0.5 bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 rounded-full text-sm">
                    {generatedQuestions.length}
                  </span>
                </h3>

                {generatedQuestions.map((question, index) => (
                  <div
                    key={question.id || index}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg overflow-hidden"
                  >
                    {editingQuestionIndex === index ? (
                      <QuestionEditor
                        question={question}
                        onSave={(updated) => handleSaveQuestionEdit(index, updated)}
                        onCancel={() => setEditingQuestionIndex(null)}
                      />
                    ) : (
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="w-6 h-6 bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300 rounded-full flex items-center justify-center text-sm font-medium">
                                {index + 1}
                              </span>
                              <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-gray-600 dark:text-gray-400">
                                {question.points} punto{question.points !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <p className="text-gray-900 dark:text-white mb-3">{question.question}</p>
                            <div className="grid grid-cols-2 gap-2">
                              {question.options.map((option, optIndex) => (
                                <div
                                  key={optIndex}
                                  className={`px-3 py-2 rounded text-sm ${
                                    option === question.correctAnswer
                                      ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 border border-green-300 dark:border-green-700'
                                      : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                                  }`}
                                >
                                  {option === question.correctAnswer && (
                                    <span className="mr-1">✓</span>
                                  )}
                                  {option}
                                </div>
                              ))}
                            </div>
                            {question.explanation && (
                              <p className="mt-3 text-sm text-gray-500 dark:text-gray-400 italic">
                                💡 {question.explanation}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleEditQuestion(index)}
                              className="p-2 text-gray-400 hover:text-primary-600 transition-colors"
                              title="Editar"
                              aria-label="Editar pregunta"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDeleteQuestion(index)}
                              className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                              title="Eliminar"
                              aria-label="Eliminar pregunta"
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

          {/* Step 3: Preview as Student */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="bg-primary-50 dark:bg-primary-900/20 rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                <div className="flex items-center gap-2 text-primary-700 dark:text-primary-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  <span className="font-medium">Vista Previa del Estudiante</span>
                </div>
                <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
                  Asi vera el estudiante este quiz. Las respuestas correctas estan ocultas.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-700 rounded-lg p-6 border border-gray-200 dark:border-gray-600">
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{generatedQuiz.title}</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">{generatedQuiz.description}</p>
                <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-6">
                  <span>⏱️ {generatedQuiz.timeLimitMinutes} minutos</span>
                  <span>📝 {generatedQuestions.length} preguntas</span>
                  <span>🎯 {generatedQuiz.passingScore}% para aprobar</span>
                </div>

                {generatedQuestions.map((question, index) => (
                  <div key={question.id || index} className="mb-6 pb-6 border-b border-gray-200 dark:border-gray-600 last:border-0">
                    <p className="font-medium text-gray-900 dark:text-white mb-3">
                      {index + 1}. {question.question}
                    </p>
                    <div className="space-y-2">
                      {question.options.map((option, optIndex) => (
                        <label
                          key={optIndex}
                          className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-600 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-500 transition-colors"
                        >
                          <input
                            type="radio"
                            name={`preview-q${index}`}
                            className="w-4 h-4 text-primary-600"
                            disabled
                          />
                          <span className="text-gray-700 dark:text-gray-300">{option}</span>
                        </label>
                      ))}
                    </div>
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
                disabled={isGenerating || (!sourceContent && !selectedTopic && !customTopic)}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
                    <span>Generar Quiz</span>
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
              <div className="flex items-center gap-3">
                <button
                  onClick={handlePreviewAsStudent}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Vista Previa
                </button>
                <button
                  onClick={handleSaveQuiz}
                  disabled={isSaving}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Guardar Quiz</span>
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <button
                onClick={handleBackToEdit}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Volver a Editar
              </button>
              <button
                onClick={handleSaveQuiz}
                disabled={isSaving}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Guardando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Guardar Quiz</span>
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
 * QuestionEditor - Inline editor for a question
 */
function QuestionEditor({ question, onSave, onCancel }) {
  const [editedQuestion, setEditedQuestion] = useState({ ...question });
  const [editingOptionIndex, setEditingOptionIndex] = useState(null);

  const handleOptionChange = (index, value) => {
    const newOptions = [...editedQuestion.options];
    // If we're changing the correct answer option, update correctAnswer too
    if (newOptions[index] === editedQuestion.correctAnswer) {
      setEditedQuestion({
        ...editedQuestion,
        options: newOptions.map((opt, i) => i === index ? value : opt),
        correctAnswer: value
      });
    } else {
      newOptions[index] = value;
      setEditedQuestion({ ...editedQuestion, options: newOptions });
    }
  };

  const handleSetCorrectAnswer = (option) => {
    setEditedQuestion({ ...editedQuestion, correctAnswer: option });
  };

  return (
    <div className="p-4 bg-blue-50 dark:bg-blue-900/20">
      <div className="space-y-4">
        {/* Question text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Pregunta
          </label>
          <textarea
            value={editedQuestion.question}
            onChange={(e) => setEditedQuestion({ ...editedQuestion, question: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
        </div>

        {/* Options */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Opciones (click para marcar como correcta)
          </label>
          <div className="space-y-2">
            {editedQuestion.options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <button
                  onClick={() => handleSetCorrectAnswer(option)}
                  className={`w-6 h-6 rounded-full flex items-center justify-center transition-colors ${
                    option === editedQuestion.correctAnswer
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-400 hover:bg-green-100'
                  }`}
                >
                  {option === editedQuestion.correctAnswer && '✓'}
                </button>
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handleOptionChange(index, e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Explanation */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Explicacion
          </label>
          <textarea
            value={editedQuestion.explanation}
            onChange={(e) => setEditedQuestion({ ...editedQuestion, explanation: e.target.value })}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
          />
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
            onClick={() => onSave(editedQuestion)}
            className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
