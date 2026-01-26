import express from 'express';
import { getDatabase, queryAll, queryOne, run, saveDatabase } from '../config/database.js';

const router = express.Router();

/**
 * Initialize webinars tables
 */
export function initWebinarsTables(db) {
  // Webinars table - stores webinar information
  db.run(`
    CREATE TABLE IF NOT EXISTS webinars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      scheduled_at TEXT NOT NULL,
      duration_minutes INTEGER DEFAULT 60,
      meet_link TEXT,
      recording_url TEXT,
      status TEXT DEFAULT 'scheduled',
      instructor_id INTEGER,
      max_attendees INTEGER DEFAULT 100,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Webinar registrations table - tracks who registered for webinars
  db.run(`
    CREATE TABLE IF NOT EXISTS webinar_registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      webinar_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      registered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      attended INTEGER DEFAULT 0,
      attended_at TEXT,
      UNIQUE(webinar_id, user_id),
      FOREIGN KEY (webinar_id) REFERENCES webinars(id) ON DELETE CASCADE
    )
  `);

  // Create indexes for webinar lookups
  db.run(`CREATE INDEX IF NOT EXISTS idx_webinars_course ON webinars(course_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_webinars_scheduled ON webinars(scheduled_at)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_webinar_registrations_webinar ON webinar_registrations(webinar_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_webinar_registrations_user ON webinar_registrations(user_id)`);

  // Seed sample webinars
  seedSampleWebinars(db);

  console.log('[Webinars] Tables initialized');
}

/**
 * Seed sample webinars for testing
 */
function seedSampleWebinars(db) {
  const now = new Date();

  // Check if webinars already exist
  const stmt = db.prepare('SELECT COUNT(*) as count FROM webinars');
  stmt.step();
  const { count } = stmt.getAsObject();
  stmt.free();

  if (count > 0) {
    console.log('[Webinars] Sample webinars already exist, skipping seed');
    return;
  }

  const sampleWebinars = [
    {
      title: 'Introduccion a Python para Principiantes',
      description: 'Sesion en vivo donde aprenderemos los fundamentos de Python desde cero. Ideal para quienes no tienen experiencia previa en programacion.',
      course_id: 1,
      scheduled_at: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days from now
      duration_minutes: 90,
      meet_link: 'https://meet.google.com/abc-defg-hij',
      status: 'scheduled',
      instructor_id: 1
    },
    {
      title: 'Analisis de Datos con Pandas',
      description: 'Aprende a manipular y analizar datasets usando la biblioteca Pandas. Veremos casos practicos con datos reales.',
      course_id: 2,
      scheduled_at: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days from now
      duration_minutes: 120,
      meet_link: 'https://meet.google.com/klm-nopq-rst',
      status: 'scheduled',
      instructor_id: 1
    },
    {
      title: 'Q&A: Consultas SQL Avanzadas',
      description: 'Sesion de preguntas y respuestas sobre consultas SQL avanzadas. Trae tus dudas!',
      course_id: 3,
      scheduled_at: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago (past)
      duration_minutes: 60,
      meet_link: 'https://meet.google.com/uvw-xyza-bcd',
      recording_url: 'https://recordings.example.com/sql-qa-session.mp4',
      status: 'completed',
      instructor_id: 1
    }
  ];

  for (const webinar of sampleWebinars) {
    db.run(`
      INSERT INTO webinars (title, description, course_id, scheduled_at, duration_minutes, meet_link, recording_url, status, instructor_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `, [
      webinar.title,
      webinar.description,
      webinar.course_id,
      webinar.scheduled_at,
      webinar.duration_minutes,
      webinar.meet_link,
      webinar.recording_url || null,
      webinar.status,
      webinar.instructor_id
    ]);
    console.log(`[Webinars] Created sample webinar: ${webinar.title}`);
  }

  saveDatabase();
}

/**
 * GET /api/webinars - List all webinars
 * Query params:
 *   - course_id: Filter by course
 *   - status: Filter by status (scheduled, live, completed, cancelled)
 *   - upcoming: If true, only show upcoming webinars
 */
router.get('/', (req, res) => {
  try {
    const { course_id, status, upcoming } = req.query;

    let sql = `
      SELECT
        w.*,
        c.title as course_title,
        c.slug as course_slug,
        (SELECT COUNT(*) FROM webinar_registrations WHERE webinar_id = w.id) as registered_count
      FROM webinars w
      LEFT JOIN courses c ON w.course_id = c.id
      WHERE 1=1
    `;
    const params = [];

    if (course_id) {
      sql += ' AND w.course_id = ?';
      params.push(course_id);
    }

    if (status) {
      sql += ' AND w.status = ?';
      params.push(status);
    }

    if (upcoming === 'true') {
      sql += ' AND datetime(w.scheduled_at) > datetime("now")';
    }

    sql += ' ORDER BY w.scheduled_at ASC';

    const webinars = queryAll(sql, params);
    res.json(webinars);
  } catch (error) {
    console.error('[Webinars] Error listing webinars:', error);
    res.status(500).json({ error: 'Failed to list webinars' });
  }
});

/**
 * GET /api/webinars/calendar - Get webinars for calendar view
 * Returns webinars grouped by date
 */
router.get('/calendar', (req, res) => {
  try {
    const { month, year } = req.query;

    let sql = `
      SELECT
        w.*,
        c.title as course_title,
        c.slug as course_slug,
        (SELECT COUNT(*) FROM webinar_registrations WHERE webinar_id = w.id) as registered_count
      FROM webinars w
      LEFT JOIN courses c ON w.course_id = c.id
    `;
    const params = [];

    if (month && year) {
      sql += ` WHERE strftime('%m', w.scheduled_at) = ? AND strftime('%Y', w.scheduled_at) = ?`;
      params.push(month.padStart(2, '0'), year);
    }

    sql += ' ORDER BY w.scheduled_at ASC';

    const webinars = queryAll(sql, params);

    // Group by date
    const grouped = webinars.reduce((acc, webinar) => {
      const date = webinar.scheduled_at.split('T')[0];
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(webinar);
      return acc;
    }, {});

    res.json({ webinars, grouped });
  } catch (error) {
    console.error('[Webinars] Error getting calendar:', error);
    res.status(500).json({ error: 'Failed to get calendar' });
  }
});

/**
 * GET /api/webinars/:id - Get single webinar details
 */
router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const webinar = queryOne(`
      SELECT
        w.*,
        c.title as course_title,
        c.slug as course_slug,
        (SELECT COUNT(*) FROM webinar_registrations WHERE webinar_id = w.id) as registered_count
      FROM webinars w
      LEFT JOIN courses c ON w.course_id = c.id
      WHERE w.id = ?
    `, [id]);

    if (!webinar) {
      return res.status(404).json({ error: 'Webinar not found' });
    }

    // Check if current user is registered
    if (req.session?.user?.id) {
      const registration = queryOne(
        'SELECT * FROM webinar_registrations WHERE webinar_id = ? AND user_id = ?',
        [id, req.session.user.id]
      );
      webinar.isRegistered = !!registration;
      webinar.hasAttended = registration?.attended === 1;
    }

    res.json(webinar);
  } catch (error) {
    console.error('[Webinars] Error getting webinar:', error);
    res.status(500).json({ error: 'Failed to get webinar' });
  }
});

/**
 * POST /api/webinars - Create a new webinar (instructor only)
 */
router.post('/', (req, res) => {
  try {
    // Check if user is instructor
    if (!req.session?.user || req.session.user.role !== 'instructor_admin') {
      return res.status(403).json({ error: 'Only instructors can create webinars' });
    }

    const { title, description, course_id, scheduled_at, duration_minutes, meet_link, max_attendees } = req.body;

    // Server-side validation constants (must match frontend expectations)
    const MIN_TITLE_LENGTH = 1;
    const MAX_TITLE_LENGTH = 200;
    const MAX_DESCRIPTION_LENGTH = 5000;
    const MIN_ATTENDEES = 1;
    const MAX_ATTENDEES = 1000;

    // Collect all validation errors
    const errors = {};

    // Title validation
    if (!title || typeof title !== 'string') {
      errors.title = 'El titulo es requerido';
    } else {
      const trimmedTitle = title.trim();
      if (trimmedTitle.length === 0) {
        errors.title = 'El titulo es requerido';
      } else if (trimmedTitle.length > MAX_TITLE_LENGTH) {
        errors.title = `El titulo no puede tener mas de ${MAX_TITLE_LENGTH} caracteres`;
      }
    }

    // Scheduled date validation
    if (!scheduled_at || typeof scheduled_at !== 'string') {
      errors.scheduled_date = 'La fecha y hora son requeridas';
    } else {
      const scheduledDate = new Date(scheduled_at);
      const now = new Date();
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

      if (isNaN(scheduledDate.getTime())) {
        errors.scheduled_date = 'Formato de fecha invalido';
      } else if (scheduledDate < now) {
        errors.scheduled_date = 'La fecha no puede ser en el pasado';
      } else if (scheduledDate > oneYearFromNow) {
        errors.scheduled_date = 'La fecha no puede ser mas de 1 año en el futuro';
      }
    }

    // Description validation (optional but has max length)
    if (description && typeof description === 'string' && description.length > MAX_DESCRIPTION_LENGTH) {
      errors.description = `La descripcion no puede tener mas de ${MAX_DESCRIPTION_LENGTH} caracteres`;
    }

    // Max attendees validation
    if (max_attendees !== undefined && max_attendees !== null) {
      const attendeesNum = parseInt(max_attendees, 10);
      if (isNaN(attendeesNum)) {
        errors.max_attendees = 'La capacidad debe ser un numero valido';
      } else if (attendeesNum < MIN_ATTENDEES) {
        errors.max_attendees = `La capacidad minima es ${MIN_ATTENDEES}`;
      } else if (attendeesNum > MAX_ATTENDEES) {
        errors.max_attendees = `La capacidad maxima es ${MAX_ATTENDEES}`;
      }
    }

    // Duration validation
    if (duration_minutes !== undefined && duration_minutes !== null) {
      const durationNum = parseInt(duration_minutes, 10);
      const validDurations = [30, 45, 60, 90, 120, 180];
      if (isNaN(durationNum) || !validDurations.includes(durationNum)) {
        errors.duration_minutes = 'Duracion invalida';
      }
    }

    // Return validation errors if any
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        error: 'Error de validacion',
        validationErrors: errors
      });
    }

    const result = run(`
      INSERT INTO webinars (title, description, course_id, scheduled_at, duration_minutes, meet_link, max_attendees, instructor_id, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', datetime('now'), datetime('now'))
    `, [
      title.trim(),
      description ? description.trim() : null,
      course_id || null,
      scheduled_at,
      duration_minutes || 60,
      meet_link || null,
      max_attendees || 100,
      req.session.user.id
    ]);

    const webinar = queryOne('SELECT * FROM webinars WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json(webinar);
  } catch (error) {
    console.error('[Webinars] Error creating webinar:', error);
    res.status(500).json({ error: 'Failed to create webinar' });
  }
});

/**
 * PUT /api/webinars/:id - Update a webinar (instructor only)
 */
router.put('/:id', (req, res) => {
  try {
    // Check if user is instructor
    if (!req.session?.user || req.session.user.role !== 'instructor_admin') {
      return res.status(403).json({ error: 'Only instructors can update webinars' });
    }

    const { id } = req.params;
    const { title, description, scheduled_at, duration_minutes, meet_link, recording_url, status, max_attendees } = req.body;

    const existing = queryOne('SELECT * FROM webinars WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Webinar not found' });
    }

    run(`
      UPDATE webinars
      SET title = ?, description = ?, scheduled_at = ?, duration_minutes = ?,
          meet_link = ?, recording_url = ?, status = ?, max_attendees = ?, updated_at = datetime('now')
      WHERE id = ?
    `, [
      title || existing.title,
      description !== undefined ? description : existing.description,
      scheduled_at || existing.scheduled_at,
      duration_minutes || existing.duration_minutes,
      meet_link !== undefined ? meet_link : existing.meet_link,
      recording_url !== undefined ? recording_url : existing.recording_url,
      status || existing.status,
      max_attendees || existing.max_attendees,
      id
    ]);

    const webinar = queryOne('SELECT * FROM webinars WHERE id = ?', [id]);
    res.json(webinar);
  } catch (error) {
    console.error('[Webinars] Error updating webinar:', error);
    res.status(500).json({ error: 'Failed to update webinar' });
  }
});

/**
 * DELETE /api/webinars/:id - Delete a webinar (instructor only)
 */
router.delete('/:id', (req, res) => {
  try {
    // Check if user is instructor
    if (!req.session?.user || req.session.user.role !== 'instructor_admin') {
      return res.status(403).json({ error: 'Only instructors can delete webinars' });
    }

    const { id } = req.params;

    const existing = queryOne('SELECT * FROM webinars WHERE id = ?', [id]);
    if (!existing) {
      return res.status(404).json({ error: 'Webinar not found' });
    }

    // Delete webinar reminder notifications for this webinar (Feature #167)
    // Use LIKE pattern to match webinar_id in JSON content since json_extract comparison
    // can have type issues with sql.js. The pattern matches "webinar_id":N, or "webinar_id":N}
    const webinarIdInt = parseInt(id);
    const deletedNotifications = run(`
      DELETE FROM notifications
      WHERE type = 'webinar_reminder'
      AND (
        content LIKE '%"webinar_id":' || ? || ',%'
        OR content LIKE '%"webinar_id":' || ? || '}'
      )
    `, [webinarIdInt, webinarIdInt]);

    console.log(`[Webinars] Deleted ${deletedNotifications.changes || 0} reminder notifications for webinar ${id}`);

    run('DELETE FROM webinar_registrations WHERE webinar_id = ?', [id]);
    run('DELETE FROM webinars WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Webinar deleted',
      reminders_cancelled: deletedNotifications.changes || 0
    });
  } catch (error) {
    console.error('[Webinars] Error deleting webinar:', error);
    res.status(500).json({ error: 'Failed to delete webinar' });
  }
});

/**
 * POST /api/webinars/:id/register - Register for a webinar
 */
router.post('/:id/register', (req, res) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Must be logged in to register' });
    }

    const { id } = req.params;
    const userId = req.session.user.id;

    const webinar = queryOne('SELECT * FROM webinars WHERE id = ?', [id]);
    if (!webinar) {
      return res.status(404).json({ error: 'Webinar not found' });
    }

    // Check if already registered
    const existing = queryOne(
      'SELECT * FROM webinar_registrations WHERE webinar_id = ? AND user_id = ?',
      [id, userId]
    );
    if (existing) {
      return res.status(400).json({ error: 'Already registered for this webinar' });
    }

    // Check max attendees
    const registrationCount = queryOne(
      'SELECT COUNT(*) as count FROM webinar_registrations WHERE webinar_id = ?',
      [id]
    );
    if (registrationCount.count >= webinar.max_attendees) {
      return res.status(400).json({ error: 'Webinar is full' });
    }

    run(`
      INSERT INTO webinar_registrations (webinar_id, user_id, registered_at)
      VALUES (?, ?, datetime('now'))
    `, [id, userId]);

    // Create webinar reminder notification for the user (Feature #167)
    const reminderContent = JSON.stringify({
      webinar_id: parseInt(id),
      webinar_title: webinar.title,
      scheduled_at: webinar.scheduled_at,
      meet_link: webinar.meet_link
    });

    run(`
      INSERT INTO notifications (user_id, type, title, message, content, is_read, created_at)
      VALUES (?, 'webinar_reminder', ?, ?, ?, 0, datetime('now'))
    `, [
      userId,
      `Recordatorio: ${webinar.title}`,
      `Te has inscrito al webinar "${webinar.title}". Fecha: ${new Date(webinar.scheduled_at).toLocaleString('es-ES')}`,
      reminderContent
    ]);

    console.log(`[Webinars] Created reminder notification for user ${userId} for webinar ${id}`);

    res.json({ success: true, message: 'Registered successfully' });
  } catch (error) {
    console.error('[Webinars] Error registering for webinar:', error);
    res.status(500).json({ error: 'Failed to register' });
  }
});

/**
 * DELETE /api/webinars/:id/register - Unregister from a webinar
 */
router.delete('/:id/register', (req, res) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Must be logged in' });
    }

    const { id } = req.params;
    const userId = req.session.user.id;

    run('DELETE FROM webinar_registrations WHERE webinar_id = ? AND user_id = ?', [id, userId]);

    // Also delete the user's reminder notification for this webinar (Feature #167)
    // Use LIKE pattern to match webinar_id in JSON content since json_extract comparison
    // can have type issues with sql.js
    const webinarIdInt = parseInt(id);
    run(`
      DELETE FROM notifications
      WHERE user_id = ?
      AND type = 'webinar_reminder'
      AND (
        content LIKE '%"webinar_id":' || ? || ',%'
        OR content LIKE '%"webinar_id":' || ? || '}'
      )
    `, [userId, webinarIdInt, webinarIdInt]);

    console.log(`[Webinars] User ${userId} unregistered from webinar ${id}, reminder notification removed`);

    res.json({ success: true, message: 'Unregistered successfully' });
  } catch (error) {
    console.error('[Webinars] Error unregistering from webinar:', error);
    res.status(500).json({ error: 'Failed to unregister' });
  }
});

/**
 * POST /api/webinars/:id/join - Join a webinar (marks attendance)
 */
router.post('/:id/join', (req, res) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Must be logged in to join' });
    }

    const { id } = req.params;
    const userId = req.session.user.id;

    const webinar = queryOne('SELECT * FROM webinars WHERE id = ?', [id]);
    if (!webinar) {
      return res.status(404).json({ error: 'Webinar not found' });
    }

    // Check if registered
    const registration = queryOne(
      'SELECT * FROM webinar_registrations WHERE webinar_id = ? AND user_id = ?',
      [id, userId]
    );

    if (!registration) {
      // Auto-register if joining
      run(`
        INSERT INTO webinar_registrations (webinar_id, user_id, registered_at, attended, attended_at)
        VALUES (?, ?, datetime('now'), 1, datetime('now'))
      `, [id, userId]);
    } else {
      // Mark as attended
      run(`
        UPDATE webinar_registrations
        SET attended = 1, attended_at = datetime('now')
        WHERE webinar_id = ? AND user_id = ?
      `, [id, userId]);
    }

    // Return meet link
    res.json({
      success: true,
      meet_link: webinar.meet_link,
      message: 'Joined successfully'
    });
  } catch (error) {
    console.error('[Webinars] Error joining webinar:', error);
    res.status(500).json({ error: 'Failed to join webinar' });
  }
});

/**
 * GET /api/webinars/:id/recording - Get recording URL for a completed webinar
 */
router.get('/:id/recording', (req, res) => {
  try {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Must be logged in' });
    }

    const { id } = req.params;

    const webinar = queryOne('SELECT * FROM webinars WHERE id = ?', [id]);
    if (!webinar) {
      return res.status(404).json({ error: 'Webinar not found' });
    }

    if (webinar.status !== 'completed') {
      return res.status(400).json({ error: 'Recording not available yet' });
    }

    if (!webinar.recording_url) {
      return res.status(404).json({ error: 'No recording available' });
    }

    res.json({ recording_url: webinar.recording_url });
  } catch (error) {
    console.error('[Webinars] Error getting recording:', error);
    res.status(500).json({ error: 'Failed to get recording' });
  }
});

/**
 * GET /api/webinars/:id/attendees - Get list of registered attendees (instructor only)
 */
router.get('/:id/attendees', (req, res) => {
  try {
    if (!req.session?.user || req.session.user.role !== 'instructor_admin') {
      return res.status(403).json({ error: 'Only instructors can view attendees' });
    }

    const { id } = req.params;

    const attendees = queryAll(`
      SELECT
        wr.*,
        u.name,
        u.email,
        u.avatar_url
      FROM webinar_registrations wr
      LEFT JOIN users u ON wr.user_id = u.id
      WHERE wr.webinar_id = ?
      ORDER BY wr.registered_at ASC
    `, [id]);

    res.json(attendees);
  } catch (error) {
    console.error('[Webinars] Error getting attendees:', error);
    res.status(500).json({ error: 'Failed to get attendees' });
  }
});

/**
 * PUT /api/webinars/:id/status - Update webinar status (go live, complete, cancel)
 */
router.put('/:id/status', (req, res) => {
  try {
    if (!req.session?.user || req.session.user.role !== 'instructor_admin') {
      return res.status(403).json({ error: 'Only instructors can update status' });
    }

    const { id } = req.params;
    const { status, recording_url } = req.body;

    const validStatuses = ['scheduled', 'live', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    const updateParams = [status, id];
    let sql = 'UPDATE webinars SET status = ?, updated_at = datetime("now")';

    if (recording_url && status === 'completed') {
      sql = 'UPDATE webinars SET status = ?, recording_url = ?, updated_at = datetime("now")';
      updateParams.splice(1, 0, recording_url);
    }

    sql += ' WHERE id = ?';
    run(sql, updateParams);

    const webinar = queryOne('SELECT * FROM webinars WHERE id = ?', [id]);
    res.json(webinar);
  } catch (error) {
    console.error('[Webinars] Error updating status:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

export default router;
// trigger reload - fix for Feature #167 json_extract issue
