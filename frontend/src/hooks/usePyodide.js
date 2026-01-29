import { useState, useRef, useCallback, useEffect } from 'react';

const PYODIDE_CDN = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/';

// Singleton: only load Pyodide once across all component instances
let pyodidePromise = null;
let pyodideInstance = null;

function loadPyodideScript() {
  return new Promise((resolve, reject) => {
    if (window.loadPyodide) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = `${PYODIDE_CDN}pyodide.js`;
    script.onload = resolve;
    script.onerror = () => reject(new Error('Failed to load Pyodide script'));
    document.head.appendChild(script);
  });
}

async function initPyodide() {
  if (pyodideInstance) return pyodideInstance;
  if (pyodidePromise) return pyodidePromise;

  pyodidePromise = (async () => {
    await loadPyodideScript();
    const pyodide = await window.loadPyodide({
      indexURL: PYODIDE_CDN,
    });
    pyodideInstance = pyodide;
    return pyodide;
  })();

  return pyodidePromise;
}

/**
 * usePyodide - Hook for Python code execution via Pyodide (WASM).
 *
 * Returns:
 * - isLoading: true while Pyodide is being loaded
 * - isReady: true when Pyodide is ready for execution
 * - error: Error if loading failed
 * - runCode: (code: string) => Promise<{ output, error, executionTime }>
 * - isRunning: true while code is executing
 */
export function usePyodide() {
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(!!pyodideInstance);
  const [error, setError] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const pyodideRef = useRef(pyodideInstance);

  const load = useCallback(async () => {
    if (pyodideRef.current) {
      setIsReady(true);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const pyodide = await initPyodide();
      pyodideRef.current = pyodide;
      setIsReady(true);
    } catch (err) {
      setError(err);
      console.error('[usePyodide] Failed to load:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const runCode = useCallback(async (code) => {
    const pyodide = pyodideRef.current;
    if (!pyodide) {
      return { output: '', error: 'Pyodide no esta listo. Espera a que cargue.', executionTime: 0 };
    }

    setIsRunning(true);
    const startTime = performance.now();

    try {
      // Capture stdout/stderr
      pyodide.runPython(`
import sys
from io import StringIO
__stdout_capture = StringIO()
__stderr_capture = StringIO()
sys.stdout = __stdout_capture
sys.stderr = __stderr_capture
`);

      // Auto-load packages from imports
      await pyodide.loadPackagesFromImports(code);

      // Run user code
      let result;
      try {
        result = await pyodide.runPythonAsync(code);
      } catch (pyErr) {
        // Get stderr output before the error
        const stderr = pyodide.runPython('__stderr_capture.getvalue()');
        const stdout = pyodide.runPython('__stdout_capture.getvalue()');

        // Restore stdout/stderr
        pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`);

        const executionTime = Math.round(performance.now() - startTime);
        return {
          output: stdout || '',
          error: pyErr.message || String(pyErr),
          executionTime
        };
      }

      // Get captured output
      const stdout = pyodide.runPython('__stdout_capture.getvalue()');
      const stderr = pyodide.runPython('__stderr_capture.getvalue()');

      // Restore stdout/stderr
      pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`);

      const executionTime = Math.round(performance.now() - startTime);

      // Build output: stdout + return value (if any and not None)
      let output = stdout || '';
      if (result !== undefined && result !== null && String(result) !== 'None') {
        if (output) output += '\n';
        output += String(result);
      }

      return {
        output,
        error: stderr || null,
        executionTime
      };
    } catch (err) {
      const executionTime = Math.round(performance.now() - startTime);
      // Try to restore stdout/stderr on unexpected error
      try {
        pyodide.runPython(`
sys.stdout = sys.__stdout__
sys.stderr = sys.__stderr__
`);
      } catch (_) { /* ignore */ }

      return {
        output: '',
        error: err.message || String(err),
        executionTime
      };
    } finally {
      setIsRunning(false);
    }
  }, []);

  return {
    isLoading,
    isReady,
    error,
    isRunning,
    load,
    runCode
  };
}

export default usePyodide;
