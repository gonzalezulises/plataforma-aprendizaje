import { useState, useRef } from 'react';
import toast from 'react-hot-toast';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/api$/, '');

/**
 * QuizImportModal - Modal for importing quiz questions from CSV file
 *
 * Steps:
 * 1. User uploads CSV file or pastes CSV data
 * 2. Preview parsed questions
 * 3. Confirm import
 */
export default function QuizImportModal({ isOpen, onClose, lessonId, lessonTitle, onQuizImported }) {
  const [step, setStep] = useState(1); // 1: upload, 2: preview
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Input state
  const [csvData, setCsvData] = useState('');
  const [quizTitle, setQuizTitle] = useState('');
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(15);
  const [passingScore, setPassingScore] = useState(70);
  const [maxAttempts, setMaxAttempts] = useState(3);

  // Preview state
  const [previewQuestions, setPreviewQuestions] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);

  /**
   * Parse CSV line handling quoted values
   */
  const parseCSVLine = (line) => {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };

  /**
   * Parse CSV data and generate preview
   */
  const parseCSV = (data) => {
    const lines = data.trim().split('\n');
    if (lines.length < 2) {
      setParseErrors([{ row: 0, error: 'El CSV debe tener encabezado y al menos una pregunta' }]);
      return [];
    }

    const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim());
    const requiredHeaders = ['question', 'option1', 'option2', 'correct_answer'];
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));

    if (missingHeaders.length > 0) {
      setParseErrors([{ row: 0, error: `Faltan columnas: ${missingHeaders.join(', ')}` }]);
      return [];
    }

    const questions = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const values = parseCSVLine(line);
        const rowData = {};
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        const options = [];
        for (let j = 1; j <= 4; j++) {
          const opt = rowData['option' + j];
          if (opt && opt.trim()) {
            options.push(opt.trim());
          }
        }

        if (!rowData.question || !rowData.question.trim()) {
          errors.push({ row: i + 1, error: 'Pregunta vacia' });
          continue;
        }

        if (options.length < 2) {
          errors.push({ row: i + 1, error: 'Se requieren al menos 2 opciones' });
          continue;
        }

        const correctAnswer = rowData.correct_answer?.trim() || '';
        if (!correctAnswer) {
          errors.push({ row: i + 1, error: 'Falta respuesta correcta' });
          continue;
        }

        if (!options.includes(correctAnswer)) {
          errors.push({ row: i + 1, error: `Respuesta "${correctAnswer}" no coincide con opciones` });
          continue;
        }

        questions.push({
          question: rowData.question.trim(),
          options,
          correctAnswer,
          explanation: rowData.explanation || '',
          points: parseInt(rowData.points) || 1
        });
      } catch (e) {
        errors.push({ row: i + 1, error: 'Error de formato' });
      }
    }

    setParseErrors(errors);
    return questions;
  };

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setCsvData(content);
        const questions = parseCSV(content);
        setPreviewQuestions(questions);
        if (questions.length > 0) {
          setStep(2);
        }
      }
    };
    reader.readAsText(file);
  };

  const handlePasteData = () => {
    if (!csvData.trim()) {
      toast.error('Pega datos CSV primero');
      return;
    }
    const questions = parseCSV(csvData);
    setPreviewQuestions(questions);
    if (questions.length > 0) {
      setStep(2);
    } else if (parseErrors.length === 0) {
      toast.error('No se encontraron preguntas validas');
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/quizzes/import/template`, {
        credentials: 'include'
      });
      if (!response.ok) throw new Error('Error descargando plantilla');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'quiz_template.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Plantilla descargada');
    } catch (error) {
      toast.error('Error al descargar plantilla');
    }
  };

  const handleImport = async () => {
    if (!quizTitle.trim()) {
      toast.error('Ingresa un titulo para el quiz');
      return;
    }

    if (previewQuestions.length === 0) {
      toast.error('No hay preguntas para importar');
      return;
    }

    setIsImporting(true);
    try {
      const response = await fetch(`${API_BASE}/api/quizzes/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          lessonId,
          quizTitle,
          csvData,
          timeLimitMinutes,
          maxAttempts,
          passingScore
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al importar quiz');
      }

      const data = await response.json();
      toast.success(data.message || `Se importaron ${data.importedCount} preguntas`);

      if (onQuizImported) {
        onQuizImported(data.quizId);
      }

      handleClose();
    } catch (error) {
      console.error('Error importing quiz:', error);
      toast.error(error.message || 'Error al importar el quiz');
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setCsvData('');
    setQuizTitle('');
    setTimeLimitMinutes(15);
    setPassingScore(70);
    setMaxAttempts(3);
    setPreviewQuestions([]);
    setParseErrors([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Importar Quiz desde CSV
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {step === 1 && 'Paso 1: Sube o pega datos CSV'}
                {step === 2 && 'Paso 2: Revisa y confirma importacion'}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Cerrar modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Step 1: Upload */}
          {step === 1 && (
            <div className="space-y-6">
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Subir archivo CSV
                </label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-primary-500 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="csv-file-input"
                  />
                  <label
                    htmlFor="csv-file-input"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <span className="text-gray-600 dark:text-gray-400">
                      Click para seleccionar archivo CSV
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-500">
                      o arrastra y suelta aqui
                    </span>
                  </label>
                </div>
              </div>

              {/* Download Template */}
              <div className="flex items-center justify-center">
                <button
                  onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Descargar plantilla CSV de ejemplo
                </button>
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">o pega datos CSV</span>
                </div>
              </div>

              {/* Paste CSV Data */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Pegar datos CSV
                </label>
                <textarea
                  value={csvData}
                  onChange={(e) => setCsvData(e.target.value)}
                  rows={8}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent font-mono text-sm"
                  placeholder="question,option1,option2,option3,option4,correct_answer,explanation,points&#10;Cual es 2+2?,3,4,5,6,4,Es una suma basica,1"
                />
                <button
                  onClick={handlePasteData}
                  disabled={!csvData.trim()}
                  className="mt-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Procesar CSV
                </button>
              </div>

              {/* Parse Errors */}
              {parseErrors.length > 0 && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                  <h4 className="text-red-800 dark:text-red-300 font-medium mb-2">
                    Errores encontrados:
                  </h4>
                  <ul className="list-disc list-inside text-sm text-red-700 dark:text-red-400 space-y-1">
                    {parseErrors.map((err, i) => (
                      <li key={i}>Fila {err.row}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Expected Format Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                <h4 className="text-blue-800 dark:text-blue-300 font-medium mb-2">
                  Formato esperado:
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-400 mb-2">
                  El CSV debe tener las siguientes columnas:
                </p>
                <code className="block bg-blue-100 dark:bg-blue-900/40 px-3 py-2 rounded text-xs text-blue-800 dark:text-blue-300">
                  question,option1,option2,option3,option4,correct_answer,explanation,points
                </code>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                  * question, option1, option2, correct_answer son obligatorios
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 2 && (
            <div className="space-y-6">
              {/* Quiz Settings */}
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                  Configuracion del Quiz
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Titulo del Quiz *
                    </label>
                    <input
                      type="text"
                      value={quizTitle}
                      onChange={(e) => setQuizTitle(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                      placeholder="Ej: Quiz de Python Basico"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Tiempo limite (min)
                    </label>
                    <input
                      type="number"
                      value={timeLimitMinutes}
                      onChange={(e) => setTimeLimitMinutes(parseInt(e.target.value) || 15)}
                      min={1}
                      max={120}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Puntaje para aprobar (%)
                    </label>
                    <input
                      type="number"
                      value={passingScore}
                      onChange={(e) => setPassingScore(parseInt(e.target.value) || 70)}
                      min={0}
                      max={100}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Intentos maximos (0 = ilimitados)
                    </label>
                    <input
                      type="number"
                      value={maxAttempts}
                      onChange={(e) => setMaxAttempts(parseInt(e.target.value) || 0)}
                      min={0}
                      max={10}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Success message */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="font-medium">
                    {previewQuestions.length} pregunta{previewQuestions.length !== 1 ? 's' : ''} lista{previewQuestions.length !== 1 ? 's' : ''} para importar
                  </span>
                </div>
                {parseErrors.length > 0 && (
                  <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1">
                    {parseErrors.length} fila{parseErrors.length !== 1 ? 's' : ''} con errores (seran omitidas)
                  </p>
                )}
              </div>

              {/* Questions Preview */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  Vista Previa de Preguntas
                </h3>

                {previewQuestions.map((question, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
                  >
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
                        {question.explanation}
                      </p>
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
              <div></div>
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
                onClick={handleImport}
                disabled={isImporting || !quizTitle.trim()}
                className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isImporting ? (
                  <>
                    <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Importando...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    <span>Importar Quiz</span>
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
