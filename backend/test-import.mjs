// Test that the import works
import { parseSearchQuery } from './src/utils/searchUtils.js';

console.log('Import successful!');
console.log('parseSearchQuery:', typeof parseSearchQuery);
console.log('Test:', parseSearchQuery('"test"'));
