import { parseSearchQuery } from './src/utils/searchUtils.js';

console.log('Testing parseSearchQuery:');
console.log('');

// Test 1: Quoted phrase
console.log('Test 1: "Fundamentos"');
console.log(JSON.stringify(parseSearchQuery('"Fundamentos"'), null, 2));
console.log('');

// Test 2: Quoted phrase with space
console.log('Test 2: "Python Fundamentos"');
console.log(JSON.stringify(parseSearchQuery('"Python Fundamentos"'), null, 2));
console.log('');

// Test 3: Unbalanced quote
console.log('Test 3: "Python (unbalanced)');
console.log(JSON.stringify(parseSearchQuery('"Python'), null, 2));
console.log('');

// Test 4: Mixed search
console.log('Test 4: Python "desde cero" JavaScript');
console.log(JSON.stringify(parseSearchQuery('Python "desde cero" JavaScript'), null, 2));
console.log('');

// Test 5: No quotes
console.log('Test 5: Python JavaScript');
console.log(JSON.stringify(parseSearchQuery('Python JavaScript'), null, 2));
