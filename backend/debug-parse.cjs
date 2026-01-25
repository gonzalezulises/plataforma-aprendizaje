// Debug the parse function to understand the issue
const searchInputs = [
  'Fundamentos',      // Simple - should work
  '"Fundamentos"',    // Quoted - returns 0
  '"Python Fundamentos"', // Quoted phrase
  '"Python',          // Unbalanced
];

// Replicate the function from searchUtils.js
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

console.log('Testing parseSearchQuery:\n');

for (const input of searchInputs) {
  console.log(`Input: ${JSON.stringify(input)}`);
  const result = parseSearchQuery(input);
  console.log(`  exactPhrases: ${JSON.stringify(result.exactPhrases)}`);
  console.log(`  words: ${JSON.stringify(result.words)}`);
  console.log(`  Total terms: ${result.exactPhrases.length + result.words.length}`);
  console.log('');
}
