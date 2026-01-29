import React, { useState, useRef, useCallback, useEffect } from 'react';
import { usePyodide } from '../hooks/usePyodide';
import { useSQLite } from '../hooks/useSQLite';

/**
 * ExecutableCodeBlock - Editable code block with in-browser execution.
 *
 * Supports Python (via Pyodide WASM) and SQL (via sql.js WASM).
 * Features:
 * - Editable textarea with line numbers
 * - Run button (Cmd/Ctrl+Enter)
 * - Output panel (stdout for Python, table for SQL)
 * - Reset to original code
 * - Lazy runtime loading (only loads when user clicks Run)
 */
function ExecutableCodeBlock({ code, language, courseContext = {} }) {
  const [currentCode, setCurrentCode] = useState(code);
  const [output, setOutput] = useState(null);
  const [error, setError] = useState(null);
  const [sqlResult, setSqlResult] = useState(null);
  const [runtimeLoaded, setRuntimeLoaded] = useState(false);
  const textareaRef = useRef(null);

  const isPython = language === 'python';
  const isSQL = language === 'sql';

  const pyodide = usePyodide();
  const sqlite = useSQLite();

  const runtime = isPython ? pyodide : sqlite;
  const isModified = currentCode !== code;

  // Load runtime when first needed
  const ensureRuntime = useCallback(async () => {
    if (runtime.isReady) return true;
    if (!runtimeLoaded) {
      setRuntimeLoaded(true);
      await runtime.load();
    }
    return runtime.isReady;
  }, [runtime, runtimeLoaded]);

  // Handle running code
  const handleRun = useCallback(async () => {
    if (runtime.isRunning) return;

    setOutput(null);
    setError(null);
    setSqlResult(null);

    // Load runtime if needed
    if (!runtime.isReady) {
      setRuntimeLoaded(true);
      await runtime.load();
      // Check if load was successful - need to wait for state update
      // The runtime.isReady won't be updated yet, so we check the promise
    }

    if (isPython) {
      const result = await pyodide.runCode(currentCode);
      if (result.error) {
        setError(result.error);
      }
      if (result.output) {
        setOutput(result.output);
      }
      if (!result.output && !result.error) {
        setOutput('(Sin salida)');
      }
    } else if (isSQL) {
      const result = await sqlite.runQuery(currentCode);
      if (result.error) {
        setError(result.error);
      } else if (result.columns.length > 0) {
        setSqlResult(result);
      } else {
        setOutput(result.message || 'Consulta ejecutada correctamente');
      }
    }
  }, [currentCode, isPython, isSQL, pyodide, sqlite, runtime]);

  // Keyboard shortcut: Cmd/Ctrl + Enter to run
  const handleKeyDown = useCallback((e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
    // Tab support in textarea
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.target.selectionStart;
      const end = e.target.selectionEnd;
      const value = e.target.value;
      const newValue = value.substring(0, start) + '    ' + value.substring(end);
      setCurrentCode(newValue);
      // Restore cursor position after React re-render
      requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 4;
          textareaRef.current.selectionEnd = start + 4;
        }
      });
    }
  }, [handleRun]);

  const handleReset = useCallback(() => {
    setCurrentCode(code);
    setOutput(null);
    setError(null);
    setSqlResult(null);
  }, [code]);

  const lines = currentCode.split('\n');
  const isLoadingRuntime = runtime.isLoading || (runtimeLoaded && !runtime.isReady && !runtime.error);

  return (
    <div className="my-4 rounded-lg overflow-hidden shadow-lg border border-gray-700 dark:border-gray-600">
      {/* Header */}
      <div className="bg-gray-800 dark:bg-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          <span className="ml-3 text-xs font-medium text-gray-400 uppercase tracking-wide">
            {language}
          </span>
          {isModified && (
            <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
              Modificado
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(currentCode);
              } catch (err) {
                console.error('Failed to copy:', err);
              }
            }}
            className="text-gray-400 hover:text-white transition-colors text-xs flex items-center gap-1"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copiar
          </button>
        </div>
      </div>

      {/* Code Editor */}
      <div className="relative bg-gray-900 dark:bg-gray-950">
        {/* Line numbers */}
        <div
          className="absolute left-0 top-0 p-4 pr-0 font-mono text-xs pointer-events-none select-none text-gray-500"
          aria-hidden="true"
        >
          {lines.map((_, idx) => (
            <div key={idx} className="h-[1.375rem] text-right w-8 leading-[1.375rem]">
              {idx + 1}
            </div>
          ))}
        </div>

        <textarea
          ref={textareaRef}
          value={currentCode}
          onChange={(e) => setCurrentCode(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full p-4 pl-14 font-mono text-sm bg-transparent text-green-400 resize-y focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:ring-inset overflow-auto leading-[1.375rem]"
          spellCheck={false}
          style={{
            minHeight: `${Math.max(120, lines.length * 22 + 32)}px`,
            tabSize: 4,
            caretColor: '#4ade80'
          }}
        />
      </div>

      {/* Action Bar */}
      <div className="bg-gray-800 dark:bg-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex gap-2">
          <button
            onClick={handleRun}
            disabled={runtime.isRunning || isLoadingRuntime}
            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-800 disabled:cursor-not-allowed text-white rounded text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            {isLoadingRuntime ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Cargando {isPython ? 'Python' : 'SQL'}...
              </>
            ) : runtime.isRunning ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
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
            onClick={handleReset}
            disabled={!isModified && !output && !error && !sqlResult}
            className="px-3 py-1.5 bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-gray-200 rounded text-sm font-medium transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Reset
          </button>
        </div>
        <span className="text-xs text-gray-400">
          {isPython ? '⌘' : 'Ctrl'}+Enter para ejecutar
        </span>
      </div>

      {/* Output Panel */}
      {(output || error || sqlResult) && (
        <div className="border-t border-gray-700">
          {/* Error output */}
          {error && (
            <div className="bg-red-950/50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-red-400">Error</span>
              </div>
              <pre className="font-mono text-sm text-red-300 whitespace-pre-wrap overflow-x-auto">{error}</pre>
            </div>
          )}

          {/* Standard output */}
          {output && (
            <div className="bg-gray-900 dark:bg-gray-950 p-4">
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-sm font-medium text-green-400">Salida</span>
              </div>
              <pre className="font-mono text-sm text-gray-200 whitespace-pre-wrap overflow-x-auto">{output}</pre>
            </div>
          )}

          {/* SQL Table Result */}
          {sqlResult && sqlResult.columns.length > 0 && (
            <div className="bg-gray-900 dark:bg-gray-950 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm font-medium text-blue-400">Resultado</span>
                </div>
                <span className="text-xs text-gray-500">
                  {sqlResult.rows.length} fila{sqlResult.rows.length !== 1 ? 's' : ''}
                  {sqlResult.executionTime ? ` | ${sqlResult.executionTime}ms` : ''}
                </span>
              </div>
              <div className="overflow-x-auto rounded border border-gray-700">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800">
                      {sqlResult.columns.map((col, i) => (
                        <th key={i} className="px-3 py-2 text-left text-xs font-semibold text-gray-300 uppercase tracking-wider border-b border-gray-700">
                          {col}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                    {sqlResult.rows.slice(0, 100).map((row, rowIdx) => (
                      <tr key={rowIdx} className={rowIdx % 2 === 0 ? 'bg-gray-900' : 'bg-gray-900/50'}>
                        {sqlResult.columns.map((col, colIdx) => (
                          <td key={colIdx} className="px-3 py-1.5 text-gray-300 font-mono whitespace-nowrap">
                            {row[col] === null ? (
                              <span className="text-gray-500 italic">NULL</span>
                            ) : (
                              String(row[col])
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {sqlResult.rows.length > 100 && (
                  <div className="px-3 py-2 text-xs text-gray-500 bg-gray-800 text-center">
                    Mostrando 100 de {sqlResult.rows.length} filas
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Runtime loading info */}
      {runtime.error && (
        <div className="bg-amber-950/50 px-4 py-2 text-sm text-amber-400 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          Error cargando runtime: {runtime.error.message || String(runtime.error)}
        </div>
      )}
    </div>
  );
}

export default ExecutableCodeBlock;
