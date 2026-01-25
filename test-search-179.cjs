/**
 * Test parseSearchQuery function for Feature #179
 */

function parseSearchQuery(search) {
  if (!search || typeof search !== 'string') {
    return { exactPhrases: [], words: [] };
  }

  const exactPhrases = [];
  const words = [];

  const quotedRegex = /"([^"]+)"|'([^']+)'/g;
  let remaining = search;
  let match;

  while ((match = quotedRegex.exec(search)) !== null) {
    const phrase = match[1] || match[2];
    if (phrase && phrase.trim()) {
      exactPhrases.push(phrase.trim());
    }
  }

  remaining = search.replace(quotedRegex, ' ');
  remaining = remaining.replace(/["']/g, ' ');
  const remainingWords = remaining.split(/\s+/).filter(w => w.trim());
  words.push(...remainingWords);

  return { exactPhrases, words };
}

// Test cases
console.log('Test 1: "desde cero" (quoted phrase)');
console.log(JSON.stringify(parseSearchQuery('"desde cero"')));

console.log('\nTest 2: desde cero (no quotes)');
console.log(JSON.stringify(parseSearchQuery('desde cero')));

console.log('\nTest 3: "Python unbalanced quote');
console.log(JSON.stringify(parseSearchQuery('"Python unbalanced quote')));

console.log('\nTest 4: Python "desde cero" JavaScript (mixed)');
console.log(JSON.stringify(parseSearchQuery('Python "desde cero" JavaScript')));

console.log('\nTest 5: Empty string');
console.log(JSON.stringify(parseSearchQuery('')));

console.log('\nTest 6: Single word');
console.log(JSON.stringify(parseSearchQuery('Python')));
