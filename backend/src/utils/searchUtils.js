/**
 * Parse search query to handle quoted phrases
 * Feature #179: Quotes in search work correctly
 *
 * Examples:
 * - "Python Fundamentos" -> exact phrase search
 * - "Python Fundamentos -> gracefully handle unbalanced quote (treat as literal)
 * - Python "desde cero" JavaScript -> mixed search
 *
 * Returns: { exactPhrases: string[], words: string[] }
 */
export function parseSearchQuery(search) {
  if (!search || typeof search !== 'string') {
    return { exactPhrases: [], words: [] };
  }

  const exactPhrases = [];
  const words = [];

  // Regular expression to match quoted phrases (both double and single quotes)
  // Match: "phrase" or 'phrase' with balanced quotes
  const quotedRegex = /"([^"]+)"|'([^']+)'/g;
  let remaining = search;
  let match;

  // Extract balanced quoted phrases
  while ((match = quotedRegex.exec(search)) !== null) {
    const phrase = match[1] || match[2]; // Group 1 for double quotes, group 2 for single
    if (phrase && phrase.trim()) {
      exactPhrases.push(phrase.trim());
    }
  }

  // Remove matched quoted phrases from the search string
  remaining = search.replace(quotedRegex, ' ');

  // Handle unbalanced quotes gracefully: treat remaining quotes as literal text
  // Remove only the unbalanced quote character itself, keeping surrounding text
  remaining = remaining.replace(/["']/g, ' ');

  // Split remaining into individual words
  const remainingWords = remaining.split(/\s+/).filter(w => w.trim());
  words.push(...remainingWords);

  return { exactPhrases, words };
}

// RELOAD_MARKER: 2026-01-25T20:42:42.010Z
