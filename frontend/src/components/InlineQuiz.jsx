import React, { useState, useCallback } from 'react';

/**
 * InlineQuiz - MCQ quiz rendered inline within lesson content.
 *
 * Props:
 * - questions: Array of { question, options: [{ label, text, isCorrect }], explanation, correctAnswer }
 * - onComplete: (results) => void - callback when all questions are answered
 * - exerciseIndex: number - unique index within the lesson for progress tracking
 * - initialProgress: { answered, correct } - restored progress
 */
function InlineQuiz({ questions = [], onComplete, exerciseIndex, initialProgress }) {
  const [answers, setAnswers] = useState({}); // { questionIndex: selectedLabel }
  const [submitted, setSubmitted] = useState({}); // { questionIndex: true }
  const [showExplanation, setShowExplanation] = useState({});

  const handleSelect = useCallback((questionIdx, label) => {
    if (submitted[questionIdx]) return; // Already answered
    setAnswers(prev => ({ ...prev, [questionIdx]: label }));
  }, [submitted]);

  const handleSubmit = useCallback((questionIdx) => {
    if (!answers[questionIdx]) return;
    setSubmitted(prev => {
      const updated = { ...prev, [questionIdx]: true };

      // Check if all questions are answered
      const allAnswered = questions.every((_, idx) => updated[idx]);
      if (allAnswered && onComplete) {
        const results = questions.map((q, idx) => ({
          questionIndex: idx,
          selected: answers[idx],
          correct: q.options.find(o => o.label === answers[idx])?.isCorrect || false
        }));
        onComplete(results);
      }

      return updated;
    });
  }, [answers, questions, onComplete]);

  const toggleExplanation = useCallback((questionIdx) => {
    setShowExplanation(prev => ({ ...prev, [questionIdx]: !prev[questionIdx] }));
  }, []);

  if (!questions || questions.length === 0) {
    return null;
  }

  const totalAnswered = Object.keys(submitted).length;
  const totalCorrect = questions.filter((q, idx) =>
    submitted[idx] && q.options.find(o => o.label === answers[idx])?.isCorrect
  ).length;

  return (
    <div className="my-6 space-y-6">
      {/* Quiz header */}
      <div className="flex items-center gap-3 pb-3 border-b border-gray-200 dark:border-gray-700">
        <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
          <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 dark:text-white">
            Quiz Interactivo
          </h3>
          {totalAnswered > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {totalCorrect}/{totalAnswered} correctas
              {totalAnswered === questions.length && (
                <span className={`ml-2 font-medium ${
                  totalCorrect === questions.length
                    ? 'text-green-600 dark:text-green-400'
                    : totalCorrect >= questions.length / 2
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-600 dark:text-red-400'
                }`}>
                  ({Math.round((totalCorrect / questions.length) * 100)}%)
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Questions */}
      {questions.map((q, qIdx) => {
        const selectedLabel = answers[qIdx];
        const isSubmitted = submitted[qIdx];
        const selectedOption = q.options.find(o => o.label === selectedLabel);
        const isCorrect = selectedOption?.isCorrect;

        return (
          <div
            key={qIdx}
            className={`p-4 rounded-lg border transition-colors ${
              isSubmitted
                ? isCorrect
                  ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10'
                  : 'border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800/50'
            }`}
          >
            {/* Question text */}
            <p className="font-medium text-gray-900 dark:text-white mb-3">
              {questions.length > 1 && (
                <span className="text-gray-400 dark:text-gray-500 mr-2">{qIdx + 1}.</span>
              )}
              {q.question}
            </p>

            {/* Options */}
            <div className="space-y-2">
              {q.options.map((opt) => {
                const isSelected = selectedLabel === opt.label;
                const showCorrect = isSubmitted && opt.isCorrect;
                const showWrong = isSubmitted && isSelected && !opt.isCorrect;

                return (
                  <button
                    key={opt.label}
                    onClick={() => handleSelect(qIdx, opt.label)}
                    disabled={isSubmitted}
                    className={`w-full text-left px-4 py-3 rounded-lg border-2 transition-all flex items-start gap-3 ${
                      showCorrect
                        ? 'border-green-500 bg-green-50 dark:bg-green-900/20'
                        : showWrong
                        ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                        : isSelected
                        ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    } ${isSubmitted ? 'cursor-default' : 'cursor-pointer'}`}
                  >
                    {/* Option label circle */}
                    <span className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold border-2 ${
                      showCorrect
                        ? 'border-green-500 bg-green-500 text-white'
                        : showWrong
                        ? 'border-red-500 bg-red-500 text-white'
                        : isSelected
                        ? 'border-primary-500 bg-primary-500 text-white'
                        : 'border-gray-300 dark:border-gray-500 text-gray-500 dark:text-gray-400'
                    }`}>
                      {showCorrect ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : showWrong ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      ) : (
                        opt.label
                      )}
                    </span>

                    {/* Option text */}
                    <span className={`text-sm pt-1 ${
                      showCorrect
                        ? 'text-green-800 dark:text-green-200 font-medium'
                        : showWrong
                        ? 'text-red-800 dark:text-red-200'
                        : 'text-gray-700 dark:text-gray-300'
                    }`}>
                      {opt.text}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Submit button */}
            {!isSubmitted && selectedLabel && (
              <button
                onClick={() => handleSubmit(qIdx)}
                className="mt-3 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Verificar respuesta
              </button>
            )}

            {/* Result feedback */}
            {isSubmitted && (
              <div className={`mt-3 p-3 rounded-lg ${
                isCorrect
                  ? 'bg-green-100 dark:bg-green-900/30'
                  : 'bg-red-100 dark:bg-red-900/30'
              }`}>
                <p className={`text-sm font-medium ${
                  isCorrect
                    ? 'text-green-800 dark:text-green-200'
                    : 'text-red-800 dark:text-red-200'
                }`}>
                  {isCorrect ? 'Correcto!' : 'Incorrecto'}
                  {!isCorrect && q.correctAnswer && (
                    <span className="font-normal ml-1">
                      - La respuesta correcta es ({q.correctAnswer})
                    </span>
                  )}
                </p>
              </div>
            )}

            {/* Explanation toggle */}
            {isSubmitted && q.explanation && (
              <div className="mt-2">
                <button
                  onClick={() => toggleExplanation(qIdx)}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-1"
                >
                  <svg
                    className={`w-4 h-4 transition-transform ${showExplanation[qIdx] ? 'rotate-90' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  {showExplanation[qIdx] ? 'Ocultar explicacion' : 'Ver explicacion'}
                </button>
                {showExplanation[qIdx] && (
                  <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-sm text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800">
                    {q.explanation}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Summary when all answered */}
      {totalAnswered === questions.length && questions.length > 1 && (
        <div className={`p-4 rounded-lg border text-center ${
          totalCorrect === questions.length
            ? 'border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-900/10'
            : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50'
        }`}>
          <p className="font-semibold text-gray-900 dark:text-white">
            Resultado: {totalCorrect} de {questions.length} correctas ({Math.round((totalCorrect / questions.length) * 100)}%)
          </p>
        </div>
      )}
    </div>
  );
}

export default InlineQuiz;
