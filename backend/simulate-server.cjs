// Simulate what happens when the server receives a search query with quotes
// This tests the full flow including SQL generation

// Replicate parseSearchQuery
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
const testCases = [
  'Fundamentos',           // Simple - should work
  '"Fundamentos"',         // Quoted - should work
  '"Python Fundamentos"',  // Quoted phrase - should work
  '"Python',               // Unbalanced - should work (treat as literal)
];

console.log('Testing search query processing:\n');

for (const search of testCases) {
  console.log(`=== Input: ${JSON.stringify(search)} ===`);

  const { exactPhrases, words } = parseSearchQuery(search);
  console.log('  Parsed:', { exactPhrases, words });

  // Simulate SQL building
  const params = [];
  const searchConditions = [];

  for (const phrase of exactPhrases) {
    searchConditions.push('(title LIKE ? OR description LIKE ?)');
    params.push(`%${phrase}%`, `%${phrase}%`);
  }

  for (const word of words) {
    searchConditions.push('(title LIKE ? OR description LIKE ?)');
    params.push(`%${word}%`, `%${word}%`);
  }

  const whereClause = searchConditions.length > 0
    ? ' AND (' + searchConditions.join(' AND ') + ')'
    : '';

  console.log('  SQL WHERE clause:', whereClause);
  console.log('  Params:', params);

  // The key insight: are params correct for finding "Fundamentos"?
  const canFindFundamentos = params.some(p => p.toLowerCase().includes('fundamentos'));
  console.log('  Can find "Fundamentos"?:', canFindFundamentos);
  console.log('');
}
