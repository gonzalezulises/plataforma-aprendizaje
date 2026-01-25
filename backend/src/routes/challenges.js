import express from 'express';
import { queryAll, queryOne, run, saveDatabase } from '../config/database.js';
import { detectInfiniteLoop, detectMemoryOveruse, detectSyntaxError, executeWithTimeout } from './challenges-timeout.js';

const router = express.Router();

/**
 * Initialize challenges tables
 */
export function initChallengesTables(db) {
  // Challenges table - stores coding challenge definitions
  db.run(`
    CREATE TABLE IF NOT EXISTS challenges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      instructions TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'python',
      starter_code TEXT NOT NULL DEFAULT '',
      solution_code TEXT,
      test_cases TEXT NOT NULL DEFAULT '[]',
      hints TEXT DEFAULT '[]',
      difficulty TEXT NOT NULL DEFAULT 'easy',
      time_limit_seconds INTEGER DEFAULT 30,
      memory_limit_mb INTEGER DEFAULT 256,
      order_index INTEGER DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (lesson_id) REFERENCES lessons(id) ON DELETE SET NULL
    )
  `);

  // Code submissions table - stores user attempts
  db.run(`
    CREATE TABLE IF NOT EXISTS code_submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      challenge_id INTEGER NOT NULL,
      code TEXT NOT NULL,
      language TEXT NOT NULL DEFAULT 'python',
      output TEXT,
      error TEXT,
      test_results TEXT DEFAULT '[]',
      is_correct INTEGER NOT NULL DEFAULT 0,
      execution_time_ms INTEGER,
      attempt_number INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE
    )
  `);

  // Indexes
  db.run(`CREATE INDEX IF NOT EXISTS idx_challenges_lesson ON challenges(lesson_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_code_submissions_user ON code_submissions(user_id, challenge_id)`);

  // Seed sample challenges
  seedSampleChallenges();
}

/**
 * Seed sample challenges for testing
 */
function seedSampleChallenges() {
  const sampleChallenges = [
    {
      id: 1,
      lesson_id: 1,
      title: 'Hola Mundo en Python',
      description: 'Tu primer programa en Python: imprimir "Hola Mundo" en la consola.',
      instructions: `## Objetivo
Escribe un programa que imprima exactamente el texto "Hola Mundo" en la consola.

## Requisitos
- Usa la funcion \`print()\`
- El texto debe ser exactamente "Hola Mundo" (con H mayuscula)

## Ejemplo de salida esperada
\`\`\`
Hola Mundo
\`\`\``,
      language: 'python',
      starter_code: '# Escribe tu codigo aqui\n',
      solution_code: 'print("Hola Mundo")',
      test_cases: JSON.stringify([
        {
          id: 1,
          name: 'Salida correcta',
          input: '',
          expected_output: 'Hola Mundo',
          is_hidden: false
        }
      ]),
      hints: JSON.stringify([
        'Usa la funcion print() para mostrar texto en la consola',
        'Recuerda usar comillas alrededor del texto'
      ]),
      difficulty: 'easy',
      time_limit_seconds: 10,
      order_index: 1
    },
    {
      id: 2,
      lesson_id: 1,
      title: 'Suma de Dos Numeros',
      description: 'Crea una funcion que sume dos numeros y retorne el resultado.',
      instructions: `## Objetivo
Implementa una funcion llamada \`suma\` que reciba dos numeros como parametros y retorne su suma.

## Requisitos
- La funcion debe llamarse \`suma\`
- Debe recibir dos parametros: \`a\` y \`b\`
- Debe retornar la suma de ambos numeros

## Ejemplo
\`\`\`python
resultado = suma(3, 5)
print(resultado)  # Output: 8
\`\`\``,
      language: 'python',
      starter_code: `def suma(a, b):
    # Tu codigo aqui
    pass

# Prueba tu funcion
print(suma(3, 5))`,
      solution_code: `def suma(a, b):
    return a + b

print(suma(3, 5))`,
      test_cases: JSON.stringify([
        {
          id: 1,
          name: 'Suma basica',
          input: '',
          expected_output: '8',
          is_hidden: false
        },
        {
          id: 2,
          name: 'Suma con negativos',
          test_code: 'print(suma(-3, 5))',
          expected_output: '2',
          is_hidden: false
        },
        {
          id: 3,
          name: 'Suma con cero',
          test_code: 'print(suma(0, 0))',
          expected_output: '0',
          is_hidden: true
        }
      ]),
      hints: JSON.stringify([
        'Usa la palabra clave "return" para devolver un valor',
        'El operador + funciona con numeros para sumarlos'
      ]),
      difficulty: 'easy',
      time_limit_seconds: 10,
      order_index: 2
    },
    {
      id: 3,
      lesson_id: 2,
      title: 'Numero Par o Impar',
      description: 'Determina si un numero es par o impar usando condicionales.',
      instructions: `## Objetivo
Implementa una funcion llamada \`es_par\` que reciba un numero y retorne True si es par, o False si es impar.

## Requisitos
- La funcion debe llamarse \`es_par\`
- Debe recibir un parametro: \`numero\`
- Debe retornar \`True\` si el numero es par
- Debe retornar \`False\` si el numero es impar

## Ejemplo
\`\`\`python
print(es_par(4))   # True
print(es_par(7))   # False
\`\`\``,
      language: 'python',
      starter_code: `def es_par(numero):
    # Tu codigo aqui
    pass

# Prueba tu funcion
print(es_par(4))
print(es_par(7))`,
      solution_code: `def es_par(numero):
    return numero % 2 == 0

print(es_par(4))
print(es_par(7))`,
      test_cases: JSON.stringify([
        {
          id: 1,
          name: 'Numero par',
          test_code: 'print(es_par(4))',
          expected_output: 'True',
          is_hidden: false
        },
        {
          id: 2,
          name: 'Numero impar',
          test_code: 'print(es_par(7))',
          expected_output: 'False',
          is_hidden: false
        },
        {
          id: 3,
          name: 'Cero es par',
          test_code: 'print(es_par(0))',
          expected_output: 'True',
          is_hidden: true
        }
      ]),
      hints: JSON.stringify([
        'Un numero es par si el residuo de dividirlo por 2 es 0',
        'Usa el operador modulo % para obtener el residuo'
      ]),
      difficulty: 'easy',
      time_limit_seconds: 10,
      order_index: 1
    },
    {
      id: 4,
      lesson_id: 3,
      title: 'Factorial con Bucle',
      description: 'Calcula el factorial de un numero usando un bucle.',
      instructions: `## Objetivo
Implementa una funcion llamada \`factorial\` que calcule el factorial de un numero usando un bucle.

## Requisitos
- La funcion debe llamarse \`factorial\`
- Debe recibir un parametro: \`n\`
- Debe usar un bucle (for o while)
- El factorial de 0 es 1
- El factorial de n es n * (n-1) * (n-2) * ... * 1

## Ejemplo
\`\`\`python
print(factorial(5))  # 120 (5*4*3*2*1)
print(factorial(0))  # 1
\`\`\``,
      language: 'python',
      starter_code: `def factorial(n):
    # Tu codigo aqui
    pass

# Prueba tu funcion
print(factorial(5))`,
      solution_code: `def factorial(n):
    resultado = 1
    for i in range(1, n + 1):
        resultado *= i
    return resultado

print(factorial(5))`,
      test_cases: JSON.stringify([
        {
          id: 1,
          name: 'Factorial de 5',
          test_code: 'print(factorial(5))',
          expected_output: '120',
          is_hidden: false
        },
        {
          id: 2,
          name: 'Factorial de 0',
          test_code: 'print(factorial(0))',
          expected_output: '1',
          is_hidden: false
        },
        {
          id: 3,
          name: 'Factorial de 10',
          test_code: 'print(factorial(10))',
          expected_output: '3628800',
          is_hidden: true
        }
      ]),
      hints: JSON.stringify([
        'Inicializa una variable resultado en 1',
        'Usa un bucle for con range(1, n+1)',
        'Multiplica resultado por cada numero en el bucle'
      ]),
      difficulty: 'medium',
      time_limit_seconds: 15,
      order_index: 1
    }
  ];

  const now = new Date().toISOString();

  for (const challenge of sampleChallenges) {
    try {
      const existing = queryOne('SELECT id FROM challenges WHERE id = ?', [challenge.id]);
      if (!existing) {
        run(`
          INSERT INTO challenges (id, lesson_id, title, description, instructions, language, starter_code, solution_code, test_cases, hints, difficulty, time_limit_seconds, order_index, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          challenge.id,
          challenge.lesson_id,
          challenge.title,
          challenge.description,
          challenge.instructions,
          challenge.language,
          challenge.starter_code,
          challenge.solution_code,
          challenge.test_cases,
          challenge.hints,
          challenge.difficulty,
          challenge.time_limit_seconds,
          challenge.order_index,
          now,
          now
        ]);
        console.log(`Created sample challenge: ${challenge.title}`);
      }
    } catch (error) {
      console.error(`Error seeding challenge ${challenge.title}:`, error.message);
    }
  }
}

/**
 * GET /api/challenges - List all challenges
 */
router.get('/', (req, res) => {
  try {
    const { lesson_id, difficulty } = req.query;

    let sql = 'SELECT id, lesson_id, title, description, language, difficulty, time_limit_seconds, order_index, created_at FROM challenges WHERE 1=1';
    const params = [];

    if (lesson_id) {
      sql += ' AND lesson_id = ?';
      params.push(lesson_id);
    }

    if (difficulty) {
      sql += ' AND difficulty = ?';
      params.push(difficulty);
    }

    sql += ' ORDER BY order_index ASC';

    const challenges = queryAll(sql, params);
    res.json({ challenges });
  } catch (error) {
    console.error('Error fetching challenges:', error);
    res.status(500).json({ error: 'Failed to fetch challenges' });
  }
});

/**
 * GET /api/challenges/:id - Get challenge details
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const challenge = queryOne(`
      SELECT id, lesson_id, title, description, instructions, language, starter_code,
             test_cases, hints, difficulty, time_limit_seconds, memory_limit_mb, order_index, created_at
      FROM challenges WHERE id = ?
    `, [id]);

    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Parse JSON fields
    challenge.test_cases = JSON.parse(challenge.test_cases || '[]');
    challenge.hints = JSON.parse(challenge.hints || '[]');

    // Filter out hidden test case details (only show public info)
    challenge.test_cases = challenge.test_cases.map(tc => ({
      id: tc.id,
      name: tc.name,
      is_hidden: tc.is_hidden
    }));

    // Get user's submission history if authenticated
    const userId = req.session?.user?.id || 'anonymous';
    const submissions = queryAll(`
      SELECT id, is_correct, attempt_number, created_at
      FROM code_submissions
      WHERE user_id = ? AND challenge_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `, [userId, id]);

    challenge.user_submissions = submissions;
    challenge.best_submission = submissions.find(s => s.is_correct) || null;

    res.json(challenge);
  } catch (error) {
    console.error('Error fetching challenge:', error);
    res.status(500).json({ error: 'Failed to fetch challenge' });
  }
});

/**
 * POST /api/challenges/:id/run - Run code without submitting
 */
router.post('/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const { code, language = 'python' } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const challenge = queryOne('SELECT * FROM challenges WHERE id = ?', [id]);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Execute code (simulated for now - in production this would use Docker sandbox)
    const result = await executeCode(code, language, challenge.time_limit_seconds);

    res.json({
      output: result.output,
      error: result.error,
      timeout: result.timeout || false,
      timeout_message: result.timeout_message || null,
      memory_exceeded: result.memory_exceeded || false,
      memory_error_message: result.memory_error_message || null,
      syntax_error: result.syntax_error || false,
      syntax_error_info: result.syntax_error_info || null,
      container_cleaned: result.container_cleaned || false,
      execution_time_ms: result.execution_time_ms,
      success: !result.error && !result.timeout && !result.memory_exceeded && !result.syntax_error
    });
  } catch (error) {
    console.error('Error running code:', error);
    res.status(500).json({ error: 'Failed to run code' });
  }
});

/**
 * POST /api/challenges/:id/submit - Submit solution for grading
 */
router.post('/:id/submit', async (req, res) => {
  try {
    const { id } = req.params;
    const { code, language = 'python' } = req.body;
    const userId = req.session?.user?.id || `guest_${Date.now()}`;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    const challenge = queryOne('SELECT * FROM challenges WHERE id = ?', [id]);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    // Get current attempt number
    const lastSubmission = queryOne(`
      SELECT MAX(attempt_number) as max_attempt
      FROM code_submissions
      WHERE user_id = ? AND challenge_id = ?
    `, [userId, id]);
    const attemptNumber = (lastSubmission?.max_attempt || 0) + 1;

    // Run all test cases
    const testCases = JSON.parse(challenge.test_cases || '[]');
    const testResults = [];
    let allPassed = true;
    let totalExecutionTime = 0;
    let lastOutput = '';
    let lastError = null;

    for (const testCase of testCases) {
      // Build test code
      let testCode = code;
      if (testCase.test_code) {
        testCode = code + '\n' + testCase.test_code;
      }

      const result = await executeCode(testCode, language, challenge.time_limit_seconds);
      totalExecutionTime += result.execution_time_ms || 0;

      const actualOutput = (result.output || '').trim();
      const expectedOutput = (testCase.expected_output || '').trim();
      const passed = !result.error && actualOutput === expectedOutput;

      if (!passed) {
        allPassed = false;
        if (result.error) lastError = result.error;
      }

      lastOutput = result.output;

      testResults.push({
        id: testCase.id,
        name: testCase.name,
        passed,
        is_hidden: testCase.is_hidden,
        // Only show expected/actual for visible tests
        ...(testCase.is_hidden ? {} : {
          expected: expectedOutput,
          actual: actualOutput,
          error: result.error
        })
      });
    }

    // Save submission
    const { lastInsertRowid } = run(`
      INSERT INTO code_submissions (user_id, challenge_id, code, language, output, error, test_results, is_correct, execution_time_ms, attempt_number, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      userId,
      id,
      code,
      language,
      lastOutput,
      lastError,
      JSON.stringify(testResults),
      allPassed ? 1 : 0,
      totalExecutionTime,
      attemptNumber,
      new Date().toISOString()
    ]);

    // Generate feedback
    let feedback = '';
    if (allPassed) {
      feedback = 'Excelente! Tu solucion paso todas las pruebas.';
    } else {
      const passedCount = testResults.filter(t => t.passed).length;
      const totalCount = testResults.length;
      feedback = `Tu solucion paso ${passedCount} de ${totalCount} pruebas.`;

      // Add hints for failed visible tests
      const failedVisible = testResults.find(t => !t.passed && !t.is_hidden);
      if (failedVisible) {
        if (failedVisible.error) {
          feedback += ` Error: ${failedVisible.error}`;
        } else {
          feedback += ` Revisa el caso "${failedVisible.name}".`;
        }
      }
    }

    res.json({
      submission_id: lastInsertRowid,
      is_correct: allPassed,
      test_results: testResults,
      execution_time_ms: totalExecutionTime,
      attempt_number: attemptNumber,
      feedback,
      // Include solution if all tests passed
      ...(allPassed && challenge.solution_code ? { solution: challenge.solution_code } : {})
    });
  } catch (error) {
    console.error('Error submitting solution:', error);
    res.status(500).json({ error: 'Failed to submit solution' });
  }
});

/**
 * GET /api/challenges/:id/attempts - Get user's attempts for a challenge
 */
router.get('/:id/attempts', (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session?.user?.id || 'anonymous';

    const attempts = queryAll(`
      SELECT id, code, output, error, test_results, is_correct, execution_time_ms, attempt_number, created_at
      FROM code_submissions
      WHERE user_id = ? AND challenge_id = ?
      ORDER BY created_at DESC
    `, [userId, id]);

    // Parse test_results JSON
    const parsedAttempts = attempts.map(a => ({
      ...a,
      test_results: JSON.parse(a.test_results || '[]')
    }));

    res.json({ attempts: parsedAttempts });
  } catch (error) {
    console.error('Error fetching attempts:', error);
    res.status(500).json({ error: 'Failed to fetch attempts' });
  }
});

/**
 * GET /api/challenges/:id/hint/:hintIndex - Get a hint for the challenge
 */
router.get('/:id/hint/:hintIndex', (req, res) => {
  try {
    const { id, hintIndex } = req.params;
    const idx = parseInt(hintIndex);

    const challenge = queryOne('SELECT hints FROM challenges WHERE id = ?', [id]);
    if (!challenge) {
      return res.status(404).json({ error: 'Challenge not found' });
    }

    const hints = JSON.parse(challenge.hints || '[]');
    if (idx < 0 || idx >= hints.length) {
      return res.status(404).json({ error: 'Hint not found' });
    }

    res.json({
      hint: hints[idx],
      hint_index: idx,
      total_hints: hints.length,
      has_next: idx < hints.length - 1
    });
  } catch (error) {
    console.error('Error fetching hint:', error);
    res.status(500).json({ error: 'Failed to fetch hint' });
  }
});

/**
 * Execute code in a sandboxed environment
 * For now, this is a simulation. In production, use Docker containers.
 */
async function executeCode(code, language, timeoutSeconds = 30) {
  const startTime = Date.now();
  const timeoutMs = timeoutSeconds * 1000;

  // For development, simulate Python execution
  if (language === 'python') {
    try {
      // Feature #117: Check for syntax errors BEFORE execution
      const syntaxResult = detectSyntaxError(code);
      if (syntaxResult.hasSyntaxError) {
        return {
          output: '',
          error: null,
          timeout: false,
          syntax_error: true,
          syntax_error_info: syntaxResult.error,
          execution_time_ms: 0
        };
      }

      // Feature #116: Check for memory overuse patterns BEFORE execution
      const memoryResult = detectMemoryOveruse(code);
      if (memoryResult.isMemoryOveruse) {
        // Simulate brief execution time before memory error (max 1 second)
        await new Promise(resolve => setTimeout(resolve, Math.min(1000, timeoutMs)));
        return {
          output: '',
          error: null,
          timeout: false,
          memory_exceeded: true,
          memory_error_message: memoryResult.message,
          execution_time_ms: 1000,
          container_cleaned: true
        };
      }

      // Check for infinite loop patterns BEFORE execution
      const infiniteLoopResult = detectInfiniteLoop(code);
      if (infiniteLoopResult.isInfiniteLoop) {
        // Simulate execution time up to timeout (max 3 seconds for demo)
        await new Promise(resolve => setTimeout(resolve, Math.min(3000, timeoutMs)));
        return {
          output: '',
          error: null,
          timeout: true,
          timeout_message: `TimeoutError: Tiempo de ejecucion excedido (${timeoutSeconds}s). ${infiniteLoopResult.message}`,
          execution_time_ms: timeoutSeconds * 1000,
          container_cleaned: true
        };
      }

      // Parse and simulate simple Python code with timeout wrapper
      const result = await executeWithTimeout(
        () => simulatePython(code),
        timeoutMs
      );

      if (result.timedOut) {
        return {
          output: '',
          error: null,
          timeout: true,
          timeout_message: `TimeoutError: Tiempo de ejecucion excedido (${timeoutSeconds}s). Tu codigo tardo demasiado en ejecutarse.`,
          execution_time_ms: timeoutSeconds * 1000,
          container_cleaned: true
        };
      }

      return {
        output: result.value,
        error: null,
        timeout: false,
        execution_time_ms: Date.now() - startTime
      };
    } catch (error) {
      return {
        output: '',
        error: error.message,
        timeout: false,
        execution_time_ms: Date.now() - startTime
      };
    }
  }

  return {
    output: '',
    error: `Language ${language} not supported yet`,
    timeout: false,
    execution_time_ms: Date.now() - startTime
  };
}

/**
 * Simple Python simulator for development
 * In production, this would be replaced with actual Docker execution
 */
function simulatePython(code) {
  const outputs = [];
  const variables = {};
  const functions = {};

  // Parse function definitions
  const funcRegex = /def\s+(\w+)\s*\(([^)]*)\)\s*:/g;
  let match;
  while ((match = funcRegex.exec(code)) !== null) {
    const funcName = match[1];
    const params = match[2].split(',').map(p => p.trim()).filter(p => p);

    // Find function body (simplified - just get until next def or end)
    const startIdx = match.index + match[0].length;
    let endIdx = code.length;
    const nextDef = code.indexOf('\ndef ', startIdx);
    if (nextDef > -1) endIdx = nextDef;

    const body = code.substring(startIdx, endIdx);
    functions[funcName] = { params, body };
  }

  // Process lines
  const lines = code.split('\n');
  let inFunction = false;
  let currentIndent = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Skip function definitions
    if (trimmed.startsWith('def ')) {
      inFunction = true;
      currentIndent = line.search(/\S/);
      continue;
    }

    // Check if we're inside a function
    if (inFunction) {
      const indent = line.search(/\S/);
      if (indent <= currentIndent && trimmed) {
        inFunction = false;
      } else {
        continue;
      }
    }

    // Handle print statements
    if (trimmed.startsWith('print(')) {
      const content = trimmed.slice(6, -1);
      const result = evaluateExpression(content, variables, functions);
      outputs.push(String(result));
      continue;
    }

    // Handle variable assignments
    const assignMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
    if (assignMatch) {
      const [, varName, expr] = assignMatch;
      variables[varName] = evaluateExpression(expr, variables, functions);
      continue;
    }
  }

  return outputs.join('\n');
}

/**
 * Evaluate a simple Python expression
 */
function evaluateExpression(expr, variables, functions) {
  expr = expr.trim();

  // Handle f-strings
  if (expr.startsWith('f"') || expr.startsWith("f'")) {
    const quote = expr[1];
    const content = expr.slice(2, -1);
    return content.replace(/\{([^}]+)\}/g, (_, varExpr) => {
      return evaluateExpression(varExpr, variables, functions);
    });
  }

  // Handle strings
  if ((expr.startsWith('"') && expr.endsWith('"')) ||
      (expr.startsWith("'") && expr.endsWith("'"))) {
    return expr.slice(1, -1);
  }

  // Handle numbers
  if (!isNaN(parseFloat(expr)) && isFinite(expr)) {
    return parseFloat(expr);
  }

  // Handle booleans
  if (expr === 'True') return true;
  if (expr === 'False') return false;
  if (expr === 'None') return null;

  // Handle type()
  const typeMatch = expr.match(/^type\((\w+)\)$/);
  if (typeMatch) {
    const val = variables[typeMatch[1]];
    if (typeof val === 'string') return "<class 'str'>";
    if (typeof val === 'number' && Number.isInteger(val)) return "<class 'int'>";
    if (typeof val === 'number') return "<class 'float'>";
    if (typeof val === 'boolean') return "<class 'bool'>";
    return "<class 'NoneType'>";
  }

  // Handle function calls
  const funcCallMatch = expr.match(/^(\w+)\s*\(([^)]*)\)$/);
  if (funcCallMatch) {
    const [, funcName, argsStr] = funcCallMatch;
    const func = functions[funcName];

    if (func) {
      // Parse arguments
      const args = argsStr.split(',').map(a => evaluateExpression(a.trim(), variables, functions));

      // Create local scope with parameters
      const localVars = { ...variables };
      func.params.forEach((param, idx) => {
        localVars[param] = args[idx];
      });

      // Execute function body to find return value
      const bodyLines = func.body.split('\n');
      for (const line of bodyLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('return ')) {
          return evaluateExpression(trimmed.slice(7), localVars, functions);
        }

        // Handle assignments in function
        const assignMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
        if (assignMatch) {
          const [, varName, valExpr] = assignMatch;
          localVars[varName] = evaluateExpression(valExpr, localVars, functions);
        }

        // Handle for loops (simplified)
        const forMatch = trimmed.match(/^for\s+(\w+)\s+in\s+range\(([^)]+)\)\s*:/);
        if (forMatch) {
          const [, loopVar, rangeExpr] = forMatch;
          const rangeArgs = rangeExpr.split(',').map(a => evaluateExpression(a.trim(), localVars, functions));

          let start = 0, end = 0, step = 1;
          if (rangeArgs.length === 1) {
            end = rangeArgs[0];
          } else if (rangeArgs.length === 2) {
            [start, end] = rangeArgs;
          } else {
            [start, end, step] = rangeArgs;
          }

          // Find loop body and execute
          const loopStart = bodyLines.indexOf(line);
          const loopBody = [];
          for (let i = loopStart + 1; i < bodyLines.length; i++) {
            const bodyLine = bodyLines[i];
            if (bodyLine.trim() && bodyLine.search(/\S/) <= line.search(/\S/)) break;
            loopBody.push(bodyLine);
          }

          for (let i = start; i < end; i += step) {
            localVars[loopVar] = i;
            for (const bodyLine of loopBody) {
              const bodyTrimmed = bodyLine.trim();
              const loopAssign = bodyTrimmed.match(/^(\w+)\s*(\*=|\+=|-=|=)\s*(.+)$/);
              if (loopAssign) {
                const [, v, op, valExpr] = loopAssign;
                const val = evaluateExpression(valExpr, localVars, functions);
                if (op === '*=') localVars[v] = (localVars[v] || 1) * val;
                else if (op === '+=') localVars[v] = (localVars[v] || 0) + val;
                else if (op === '-=') localVars[v] = (localVars[v] || 0) - val;
                else localVars[v] = val;
              }
            }
          }
        }
      }

      // Check for return with variable
      for (const line of bodyLines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('return ')) {
          return evaluateExpression(trimmed.slice(7), localVars, functions);
        }
      }

      return null;
    }
  }

  // Handle arithmetic operations
  if (expr.includes('+') || expr.includes('-') || expr.includes('*') || expr.includes('/') || expr.includes('%')) {
    // Handle modulo for es_par check
    const modMatch = expr.match(/^(\w+)\s*%\s*(\d+)\s*==\s*(\d+)$/);
    if (modMatch) {
      const [, varName, divisor, expected] = modMatch;
      const value = variables[varName];
      return (value % parseInt(divisor)) === parseInt(expected);
    }

    // Replace variables with values
    let evalExpr = expr;
    for (const [varName, value] of Object.entries(variables)) {
      evalExpr = evalExpr.replace(new RegExp(`\\b${varName}\\b`, 'g'), value);
    }

    // Simple arithmetic evaluation
    try {
      // Only allow safe characters
      if (/^[\d\s+\-*/%().]+$/.test(evalExpr)) {
        return eval(evalExpr);
      }
    } catch (e) {
      // Fall through to variable lookup
    }
  }

  // Handle variable lookup
  if (variables.hasOwnProperty(expr)) {
    return variables[expr];
  }

  return expr;
}

export default router;
