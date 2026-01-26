import React, { useState, useEffect, useCallback, useRef } from 'react';

const API_BASE = 'http://localhost:3001/api';

// Generate a random session ID without uuid library
function generateSessionId() {
  return 'session-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 15);
}

/**
 * InteractiveNotebook - Jupyter-style notebook with code cells and persistent state
 * Cell outputs are saved to the backend and persist across navigation
 */
function InteractiveNotebook({ notebookId }) {
  const [notebook, setNotebook] = useState(null);
  const [cellStates, setCellStates] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [executingCells, setExecutingCells] = useState(new Set());
  const sessionIdRef = useRef(localStorage.getItem('notebookSessionId') || generateSessionId());

  // Store session ID in localStorage
  useEffect(() => {
    localStorage.setItem('notebookSessionId', sessionIdRef.current);
  }, []);

  // Fetch notebook and its state
  useEffect(() => {
    async function fetchNotebookAndState() {
      setLoading(true);
      setError(null);

      try {
        // Fetch notebook structure
        const notebookRes = await fetch(`${API_BASE}/notebooks/${notebookId}`, {
          credentials: 'include'
        });

        if (!notebookRes.ok) {
          throw new Error('Failed to fetch notebook');
        }

        const notebookData = await notebookRes.json();
        setNotebook(notebookData);

        // Fetch persisted state (cell outputs)
        const stateRes = await fetch(
          `${API_BASE}/notebooks/${notebookId}/state?sessionId=${sessionIdRef.current}`,
          { credentials: 'include' }
        );

        if (stateRes.ok) {
          const stateData = await stateRes.json();
          setCellStates(stateData.cellStates || {});
        }
      } catch (err) {
        console.error('Error fetching notebook:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    if (notebookId) {
      fetchNotebookAndState();
    }
  }, [notebookId]);

  // Save cell states to backend (debounced)
  const saveStateTimeoutRef = useRef(null);

  const saveState = useCallback(async (newCellStates) => {
    // Clear any pending save
    if (saveStateTimeoutRef.current) {
      clearTimeout(saveStateTimeoutRef.current);
    }

    // Debounce the save
    saveStateTimeoutRef.current = setTimeout(async () => {
      try {
        await fetch(`${API_BASE}/notebooks/${notebookId}/state`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            cellStates: newCellStates,
            sessionId: sessionIdRef.current
          })
        });
      } catch (err) {
        console.error('Error saving notebook state:', err);
      }
    }, 500);
  }, [notebookId]);

  // Execute a code cell
  const executeCell = async (cellId, code) => {
    setExecutingCells(prev => new Set([...prev, cellId]));

    try {
      const res = await fetch(`${API_BASE}/notebooks/${notebookId}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          cellId,
          code,
          language: 'python'
        })
      });

      const result = await res.json();

      // Update cell state with output
      const newCellStates = {
        ...cellStates,
        [cellId]: {
          output: result.output || '',
          error: result.error || null,
          executedAt: result.executedAt
        }
      };

      setCellStates(newCellStates);
      saveState(newCellStates);
    } catch (err) {
      console.error('Error executing cell:', err);
      const newCellStates = {
        ...cellStates,
        [cellId]: {
          output: '',
          error: 'Execution failed: ' + err.message,
          executedAt: new Date().toISOString()
        }
      };
      setCellStates(newCellStates);
      saveState(newCellStates);
    } finally {
      setExecutingCells(prev => {
        const newSet = new Set(prev);
        newSet.delete(cellId);
        return newSet;
      });
    }
  };

  // Clear cell output
  const clearCellOutput = (cellId) => {
    const newCellStates = { ...cellStates };
    delete newCellStates[cellId];
    setCellStates(newCellStates);
    saveState(newCellStates);
  };

  // Clear all outputs
  const clearAllOutputs = async () => {
    setCellStates({});
    try {
      await fetch(`${API_BASE}/notebooks/${notebookId}/state?sessionId=${sessionIdRef.current}`, {
        method: 'DELETE',
        credentials: 'include'
      });
    } catch (err) {
      console.error('Error clearing notebook state:', err);
    }
  };

  // Feature #136: Handle code changes in cells - persist edited code
  const handleCellCodeChange = useCallback((cellId, newCode) => {
    const newCellStates = {
      ...cellStates,
      [cellId]: {
        ...cellStates[cellId],
        editedCode: newCode
      }
    };
    setCellStates(newCellStates);
    saveState(newCellStates);
  }, [cellStates, saveState]);

  // Run all cells - Feature #136: Use edited code if available
  const runAllCells = async () => {
    if (!notebook?.cells) return;

    const codeCells = notebook.cells
      .filter(cell => cell.type === 'code')
      .sort((a, b) => a.order - b.order);

    for (const cell of codeCells) {
      // Use edited code from cellStates if available, otherwise use original content
      const codeToExecute = cellStates[cell.id]?.editedCode || cell.content;
      await executeCell(cell.id, codeToExecute);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">Cargando notebook...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <p className="text-red-600 dark:text-red-400">Error: {error}</p>
      </div>
    );
  }

  if (!notebook) {
    return (
      <div className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg">
        <p className="text-gray-600 dark:text-gray-400">Notebook no encontrado</p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
      {/* Notebook header */}
      <div className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {notebook.title}
            </h2>
            {notebook.description && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {notebook.description}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={runAllCells}
              disabled={executingCells.size > 0}
              className="px-3 py-1.5 bg-success-500 hover:bg-success-600 disabled:bg-gray-400 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Ejecutar todo
            </button>
            <button
              onClick={clearAllOutputs}
              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg transition-colors"
            >
              Limpiar salidas
            </button>
          </div>
        </div>
      </div>

      {/* Cells */}
      <div className="divide-y divide-gray-200 dark:divide-gray-700">
        {notebook.cells
          .sort((a, b) => a.order - b.order)
          .map((cell, index) => (
            <NotebookCell
              key={cell.id}
              cell={cell}
              cellState={cellStates[cell.id]}
              isExecuting={executingCells.has(cell.id)}
              onExecute={(code) => executeCell(cell.id, code)}
              onClearOutput={() => clearCellOutput(cell.id)}
              onCodeChange={handleCellCodeChange}
              cellNumber={index + 1}
            />
          ))}
      </div>
    </div>
  );
}

/**
 * NotebookCell - Individual cell component (markdown or code)
 * Feature #136: Code editor content survives navigation
 */
function NotebookCell({ cell, cellState, isExecuting, onExecute, onClearOutput, onCodeChange, cellNumber }) {
  // Feature #136: Initialize with saved edited code if available, otherwise use original content
  const [editableCode, setEditableCode] = useState(cellState?.editedCode || cell.content);

  // Reset editable code when cell content changes (but not if we have saved edited code)
  useEffect(() => {
    // Only reset to cell.content if there's no saved edited code
    if (!cellState?.editedCode) {
      setEditableCode(cell.content);
    }
  }, [cell.content, cellState?.editedCode]);

  // Feature #136: Save code changes to parent for persistence
  const handleCodeChange = (newCode) => {
    setEditableCode(newCode);
    if (onCodeChange) {
      onCodeChange(cell.id, newCode);
    }
  };

  if (cell.type === 'markdown') {
    return (
      <div className="p-4">
        <div className="prose dark:prose-invert max-w-none">
          {/* Simple markdown rendering */}
          {cell.content.split('\n').map((line, i) => {
            if (line.startsWith('# ')) {
              return <h1 key={i} className="text-2xl font-bold text-gray-900 dark:text-white mt-4 mb-2">{line.slice(2)}</h1>;
            }
            if (line.startsWith('## ')) {
              return <h2 key={i} className="text-xl font-bold text-gray-900 dark:text-white mt-4 mb-2">{line.slice(3)}</h2>;
            }
            if (line.startsWith('### ')) {
              return <h3 key={i} className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-3 mb-1">{line.slice(4)}</h3>;
            }
            if (line.trim() === '') {
              return <br key={i} />;
            }
            // Handle inline code
            const parts = line.split(/`([^`]+)`/);
            return (
              <p key={i} className="text-gray-700 dark:text-gray-300 mb-2">
                {parts.map((part, j) =>
                  j % 2 === 1
                    ? <code key={j} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-primary-600 dark:text-primary-400">{part}</code>
                    : part
                )}
              </p>
            );
          })}
        </div>
      </div>
    );
  }

  // Code cell
  return (
    <div className="p-4">
      {/* Cell header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
          In [{cellState?.executedAt ? cellNumber : ' '}]:
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onExecute(editableCode)}
            disabled={isExecuting}
            className="px-2 py-1 bg-success-500 hover:bg-success-600 disabled:bg-gray-400 text-white text-xs font-medium rounded transition-colors flex items-center gap-1"
          >
            {isExecuting ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                Ejecutando...
              </>
            ) : (
              <>
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                </svg>
                Ejecutar
              </>
            )}
          </button>
          <button
            onClick={() => setEditableCode(cell.content)}
            className="px-2 py-1 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-400 text-xs font-medium rounded transition-colors"
          >
            Resetear
          </button>
        </div>
      </div>

      {/* Code editor */}
      <div className="relative">
        <textarea
          value={editableCode}
          onChange={(e) => handleCodeChange(e.target.value)}
          className="w-full p-4 bg-gray-900 dark:bg-gray-950 text-gray-100 font-mono text-sm rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
          rows={Math.max(3, editableCode.split('\n').length)}
          spellCheck={false}
        />
        <span className="absolute top-2 right-2 text-xs text-gray-500 font-mono uppercase">
          {cell.language || 'python'}
        </span>
      </div>

      {/* Output */}
      {(cellState?.output || cellState?.error) && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
              Out [{cellNumber}]:
            </span>
            <button
              onClick={onClearOutput}
              className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Limpiar
            </button>
          </div>
          <div className={`p-3 rounded-lg font-mono text-sm whitespace-pre-wrap ${
            cellState?.error
              ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-800'
              : 'bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200'
          }`}>
            {cellState?.error || cellState?.output || '(No output)'}
          </div>
        </div>
      )}
    </div>
  );
}

export default InteractiveNotebook;
