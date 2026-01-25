/**
 * Timeout detection helpers for code execution
 * Feature #108: Code execution timeout shows message
 */

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
