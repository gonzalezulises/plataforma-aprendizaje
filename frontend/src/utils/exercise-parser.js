/**
 * exercise-parser.js - Detects exercise patterns in AI-generated markdown content.
 *
 * Supports two modes:
 * 1. Structured markers: <!-- quiz-start --> / <!-- quiz-end -->, etc.
 * 2. Natural patterns: ### Ejercicio headings, A)/B)/C)/D) options, <details> solutions
 *
 * Exports:
 * - parseExercises(markdown): returns { segments, exercises }
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
  let remaining = markdown;
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
    // Add markdown before this marker
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

  // Add remaining markdown
  if (pos < markdown.length) {
    const after = markdown.slice(pos).trim();
    if (after) {
      segments.push({ type: 'markdown', content: after });
    }
  }

  return segments;
}

/**
 * Parse natural exercise patterns in markdown.
 * Detects:
 * - ### Ejercicio / ### Ejercicios headings
 * - MCQ patterns (A) / B) / C) / D) or a) / b) / c) / d))
 * - <details><summary>Ver solucion/Solucion</summary> blocks
 */
function parseNaturalPatterns(markdown) {
  const segments = [];

  // Split by exercise headers
  // Match ### Ejercicio, ### Ejercicios, ### Ejercicio 1, etc.
  const exerciseHeaderRegex = /^(#{2,3}\s+Ejercicio[s]?\s*\d*[.:]*\s*.*?)$/gm;

  const headers = [];
  let match;
  while ((match = exerciseHeaderRegex.exec(markdown)) !== null) {
    headers.push({
      index: match.index,
      header: match[1]
    });
  }

  if (headers.length === 0) {
    // No exercise sections found - return as single markdown segment
    return [{ type: 'markdown', content: markdown }];
  }

  // Build segments by splitting at exercise headers
  let pos = 0;
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];

    // Add markdown before this exercise section
    if (header.index > pos) {
      const before = markdown.slice(pos, header.index).trim();
      if (before) {
        segments.push({ type: 'markdown', content: before });
      }
    }

    // Determine end of this exercise section
    const nextHeaderIndex = i + 1 < headers.length ? headers[i + 1].index : undefined;
    // Also look for the next ## heading (non-exercise) that would end the exercise zone
    const nextH2Regex = /^#{2}\s+(?!Ejercicio)/gm;
    nextH2Regex.lastIndex = header.index + header.header.length;
    const nextH2Match = nextH2Regex.exec(markdown);
    const sectionEnd = Math.min(
      nextHeaderIndex || markdown.length,
      nextH2Match ? nextH2Match.index : markdown.length
    );

    const sectionContent = markdown.slice(header.index, sectionEnd).trim();

    // Detect if this is a quiz (MCQ) or code exercise
    const hasOptions = /^\s*[A-Da-d]\)\s+/m.test(sectionContent);
    const hasCodeBlock = /```(?:python|sql)/m.test(sectionContent);

    if (hasOptions) {
      const quiz = parseQuizFromNaturalContent(sectionContent);
      segments.push({ type: 'quiz', ...quiz });
    } else if (hasCodeBlock) {
      segments.push({
        type: 'exercise',
        content: sectionContent,
        language: /```sql/m.test(sectionContent) ? 'sql' : 'python',
        exerciseType: 'code'
      });
    } else {
      // Generic exercise section - still render as exercise
      segments.push({
        type: 'exercise',
        content: sectionContent,
        language: 'python',
        exerciseType: 'text'
      });
    }

    pos = sectionEnd;
  }

  // Add remaining markdown
  if (pos < markdown.length) {
    const after = markdown.slice(pos).trim();
    if (after) {
      segments.push({ type: 'markdown', content: after });
    }
  }

  return segments;
}

/**
 * Parse MCQ quiz from structured marker content.
 */
function parseQuizContent(content) {
  const questions = [];
  // Split into questions by numbered patterns: 1. / 1) / **Pregunta 1**/
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
 * Parse quiz questions from natural markdown content (exercise section with MCQ options).
 */
function parseQuizFromNaturalContent(content) {
  const questions = [];

  // Extract text between the heading and the options
  const lines = content.split('\n');
  let questionText = '';
  let options = [];
  let correctAnswer = null;
  let explanation = '';
  let inQuestion = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Skip the exercise heading
    if (/^#{2,3}\s+Ejercicio/.test(line)) {
      inQuestion = true;
      continue;
    }

    // Detect option lines
    const optionMatch = line.match(/^([A-Da-d])\)\s+(.+)/);
    if (optionMatch) {
      const label = optionMatch[1].toUpperCase();
      let text = optionMatch[2];

      // Check if this option is marked as correct
      const isCorrect = text.includes('✓') || text.includes('✅') || text.includes('(correcta)') || text.includes('(correct)');
      if (isCorrect) {
        text = text.replace(/\s*[✓✅]\s*/g, '').replace(/\s*\(correct[a]?\)\s*/g, '').trim();
        correctAnswer = label;
      }

      options.push({ label, text, isCorrect });
      continue;
    }

    // Detect solution in details block
    if (line.includes('<details>') || line.includes('<summary>')) {
      // Collect everything until </details>
      let detailContent = '';
      for (let j = i; j < lines.length; j++) {
        if (lines[j].includes('</details>')) {
          detailContent += lines[j];
          i = j;
          break;
        }
        detailContent += lines[j] + '\n';
      }
      // Extract the answer from details content
      const answerMatch = detailContent.match(/(?:respuesta|answer|correcta|solucion)[:\s]*([A-Da-d])\)?/i);
      if (answerMatch && !correctAnswer) {
        correctAnswer = answerMatch[1].toUpperCase();
      }
      // Extract explanation
      const explMatch = detailContent.match(/<\/summary>\s*([\s\S]*?)(?:<\/details>|$)/);
      if (explMatch) {
        explanation = explMatch[1].trim();
      }
      continue;
    }

    // Build question text
    if (inQuestion && options.length === 0 && line) {
      if (questionText) questionText += ' ';
      questionText += line;
    }
  }

  // If no correct answer found in markup, try to find it in the explanation
  if (!correctAnswer && explanation) {
    const expMatch = explanation.match(/(?:respuesta|answer|correcta|opcion)[:\s]*([A-Da-d])\)?/i);
    if (expMatch) {
      correctAnswer = expMatch[1].toUpperCase();
    }
  }

  // Mark the correct option
  if (correctAnswer) {
    options = options.map(opt => ({
      ...opt,
      isCorrect: opt.label === correctAnswer
    }));
  }

  if (questionText && options.length >= 2) {
    questions.push({
      question: questionText,
      options,
      explanation,
      correctAnswer
    });
  }

  return { questions, content };
}

/**
 * Parse a single question block into a structured question.
 */
function parseQuestionBlock(block) {
  const lines = block.trim().split('\n');
  if (lines.length < 2) return null;

  // First line is the question
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

    // Look for explanation in details
    if (line.includes('<summary>')) {
      const restLines = lines.slice(i).join('\n');
      const explMatch = restLines.match(/<\/summary>\s*([\s\S]*?)(?:<\/details>|$)/);
      if (explMatch) {
        explanation = explMatch[1].trim();
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
