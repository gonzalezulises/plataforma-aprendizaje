/**
 * exercise-parser.js - Detects exercise patterns in AI-generated markdown content.
 *
 * Supports two modes:
 * 1. Structured markers: <!-- quiz-start --> / <!-- quiz-end -->, etc.
 * 2. Natural patterns: MCQ blocks (numbered question + A/B/C/D options + <details> answer)
 *    detected ANYWHERE in the markdown, plus ### Ejercicio headings for code exercises.
 *
 * Exports:
 * - parseExercises(markdown): returns { segments }
 *   where segments is an array of { type: 'markdown' | 'quiz' | 'exercise', content, ... }
 */

/**
 * Main entry: parse markdown into segments with detected exercises.
 * @param {string} markdown - Raw markdown content
 * @returns {{ segments: Segment[] }}
 */
export function parseExercises(markdown) {
  if (!markdown) return { segments: [{ type: 'markdown', content: '' }] };

  // First try structured markers (Phase 5 AI-generated content)
  let segments = parseStructuredMarkers(markdown);
  if (segments.length > 1) {
    return { segments };
  }

  // Fall back to natural pattern detection
  segments = parseNaturalPatterns(markdown);
  return { segments };
}

/**
 * Parse structured HTML comment markers.
 * <!-- quiz-start --> ... <!-- quiz-end -->
 * <!-- exercise-start type="code" lang="python" --> ... <!-- exercise-end -->
 */
function parseStructuredMarkers(markdown) {
  const segments = [];
  let foundMarker = false;

  // Quiz markers
  const quizRegex = /<!--\s*quiz-start\s*-->([\s\S]*?)<!--\s*quiz-end\s*-->/g;
  // Exercise markers
  const exerciseRegex = /<!--\s*exercise-start\s+(.*?)\s*-->([\s\S]*?)<!--\s*exercise-end\s*-->/g;

  // Collect all markers with positions
  const markers = [];

  let match;
  while ((match = quizRegex.exec(markdown)) !== null) {
    foundMarker = true;
    markers.push({
      type: 'quiz',
      start: match.index,
      end: match.index + match[0].length,
      content: match[1].trim(),
      raw: match[0]
    });
  }

  while ((match = exerciseRegex.exec(markdown)) !== null) {
    foundMarker = true;
    const attrs = parseAttributes(match[1]);
    markers.push({
      type: 'exercise',
      start: match.index,
      end: match.index + match[0].length,
      content: match[2].trim(),
      attrs,
      raw: match[0]
    });
  }

  if (!foundMarker) {
    return [{ type: 'markdown', content: markdown }];
  }

  // Sort markers by position
  markers.sort((a, b) => a.start - b.start);

  // Build segments
  let pos = 0;
  for (const marker of markers) {
    if (marker.start > pos) {
      const before = markdown.slice(pos, marker.start).trim();
      if (before) {
        segments.push({ type: 'markdown', content: before });
      }
    }

    if (marker.type === 'quiz') {
      const quiz = parseQuizContent(marker.content);
      segments.push({ type: 'quiz', ...quiz });
    } else if (marker.type === 'exercise') {
      segments.push({
        type: 'exercise',
        content: marker.content,
        language: marker.attrs.lang || marker.attrs.language || 'python',
        exerciseType: marker.attrs.type || 'code'
      });
    }

    pos = marker.end;
  }

  if (pos < markdown.length) {
    const after = markdown.slice(pos).trim();
    if (after) {
      segments.push({ type: 'markdown', content: after });
    }
  }

  return segments;
}

/**
 * Parse natural exercise/quiz patterns in markdown.
 *
 * Strategy:
 * 1. Scan line-by-line for MCQ blocks (numbered question + A/B/C/D options)
 * 2. Also detect ### Ejercicio headings for code exercises
 * 3. Everything else is plain markdown
 *
 * MCQ blocks are detected ANYWHERE — not limited to specific headings.
 */
function parseNaturalPatterns(markdown) {
  const lines = markdown.split('\n');
  const segments = [];
  let markdownLines = [];
  let quizQuestions = [];
  let i = 0;

  while (i < lines.length) {
    // Try to parse a code exercise block (### Ejercicio with ```python/sql)
    const exercise = tryParseExerciseBlock(lines, i);
    if (exercise) {
      flushAccumulated(segments, markdownLines, quizQuestions);
      markdownLines = [];
      quizQuestions = [];
      segments.push({
        type: 'exercise',
        content: exercise.raw,
        language: exercise.language,
        exerciseType: 'code'
      });
      i = exercise.endLine;
      continue;
    }

    // Try to parse a MCQ question block (numbered question + A/B/C/D)
    const mcq = tryParseMCQAt(lines, i);
    if (mcq) {
      // Flush markdown before quiz (but keep accumulating quiz questions)
      if (markdownLines.length > 0) {
        if (quizQuestions.length > 0) {
          segments.push({ type: 'quiz', questions: quizQuestions, content: '' });
          quizQuestions = [];
        }
        const md = markdownLines.join('\n').trim();
        if (md) segments.push({ type: 'markdown', content: md });
        markdownLines = [];
      }
      quizQuestions.push(mcq.question);
      i = mcq.endLine;
      continue;
    }

    // Regular line — check if it's a blank between consecutive quiz questions
    if (quizQuestions.length > 0 && lines[i].trim() === '') {
      // Look ahead: is there another MCQ question coming within 3 lines?
      let nextMCQNear = false;
      for (let k = i + 1; k < Math.min(i + 4, lines.length); k++) {
        if (tryParseMCQAt(lines, k)) {
          nextMCQNear = true;
          break;
        }
      }
      if (nextMCQNear) {
        i++;
        continue; // Skip blank line between quiz questions
      }
    }

    // Flush quiz questions if we transition to non-quiz content
    if (quizQuestions.length > 0) {
      segments.push({ type: 'quiz', questions: quizQuestions, content: '' });
      quizQuestions = [];
    }

    markdownLines.push(lines[i]);
    i++;
  }

  // Flush remaining accumulated content
  flushAccumulated(segments, markdownLines, quizQuestions);

  // If nothing was detected, return as single markdown
  if (segments.length === 0) {
    return [{ type: 'markdown', content: markdown }];
  }

  return segments;
}

/**
 * Flush accumulated markdown lines and quiz questions into segments.
 */
function flushAccumulated(segments, markdownLines, quizQuestions) {
  if (quizQuestions.length > 0) {
    segments.push({ type: 'quiz', questions: [...quizQuestions], content: '' });
    quizQuestions.length = 0;
  }
  if (markdownLines.length > 0) {
    const md = markdownLines.join('\n').trim();
    if (md) segments.push({ type: 'markdown', content: md });
    markdownLines.length = 0;
  }
}

/**
 * Try to parse a MCQ question block starting at line index.
 * Returns { question, endLine } or null.
 *
 * A MCQ block is:
 *   [optional number] Question text
 *   A) Option text
 *   B) Option text
 *   C) Option text
 *   D) Option text
 *   [optional blank lines]
 *   [optional <details>...<\/details> explanation]
 */
function tryParseMCQAt(lines, startLine) {
  const line = lines[startLine].trim();

  // Detect two MCQ patterns:
  // Pattern 1: Numbered question (1. / 2.) that is NOT itself an option
  // Pattern 2: Heading-as-question (### Question?) followed directly by A/B/C/D options
  //            Must end with '?' or have a numbered prefix (### 1. / ### 2.)
  const isNumberedQuestion = /^\d+[\.\)]\s+\S/.test(line) && !/^[A-Da-d]\)\s/.test(line);
  const isHeadingQuestion = /^#{2,3}\s+/.test(line) && (/\?\s*$/.test(line) || /^#{2,3}\s+\d+[\.\)]\s/.test(line));

  if (!isNumberedQuestion && !isHeadingQuestion) return null;

  // Look ahead for A/B/C/D options (tighter window for headings to avoid false positives)
  const maxLookahead = isHeadingQuestion ? 3 : 6;
  let optionStart = -1;
  for (let j = startLine + 1; j < Math.min(startLine + maxLookahead, lines.length); j++) {
    if (/^\s*[A-Da-d]\)\s+/.test(lines[j])) {
      optionStart = j;
      break;
    }
  }
  if (optionStart === -1) return null;

  // Collect question text (from startLine to before first option)
  let questionText = '';
  for (let j = startLine; j < optionStart; j++) {
    const l = lines[j].trim();
    if (questionText) questionText += ' ';
    // Strip heading markers (###), numbering (1. / 2.), and leading/trailing formatting
    questionText += l.replace(/^#{1,3}\s+/, '').replace(/^\d+[\.\)]\s*/, '').trim();
  }

  // Collect options
  const options = [];
  let j = optionStart;
  while (j < lines.length) {
    const optMatch = lines[j].trim().match(/^([A-Da-d])\)\s+(.+)/);
    if (optMatch) {
      const label = optMatch[1].toUpperCase();
      let text = optMatch[2].trim();
      // Check for inline correctness markers
      const isCorrect = text.includes('✓') || text.includes('✅') || /\(correcta?\)/i.test(text);
      if (isCorrect) {
        text = text.replace(/\s*[✓✅]\s*/g, '').replace(/\s*\(correct[a]?\)\s*/gi, '').trim();
      }
      options.push({ label, text, isCorrect });
      j++;
    } else {
      break;
    }
  }

  if (options.length < 2) return null;

  // Skip blank lines after options
  while (j < lines.length && lines[j].trim() === '') j++;

  // Try to find <details> explanation block
  let explanation = '';
  let correctAnswer = null;
  let endLine = j;

  if (j < lines.length && (lines[j].includes('<details') || lines[j].includes('<summary'))) {
    let detailContent = '';
    let detailEnd = j;
    for (let k = j; k < lines.length; k++) {
      detailContent += lines[k] + '\n';
      if (lines[k].includes('</details>')) {
        detailEnd = k + 1;
        break;
      }
      // Safety: don't go more than 20 lines into a details block
      if (k - j > 20) {
        detailEnd = k + 1;
        break;
      }
    }

    // Extract correct answer from explanation text
    // Match patterns like: "Respuesta correcta: **B)" or "Respuesta correcta: B)"
    const answerMatch = detailContent.match(
      /(?:respuesta\s*(?:correcta)?|answer|correcta|soluci[oó]n)[:\s]*\**\s*([A-Da-d])\)?\**/i
    );
    if (answerMatch) {
      correctAnswer = answerMatch[1].toUpperCase();
    }

    const explMatch = detailContent.match(/<\/summary>\s*([\s\S]*?)(?:<\/details>|$)/);
    if (explMatch) {
      // Clean up markdown bold/formatting from explanation
      explanation = explMatch[1]
        .replace(/<\/?details>/g, '')
        .trim();
    }

    endLine = detailEnd;
  }

  // Mark correct option from inline markers or explanation
  const inlineCorrect = options.find(o => o.isCorrect);
  if (inlineCorrect && !correctAnswer) {
    correctAnswer = inlineCorrect.label;
  }
  if (correctAnswer) {
    options.forEach(opt => { opt.isCorrect = opt.label === correctAnswer; });
  }

  // Skip trailing blank lines
  while (endLine < lines.length && lines[endLine].trim() === '') endLine++;

  return {
    question: { question: questionText, options, explanation, correctAnswer },
    endLine
  };
}

/**
 * Try to parse a code exercise block starting at line index.
 * Detects ### Ejercicio headings followed by code blocks.
 */
function tryParseExerciseBlock(lines, startLine) {
  const line = lines[startLine].trim();

  // Must be an exercise heading
  if (!/^#{2,3}\s+Ejercicio/i.test(line)) return null;

  // Find the end of this exercise section (next ## heading or end of content)
  let endLine = startLine + 1;
  while (endLine < lines.length) {
    const l = lines[endLine].trim();
    // Stop at next heading of same or higher level (but not ### within the exercise)
    if (/^#{1,2}\s+/.test(l) && !/^#{3}\s+/.test(l)) break;
    // Stop at another exercise heading
    if (/^#{2,3}\s+Ejercicio/i.test(l) && endLine !== startLine) break;
    endLine++;
  }

  const raw = lines.slice(startLine, endLine).join('\n').trim();
  const hasCode = /```(?:python|sql)/m.test(raw);

  if (!hasCode) return null;

  return {
    raw,
    language: /```sql/m.test(raw) ? 'sql' : 'python',
    endLine
  };
}

/**
 * Parse MCQ quiz from structured marker content.
 */
function parseQuizContent(content) {
  const questions = [];
  const questionBlocks = content.split(/(?=^\s*(?:\d+[\.\)]\s+|\*\*Pregunta\s+\d+))/m).filter(Boolean);

  for (const block of questionBlocks) {
    const question = parseQuestionBlock(block);
    if (question) {
      questions.push(question);
    }
  }

  return { questions, content };
}

/**
 * Parse a single question block into a structured question.
 */
function parseQuestionBlock(block) {
  const lines = block.trim().split('\n');
  if (lines.length < 2) return null;

  let questionText = lines[0].replace(/^\s*\d+[\.\)]\s*/, '').replace(/^\*\*Pregunta\s+\d+\**:?\s*/, '').trim();
  const options = [];
  let explanation = '';
  let correctAnswer = null;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    const optionMatch = line.match(/^([A-Da-d])\)\s+(.+)/);
    if (optionMatch) {
      const label = optionMatch[1].toUpperCase();
      let text = optionMatch[2];
      const isCorrect = text.includes('✓') || text.includes('✅');
      if (isCorrect) {
        text = text.replace(/\s*[✓✅]\s*/g, '').trim();
        correctAnswer = label;
      }
      options.push({ label, text, isCorrect });
    }

    if (line.includes('<summary>')) {
      const restLines = lines.slice(i).join('\n');
      const explMatch = restLines.match(/<\/summary>\s*([\s\S]*?)(?:<\/details>|$)/);
      if (explMatch) {
        explanation = explMatch[1].trim();
      }
      const answerMatch = restLines.match(/(?:respuesta|correcta)[:\s]*\**([A-Da-d])\)?/i);
      if (answerMatch && !correctAnswer) {
        correctAnswer = answerMatch[1].toUpperCase();
      }
      break;
    }
  }

  if (!questionText || options.length < 2) return null;

  if (correctAnswer) {
    options.forEach(opt => { opt.isCorrect = opt.label === correctAnswer; });
  }

  return { question: questionText, options, explanation, correctAnswer };
}

/**
 * Parse HTML-style attributes from a string like: type="code" lang="python"
 */
function parseAttributes(str) {
  const attrs = {};
  const regex = /(\w+)="([^"]+)"/g;
  let m;
  while ((m = regex.exec(str)) !== null) {
    attrs[m[1]] = m[2];
  }
  return attrs;
}

/**
 * Extract solution from a <details><summary>...</summary>...</details> block.
 */
export function extractSolution(markdown) {
  const match = markdown.match(/<details>\s*<summary>[^<]*<\/summary>\s*([\s\S]*?)\s*<\/details>/);
  if (match) {
    return match[1].trim();
  }
  return null;
}

/**
 * Extract code blocks from markdown.
 */
export function extractCodeBlocks(markdown) {
  const blocks = [];
  const regex = /```(\w*)\n([\s\S]*?)```/g;
  let match;
  while ((match = regex.exec(markdown)) !== null) {
    blocks.push({
      language: match[1] || 'text',
      code: match[2].trim()
    });
  }
  return blocks;
}
