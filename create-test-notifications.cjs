const Database = require('better-sqlite3');
const db = new Database('./data/learning_platform.db');

// Get the instructor user ID
const user = db.prepare('SELECT id, email, name FROM users WHERE email = ?').get('instructor@test.com');
console.log('User:', user);

if (user) {
  // Create some test notifications
  const notifications = [
    { type: 'feedback_received', title: 'Nuevo feedback recibido', message: 'Tu instructor ha dejado comentarios en tu proyecto de Python.', content: JSON.stringify({submission_id: 1}) },
    { type: 'badge_earned', title: 'Badge obtenido: Primer Proyecto', message: 'Felicidades! Has completado tu primer proyecto.', content: JSON.stringify({career_path_slug: 'data-science'}) },
    { type: 'webinar_reminder', title: 'Webinar en 1 hora', message: 'El webinar de Python Avanzado comienza pronto.', content: JSON.stringify({webinar_id: 1}) },
    { type: 'enrollment_confirmed', title: 'Inscripcion confirmada', message: 'Te has inscrito exitosamente en Data Science con Python.', content: JSON.stringify({course_slug: 'data-science-python'}) },
    { type: 'new_comment', title: 'Nueva respuesta en tu pregunta', message: 'Alguien ha respondido a tu pregunta en el foro.', content: JSON.stringify({lesson_id: 1, course_slug: 'python-fundamentos'}) }
  ];

  const stmt = db.prepare('INSERT INTO notifications (user_id, type, title, message, content, is_read, created_at) VALUES (?, ?, ?, ?, ?, 0, datetime("now", "-" || ? || " minutes"))');

  notifications.forEach((n, i) => {
    stmt.run(user.id, n.type, n.title, n.message, n.content, i * 15);
  });

  console.log('Created', notifications.length, 'notifications for user', user.id);

  // Count notifications
  const count = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ?').get(user.id);
  console.log('Total notifications for user:', count.count);
}

db.close();
