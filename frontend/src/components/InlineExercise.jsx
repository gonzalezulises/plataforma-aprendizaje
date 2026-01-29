import React, { useState, useCallback, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { extractSolution, extractCodeBlocks } from '../utils/exercise-parser';

// Lazy-load ExecutableCodeBlock
const ExecutableCodeBlock = React.lazy(() => import('./ExecutableCodeBlock'));

/**
 * InlineExercise - Code exercise rendered inline within lesson content.
 *
 * Features:
 * - Renders exercise prompt/instructions
 * - Embedded executable code editor
 * - "Ver solucion" toggle (only available after at least one execution attempt)
 * - Collapsible solution with explanation
 *
 * Props:
 * - content: raw markdown of the exercise section
 * - language: 'python' | 'sql'
 * - exerciseType: 'code' | 'text'
 * - courseContext: { language }
 * - onComplete: callback when exercise is attempted
 * - exerciseIndex: unique index within lesson
 */
function InlineExercise({ content, language = 'python', exerciseType = 'code', courseContext = {}, onComplete, exerciseIndex }) {
  const [hasAttempted, setHasAttempted] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  // Parse the exercise content
  const parsed = useMemo(() => {
    const solution = extractSolution(content);
    const codeBlocks = extractCodeBlocks(content);

    // Get the starter code (first code block) and solution code (from details or second block)
    const starterCode = codeBlocks.length > 0 ? codeBlocks[0] : null;
    const solutionCode = codeBlocks.length > 1 ? codeBlocks[1] : null;

    // Get the instruction text (everything before the first code block or details)
    let instructionText = content;
    // Remove code blocks from instruction text
    instructionText = instructionText.replace(/```[\s\S]*?```/g, '');
    // Remove details blocks
    instructionText = instructionText.replace(/<details>[\s\S]*?<\/details>/g, '');
    // Clean up
    instructionText = instructionText.trim();

    return {
      instructions: instructionText,
      starterCode,
      solutionCode,
      solution,
      language: starterCode?.language || language
    };
  }, [content, language]);

  const handleAttempt = useCallback(() => {
    if (!hasAttempted) {
      setHasAttempted(true);
      if (onComplete) {
        onComplete({ exerciseIndex, attempted: true });
      }
    }
  }, [hasAttempted, onComplete, exerciseIndex]);

  return (
    <div className="my-6 rounded-xl border border-indigo-200 dark:border-indigo-800 overflow-hidden bg-white dark:bg-gray-800/50">
      {/* Exercise header */}
      <div className="px-5 py-3 bg-indigo-50 dark:bg-indigo-900/20 border-b border-indigo-200 dark:border-indigo-800 flex items-center gap-3">
        <div className="p-1.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-lg">
          <svg className="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
        </div>
        <div>
          <h3 className="font-semibold text-indigo-900 dark:text-indigo-100 text-sm">
            Ejercicio de Codigo
          </h3>
          <span className="text-xs text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">
            {parsed.language}
          </span>
        </div>
        {hasAttempted && (
          <div className="ml-auto flex items-center gap-1 text-green-600 dark:text-green-400">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span className="text-xs font-medium">Intentado</span>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="px-5 py-4">
        <div className="prose prose-sm dark:prose-invert max-w-none text-gray-700 dark:text-gray-300">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {parsed.instructions}
          </ReactMarkdown>
        </div>
      </div>

      {/* Code editor */}
      {parsed.starterCode && exerciseType === 'code' && (
        <div className="px-5 pb-4" onClick={handleAttempt}>
          <React.Suspense fallback={
            <div className="bg-gray-900 rounded-lg p-4">
              <pre className="font-mono text-sm text-gray-400">Cargando editor...</pre>
            </div>
          }>
            <ExecutableCodeBlock
              code={parsed.starterCode.code}
              language={parsed.language}
              courseContext={courseContext}
            />
          </React.Suspense>
        </div>
      )}

      {/* Solution toggle */}
      <div className="px-5 pb-4">
        <button
          onClick={() => {
            if (!hasAttempted) return;
            setShowSolution(!showSolution);
          }}
          disabled={!hasAttempted}
          className={`text-sm flex items-center gap-2 transition-colors ${
            hasAttempted
              ? 'text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 cursor-pointer'
              : 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
          }`}
          title={!hasAttempted ? 'Ejecuta el codigo al menos una vez para ver la solucion' : ''}
        >
          <svg
            className={`w-4 h-4 transition-transform ${showSolution ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {showSolution ? 'Ocultar solucion' : 'Ver solucion'}
          {!hasAttempted && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              (intenta primero)
            </span>
          )}
        </button>

        {/* Solution content */}
        {showSolution && parsed.solution && (
          <div className="mt-3 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Solucion</span>
            </div>
            <div className="prose prose-sm dark:prose-invert max-w-none prose-pre:bg-gray-900 dark:prose-pre:bg-gray-950">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {parsed.solution}
              </ReactMarkdown>
            </div>
          </div>
        )}

        {/* Show solution code block if available and no parsed solution */}
        {showSolution && !parsed.solution && parsed.solutionCode && (
          <div className="mt-3 p-4 bg-emerald-50 dark:bg-emerald-900/10 rounded-lg border border-emerald-200 dark:border-emerald-800">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
              <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Solucion</span>
            </div>
            <pre className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 overflow-x-auto">
              <code className="font-mono text-sm text-green-400">{parsed.solutionCode.code}</code>
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export default InlineExercise;
