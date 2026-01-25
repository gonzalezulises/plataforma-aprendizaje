// Patch script for Feature #167 - Webinar reminder notifications
const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'backend', 'src', 'routes', 'webinars.js');
console.log('Patching file:', filePath);

let content = fs.readFileSync(filePath, 'utf8');

// Normalize line endings to LF for pattern matching
content = content.replace(/\r\n/g, '\n');

// 1. Update the DELETE endpoint to also delete notifications
const deleteOld = `run('DELETE FROM webinar_registrations WHERE webinar_id = ?', [id]);
    run('DELETE FROM webinars WHERE id = ?', [id]);

    res.json({ success: true, message: 'Webinar deleted' });`;

const deleteNew = `// Delete webinar reminder notifications for this webinar (Feature #167)
    const deletedNotifications = run(\`
      DELETE FROM notifications
      WHERE type = 'webinar_reminder'
      AND json_extract(content, '$.webinar_id') = ?
    \`, [parseInt(id)]);

    console.log(\`[Webinars] Deleted \${deletedNotifications.changes || 0} reminder notifications for webinar \${id}\`);

    run('DELETE FROM webinar_registrations WHERE webinar_id = ?', [id]);
    run('DELETE FROM webinars WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Webinar deleted',
      reminders_cancelled: deletedNotifications.changes || 0
    });`;

if (content.includes(deleteOld)) {
  content = content.replace(deleteOld, deleteNew);
  console.log('Patch 1 applied: DELETE endpoint updated');
} else {
  console.log('Patch 1 skipped: DELETE endpoint already patched or pattern not found');
}

// 2. Update the register endpoint to create notifications
const registerOld = `run(\`
      INSERT INTO webinar_registrations (webinar_id, user_id, registered_at)
      VALUES (?, ?, datetime('now'))
    \`, [id, userId]);

    res.json({ success: true, message: 'Registered successfully' });`;

const registerNew = `run(\`
      INSERT INTO webinar_registrations (webinar_id, user_id, registered_at)
      VALUES (?, ?, datetime('now'))
    \`, [id, userId]);

    // Create webinar reminder notification for the user (Feature #167)
    const reminderContent = JSON.stringify({
      webinar_id: parseInt(id),
      webinar_title: webinar.title,
      scheduled_at: webinar.scheduled_at,
      meet_link: webinar.meet_link
    });

    run(\`
      INSERT INTO notifications (user_id, type, title, message, content, is_read, created_at)
      VALUES (?, 'webinar_reminder', ?, ?, ?, 0, datetime('now'))
    \`, [
      userId,
      \`Recordatorio: \${webinar.title}\`,
      \`Te has inscrito al webinar "\${webinar.title}". Fecha: \${new Date(webinar.scheduled_at).toLocaleString('es-ES')}\`,
      reminderContent
    ]);

    console.log(\`[Webinars] Created reminder notification for user \${userId} for webinar \${id}\`);

    res.json({ success: true, message: 'Registered successfully' });`;

if (content.includes(registerOld)) {
  content = content.replace(registerOld, registerNew);
  console.log('Patch 2 applied: Register endpoint updated');
} else {
  console.log('Patch 2 skipped: Register endpoint already patched or pattern not found');
}

// 3. Update the unregister endpoint to also delete the notification
const unregisterOld = `run('DELETE FROM webinar_registrations WHERE webinar_id = ? AND user_id = ?', [id, userId]);

    res.json({ success: true, message: 'Unregistered successfully' });`;

const unregisterNew = `run('DELETE FROM webinar_registrations WHERE webinar_id = ? AND user_id = ?', [id, userId]);

    // Also delete the user's reminder notification for this webinar (Feature #167)
    run(\`
      DELETE FROM notifications
      WHERE user_id = ?
      AND type = 'webinar_reminder'
      AND json_extract(content, '$.webinar_id') = ?
    \`, [userId, parseInt(id)]);

    console.log(\`[Webinars] User \${userId} unregistered from webinar \${id}, reminder notification removed\`);

    res.json({ success: true, message: 'Unregistered successfully' });`;

if (content.includes(unregisterOld)) {
  content = content.replace(unregisterOld, unregisterNew);
  console.log('Patch 3 applied: Unregister endpoint updated');
} else {
  console.log('Patch 3 skipped: Unregister endpoint already patched or pattern not found');
}

// Convert back to CRLF for Windows
content = content.replace(/\n/g, '\r\n');

fs.writeFileSync(filePath, content);
console.log('All patches applied successfully!');
