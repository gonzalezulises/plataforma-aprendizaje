/**
 * Code Executor Utility - Feature #126
 * Provides code execution functionality for lessons and other routes
 * Extracted from challenges.js to avoid circular dependencies
 */

import { detectInfiniteLoop, detectMemoryOveruse, detectSyntaxError, executeWithTimeout } from '../routes/challenges-timeout.js';

/**
 * Execute code in a sandboxed environment
 * For now, this is a simulation. In production, use Docker containers.
 */
export async function executeCode(code, language, timeoutSeconds = 30) {
  const startTime = Date.now();
  const timeoutMs = timeoutSeconds * 1000;

  // For development, simulate Python execution
  if (language === 'python') {
    try {
      // Check for syntax errors BEFORE execution
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

      // Check for memory overuse patterns BEFORE execution
      const memoryResult = detectMemoryOveruse(code);
      if (memoryResult.isMemoryOveruse) {
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

  // Handle string literals
  if ((expr.startsWith('"') && expr.endsWith('"')) ||
      (expr.startsWith("'") && expr.endsWith("'"))) {
    return expr.slice(1, -1);
  }

  // Handle f-strings
  if (expr.startsWith('f"') || expr.startsWith("f'")) {
    let result = expr.slice(2, -1);
    result = result.replace(/\{([^}]+)\}/g, (match, innerExpr) => {
      return String(evaluateExpression(innerExpr.trim(), variables, functions));
    });
    return result;
  }

  // Handle type() calls
  if (expr.startsWith('type(') && expr.endsWith(')')) {
    const innerExpr = expr.slice(5, -1).trim();
    const value = evaluateExpression(innerExpr, variables, functions);
    if (typeof value === 'string') return "<class 'str'>";
    if (typeof value === 'number' && Number.isInteger(value)) return "<class 'int'>";
    if (typeof value === 'number') return "<class 'float'>";
    if (typeof value === 'boolean') return "<class 'bool'>";
    if (Array.isArray(value)) return "<class 'list'>";
    return "<class 'object'>";
  }

  // Handle len() calls
  if (expr.startsWith('len(') && expr.endsWith(')')) {
    const innerExpr = expr.slice(4, -1).trim();
    const value = evaluateExpression(innerExpr, variables, functions);
    if (typeof value === 'string' || Array.isArray(value)) {
      return value.length;
    }
    return 0;
  }

  // Handle function calls
  const funcCallMatch = expr.match(/^(\w+)\(([^)]*)\)$/);
  if (funcCallMatch && functions[funcCallMatch[1]]) {
    const func = functions[funcCallMatch[1]];
    const args = funcCallMatch[2].split(',').map(a => evaluateExpression(a.trim(), variables, functions));
    const localVars = { ...variables };
    func.params.forEach((param, i) => {
      localVars[param] = args[i];
    });
    const lines = func.body.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('return ')) {
        return evaluateExpression(trimmed.slice(7), localVars, functions);
      }
    }
    return null;
  }

  // Handle numbers
  if (!isNaN(Number(expr))) {
    const num = Number(expr);
    return Number.isInteger(num) ? num : num;
  }

  // Handle booleans
  if (expr === 'True') return true;
  if (expr === 'False') return false;
  if (expr === 'None') return null;

  // Handle list literals
  if (expr.startsWith('[') && expr.endsWith(']')) {
    const content = expr.slice(1, -1).trim();
    if (!content) return [];
    const items = content.split(',').map(item => evaluateExpression(item.trim(), variables, functions));
    return items;
  }

  // Handle arithmetic operations
  if (expr.includes('+') || expr.includes('-') || expr.includes('*') || expr.includes('/')) {
    try {
      let evalExpr = expr;
      for (const [varName, varValue] of Object.entries(variables)) {
        evalExpr = evalExpr.replace(new RegExp(`\\b${varName}\\b`, 'g'), JSON.stringify(varValue));
      }
      const result = Function(`"use strict"; return (${evalExpr})`)();
      return result;
    } catch (e) {
      return expr;
    }
  }

  // Handle variable references
  if (variables[expr] !== undefined) {
    return variables[expr];
  }

  return expr;
}
