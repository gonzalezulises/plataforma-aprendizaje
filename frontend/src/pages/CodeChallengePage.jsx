import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useUnsavedChangesWarning } from '../hooks/useUnsavedChangesWarning';
import UnsavedChangesModal from '../components/UnsavedChangesModal';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

/**
 * CodeChallengePage - Full coding challenge workflow
 * Features:
 * - Display challenge instructions
 * - Code editor with syntax highlighting
 * - Run code to see output
 * - Submit for automatic test evaluation
 * - View test results and feedback
 * - Network error handling with retry functionality
 * - Code persistence across navigation (localStorage)
 */

// Helper functions for localStorage code draft persistence
const CODE_DRAFT_KEY_PREFIX = 'challenge_code_draft_';

const getCodeDraft = (challengeId) => {
  try {
    return localStorage.getItem(`${CODE_DRAFT_KEY_PREFIX}${challengeId}`);
  } catch (e) {
    console.warn('Failed to read code draft from localStorage:', e);
    return null;
  }
};

const saveCodeDraft = (challengeId, code) => {
  try {
    localStorage.setItem(`${CODE_DRAFT_KEY_PREFIX}${challengeId}`, code);
  } catch (e) {
    console.warn('Failed to save code draft to localStorage:', e);
  }
};

const clearCodeDraft = (challengeId) => {
  try {
    localStorage.removeItem(`${CODE_DRAFT_KEY_PREFIX}${challengeId}`);
  } catch (e) {
    console.warn('Failed to clear code draft from localStorage:', e);
  }
};

function CodeChallengePage() {
  const { challengeId } = useParams();
  const [challenge, setChallenge] = useState(null);
  const [code, setCode] = useState('');
  const [output, setOutput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [currentHint, setCurrentHint] = useState(-1);
  const [hints, setHints] = useState([]);
  const [error, setError] = useState(null);
  const [showSolution, setShowSolution] = useState(false);
  const [solution, setSolution] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [activeTab, setActiveTab] = useState('instructions'); // instructions, output, tests, history
  const [networkError, setNetworkError] = useState(null); // Track network errors for retry
  const [syntaxError, setSyntaxError] = useState(null); // Track syntax errors for highlighting
  const [submissionHistory, setSubmissionHistory] = useState([]); // Full submission history from database
  const [isLoadingHistory, setIsLoadingHistory] = useState(false); // Loading state for history
  const [selectedSubmission, setSelectedSubmission] = useState(null); // Selected submission to view code
  const [originalCode, setOriginalCode] = useState(''); // Track original code for unsaved detection

  // Detect if code has unsaved changes (different from starter code or last saved state)
  const hasUnsavedCode = code !== '' && code !== originalCode;

  // Unsaved changes warning hook
  const {
    showModal: showUnsavedModal,
    confirmNavigation,
    cancelNavigation,
    message: unsavedMessage,
  } = useUnsavedChangesWarning(
    hasUnsavedCode,
    'Tienes codigo sin guardar. Si sales ahora, perderas los cambios en tu codigo.'
  );

  // Helper to detect network errors
  const isNetworkError = (err) => {
    return err.name === 'TypeError' ||
           err.message?.includes('Failed to fetch') ||
           err.message?.includes('Network') ||
           err.message?.includes('fetch') ||
           !navigator.onLine;
  };

  // Retry the failed network operation
  const handleRetry = () => {
    if (networkError?.type === 'run') {
      handleRunCode();
    } else if (networkError?.type === 'submit') {
      handleSubmit();
    }
    setNetworkError(null);
  };

  // Dismiss the network error banner
  const dismissNetworkError = () => {
    setNetworkError(null);
  };

  // Fetch challenge details
  useEffect(() => {
    const fetchChallenge = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/challenges/${challengeId}`, {
          credentials: 'include'
        });
        if (response.ok) {
          const data = await response.json();
          setChallenge(data);

          // Feature #136: Check localStorage for saved code draft first
          const savedDraft = getCodeDraft(challengeId);
          if (savedDraft !== null) {
            // Use saved draft if available
            setCode(savedDraft);
            setOriginalCode(savedDraft); // Track the restored code as original
          } else {
            // Otherwise use starter code
            setCode(data.starter_code || '');
            setOriginalCode(data.starter_code || ''); // Track starter code as original
          }

          setHints(data.hints || []);
          setAttempts(data.user_submissions || []);
        } else {
          setError('Challenge not found');
        }
      } catch (err) {
        console.error('Error fetching challenge:', err);
        setError('Failed to load challenge');
      }
    };

    if (challengeId) {
      fetchChallenge();
    }
  }, [challengeId]);

  // Fetch full submission history from database API
  const fetchSubmissionHistory = async () => {
    if (!challengeId) return;

    setIsLoadingHistory(true);
    try {
      const response = await fetch(`${API_BASE_URL}/challenges/${challengeId}/attempts`, {
        credentials: 'include'
      });
      if (response.ok) {
        const data = await response.json();
        setSubmissionHistory(data.attempts || []);
      } else {
        console.error('Failed to fetch submission history');
      }
    } catch (err) {
      console.error('Error fetching submission history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  // Fetch history when switching to history tab
  useEffect(() => {
    if (activeTab === 'history') {
      fetchSubmissionHistory();
    }
  }, [activeTab, challengeId]);

  // Format timestamp for display
  const formatTimestamp = (isoString) => {
    if (!isoString) return 'Fecha desconocida';
    const date = new Date(isoString);
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  // Load code from a past submission into the editor
  const handleLoadSubmission = (submission) => {
    if (submission.code) {
      setCode(submission.code);
      setActiveTab('instructions');
      setSelectedSubmission(null);
    }
  };

  // Run code without submitting
  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput('');
    setError(null);
    setNetworkError(null);
    setSyntaxError(null);
    setActiveTab('output');

    try {
      const response = await fetch(`${API_BASE_URL}/challenges/${challengeId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code, language: challenge.language })
      });

      const data = await response.json();

      // Feature #117: Handle syntax errors with line highlighting
      if (data.syntax_error && data.syntax_error_info) {
        setSyntaxError(data.syntax_error_info);
        setOutput(''); // Clear output - syntax error panel will show
      // Feature #116: Handle memory limit exceeded
      } else if (data.memory_exceeded) {
        setOutput(`💾 ${data.memory_error_message}\n\n${data.container_cleaned ? '✅ Sandbox limpiado correctamente. Puedes escribir nuevo codigo y ejecutarlo sin problemas.' : ''}`);
      // Feature #108: Handle timeout from infinite loop or long-running code
      } else if (data.timeout) {
        setOutput(`⏱️ ${data.timeout_message}\n\n${data.container_cleaned ? '✅ Contenedor limpiado correctamente. Puedes escribir nuevo codigo y ejecutarlo.' : ''}`);
      } else if (data.error) {
        setOutput(`Error: ${data.error}`);
      } else {
        setOutput(data.output || '(No output)');
      }
    } catch (err) {
      console.error('Error running code:', err);
      if (isNetworkError(err)) {
        setNetworkError({
          type: 'run',
          message: 'Error de conexion: No se pudo conectar con el servidor para ejecutar el codigo.',
          details: navigator.onLine
            ? 'El servidor no responde. Por favor, verifica que el servidor este funcionando e intenta de nuevo.'
            : 'Parece que no tienes conexion a internet. Verifica tu conexion e intenta de nuevo.'
        });
      } else {
        setOutput('Error: Fallo al ejecutar el codigo. Intenta de nuevo.');
      }
    } finally {
      setIsRunning(false);
    }
  };

  // Submit solution for grading
  const handleSubmit = async () => {
    setIsSubmitting(true);
    setTestResults(null);
    setFeedback('');
    setError(null);
    setNetworkError(null);
    setActiveTab('tests');

    try {
      const response = await fetch(`${API_BASE_URL}/challenges/${challengeId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code, language: challenge.language })
      });

      const data = await response.json();
      setTestResults(data.test_results);
      setFeedback(data.feedback);

      if (data.is_correct && data.solution) {
        setSolution(data.solution);
      }

      // After successful submission, update original code to current code
      // so user isn't warned about "unsaved changes" when navigating away
      setOriginalCode(code);

      // Update attempts list (with code for history display)
      const newAttempt = {
        id: data.submission_id,
        is_correct: data.is_correct,
        attempt_number: data.attempt_number,
        created_at: new Date().toISOString(),
        code: code, // Include submitted code
        test_results: data.test_results || []
      };
      setAttempts(prev => [newAttempt, ...prev]);

      // Also update submission history if it was already loaded
      setSubmissionHistory(prev => [newAttempt, ...prev]);

    } catch (err) {
      console.error('Error submitting solution:', err);
      if (isNetworkError(err)) {
        setNetworkError({
          type: 'submit',
          message: 'Error de conexion: No se pudo enviar tu solucion al servidor.',
          details: navigator.onLine
            ? 'El servidor no responde. Por favor, verifica que el servidor este funcionando e intenta de nuevo.'
            : 'Parece que no tienes conexion a internet. Verifica tu conexion e intenta de nuevo.'
        });
      } else {
        setFeedback('Error: Fallo al enviar la solucion. Intenta de nuevo.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Get next hint
  const handleGetHint = async () => {
    const nextHintIndex = currentHint + 1;
    if (nextHintIndex < hints.length) {
      try {
        const response = await fetch(
          `${API_BASE_URL}/challenges/${challengeId}/hint/${nextHintIndex}`,
          { credentials: 'include' }
        );
        if (response.ok) {
          const data = await response.json();
          setCurrentHint(nextHintIndex);
          setHints(prev => {
            const updated = [...prev];
            updated[nextHintIndex] = { ...updated[nextHintIndex], revealed: true, text: data.hint };
            return updated;
          });
        }
      } catch (err) {
        console.error('Error fetching hint:', err);
      }
    }
  };

  // Reset code to starter
  const handleReset = () => {
    if (challenge) {
      setCode(challenge.starter_code || '');
      // Feature #136: Clear saved draft when resetting to starter code
      clearCodeDraft(challengeId);
      setOutput('');
      setTestResults(null);
      setFeedback('');
      setNetworkError(null);
      setSyntaxError(null);
    }
  };

  // Clear syntax error when code changes and save draft to localStorage
  const handleCodeChange = (e) => {
    const newCode = e.target.value;
    setCode(newCode);
    // Feature #136: Save code draft to localStorage for persistence across navigation
    saveCodeDraft(challengeId, newCode);
    if (syntaxError) {
      setSyntaxError(null);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400 mb-4">{error}</h1>
          <Link to="/courses" className="text-primary-600 hover:text-primary-700 dark:text-primary-400">
            Volver a cursos
          </Link>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-pulse text-gray-500 dark:text-gray-400">Cargando reto...</div>
      </div>
    );
  }

  const passedTests = testResults?.filter(t => t.passed).length || 0;
  const totalTests = testResults?.length || 0;
  const allPassed = passedTests === totalTests && totalTests > 0;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Network Error Banner */}
      {networkError && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-orange-50 dark:bg-orange-900/30 border-b border-orange-200 dark:border-orange-800 shadow-lg">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-start gap-4">
              <svg className="w-8 h-8 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div className="flex-1">
                <h3 className="font-semibold text-orange-800 dark:text-orange-200">{networkError.message}</h3>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">{networkError.details}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRetry}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reintentar
                </button>
                <button
                  onClick={dismissNetworkError}
                  className="p-2 text-orange-600 hover:text-orange-800 dark:text-orange-400 dark:hover:text-orange-200 transition-colors"
                  aria-label="Cerrar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className={`bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 ${networkError ? 'mt-24' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  challenge.difficulty === 'easy' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300' :
                  challenge.difficulty === 'medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300' :
                  'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300'
                }`}>
                  {challenge.difficulty === 'easy' ? 'Facil' :
                   challenge.difficulty === 'medium' ? 'Intermedio' : 'Dificil'}
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {challenge.language.toUpperCase()}
                </span>
                {attempts.some(a => a.is_correct) && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 flex items-center gap-1">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    Completado
                  </span>
                )}
              </div>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                {challenge.title}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              {attempts.length > 0 && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {attempts.length} intento{attempts.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main content - Split view */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left panel - Instructions */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            {/* Tabs */}
            <div className="border-b border-gray-200 dark:border-gray-700">
              <nav className="flex">
                <button
                  onClick={() => setActiveTab('instructions')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'instructions'
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Instrucciones
                </button>
                <button
                  onClick={() => setActiveTab('output')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === 'output'
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Salida
                </button>
                <button
                  onClick={() => setActiveTab('tests')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'tests'
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Pruebas
                  {testResults && (
                    <span className={`px-1.5 py-0.5 rounded text-xs ${
                      allPassed ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                    }`}>
                      {passedTests}/{totalTests}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setActiveTab('history')}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
                    activeTab === 'history'
                      ? 'border-primary-600 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  Historial
                  {attempts.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                      {attempts.length}
                    </span>
                  )}
                </button>
              </nav>
            </div>

            {/* Tab content */}
            <div className="p-4 h-[500px] overflow-y-auto">
              {activeTab === 'instructions' && (
                <div className="prose dark:prose-invert max-w-none">
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {challenge.description}
                  </p>
                  <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">
                    {challenge.instructions.split('\n').map((line, idx) => {
                      if (line.startsWith('## ')) {
                        return <h2 key={idx} className="text-lg font-bold text-gray-900 dark:text-white mt-4 mb-2">{line.slice(3)}</h2>;
                      }
                      if (line.startsWith('### ')) {
                        return <h3 key={idx} className="text-md font-semibold text-gray-800 dark:text-gray-200 mt-3 mb-1">{line.slice(4)}</h3>;
                      }
                      if (line.startsWith('- ')) {
                        return <li key={idx} className="ml-4 text-gray-600 dark:text-gray-400">{line.slice(2)}</li>;
                      }
                      if (line.startsWith('```')) {
                        return null; // Skip code fence markers
                      }
                      if (line.startsWith('`') && line.endsWith('`')) {
                        return <code key={idx} className="bg-gray-100 dark:bg-gray-700 px-1 rounded text-sm">{line.slice(1, -1)}</code>;
                      }
                      return line ? <p key={idx} className="mb-1">{line}</p> : <br key={idx} />;
                    })}
                  </div>

                  {/* Hints section */}
                  {hints.length > 0 && (
                    <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Pistas ({currentHint + 1 >= hints.length ? hints.length : currentHint + 1}/{hints.length})
                        </h3>
                        {currentHint < hints.length - 1 && (
                          <button
                            onClick={handleGetHint}
                            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            Obtener pista
                          </button>
                        )}
                      </div>
                      {hints.filter(h => h.revealed).map((hint, idx) => (
                        <div key={idx} className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-2">
                          <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <span className="text-sm text-amber-800 dark:text-amber-200">{hint.text}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'output' && (
                <div className="h-full">
                  {/* Feature #117: Syntax Error Display */}
                  {syntaxError ? (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 h-full overflow-auto">
                      {/* Error Header */}
                      <div className="flex items-start gap-3 mb-4">
                        <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div>
                          <h3 className="font-bold text-red-800 dark:text-red-200 text-lg">
                            {syntaxError.type}: Linea {syntaxError.line}
                          </h3>
                          <p className="text-red-700 dark:text-red-300 mt-1">
                            {syntaxError.message}
                          </p>
                        </div>
                      </div>

                      {/* Code Snippet with Line Highlighting */}
                      {syntaxError.codeSnippet && (
                        <div className="bg-gray-900 rounded-lg overflow-hidden mb-4">
                          <div className="px-3 py-2 bg-gray-800 text-gray-400 text-xs font-medium border-b border-gray-700">
                            Codigo con error
                          </div>
                          <div className="font-mono text-sm">
                            {syntaxError.codeSnippet.map((line, idx) => (
                              <div
                                key={idx}
                                className={`flex ${line.isErrorLine ? 'bg-red-900/40 border-l-4 border-red-500' : ''}`}
                              >
                                <span className={`w-12 px-2 py-1 text-right select-none ${
                                  line.isErrorLine ? 'text-red-400 font-bold' : 'text-gray-500'
                                }`}>
                                  {line.lineNum}
                                </span>
                                <span className={`flex-1 px-2 py-1 ${
                                  line.isErrorLine ? 'text-red-300' : 'text-gray-300'
                                }`}>
                                  {line.code || ' '}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Suggestion */}
                      {syntaxError.suggestion && (
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                          <div className="flex items-start gap-2">
                            <svg className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                            </svg>
                            <div>
                              <span className="font-medium text-amber-800 dark:text-amber-200">Sugerencia: </span>
                              <span className="text-amber-700 dark:text-amber-300">{syntaxError.suggestion}</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : output ? (
                    <pre className="font-mono text-sm bg-gray-900 text-green-400 p-4 rounded-lg h-full overflow-auto whitespace-pre-wrap">
                      {output}
                    </pre>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                      <div className="text-center">
                        <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <p>Ejecuta tu codigo para ver la salida</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'tests' && (
                <div className="space-y-4">
                  {testResults ? (
                    <>
                      {/* Summary */}
                      <div className={`p-4 rounded-lg ${
                        allPassed
                          ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                          : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
                      }`}>
                        <div className="flex items-center gap-3">
                          {allPassed ? (
                            <>
                              <svg className="w-8 h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <h3 className="font-semibold text-green-800 dark:text-green-200">Todas las pruebas pasaron!</h3>
                                <p className="text-sm text-green-700 dark:text-green-300">{feedback}</p>
                              </div>
                            </>
                          ) : (
                            <>
                              <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div>
                                <h3 className="font-semibold text-red-800 dark:text-red-200">{passedTests} de {totalTests} pruebas pasaron</h3>
                                <p className="text-sm text-red-700 dark:text-red-300">{feedback}</p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Individual test results */}
                      <div className="space-y-2">
                        {testResults.map((test, idx) => (
                          <div
                            key={test.id || idx}
                            className={`p-3 rounded-lg border ${
                              test.passed
                                ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
                                : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              {test.passed ? (
                                <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              ) : (
                                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              )}
                              <span className={`font-medium ${
                                test.passed ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                              }`}>
                                {test.name}
                                {test.is_hidden && <span className="ml-2 text-xs opacity-75">(oculto)</span>}
                              </span>
                            </div>

                            {/* Show details for visible failed tests */}
                            {!test.passed && !test.is_hidden && test.expected !== undefined && (
                              <div className="mt-2 text-sm font-mono">
                                <div className="text-gray-600 dark:text-gray-400">
                                  <span className="text-gray-500">Esperado:</span> {test.expected}
                                </div>
                                <div className="text-gray-600 dark:text-gray-400">
                                  <span className="text-gray-500">Obtenido:</span> {test.actual || '(sin salida)'}
                                </div>
                                {test.error && (
                                  <div className="text-red-600 dark:text-red-400 mt-1">
                                    Error: {test.error}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Show solution button (only if all passed) */}
                      {allPassed && solution && (
                        <div className="mt-4">
                          <button
                            onClick={() => setShowSolution(!showSolution)}
                            className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1"
                          >
                            {showSolution ? 'Ocultar solucion' : 'Ver solucion del instructor'}
                            <svg className={`w-4 h-4 transition-transform ${showSolution ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </button>
                          {showSolution && (
                            <pre className="mt-2 p-3 bg-gray-900 text-green-400 rounded-lg font-mono text-sm overflow-x-auto">
                              {solution}
                            </pre>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500">
                      <div className="text-center">
                        <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                        </svg>
                        <p>Envia tu solucion para ver los resultados</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'history' && (
                <div className="space-y-4">
                  {isLoadingHistory ? (
                    <div className="flex items-center justify-center py-8">
                      <svg className="w-8 h-8 animate-spin text-primary-600" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      <span className="ml-2 text-gray-500 dark:text-gray-400">Cargando historial...</span>
                    </div>
                  ) : submissionHistory.length > 0 ? (
                    <>
                      <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                        {submissionHistory.length} intento{submissionHistory.length !== 1 ? 's' : ''} registrado{submissionHistory.length !== 1 ? 's' : ''}
                      </div>
                      <div className="space-y-3">
                        {submissionHistory.map((submission, idx) => (
                          <div
                            key={submission.id}
                            className={`border rounded-lg overflow-hidden ${
                              submission.is_correct
                                ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                            }`}
                          >
                            {/* Submission Header */}
                            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                              <div className="flex items-center gap-3">
                                {submission.is_correct ? (
                                  <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                    <span className="font-medium">Correcto</span>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                    <span className="font-medium">Incorrecto</span>
                                  </div>
                                )}
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                  Intento #{submission.attempt_number}
                                </span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-gray-400 dark:text-gray-500">
                                  {formatTimestamp(submission.created_at)}
                                </span>
                                {submission.execution_time_ms && (
                                  <span className="text-xs text-gray-400 dark:text-gray-500">
                                    {submission.execution_time_ms}ms
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Code Preview / Expandable */}
                            <div className="p-4">
                              {selectedSubmission === submission.id ? (
                                <div>
                                  <pre className="bg-gray-900 text-green-400 p-3 rounded-lg font-mono text-sm overflow-x-auto max-h-64 overflow-y-auto">
                                    {submission.code || '(Sin codigo)'}
                                  </pre>
                                  <div className="flex items-center gap-2 mt-3">
                                    <button
                                      onClick={() => setSelectedSubmission(null)}
                                      className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                                    >
                                      Ocultar codigo
                                    </button>
                                    <button
                                      onClick={() => handleLoadSubmission(submission)}
                                      className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 flex items-center gap-1"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                      </svg>
                                      Cargar en editor
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <pre className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 p-2 rounded font-mono text-xs overflow-hidden max-h-16">
                                    {submission.code?.substring(0, 150) || '(Sin codigo)'}
                                    {submission.code && submission.code.length > 150 ? '...' : ''}
                                  </pre>
                                  <button
                                    onClick={() => setSelectedSubmission(submission.id)}
                                    className="text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 mt-2 flex items-center gap-1"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                    </svg>
                                    Ver codigo completo
                                  </button>
                                </div>
                              )}

                              {/* Test results summary */}
                              {submission.test_results && submission.test_results.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center gap-2 text-sm">
                                    <span className="text-gray-500 dark:text-gray-400">Pruebas:</span>
                                    {submission.test_results.map((tr, trIdx) => (
                                      <span
                                        key={trIdx}
                                        className={`w-3 h-3 rounded-full ${tr.passed ? 'bg-green-500' : 'bg-red-500'}`}
                                        title={`${tr.name}: ${tr.passed ? 'Paso' : 'Fallo'}`}
                                      />
                                    ))}
                                    <span className="text-gray-400 dark:text-gray-500">
                                      ({submission.test_results.filter(t => t.passed).length}/{submission.test_results.length})
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Error message if present */}
                              {submission.error && (
                                <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                  <div className="text-sm text-red-600 dark:text-red-400">
                                    <span className="font-medium">Error:</span> {submission.error}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex items-center justify-center text-gray-400 dark:text-gray-500 py-8">
                      <div className="text-center">
                        <svg className="w-12 h-12 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p>No hay intentos registrados</p>
                        <p className="text-sm mt-1">Envia tu primera solucion para ver el historial</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Right panel - Code editor */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col">
            {/* Editor header */}
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {challenge.language === 'python' ? 'main.py' : `main.${challenge.language}`}
                </span>
              </div>
              <button
                onClick={handleReset}
                className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 flex items-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Resetear
              </button>
            </div>

            {/* Code editor */}
            <div className="flex-1 relative">
              <textarea
                value={code}
                onChange={handleCodeChange}
                className={`w-full h-[400px] p-4 font-mono text-sm bg-gray-900 text-green-400 resize-none focus:outline-none ${
                  syntaxError ? 'border-2 border-red-500' : ''
                }`}
                spellCheck={false}
                placeholder="Escribe tu codigo aqui..."
              />
              {/* Line numbers overlay with syntax error highlighting */}
              <div className="absolute left-0 top-0 p-4 font-mono text-sm pointer-events-none select-none">
                {code.split('\n').map((_, idx) => {
                  const lineNum = idx + 1;
                  const isErrorLine = syntaxError && syntaxError.line === lineNum;
                  return (
                    <div
                      key={idx}
                      className={`h-5 text-right pr-4 w-8 ${
                        isErrorLine
                          ? 'text-red-400 font-bold bg-red-900/30 rounded-l'
                          : 'text-gray-500'
                      }`}
                    >
                      {lineNum}
                      {isErrorLine && (
                        <span className="absolute left-10 text-red-400" title={syntaxError.message}>
                          ⚠
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-700 border-t border-gray-200 dark:border-gray-600">
              <div className="text-sm text-gray-500 dark:text-gray-400">
                Tiempo limite: {challenge.time_limit_seconds}s
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRunCode}
                  disabled={isRunning}
                  className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-200 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isRunning ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Ejecutando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Ejecutar
                    </>
                  )}
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Enviando...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                      </svg>
                      Enviar Solucion
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unsaved Changes Warning Modal */}
      <UnsavedChangesModal
        isOpen={showUnsavedModal}
        onConfirm={confirmNavigation}
        onCancel={cancelNavigation}
        message={unsavedMessage}
      />
    </div>
  );
}

export default CodeChallengePage;
