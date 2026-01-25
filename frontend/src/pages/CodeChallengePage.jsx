import React, { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';

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
 */
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
  const [activeTab, setActiveTab] = useState('instructions'); // instructions, output, tests
  const [networkError, setNetworkError] = useState(null); // Track network errors for retry

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
          setCode(data.starter_code || '');
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

  // Run code without submitting
  const handleRunCode = async () => {
    setIsRunning(true);
    setOutput('');
    setError(null);
    setNetworkError(null);
    setActiveTab('output');

    try {
      const response = await fetch(`${API_BASE_URL}/challenges/${challengeId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code, language: challenge.language })
      });

      const data = await response.json();
      // Feature #116: Handle memory limit exceeded
      if (data.memory_exceeded) {
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

      // Update attempts list
      setAttempts(prev => [{
        id: data.submission_id,
        is_correct: data.is_correct,
        attempt_number: data.attempt_number,
        created_at: new Date().toISOString()
      }, ...prev]);

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
      setOutput('');
      setTestResults(null);
      setFeedback('');
      setNetworkError(null);
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
                  {output ? (
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
                onChange={(e) => setCode(e.target.value)}
                className="w-full h-[400px] p-4 font-mono text-sm bg-gray-900 text-green-400 resize-none focus:outline-none"
                spellCheck={false}
                placeholder="Escribe tu codigo aqui..."
              />
              {/* Line numbers overlay */}
              <div className="absolute left-0 top-0 p-4 font-mono text-sm text-gray-500 pointer-events-none select-none">
                {code.split('\n').map((_, idx) => (
                  <div key={idx} className="h-5 text-right pr-4 w-8">{idx + 1}</div>
                ))}
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
    </div>
  );
}

export default CodeChallengePage;
