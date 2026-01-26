const Database = require('./backend/node_modules/better-sqlite3');
const db = new Database('./backend/database.sqlite');

// Check current notifications
console.log("=== Current Notifications ===");
const notifications = db.prepare(`
  SELECT n.id, n.user_id, n.type, n.title, n.read, u.email
  FROM notifications n
  JOIN users u ON n.user_id = u.id
  ORDER BY n.created_at DESC
  LIMIT 20
`).all();
console.log(JSON.stringify(notifications, null, 2));

// Get unread count per user
console.log("\n=== Unread Count Per User ===");
const unreadCounts = db.prepare(`
  SELECT n.user_id, u.email, COUNT(*) as unread_count
  FROM notifications n
  JOIN users u ON n.user_id = u.id
  WHERE n.read = 0
  GROUP BY n.user_id
`).all();
console.log(JSON.stringify(unreadCounts, null, 2));

db.close();
