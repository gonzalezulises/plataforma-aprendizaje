const fs = require('fs');

const filePath = 'C:/Users/gonza/claude-projects/backend/src/routes/analytics.js';
let content = fs.readFileSync(filePath, 'utf8');

// Fix l."order" to l.order_index in the lessons query
content = content.replace(/l\."order" as lesson_order/g, 'l.order_index as lesson_order');
content = content.replace(/ORDER BY m\."order", l\."order"/g, 'ORDER BY m."order", l.order_index');

fs.writeFileSync(filePath, content);
console.log('Fixed order column references in analytics.js');
