import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, Link, useNavigate, useSearchParams } from 'react-router-dom';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Timeout duration for quiz submission (30 seconds)
const SUBMIT_TIMEOUT_MS = 30000;

/**
 * QuizPage - Complete quiz attempt workflow
 * Displays quiz questions, handles answers, shows results with feedback
 */
function QuizPage() {
  const { quizId } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Quiz state
  const [quiz, setQuiz] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Attempt state
  const [attemptId, setAttemptId] = useState(null);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [quizStarted, setQuizStarted] = useState(false);

  // Results state
  const [results, setResults] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Timeout and network error state
  const [submitError, setSubmitError] = useState(null);
  const [isTimeoutError, setIsTimeoutError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const abortControllerRef = useRef(null);

  // Store answers in localStorage to prevent loss
  const savedAnswersKey = `quiz_${quizId}_answers`;
  const savedAttemptKey = `quiz_${quizId}_attempt`;

  // Initialize currentQuestion from URL on mount
  const initialQuestionFromUrl = useRef(false);

  // Sync URL to currentQuestion on mount (deep link support)
  useEffect(() => {
    if (!initialQuestionFromUrl.current && questions.length > 0 && quizStarted) {
      const qParam = searchParams.get('q');
      if (qParam !== null) {
        const questionIndex = parseInt(qParam, 10) - 1; // URL uses 1-based index
        if (!isNaN(questionIndex) && questionIndex >= 0 && questionIndex < questions.length) {
          setCurrentQuestion(questionIndex);
        }
      }
      initialQuestionFromUrl.current = true;
    }
  }, [questions.length, quizStarted, searchParams]);

  // Sync currentQuestion to URL (update URL when navigating between questions)
  useEffect(() => {
    if (quizStarted && questions.length > 0) {
      // Only update URL if the question param is different from current state
      const currentUrlQuestion = searchParams.get('q');
      const expectedUrlQuestion = String(currentQuestion + 1); // URL uses 1-based index

      if (currentUrlQuestion !== expectedUrlQuestion) {
        setSearchParams({ q: expectedUrlQuestion }, { replace: true });
      }
    }
  }, [currentQuestion, quizStarted, questions.length, setSearchParams]);

  // Fetch quiz data
  useEffect(() => {
    fetchQuiz();
  }, [quizId]);

  // Save answers to localStorage whenever they change
  useEffect(() => {
    if (quizStarted && Object.keys(answers).length > 0) {
      localStorage.setItem(savedAnswersKey, JSON.stringify(answers));
    }
  }, [answers, quizStarted, savedAnswersKey]);

  // Save attemptId to localStorage
  useEffect(() => {
    if (attemptId) {
      localStorage.setItem(savedAttemptKey, attemptId.toString());
    }
  }, [attemptId, savedAttemptKey]);

  // Restore answers from localStorage on mount (for recovery after timeout)
  useEffect(() => {
    const savedAnswers = localStorage.getItem(savedAnswersKey);
    const savedAttempt = localStorage.getItem(savedAttemptKey);
    if (savedAnswers && savedAttempt) {
      try {
        const parsed = JSON.parse(savedAnswers);
        if (Object.keys(parsed).length > 0) {
          setAnswers(parsed);
          setAttemptId(parseInt(savedAttempt, 10));
        }
      } catch (e) {
        console.error('Error restoring saved answers:', e);
      }
    }
  }, [savedAnswersKey, savedAttemptKey]);

  // Timer effect
  useEffect(() => {
    if (!quizStarted || timeRemaining === null || timeRemaining <= 0) return;

    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleSubmit(); // Auto-submit when time runs out
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [quizStarted, timeRemaining]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const fetchQuiz = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/quizzes/${quizId}`, {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch quiz');
      }

      const data = await response.json();
      setQuiz(data.quiz);
      setQuestions(data.questions);
      setError(null);
    } catch (err) {
      console.error('Error fetching quiz:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleStartQuiz = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/quizzes/${quizId}/start`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to start quiz');
      }

      const data = await response.json();
      setAttemptId(data.attemptId);
      setQuizStarted(true);
      setAnswers({});

      // Check if URL has a question param for deep linking
      const qParam = searchParams.get('q');
      if (qParam !== null) {
        const questionIndex = parseInt(qParam, 10) - 1; // URL uses 1-based index
        if (!isNaN(questionIndex) && questionIndex >= 0 && questionIndex < questions.length) {
          setCurrentQuestion(questionIndex);
        } else {
          setCurrentQuestion(0);
          setSearchParams({ q: '1' }, { replace: true });
        }
      } else {
        setCurrentQuestion(0);
        setSearchParams({ q: '1' }, { replace: true });
      }

      // Set timer if quiz has time limit
      if (data.timeLimitMinutes) {
        setTimeRemaining(data.timeLimitMinutes * 60);
      }
    } catch (err) {
      console.error('Error starting quiz:', err);
      setError(err.message);
    }
  };

  const handleAnswerSelect = (questionId, answer) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));
  };

  const handleNext = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    if (submitting) return;

    // Clear previous submit errors
    setSubmitError(null);
    setIsTimeoutError(false);

    try {
      setSubmitting(true);

      // Cancel any previous request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          abortControllerRef.current?.abort();
          reject(new Error('TIMEOUT'));
        }, SUBMIT_TIMEOUT_MS);
      });

      // Create fetch promise
      const fetchPromise = fetch(`${API_BASE_URL}/quizzes/${quizId}/submit`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          attemptId,
          answers
        }),
        signal: abortControllerRef.current.signal
      });

      // Race between fetch and timeout
      const response = await Promise.race([fetchPromise, timeoutPromise]);

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to submit quiz');
      }

      const data = await response.json();

      // Clear saved answers on successful submission
      localStorage.removeItem(savedAnswersKey);
      localStorage.removeItem(savedAttemptKey);

      setResults(data);
      setShowResults(true);
      setQuizStarted(false);
      setRetryCount(0);
    } catch (err) {
      console.error('Error submitting quiz:', err);

      // Check if it's a timeout or abort error
      if (err.message === 'TIMEOUT' || err.name === 'AbortError') {
        setIsTimeoutError(true);
        setSubmitError('La solicitud ha tardado demasiado. El servidor no responde. Tus respuestas se han guardado localmente.');
      } else if (err.message.includes('NetworkError') || err.message.includes('Failed to fetch') || !navigator.onLine) {
        setIsTimeoutError(true);
        setSubmitError('No hay conexion a internet. Por favor, verifica tu conexion y vuelve a intentar. Tus respuestas estan guardadas.');
      } else {
        setSubmitError(err.message || 'Error al enviar el quiz. Por favor, intenta de nuevo.');
      }

      // Don't set general error - keep quiz state so user can retry
      setRetryCount(prev => prev + 1);
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetrySubmit = () => {
    setSubmitError(null);
    setIsTimeoutError(false);
    handleSubmit();
  };

  const handleDismissError = () => {
    setSubmitError(null);
    setIsTimeoutError(false);
  };

  const handleRetry = () => {
    // Clear saved data when starting fresh
    localStorage.removeItem(savedAnswersKey);
    localStorage.removeItem(savedAttemptKey);

    setShowResults(false);
    setResults(null);
    setAttemptId(null);
    setAnswers({});
    setCurrentQuestion(0);
    setSubmitError(null);
    setIsTimeoutError(false);
    setRetryCount(0);
    // Reset URL to remove question parameter
    setSearchParams({}, { replace: true });
    initialQuestionFromUrl.current = false;
    fetchQuiz(); // Refresh quiz data including attempts
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando quiz...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-5xl mb-4">!</div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Error</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Volver
          </button>
        </div>
      </div>
    );
  }

  // Results view
  if (showResults && results) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-3xl mx-auto px-4">
          {/* Results header */}
          <div className={`rounded-xl p-6 mb-6 ${results.passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            <div className="text-center">
              <div className={`text-6xl mb-4 ${results.passed ? 'text-green-500' : 'text-red-500'}`}>
                {results.passed ? '🎉' : '📚'}
              </div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">
                {results.passed ? '¡Felicidades!' : 'Sigue practicando'}
              </h1>
              <p className="text-gray-600 mb-4">
                {results.passed
                  ? 'Has aprobado el quiz exitosamente.'
                  : `Necesitas ${results.passingScore}% para aprobar. ¡No te rindas!`}
              </p>

              {/* Score display */}
              <div className="flex justify-center items-center gap-8 mb-4">
                <div className="text-center">
                  <div className={`text-4xl font-bold ${results.passed ? 'text-green-600' : 'text-red-600'}`}>
                    {results.score}%
                  </div>
                  <div className="text-sm text-gray-500">Tu puntuacion</div>
                </div>
                <div className="text-center">
                  <div className="text-4xl font-bold text-gray-700">
                    {results.earnedPoints}/{results.totalPoints}
                  </div>
                  <div className="text-sm text-gray-500">Puntos</div>
                </div>
              </div>

              {/* Time spent */}
              <p className="text-sm text-gray-500">
                Tiempo: {formatTime(results.timeSpentSeconds)}
              </p>
            </div>
          </div>

          {/* Question results */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h2 className="text-lg font-semibold text-gray-900">Revision de respuestas</h2>
            </div>

            <div className="divide-y divide-gray-200">
              {results.results.map((result, index) => (
                <div key={result.questionId} className="p-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                      result.isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                    }`}>
                      {result.isCorrect ? '✓' : '✗'}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 mb-2">
                        {index + 1}. {result.question}
                      </p>

                      {/* Options */}
                      <div className="space-y-2 mb-3">
                        {result.options.map((option, optIndex) => {
                          const isUserAnswer = result.userAnswer === option;
                          const isCorrectAnswer = result.correctAnswer === option;
                          let bgColor = 'bg-gray-50';
                          let textColor = 'text-gray-700';
                          let icon = null;

                          if (isCorrectAnswer) {
                            bgColor = 'bg-green-50';
                            textColor = 'text-green-800';
                            icon = '✓';
                          } else if (isUserAnswer && !result.isCorrect) {
                            bgColor = 'bg-red-50';
                            textColor = 'text-red-800';
                            icon = '✗';
                          }

                          return (
                            <div
                              key={optIndex}
                              className={`flex items-center gap-2 p-2 rounded-lg ${bgColor} ${textColor}`}
                            >
                              {icon && <span className="font-bold">{icon}</span>}
                              <span>{option}</span>
                              {isUserAnswer && <span className="text-xs ml-auto">(Tu respuesta)</span>}
                            </div>
                          );
                        })}
                      </div>

                      {/* Explanation */}
                      {result.explanation && (
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm text-blue-800">
                            <span className="font-semibold">Explicacion:</span> {result.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex flex-col sm:flex-row gap-4 justify-center">
            {results.canRetry && (
              <button
                onClick={handleRetry}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium"
              >
                Intentar de nuevo
                {results.attemptsRemaining !== 'unlimited' && (
                  <span className="ml-2 text-sm opacity-80">
                    ({results.attemptsRemaining} intentos restantes)
                  </span>
                )}
              </button>
            )}
            <button
              onClick={() => navigate(-1)}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium"
            >
              Volver al curso
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quiz start screen
  if (!quizStarted) {
    return (
      <div className="min-h-screen bg-gray-50 py-8">
        <div className="max-w-2xl mx-auto px-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="bg-primary-600 text-white p-6">
              <h1 className="text-2xl font-bold mb-2">{quiz?.title}</h1>
              <p className="text-primary-100">{quiz?.description}</p>
            </div>

            {/* Quiz info */}
            <div className="p-6">
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-primary-600">{quiz?.totalQuestions}</div>
                  <div className="text-sm text-gray-500">Preguntas</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-primary-600">{quiz?.totalPoints}</div>
                  <div className="text-sm text-gray-500">Puntos totales</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-primary-600">
                    {quiz?.timeLimitMinutes ? `${quiz.timeLimitMinutes} min` : 'Sin limite'}
                  </div>
                  <div className="text-sm text-gray-500">Tiempo</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-primary-600">{quiz?.passingScore}%</div>
                  <div className="text-sm text-gray-500">Para aprobar</div>
                </div>
              </div>

              {/* Start button */}
              <button
                onClick={handleStartQuiz}
                className="w-full py-4 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-semibold text-lg transition-colors"
              >
                Comenzar Quiz
              </button>

              <p className="text-center text-sm text-gray-500 mt-4">
                {quiz?.maxAttempts > 0
                  ? `Tienes ${quiz.maxAttempts} intentos permitidos`
                  : 'Intentos ilimitados'}
              </p>
            </div>
          </div>

          {/* Back button */}
          <div className="mt-4 text-center">
            <button
              onClick={() => navigate(-1)}
              className="text-gray-600 hover:text-gray-900"
            >
              ← Volver al curso
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Quiz in progress
  const currentQ = questions[currentQuestion];
  const answeredCount = Object.keys(answers).length;
  const progress = (answeredCount / questions.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4">
        {/* Header with timer */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-semibold text-gray-900">{quiz?.title}</h1>
              <p className="text-sm text-gray-500">
                Pregunta {currentQuestion + 1} de {questions.length}
              </p>
            </div>
            {timeRemaining !== null && (
              <div className={`text-xl font-mono font-bold ${
                timeRemaining < 60 ? 'text-red-600 animate-pulse' : 'text-gray-900'
              }`}>
                ⏱ {formatTime(timeRemaining)}
              </div>
            )}
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>{answeredCount} de {questions.length} respondidas</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-primary-600 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* Timeout/Network Error Banner */}
        {submitError && (
          <div className={`mb-6 rounded-xl border p-4 ${
            isTimeoutError
              ? 'bg-amber-50 border-amber-300'
              : 'bg-red-50 border-red-300'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`flex-shrink-0 text-2xl ${
                isTimeoutError ? 'text-amber-500' : 'text-red-500'
              }`}>
                {isTimeoutError ? '⏱' : '⚠'}
              </div>
              <div className="flex-1">
                <h3 className={`font-semibold mb-1 ${
                  isTimeoutError ? 'text-amber-800' : 'text-red-800'
                }`}>
                  {isTimeoutError ? 'Tiempo de espera agotado' : 'Error al enviar'}
                </h3>
                <p className={`text-sm mb-3 ${
                  isTimeoutError ? 'text-amber-700' : 'text-red-700'
                }`}>
                  {submitError}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={handleRetrySubmit}
                    disabled={submitting}
                    className={`px-4 py-2 rounded-lg font-medium text-white transition-colors ${
                      isTimeoutError
                        ? 'bg-amber-600 hover:bg-amber-700 disabled:bg-amber-400'
                        : 'bg-red-600 hover:bg-red-700 disabled:bg-red-400'
                    }`}
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Reintentando...
                      </span>
                    ) : (
                      <>
                        Reintentar envio
                        {retryCount > 0 && <span className="ml-1 text-xs opacity-80">(intento {retryCount + 1})</span>}
                      </>
                    )}
                  </button>
                  <button
                    onClick={handleDismissError}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isTimeoutError
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        : 'bg-red-100 text-red-800 hover:bg-red-200'
                    }`}
                  >
                    Continuar respondiendo
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-3">
                  💾 Tus {Object.keys(answers).length} respuestas estan guardadas y no se perderan.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Question card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="p-6">
            <div className="flex items-start gap-4 mb-6">
              <div className="flex-shrink-0 w-10 h-10 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center font-bold">
                {currentQuestion + 1}
              </div>
              <p className="text-lg text-gray-900 pt-1.5">{currentQ?.question}</p>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {currentQ?.options.map((option, index) => {
                const isSelected = answers[currentQ.id] === option;
                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(currentQ.id, option)}
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary-600 bg-primary-50 text-primary-900'
                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                        isSelected
                          ? 'border-primary-600 bg-primary-600'
                          : 'border-gray-300'
                      }`}>
                        {isSelected && (
                          <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                      <span>{option}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
            className="px-4 py-2 text-gray-600 hover:text-gray-900 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ← Anterior
          </button>

          {/* Question dots */}
          <div className="flex gap-2 flex-wrap justify-center max-w-md">
            {questions.map((q, index) => (
              <button
                key={q.id}
                onClick={() => setCurrentQuestion(index)}
                className={`w-8 h-8 rounded-full text-sm font-medium transition-colors ${
                  currentQuestion === index
                    ? 'bg-primary-600 text-white'
                    : answers[q.id]
                      ? 'bg-primary-100 text-primary-600'
                      : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                }`}
              >
                {index + 1}
              </button>
            ))}
          </div>

          {currentQuestion < questions.length - 1 ? (
            <button
              onClick={handleNext}
              className="px-4 py-2 text-primary-600 hover:text-primary-700 font-medium"
            >
              Siguiente →
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50"
            >
              {submitting ? 'Enviando...' : 'Enviar Quiz'}
            </button>
          )}
        </div>

        {/* Submit button (always visible) */}
        {answeredCount === questions.length && currentQuestion < questions.length - 1 && (
          <div className="mt-6 text-center">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="px-8 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold disabled:opacity-50"
            >
              {submitting ? 'Enviando...' : '✓ Enviar Quiz'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default QuizPage;
