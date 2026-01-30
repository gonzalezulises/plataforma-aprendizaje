/**
 * Content Quality Scorer for AI-generated lesson content.
 * Pure function — no external dependencies.
 *
 * Scores content 0-100 across 6 metrics and auto-classifies review status.
 *
 * Metrics (weights):
 *   sectionCompleteness  25%  — All 4C sections present with >200 chars each
 *   practiceRatio        20%  — Practice section >= 35% of total content
 *   executableCode       15%  — >= 3 code blocks (```python or ```sql)
 *   quizValidity         15%  — >= 3 valid quizzes (A/B/C/D + <details>)
 *   conceptAlignment     15%  — Key concepts from structure_4c appear in content
 *   minimumLength        10%  — >= 1500 words
 */

const SECTION_HEADERS = [
  { header: '## 🔗 Conexiones', key: 'conexiones' },
  { header: '## 💡 Conceptos', key: 'conceptos' },
  { header: '## 🛠️ Practica Concreta', key: 'practica' },
  { header: '## 🎯 Conclusion', key: 'conclusion' }
];

const SECTION_EMOJI_MAP = {
  conexiones: '🔗',
  conceptos: '💡',
  practica: '🛠️',
  conclusion: '🎯'
};

/**
 * Score AI-generated content on quality metrics.
 * @param {string} content - The markdown content to score
 * @param {object|null} structure4c - The 4C structure from the lesson (for concept alignment)
 * @returns {{ overall: number, breakdown: object, issues: string[], reviewStatus: string }}
 */
export function scoreContent(content, structure4c) {
  if (!content || typeof content !== 'string') {
    return {
      overall: 0,
      breakdown: {
        sectionCompleteness: 0,
        practiceRatio: 0,
        executableCode: 0,
        quizValidity: 0,
        conceptAlignment: 0,
        minimumLength: 0
      },
      issues: ['No content provided'],
      reviewStatus: 'needs_review'
    };
  }

  const issues = [];

  // 1. Section Completeness (25%)
  const sectionCompleteness = scoreSectionCompleteness(content, issues);

  // 2. Practice Ratio (20%)
  const practiceRatio = scorePracticeRatio(content, issues);

  // 3. Executable Code (15%)
  const executableCode = scoreExecutableCode(content, issues);

  // 4. Quiz Validity (15%)
  const quizValidity = scoreQuizValidity(content, issues);

  // 5. Concept Alignment (15%)
  const conceptAlignment = scoreConceptAlignment(content, structure4c, issues);

  // 6. Minimum Length (10%)
  const minimumLength = scoreMinimumLength(content, issues);

  const breakdown = {
    sectionCompleteness,
    practiceRatio,
    executableCode,
    quizValidity,
    conceptAlignment,
    minimumLength
  };

  // Weighted overall score
  const overall = Math.round(
    sectionCompleteness * 0.25 +
    practiceRatio * 0.20 +
    executableCode * 0.15 +
    quizValidity * 0.15 +
    conceptAlignment * 0.15 +
    minimumLength * 0.10
  );

  const reviewStatus = overall >= 80 ? 'auto_approved' : 'needs_review';

  return { overall, breakdown, issues, reviewStatus };
}

/**
 * Metric 1: Section Completeness (25%)
 * Score 100 if all 4 sections exist with >200 chars each. 0 if missing sections.
 */
function scoreSectionCompleteness(content, issues) {
  const sections = extractSections(content);
  let score = 0;
  let foundCount = 0;
  const minChars = 200;

  for (const { key } of SECTION_HEADERS) {
    const sectionContent = sections[key];
    if (sectionContent) {
      foundCount++;
      if (sectionContent.length >= minChars) {
        score += 25; // 25 per section = 100 total
      } else {
        score += Math.round((sectionContent.length / minChars) * 25);
        issues.push(`Seccion ${key} tiene solo ${sectionContent.length} caracteres (min: ${minChars})`);
      }
    } else {
      issues.push(`Seccion ${key} no encontrada`);
    }
  }

  if (foundCount < 4) {
    issues.push(`Solo ${foundCount}/4 secciones 4C presentes`);
  }

  return Math.min(100, score);
}

/**
 * Metric 2: Practice Ratio (20%)
 * Score 100 if practice section >= 35% of total. 0 if < 15%.
 */
function scorePracticeRatio(content, issues) {
  const sections = extractSections(content);
  const practiceContent = sections.practica || '';
  const totalLength = content.length;

  if (totalLength === 0) return 0;

  const ratio = practiceContent.length / totalLength;

  if (ratio >= 0.35) {
    return 100;
  } else if (ratio < 0.15) {
    issues.push(`Seccion practica es solo ${Math.round(ratio * 100)}% del contenido (min: 15%, ideal: 35%)`);
    return Math.round((ratio / 0.15) * 50); // 0-50 range for < 15%
  } else {
    // Linear interpolation between 15% -> 50 points and 35% -> 100 points
    return Math.round(50 + ((ratio - 0.15) / (0.35 - 0.15)) * 50);
  }
}

/**
 * Metric 3: Executable Code (15%)
 * Score 100 if >= 3 code blocks with ```python or ```sql. 0 if none.
 */
function scoreExecutableCode(content, issues) {
  const codeBlockRegex = /```(?:python|sql)\b/gi;
  const matches = content.match(codeBlockRegex) || [];
  const count = matches.length;

  if (count >= 3) {
    return 100;
  } else if (count === 0) {
    issues.push('No se encontraron bloques de codigo ejecutable (```python o ```sql)');
    return 0;
  } else {
    issues.push(`Solo ${count}/3 bloques de codigo ejecutable encontrados`);
    return Math.round((count / 3) * 100);
  }
}

/**
 * Metric 4: Quiz Validity (15%)
 * Score 100 if >= 3 valid quizzes with A/B/C/D options and <details> explanation.
 */
function scoreQuizValidity(content, issues) {
  // Count quiz patterns: lines with A) B) C) D) options
  const quizPattern = /(?:^|\n)\s*A\)\s*.+\n\s*B\)\s*.+\n\s*C\)\s*.+\n\s*D\)\s*.+/g;
  const quizMatches = content.match(quizPattern) || [];
  const quizCount = quizMatches.length;

  // Check for <details> blocks (answer explanations)
  const detailsPattern = /<details>/gi;
  const detailsMatches = content.match(detailsPattern) || [];

  // Valid quiz = has A/B/C/D AND has a <details> nearby
  const validCount = Math.min(quizCount, detailsMatches.length);

  if (validCount >= 3) {
    return 100;
  } else if (validCount === 0) {
    issues.push('No se encontraron quizzes validos (A/B/C/D con explicacion en <details>)');
    return 0;
  } else {
    issues.push(`Solo ${validCount}/3 quizzes validos encontrados`);
    return Math.round((validCount / 3) * 100);
  }
}

/**
 * Metric 5: Concept Alignment (15%)
 * Score 100 if all key_concepts from structure_4c appear in content.
 */
function scoreConceptAlignment(content, structure4c, issues) {
  if (!structure4c || !structure4c.concepts || !structure4c.concepts.key_concepts) {
    // No structure to compare against — give benefit of the doubt
    return 75;
  }

  const keyConcepts = structure4c.concepts.key_concepts;
  if (!Array.isArray(keyConcepts) || keyConcepts.length === 0) {
    return 75;
  }

  const contentLower = content.toLowerCase();
  let foundCount = 0;
  const missing = [];

  for (const concept of keyConcepts) {
    // Normalize: split multi-word concepts, check if key words appear
    const words = concept.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const found = words.length === 0 || words.some(word => contentLower.includes(word));
    if (found) {
      foundCount++;
    } else {
      missing.push(concept);
    }
  }

  const score = Math.round((foundCount / keyConcepts.length) * 100);

  if (missing.length > 0) {
    issues.push(`Conceptos clave no encontrados: ${missing.join(', ')}`);
  }

  return score;
}

/**
 * Metric 6: Minimum Length (10%)
 * Score 100 if >= 1500 words. Proportional below that.
 */
function scoreMinimumLength(content, issues) {
  const wordCount = content.split(/\s+/).filter(w => w.length > 0).length;
  const targetWords = 1500;

  if (wordCount >= targetWords) {
    return 100;
  }

  const score = Math.round((wordCount / targetWords) * 100);
  issues.push(`Contenido tiene ${wordCount} palabras (objetivo: ${targetWords})`);
  return Math.min(100, score);
}

/**
 * Extract content for each 4C section.
 * Returns { conexiones: string, conceptos: string, practica: string, conclusion: string }
 */
function extractSections(content) {
  const result = {};
  const headerPositions = [];

  for (const { header, key } of SECTION_HEADERS) {
    const idx = content.indexOf(header);
    if (idx !== -1) {
      headerPositions.push({ key, start: idx, headerLength: header.length });
    }
  }

  // Sort by position
  headerPositions.sort((a, b) => a.start - b.start);

  for (let i = 0; i < headerPositions.length; i++) {
    const current = headerPositions[i];
    const contentStart = current.start + current.headerLength;
    const contentEnd = i + 1 < headerPositions.length
      ? headerPositions[i + 1].start
      : content.length;
    result[current.key] = content.substring(contentStart, contentEnd).trim();
  }

  return result;
}

export default { scoreContent };
