/**
 * Timeout detection helpers for code execution
 * Feature #108: Code execution timeout shows message
 * Feature #116: Memory limit exceeded in code execution
 * Feature #117: Syntax error in code shows helpful message
 */

// Default memory limit in MB
const MEMORY_LIMIT_MB = 256;

/**
 * Common Python syntax error patterns with helpful explanations
 */
const SYNTAX_ERROR_PATTERNS = [
  // Missing colon after if/elif/else/while/for/def/class
  {
    pattern: /^(\s*)(if|elif|else|while|for|def|class)\s+[^:]+$/m,
    getMessage: (match, lineNum) => ({
      type: 'SyntaxError',
      line: lineNum,
      message: `Falta ':' al final de la declaracion '${match[2]}'`,
      suggestion: `Agrega ':' al final de la linea ${lineNum}. Ejemplo: ${match[2]} condition:`
    })
  },
  // Unclosed parenthesis
  {
    pattern: /^[^#\n]*\([^)\n]*$/m,
    getMessage: (match, lineNum, code) => {
      // Count opening and closing parentheses
      const opens = (match[0].match(/\(/g) || []).length;
      const closes = (match[0].match(/\)/g) || []).length;
      if (opens > closes) {
        return {
          type: 'SyntaxError',
          line: lineNum,
          message: 'Parentesis sin cerrar',
          suggestion: `Agrega ${opens - closes} parentesis de cierre ')' en la linea ${lineNum}`
        };
      }
      return null;
    }
  },
  // Unclosed string (single quote)
  {
    pattern: /^[^#\n]*'[^'\n]*$/m,
    getMessage: (match, lineNum) => {
      // Check it's not a comment and not an escaped quote situation
      const quotes = (match[0].match(/'/g) || []).length;
      if (quotes % 2 !== 0) {
        return {
          type: 'SyntaxError',
          line: lineNum,
          message: 'Cadena de texto sin cerrar (comilla simple)',
          suggestion: `Agrega una comilla simple ' para cerrar la cadena en la linea ${lineNum}`
        };
      }
      return null;
    }
  },
  // Unclosed string (double quote)
  {
    pattern: /^[^#\n]*"[^"\n]*$/m,
    getMessage: (match, lineNum) => {
      const quotes = (match[0].match(/"/g) || []).length;
      if (quotes % 2 !== 0) {
        return {
          type: 'SyntaxError',
          line: lineNum,
          message: 'Cadena de texto sin cerrar (comilla doble)',
          suggestion: `Agrega una comilla doble " para cerrar la cadena en la linea ${lineNum}`
        };
      }
      return null;
    }
  },
  // Unclosed bracket
  {
    pattern: /^[^#\n]*\[[^\]\n]*$/m,
    getMessage: (match, lineNum) => {
      const opens = (match[0].match(/\[/g) || []).length;
      const closes = (match[0].match(/\]/g) || []).length;
      if (opens > closes) {
        return {
          type: 'SyntaxError',
          line: lineNum,
          message: 'Corchete sin cerrar',
          suggestion: `Agrega ${opens - closes} corchete(s) de cierre ']' en la linea ${lineNum}`
        };
      }
      return null;
    }
  },
  // Unclosed brace
  {
    pattern: /^[^#\n]*\{[^\}\n]*$/m,
    getMessage: (match, lineNum) => {
      const opens = (match[0].match(/\{/g) || []).length;
      const closes = (match[0].match(/\}/g) || []).length;
      if (opens > closes) {
        return {
          type: 'SyntaxError',
          line: lineNum,
          message: 'Llave sin cerrar',
          suggestion: `Agrega ${opens - closes} llave(s) de cierre '}' en la linea ${lineNum}`
        };
      }
      return null;
    }
  },
  // Invalid assignment operator (single = in comparison context)
  {
    pattern: /^[^#\n]*(if|elif|while)\s+[^=]*[^=!<>]=[^=][^#\n]*:/m,
    getMessage: (match, lineNum) => ({
      type: 'SyntaxError',
      line: lineNum,
      message: 'Uso incorrecto de "=" en una condicion. ¿Quisiste usar "==" para comparar?',
      suggestion: `En la linea ${lineNum}, usa '==' para comparar igualdad, no '=' que es para asignar valores`
    })
  },
  // print without parentheses (Python 2 style)
  {
    pattern: /^(\s*)print\s+[^(]/m,
    getMessage: (match, lineNum) => ({
      type: 'SyntaxError',
      line: lineNum,
      message: 'En Python 3, print() requiere parentesis',
      suggestion: `En la linea ${lineNum}, cambia 'print valor' por 'print(valor)'`
    })
  },
  // Missing comma in list/dict/tuple
  {
    pattern: /[\[\{]\s*[^,\]\}\n]+\s+[^,\]\}\n]+\s*[\]\}]/m,
    getMessage: (match, lineNum) => ({
      type: 'SyntaxError',
      line: lineNum,
      message: 'Posible falta de coma entre elementos',
      suggestion: `Revisa si faltan comas entre los elementos en la linea ${lineNum}`
    })
  },
  // def without parentheses
  {
    pattern: /^(\s*)def\s+\w+\s*[^(:\s]/m,
    getMessage: (match, lineNum) => ({
      type: 'SyntaxError',
      line: lineNum,
      message: 'Definicion de funcion sin parentesis',
      suggestion: `En la linea ${lineNum}, las funciones deben tener parentesis: def nombre():`
    })
  },
  // Indentation error - mixing tabs and spaces is harder to detect, but we can catch obvious issues
  {
    pattern: /^(\t+ +|\t +\t)/m,
    getMessage: (match, lineNum) => ({
      type: 'IndentationError',
      line: lineNum,
      message: 'Mezcla de tabs y espacios en la indentacion',
      suggestion: `En la linea ${lineNum}, usa solo espacios o solo tabs para indentar, no ambos`
    })
  },
  // Return outside function
  {
    pattern: /^return\s/m,
    getMessage: (match, lineNum, code) => {
      // Check if there's a def before this line at a lower indentation
      const lines = code.split('\n');
      let insideFunction = false;
      for (let i = 0; i < lineNum - 1; i++) {
        if (/^\s*def\s/.test(lines[i])) {
          insideFunction = true;
        }
      }
      if (!insideFunction) {
        return {
          type: 'SyntaxError',
          line: lineNum,
          message: '"return" fuera de una funcion',
          suggestion: `En la linea ${lineNum}, 'return' solo puede usarse dentro de una funcion (def)`
        };
      }
      return null;
    }
  },
  // break/continue outside loop
  {
    pattern: /^(break|continue)\s*$/m,
    getMessage: (match, lineNum, code) => {
      const lines = code.split('\n');
      let insideLoop = false;
      for (let i = 0; i < lineNum - 1; i++) {
        if (/^\s*(for|while)\s/.test(lines[i])) {
          insideLoop = true;
        }
      }
      if (!insideLoop) {
        return {
          type: 'SyntaxError',
          line: lineNum,
          message: `'${match[1]}' fuera de un bucle`,
          suggestion: `En la linea ${lineNum}, '${match[1]}' solo puede usarse dentro de un bucle (for/while)`
        };
      }
      return null;
    }
  },
  // Invalid identifier starting with number
  {
    pattern: /^\s*\d+\w+\s*=/m,
    getMessage: (match, lineNum) => ({
      type: 'SyntaxError',
      line: lineNum,
      message: 'Nombre de variable invalido (no puede empezar con numero)',
      suggestion: `En la linea ${lineNum}, los nombres de variables deben empezar con letra o guion bajo`
    })
  },
  // Using reserved keyword as variable
  {
    pattern: /^\s*(if|else|elif|for|while|def|class|return|import|from|try|except|finally|with|as|pass|break|continue|and|or|not|in|is|lambda|yield|global|nonlocal|assert|raise|True|False|None)\s*=/m,
    getMessage: (match, lineNum) => ({
      type: 'SyntaxError',
      line: lineNum,
      message: `'${match[1]}' es una palabra reservada de Python y no puede usarse como nombre de variable`,
      suggestion: `En la linea ${lineNum}, usa un nombre diferente para tu variable`
    })
  }
];

/**
 * Detect Python syntax errors and return helpful error information
 * @param {string} code - The Python code to check
 * @returns {object} - { hasSyntaxError, error: { type, line, message, suggestion, codeSnippet } }
 */
export function detectSyntaxError(code) {
  const lines = code.split('\n');

  // Check each line for syntax errors
  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1;
    const line = lines[i];

    // Skip empty lines and comments
    if (!line.trim() || line.trim().startsWith('#')) continue;

    for (const errorPattern of SYNTAX_ERROR_PATTERNS) {
      // Create a regex that matches the specific line
      const lineSpecificCode = lines.slice(0, i + 1).join('\n');
      const match = line.match(errorPattern.pattern) || lineSpecificCode.match(errorPattern.pattern);

      if (match) {
        const errorInfo = errorPattern.getMessage(match, lineNum, code);
        if (errorInfo) {
          // Get code snippet with context
          const startLine = Math.max(0, i - 1);
          const endLine = Math.min(lines.length - 1, i + 1);
          const codeSnippet = lines.slice(startLine, endLine + 1).map((l, idx) => ({
            lineNum: startLine + idx + 1,
            code: l,
            isErrorLine: startLine + idx === i
          }));

          return {
            hasSyntaxError: true,
            error: {
              ...errorInfo,
              codeSnippet
            }
          };
        }
      }
    }
  }

  // Check for unbalanced brackets across the entire code
  const brackets = { '(': ')', '[': ']', '{': '}' };
  const stack = [];
  const bracketPositions = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let inString = false;
    let stringChar = '';

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      // Track string state
      if ((char === '"' || char === "'") && (j === 0 || line[j-1] !== '\\')) {
        if (!inString) {
          inString = true;
          stringChar = char;
        } else if (char === stringChar) {
          inString = false;
        }
      }

      // Skip characters in strings or comments
      if (inString) continue;
      if (char === '#') break;

      if (brackets[char]) {
        stack.push({ char, line: i + 1, col: j + 1 });
        bracketPositions.push({ char, line: i + 1, col: j + 1, type: 'open' });
      } else if (Object.values(brackets).includes(char)) {
        const last = stack.pop();
        if (!last || brackets[last.char] !== char) {
          return {
            hasSyntaxError: true,
            error: {
              type: 'SyntaxError',
              line: i + 1,
              message: last
                ? `Cierre inesperado '${char}'. Se esperaba '${brackets[last.char]}' para cerrar '${last.char}' de la linea ${last.line}`
                : `Cierre inesperado '${char}' sin apertura correspondiente`,
              suggestion: `Revisa los parentesis, corchetes y llaves en tu codigo`,
              codeSnippet: [{
                lineNum: i + 1,
                code: lines[i],
                isErrorLine: true
              }]
            }
          };
        }
      }
    }
  }

  // Check for unclosed brackets at end of file
  if (stack.length > 0) {
    const unclosed = stack[stack.length - 1];
    return {
      hasSyntaxError: true,
      error: {
        type: 'SyntaxError',
        line: unclosed.line,
        message: `'${unclosed.char}' sin cerrar (abierto en linea ${unclosed.line}, columna ${unclosed.col})`,
        suggestion: `Agrega '${brackets[unclosed.char]}' para cerrar '${unclosed.char}'`,
        codeSnippet: [{
          lineNum: unclosed.line,
          code: lines[unclosed.line - 1],
          isErrorLine: true
        }]
      }
    };
  }

  return { hasSyntaxError: false };
}

/**
 * Detect common memory-intensive patterns in Python code
 * Returns an object indicating if memory limit would be exceeded and a message
 */
export function detectMemoryOveruse(code) {
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect large list creation with multiplication: [0] * 10000000
    const largListMultiply = line.match(/\[[^\]]*\]\s*\*\s*(\d+)/);
    if (largListMultiply) {
      const size = parseInt(largListMultiply[1]);
      // Lists with more than 100 million elements would use ~800MB
      if (size >= 100000000) {
        return {
          isMemoryOveruse: true,
          message: `MemoryError: Se intento crear una lista demasiado grande (${size.toLocaleString()} elementos). Limite de memoria: ${MEMORY_LIMIT_MB}MB.`
        };
      }
    }

    // Detect range with very large numbers that could be converted to list
    const largeListFromRange = line.match(/list\s*\(\s*range\s*\(\s*(\d+)\s*\)\s*\)/);
    if (largeListFromRange) {
      const size = parseInt(largeListFromRange[1]);
      if (size >= 100000000) {
        return {
          isMemoryOveruse: true,
          message: `MemoryError: Se intento crear una lista desde range(${size.toLocaleString()}). Limite de memoria: ${MEMORY_LIMIT_MB}MB.`
        };
      }
    }

    // Detect string multiplication: 'x' * 1000000000
    const largeStringMultiply = line.match(/['"][^'"]*['"]\s*\*\s*(\d+)/);
    if (largeStringMultiply) {
      const size = parseInt(largeStringMultiply[1]);
      // Strings with more than 1 billion characters would use ~1GB
      if (size >= 1000000000) {
        return {
          isMemoryOveruse: true,
          message: `MemoryError: Se intento crear una cadena demasiado larga (${size.toLocaleString()} caracteres). Limite de memoria: ${MEMORY_LIMIT_MB}MB.`
        };
      }
    }

    // Detect bytearray with very large size
    const largeBytearray = line.match(/bytearray\s*\(\s*(\d+)\s*\)/);
    if (largeBytearray) {
      const size = parseInt(largeBytearray[1]);
      // Bytearrays larger than 500MB
      if (size >= 500000000) {
        return {
          isMemoryOveruse: true,
          message: `MemoryError: Se intento crear un bytearray demasiado grande (${size.toLocaleString()} bytes). Limite de memoria: ${MEMORY_LIMIT_MB}MB.`
        };
      }
    }

    // Detect recursive memory allocation pattern: large nested list comprehension
    const nestedComprehension = line.match(/\[\s*\[\s*[^\]]+\s*for\s+\w+\s+in\s+range\s*\(\s*(\d+)\s*\)\s*\]\s*for\s+\w+\s+in\s+range\s*\(\s*(\d+)\s*\)\s*\]/);
    if (nestedComprehension) {
      const innerSize = parseInt(nestedComprehension[1]);
      const outerSize = parseInt(nestedComprehension[2]);
      const totalSize = innerSize * outerSize;
      if (totalSize >= 100000000) {
        return {
          isMemoryOveruse: true,
          message: `MemoryError: Se intento crear una matriz de ${outerSize.toLocaleString()}x${innerSize.toLocaleString()} = ${totalSize.toLocaleString()} elementos. Limite de memoria: ${MEMORY_LIMIT_MB}MB.`
        };
      }
    }

    // Detect explicit b'x' * large_number patterns
    const largeBytesMultiply = line.match(/b['"][^'"]*['"]\s*\*\s*(\d+)/);
    if (largeBytesMultiply) {
      const size = parseInt(largeBytesMultiply[1]);
      if (size >= 500000000) {
        return {
          isMemoryOveruse: true,
          message: `MemoryError: Se intento crear bytes demasiado grandes (${size.toLocaleString()} bytes). Limite de memoria: ${MEMORY_LIMIT_MB}MB.`
        };
      }
    }
  }

  return { isMemoryOveruse: false };
}

/**
 * Detect common infinite loop patterns in Python code
 */
export function detectInfiniteLoop(code) {
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Detect "while True:" pattern
    if (/^while\s+True\s*:/.test(line)) {
      const hasBreak = checkForBreakInLoop(lines, i);
      if (!hasBreak) {
        return {
          isInfiniteLoop: true,
          message: 'Se detecto un bucle infinito (while True: sin break). El contenedor fue limpiado correctamente.'
        };
      }
    }

    // Detect "while 1:" pattern
    if (/^while\s+1\s*:/.test(line)) {
      const hasBreak = checkForBreakInLoop(lines, i);
      if (!hasBreak) {
        return {
          isInfiniteLoop: true,
          message: 'Se detecto un bucle infinito (while 1: sin break). El contenedor fue limpiado correctamente.'
        };
      }
    }

    // Detect "for ... in itertools.cycle()" or similar infinite iterators
    if (/^for\s+\w+\s+in\s+itertools\.cycle\s*\(/.test(line)) {
      const hasBreak = checkForBreakInLoop(lines, i);
      if (!hasBreak) {
        return {
          isInfiniteLoop: true,
          message: 'Se detecto un bucle infinito (itertools.cycle sin break). El contenedor fue limpiado correctamente.'
        };
      }
    }
  }

  return { isInfiniteLoop: false };
}

/**
 * Check if a loop has a break statement within its body
 */
function checkForBreakInLoop(lines, loopLineIndex) {
  const loopLine = lines[loopLineIndex];
  const loopIndent = loopLine.search(/\S/);

  for (let i = loopLineIndex + 1; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) continue;

    const currentIndent = line.search(/\S/);

    if (currentIndent <= loopIndent && trimmed) {
      break;
    }

    if (/\bbreak\b/.test(trimmed)) {
      return true;
    }
  }

  return false;
}

/**
 * Execute a function with a timeout
 */
export async function executeWithTimeout(fn, timeoutMs) {
  return new Promise((resolve) => {
    const timeoutId = setTimeout(() => {
      resolve({ timedOut: true, value: null });
    }, timeoutMs);

    try {
      const result = fn();
      clearTimeout(timeoutId);
      resolve({ timedOut: false, value: result });
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  });
}
