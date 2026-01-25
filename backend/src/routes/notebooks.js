import express from 'express';
import { queryAll, queryOne, run, saveDatabase } from '../config/database.js';

// Generate a random ID without uuid library
function generateId() {
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 15);
}

const router = express.Router();

/**
 * GET /api/notebooks/:notebookId
 * Get a notebook with its cells
 */
router.get('/:notebookId', (req, res) => {
  try {
    const { notebookId } = req.params;

    // For demo, return a sample notebook if not found in DB
    const notebook = queryOne('SELECT * FROM notebooks WHERE id = ?', [notebookId]);

    if (!notebook) {
      // Return a demo notebook for testing
      return res.json({
        id: notebookId,
        title: 'Introduccion a Python - Notebook Interactivo',
        description: 'Practica conceptos basicos de Python con este notebook interactivo',
        cells: [
          {
            id: 'cell-1',
            type: 'markdown',
            content: '# Variables en Python\n\nLas variables son contenedores para almacenar datos. En Python, no necesitas declarar el tipo de variable.',
            order: 0
          },
          {
            id: 'cell-2',
            type: 'code',
            language: 'python',
            content: '# Asigna tu nombre a la variable\nnombre = "Maria"\nprint(f"Hola, {nombre}!")',
            order: 1
          },
          {
            id: 'cell-3',
            type: 'markdown',
            content: '## Tipos de Datos\n\nPython tiene varios tipos de datos basicos: `str`, `int`, `float`, `bool`, `list`, `dict`',
            order: 2
          },
          {
            id: 'cell-4',
            type: 'code',
            language: 'python',
            content: '# Experimenta con diferentes tipos de datos\nedad = 25\naltura = 1.75\nes_estudiante = True\n\nprint(f"Edad: {edad} (tipo: {type(edad).__name__})")\nprint(f"Altura: {altura} (tipo: {type(altura).__name__})")\nprint(f"Es estudiante: {es_estudiante} (tipo: {type(es_estudiante).__name__})")',
            order: 3
          },
          {
            id: 'cell-5',
            type: 'markdown',
            content: '## Operaciones Matematicas\n\nPuedes realizar operaciones matematicas basicas con numeros.',
            order: 4
          },
          {
            id: 'cell-6',
            type: 'code',
            language: 'python',
            content: '# Calcula el area de un rectangulo\nbase = 10\naltura = 5\narea = base * altura\n\nprint(f"El area del rectangulo es: {area}")',
            order: 5
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
    }

    // Parse cells from JSON string
    const cells = JSON.parse(notebook.cells || '[]');

    res.json({
      id: notebook.id,
      title: notebook.title,
      description: notebook.description,
      cells,
      createdAt: notebook.created_at,
      updatedAt: notebook.updated_at
    });
  } catch (error) {
    console.error('Error fetching notebook:', error);
    res.status(500).json({ error: 'Failed to fetch notebook' });
  }
});

/**
 * GET /api/notebooks/:notebookId/state
 * Get the persisted state (cell outputs) for a notebook
 */
router.get('/:notebookId/state', (req, res) => {
  try {
    const { notebookId } = req.params;
    // Prioritize explicit sessionId from query params over express session
    const sessionId = req.query.sessionId || req.session?.id || 'anonymous';
    const userId = req.session?.user?.id || null;

    // Try to find existing state for this user/session
    let state = null;

    if (userId) {
      state = queryOne(
        'SELECT * FROM notebook_states WHERE notebook_id = ? AND user_id = ? ORDER BY updated_at DESC LIMIT 1',
        [notebookId, userId]
      );
    }

    if (!state) {
      state = queryOne(
        'SELECT * FROM notebook_states WHERE notebook_id = ? AND session_id = ? ORDER BY updated_at DESC LIMIT 1',
        [notebookId, sessionId]
      );
    }

    if (!state) {
      return res.json({
        notebookId,
        cellStates: {},
        createdAt: null,
        updatedAt: null
      });
    }

    const cellStates = JSON.parse(state.cell_states || '{}');

    res.json({
      id: state.id,
      notebookId: state.notebook_id,
      cellStates,
      createdAt: state.created_at,
      updatedAt: state.updated_at
    });
  } catch (error) {
    console.error('Error fetching notebook state:', error);
    res.status(500).json({ error: 'Failed to fetch notebook state' });
  }
});

/**
 * POST /api/notebooks/:notebookId/state
 * Save notebook state (cell outputs) - persists across navigation
 */
router.post('/:notebookId/state', (req, res) => {
  try {
    const { notebookId } = req.params;
    const { cellStates } = req.body;
    // Prioritize explicit sessionId from body over express session
    const sessionId = req.body.sessionId || req.session?.id || generateId();
    const userId = req.session?.user?.id || null;
    const now = new Date().toISOString();

    if (!cellStates || typeof cellStates !== 'object') {
      return res.status(400).json({ error: 'cellStates object is required' });
    }

    // Check if state already exists for this notebook/session
    let existingState = null;

    if (userId) {
      existingState = queryOne(
        'SELECT id FROM notebook_states WHERE notebook_id = ? AND user_id = ?',
        [notebookId, userId]
      );
    }

    if (!existingState) {
      existingState = queryOne(
        'SELECT id FROM notebook_states WHERE notebook_id = ? AND session_id = ?',
        [notebookId, sessionId]
      );
    }

    const cellStatesJson = JSON.stringify(cellStates);

    if (existingState) {
      // Update existing state
      run(
        'UPDATE notebook_states SET cell_states = ?, updated_at = ?, user_id = ? WHERE id = ?',
        [cellStatesJson, now, userId, existingState.id]
      );

      res.json({
        id: existingState.id,
        notebookId,
        sessionId,
        message: 'Notebook state updated successfully'
      });
    } else {
      // Insert new state
      const result = run(
        'INSERT INTO notebook_states (notebook_id, user_id, session_id, cell_states, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [notebookId, userId, sessionId, cellStatesJson, now, now]
      );

      res.json({
        id: result.lastInsertRowid,
        notebookId,
        sessionId,
        message: 'Notebook state saved successfully'
      });
    }
  } catch (error) {
    console.error('Error saving notebook state:', error);
    res.status(500).json({ error: 'Failed to save notebook state' });
  }
});

/**
 * POST /api/notebooks/:notebookId/execute
 * Execute a code cell and return the output (simulated for now)
 */
router.post('/:notebookId/execute', (req, res) => {
  try {
    const { notebookId } = req.params;
    const { cellId, code, language = 'python' } = req.body;

    if (!cellId || !code) {
      return res.status(400).json({ error: 'cellId and code are required' });
    }

    // Simulate code execution (in production, this would run in a sandboxed container)
    let output = '';
    let error = null;

    // Simple Python simulation for demo purposes
    if (language === 'python') {
      // Detect print statements and simulate output
      const printRegex = /print\s*\(\s*f?"([^"]*)".*\)/g;
      const printMatches = [...code.matchAll(printRegex)];

      if (printMatches.length > 0) {
        // Simple variable substitution simulation
        const variables = {};
        const varRegex = /(\w+)\s*=\s*([^\n]+)/g;
        let varMatch;
        while ((varMatch = varRegex.exec(code)) !== null) {
          const [, name, value] = varMatch;
          try {
            // Try to evaluate simple values
            if (value.startsWith('"') || value.startsWith("'")) {
              variables[name] = value.slice(1, -1);
            } else if (!isNaN(Number(value))) {
              variables[name] = Number(value);
            } else if (value === 'True') {
              variables[name] = true;
            } else if (value === 'False') {
              variables[name] = false;
            }
          } catch (e) {
            // Skip complex expressions
          }
        }

        // Generate output lines
        const outputLines = [];
        const allPrints = code.match(/print\s*\([^)]+\)/g) || [];

        for (const printCall of allPrints) {
          // Extract the content inside print()
          const content = printCall.replace(/print\s*\(\s*/, '').replace(/\s*\)$/, '');

          if (content.startsWith('f"') || content.startsWith("f'")) {
            // f-string - substitute variables
            let result = content.slice(2, -1);
            result = result.replace(/\{([^}]+)\}/g, (match, expr) => {
              // Handle type() calls
              if (expr.includes('type(')) {
                const typeVar = expr.match(/type\((\w+)\)/)?.[1];
                if (typeVar && variables[typeVar] !== undefined) {
                  const v = variables[typeVar];
                  if (typeof v === 'string') return 'str';
                  if (typeof v === 'number' && Number.isInteger(v)) return 'int';
                  if (typeof v === 'number') return 'float';
                  if (typeof v === 'boolean') return 'bool';
                }
                return 'type';
              }
              // Simple expressions
              if (expr.includes('*') || expr.includes('+') || expr.includes('-') || expr.includes('/')) {
                try {
                  // Replace variable names with values for calculation
                  let calcExpr = expr;
                  for (const [varName, varValue] of Object.entries(variables)) {
                    calcExpr = calcExpr.replace(new RegExp(`\\b${varName}\\b`, 'g'), varValue);
                  }
                  return eval(calcExpr);
                } catch (e) {
                  return expr;
                }
              }
              return variables[expr] !== undefined ? variables[expr] : match;
            });
            outputLines.push(result);
          } else if (content.startsWith('"') || content.startsWith("'")) {
            outputLines.push(content.slice(1, -1));
          } else {
            outputLines.push(content);
          }
        }

        output = outputLines.join('\n');
      } else if (code.includes('=') && !code.includes('print')) {
        // Just variable assignments, no output
        output = '';
      } else {
        output = '>>> Code executed successfully';
      }
    } else {
      output = `>>> ${language} execution simulated`;
    }

    res.json({
      cellId,
      output,
      error,
      executedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error executing code:', error);
    res.status(500).json({
      cellId: req.body.cellId,
      output: '',
      error: 'Execution failed: ' + error.message,
      executedAt: new Date().toISOString()
    });
  }
});

/**
 * DELETE /api/notebooks/:notebookId/state
 * Clear notebook state (reset all outputs)
 */
router.delete('/:notebookId/state', (req, res) => {
  try {
    const { notebookId } = req.params;
    const sessionId = req.session?.id || req.query.sessionId;
    const userId = req.session?.user?.id;

    if (userId) {
      run('DELETE FROM notebook_states WHERE notebook_id = ? AND user_id = ?', [notebookId, userId]);
    } else if (sessionId) {
      run('DELETE FROM notebook_states WHERE notebook_id = ? AND session_id = ?', [notebookId, sessionId]);
    }

    res.json({ message: 'Notebook state cleared successfully' });
  } catch (error) {
    console.error('Error clearing notebook state:', error);
    res.status(500).json({ error: 'Failed to clear notebook state' });
  }
});

export default router;
