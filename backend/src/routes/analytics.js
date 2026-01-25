import express from 'express';
import { queryAll, queryOne, run, getDatabase, saveDatabase } from '../config/database.js';

const router = express.Router();

// Run analytics table migration on load
try {
  const db = getDatabase();

  // Analytics events table - tracks all user activity
  db.run(`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      metadata TEXT DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for analytics
  db.run(`CREATE INDEX IF NOT EXISTS idx_analytics_user ON analytics_events(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_analytics_type ON analytics_events(event_type)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_analytics_created ON analytics_events(created_at)`);

  // Create index for lesson_progress if not exists
  db.run(`CREATE INDEX IF NOT EXISTS idx_lesson_progress_user ON lesson_progress(user_id)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_lesson_progress_lesson ON lesson_progress(lesson_id)`);

  saveDatabase();
  console.log('Analytics tables initialized');
} catch (error) {
  console.log('Analytics migration will run after database is ready');
}

/**
 * Middleware to check if user is authenticated
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * Middleware to check if user is an instructor/admin
 */
function requireInstructor(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.session.user.role !== 'instructor_admin') {
    return res.status(403).json({ error: 'Instructor access required' });
  }
  next();
}

/**
 * POST /api/analytics/lesson-complete
 * Record a lesson completion with time spent
 */
router.post('/lesson-complete', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const { lessonId, courseId, timeSpentSeconds } = req.body;

    if (!lessonId) {
      return res.status(400).json({ error: 'lessonId is required' });
    }

    const now = new Date().toISOString();
    const timeSpent = timeSpentSeconds || 0;

    // Check if progress already exists
    const existing = queryOne(
      'SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
      [userId, lessonId]
    );

    if (existing) {
      // Update existing record
      run(`
        UPDATE lesson_progress
        SET status = 'completed',
            time_spent_seconds = time_spent_seconds + ?,
            completed_at = ?,
            updated_at = ?
        WHERE user_id = ? AND lesson_id = ?
      `, [timeSpent, now, now, userId, lessonId]);
    } else {
      // Insert new record
      run(`
        INSERT INTO lesson_progress (user_id, lesson_id, status, time_spent_seconds, completed_at, updated_at, created_at)
        VALUES (?, ?, 'completed', ?, ?, ?, ?)
      `, [userId, lessonId, timeSpent, now, now, now]);
    }

    // Log the analytics event
    run(`
      INSERT INTO analytics_events (user_id, event_type, metadata, created_at)
      VALUES (?, 'lesson_completed', ?, ?)
    `, [userId, JSON.stringify({ lessonId, courseId, timeSpentSeconds: timeSpent }), now]);

    // Update enrollment progress if courseId provided
    if (courseId) {
      // Get total lessons and completed lessons for the course
      // Note: lessons -> modules -> courses (lessons don't have course_id directly)
      const totalLessons = queryOne(`
        SELECT COUNT(*) as count
        FROM lessons l
        JOIN modules m ON l.module_id = m.id
        WHERE m.course_id = ?
      `, [courseId]);

      const completedLessons = queryOne(`
        SELECT COUNT(*) as count
        FROM lesson_progress lp
        JOIN lessons l ON lp.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        WHERE lp.user_id = ? AND m.course_id = ? AND lp.status = 'completed'
      `, [userId, courseId]);

      if (totalLessons && totalLessons.count > 0) {
        const progressPercent = Math.round((completedLessons.count / totalLessons.count) * 100);
        run(`
          UPDATE enrollments
          SET progress_percent = ?, last_accessed_at = ?
          WHERE user_id = ? AND course_id = ?
        `, [progressPercent, now, userId, courseId]);
      }
    }

    res.json({
      success: true,
      message: 'Lesson completion recorded',
      lessonId,
      timeSpentSeconds: timeSpent,
      completedAt: now
    });
  } catch (error) {
    console.error('Error recording lesson completion:', error);
    res.status(500).json({ error: 'Failed to record lesson completion' });
  }
});

/**
 * POST /api/analytics/track-time
 * Track time spent on a lesson (called periodically)
 */
router.post('/track-time', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const { lessonId, timeSpentSeconds } = req.body;

    if (!lessonId || timeSpentSeconds === undefined) {
      return res.status(400).json({ error: 'lessonId and timeSpentSeconds are required' });
    }

    const now = new Date().toISOString();

    // Check if progress exists
    const existing = queryOne(
      'SELECT * FROM lesson_progress WHERE user_id = ? AND lesson_id = ?',
      [userId, lessonId]
    );

    if (existing) {
      // Update time spent
      run(`
        UPDATE lesson_progress
        SET time_spent_seconds = ?,
            status = CASE WHEN status = 'not_started' THEN 'in_progress' ELSE status END,
            updated_at = ?
        WHERE user_id = ? AND lesson_id = ?
      `, [timeSpentSeconds, now, userId, lessonId]);
    } else {
      // Create new record with in_progress status
      run(`
        INSERT INTO lesson_progress (user_id, lesson_id, status, time_spent_seconds, updated_at, created_at)
        VALUES (?, ?, 'in_progress', ?, ?, ?)
      `, [userId, lessonId, timeSpentSeconds, now, now]);
    }

    res.json({
      success: true,
      lessonId,
      timeSpentSeconds
    });
  } catch (error) {
    console.error('Error tracking time:', error);
    res.status(500).json({ error: 'Failed to track time' });
  }
});

/**
 * GET /api/analytics/dashboard
 * Get analytics dashboard data for instructors
 */
router.get('/dashboard', requireInstructor, (req, res) => {
  try {
    // Get overall stats
    const totalStudents = queryOne('SELECT COUNT(*) as count FROM users WHERE role != "instructor_admin"');
    const totalCourses = queryOne('SELECT COUNT(*) as count FROM courses');
    const totalEnrollments = queryOne('SELECT COUNT(*) as count FROM enrollments');
    const completedLessons = queryOne('SELECT COUNT(*) as count FROM lesson_progress WHERE status = "completed"');

    // Get total time spent across all students (in hours)
    const totalTimeSpent = queryOne('SELECT COALESCE(SUM(time_spent_seconds), 0) as total FROM lesson_progress');
    const totalHours = Math.round((totalTimeSpent?.total || 0) / 3600 * 10) / 10;

    // Get recent lesson completions
    const recentCompletions = queryAll(`
      SELECT
        lp.lesson_id,
        lp.completed_at,
        lp.time_spent_seconds,
        u.name as student_name,
        u.email as student_email
      FROM lesson_progress lp
      JOIN users u ON lp.user_id = u.id
      WHERE lp.status = 'completed' AND lp.completed_at IS NOT NULL
      ORDER BY lp.completed_at DESC
      LIMIT 20
    `);

    // Get course completion stats
    const courseStats = queryAll(`
      SELECT
        c.id as course_id,
        c.title as course_title,
        COUNT(DISTINCT e.user_id) as enrolled_count,
        COUNT(DISTINCT CASE WHEN e.progress_percent >= 100 THEN e.user_id END) as completed_count,
        AVG(e.progress_percent) as avg_progress
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id
      GROUP BY c.id
      ORDER BY enrolled_count DESC
      LIMIT 10
    `);

    // Get student activity by day (last 7 days)
    const dailyActivity = queryAll(`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as event_count
      FROM analytics_events
      WHERE created_at >= DATE('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `);

    // Get lesson completion rates
    const lessonStats = queryAll(`
      SELECT
        lesson_id,
        COUNT(*) as completion_count,
        AVG(time_spent_seconds) as avg_time_seconds
      FROM lesson_progress
      WHERE status = 'completed'
      GROUP BY lesson_id
      ORDER BY completion_count DESC
      LIMIT 10
    `);

    res.json({
      overview: {
        totalStudents: totalStudents?.count || 0,
        totalCourses: totalCourses?.count || 0,
        totalEnrollments: totalEnrollments?.count || 0,
        completedLessons: completedLessons?.count || 0,
        totalTimeSpentHours: totalHours
      },
      recentCompletions: recentCompletions.map(c => ({
        lessonId: c.lesson_id,
        completedAt: c.completed_at,
        timeSpentSeconds: c.time_spent_seconds,
        studentName: c.student_name,
        studentEmail: c.student_email
      })),
      courseStats: courseStats.map(c => ({
        courseId: c.course_id,
        courseTitle: c.course_title,
        enrolledCount: c.enrolled_count || 0,
        completedCount: c.completed_count || 0,
        avgProgress: Math.round(c.avg_progress || 0)
      })),
      dailyActivity,
      lessonStats: lessonStats.map(l => ({
        lessonId: l.lesson_id,
        completionCount: l.completion_count,
        avgTimeSeconds: Math.round(l.avg_time_seconds || 0)
      }))
    });
  } catch (error) {
    console.error('Error fetching analytics dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

/**
 * GET /api/analytics/student/:studentId
 * Get detailed analytics for a specific student (instructor only)
 */
router.get('/student/:studentId', requireInstructor, (req, res) => {
  try {
    const studentId = req.params.studentId;

    // Get student info
    const student = queryOne('SELECT id, name, email, role, created_at FROM users WHERE id = ?', [studentId]);
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Get student's enrollments
    const enrollments = queryAll(`
      SELECT
        e.*,
        c.title as course_title
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.user_id = ?
      ORDER BY e.enrolled_at DESC
    `, [studentId]);

    // Get lesson progress
    const lessonProgress = queryAll(`
      SELECT *
      FROM lesson_progress
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `, [studentId]);

    // Get total time spent
    const totalTime = queryOne('SELECT COALESCE(SUM(time_spent_seconds), 0) as total FROM lesson_progress WHERE user_id = ?', [studentId]);

    res.json({
      student: {
        id: student.id,
        name: student.name,
        email: student.email,
        role: student.role,
        createdAt: student.created_at
      },
      enrollments: enrollments.map(e => ({
        courseId: e.course_id,
        courseTitle: e.course_title,
        enrolledAt: e.enrolled_at,
        completedAt: e.completed_at,
        progressPercent: e.progress_percent
      })),
      lessonProgress: lessonProgress.map(lp => ({
        lessonId: lp.lesson_id,
        status: lp.status,
        timeSpentSeconds: lp.time_spent_seconds,
        completedAt: lp.completed_at,
        updatedAt: lp.updated_at
      })),
      totalTimeSpentHours: Math.round((totalTime?.total || 0) / 3600 * 10) / 10
    });
  } catch (error) {
    console.error('Error fetching student analytics:', error);
    res.status(500).json({ error: 'Failed to fetch student analytics' });
  }
});

/**
 * GET /api/analytics/my-progress
 * Get current user's own progress data
 */
router.get('/my-progress', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;

    // Get lesson progress
    const lessonProgress = queryAll(`
      SELECT *
      FROM lesson_progress
      WHERE user_id = ?
      ORDER BY updated_at DESC
    `, [userId]);

    // Get total time spent
    const totalTime = queryOne('SELECT COALESCE(SUM(time_spent_seconds), 0) as total FROM lesson_progress WHERE user_id = ?', [userId]);

    // Get completed lessons count
    const completedCount = queryOne('SELECT COUNT(*) as count FROM lesson_progress WHERE user_id = ? AND status = "completed"', [userId]);

    res.json({
      lessons: lessonProgress.map(lp => ({
        lessonId: lp.lesson_id,
        status: lp.status,
        timeSpentSeconds: lp.time_spent_seconds,
        completedAt: lp.completed_at,
        updatedAt: lp.updated_at
      })),
      totalTimeSpentSeconds: totalTime?.total || 0,
      totalTimeSpentHours: Math.round((totalTime?.total || 0) / 3600 * 10) / 10,
      completedLessonsCount: completedCount?.count || 0
    });
  } catch (error) {
    console.error('Error fetching my progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

export default router;
