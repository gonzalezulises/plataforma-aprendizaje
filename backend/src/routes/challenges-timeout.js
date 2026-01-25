/**
 * Timeout detection helpers for code execution
 * Feature #108: Code execution timeout shows message
 * Feature #116: Memory limit exceeded in code execution
 */

// Default memory limit in MB
const MEMORY_LIMIT_MB = 256;

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
