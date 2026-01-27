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
 * Accepts both 'instructor' and 'instructor_admin' for compatibility
 */
function requireInstructor(req, res, next) {
  if (!req.session || !req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const role = req.session.user.role;
  if (role !== 'instructor' && role !== 'instructor_admin') {
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
    // Note: lesson_progress.user_id is TEXT, users.id is INTEGER - CAST for proper join
    const recentCompletions = queryAll(`
      SELECT
        lp.lesson_id,
        lp.completed_at,
        lp.time_spent_seconds,
        u.name as student_name,
        u.email as student_email
      FROM lesson_progress lp
      JOIN users u ON CAST(lp.user_id AS INTEGER) = u.id
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
    // Use try-catch in case analytics_events table doesn't exist yet
    let dailyActivity = [];
    try {
      dailyActivity = queryAll(`
        SELECT
          DATE(created_at) as date,
          COUNT(*) as event_count
        FROM analytics_events
        WHERE created_at >= DATE('now', '-7 days')
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `);
    } catch (e) {
      console.log('analytics_events table not ready, skipping daily activity');
    }

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



/**
 * GET /api/analytics/export/:courseId
 * Export course data as CSV or JSON (instructor only)
 * Query params: format=csv|json (default: json)
 */
router.get('/export/:courseId', requireInstructor, (req, res) => {
  try {
    const courseId = req.params.courseId;
    const format = req.query.format || 'json';

    // Validate format
    if (!['csv', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Use csv or json.' });
    }

    // Get course info
    const course = queryOne('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Get all enrollments for this course with student details
    const enrollments = queryAll(`
      SELECT
        e.id as enrollment_id,
        e.user_id,
        u.name as student_name,
        u.email as student_email,
        e.enrolled_at,
        e.completed_at,
        e.progress_percent,
        e.last_accessed_at
      FROM enrollments e
      JOIN users u ON e.user_id = u.id
      WHERE e.course_id = ?
      ORDER BY e.enrolled_at DESC
    `, [courseId]);

    // Get all modules for this course
    const modules = queryAll(`
      SELECT id, title, description, order_index as module_order
      FROM modules
      WHERE course_id = ?
      ORDER BY order_index
    `, [courseId]);

    // Get all lessons for this course
    const lessons = queryAll(`
      SELECT
        l.id as lesson_id,
        l.title as lesson_title,
        l.module_id,
        m.title as module_title,
        l.order_index as lesson_order
      FROM lessons l
      JOIN modules m ON l.module_id = m.id
      WHERE m.course_id = ?
      ORDER BY m.order_index, l.order_index
    `, [courseId]);

    // Get lesson progress for all students in this course
    const lessonProgress = queryAll(`
      SELECT
        lp.user_id,
        u.name as student_name,
        u.email as student_email,
        lp.lesson_id,
        l.title as lesson_title,
        lp.status,
        lp.time_spent_seconds,
        lp.completed_at,
        lp.updated_at
      FROM lesson_progress lp
      JOIN users u ON CAST(lp.user_id AS INTEGER) = u.id
      JOIN lessons l ON lp.lesson_id = l.id
      JOIN modules m ON l.module_id = m.id
      WHERE m.course_id = ?
      ORDER BY lp.user_id, l.id
    `, [courseId]);

    // Get quiz attempts for this course (if quiz table exists)
    let quizAttempts = [];
    try {
      quizAttempts = queryAll(`
        SELECT
          qa.user_id,
          u.name as student_name,
          u.email as student_email,
          qa.quiz_id,
          qa.score,
          qa.attempt_number,
          qa.created_at
        FROM quiz_attempts qa
        JOIN users u ON qa.user_id = u.id
        JOIN quizzes q ON qa.quiz_id = q.id
        JOIN lessons l ON q.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        WHERE m.course_id = ?
        ORDER BY qa.created_at DESC
      `, [courseId]);
    } catch (e) {
      // Quiz tables may not exist
    }

    // Get code submissions for this course (if challenges table exists)
    let codeSubmissions = [];
    try {
      codeSubmissions = queryAll(`
        SELECT
          cs.user_id,
          u.name as student_name,
          u.email as student_email,
          cs.challenge_id,
          cs.is_correct,
          cs.attempt_number,
          cs.created_at
        FROM code_submissions cs
        JOIN users u ON cs.user_id = u.id
        JOIN challenges c ON cs.challenge_id = c.id
        JOIN lessons l ON c.lesson_id = l.id
        JOIN modules m ON l.module_id = m.id
        WHERE m.course_id = ?
        ORDER BY cs.created_at DESC
      `, [courseId]);
    } catch (e) {
      // Challenge tables may not exist
    }

    // Build export data
    const exportData = {
      course: {
        id: course.id,
        title: course.title,
        slug: course.slug,
        description: course.description,
        category: course.category,
        level: course.level,
        is_premium: course.is_premium,
        created_at: course.created_at
      },
      summary: {
        total_enrollments: enrollments.length,
        completed_enrollments: enrollments.filter(e => e.completed_at).length,
        average_progress: enrollments.length > 0
          ? Math.round(enrollments.reduce((sum, e) => sum + (e.progress_percent || 0), 0) / enrollments.length)
          : 0,
        total_modules: modules.length,
        total_lessons: lessons.length,
        total_quiz_attempts: quizAttempts.length,
        total_code_submissions: codeSubmissions.length,
        exported_at: new Date().toISOString()
      },
      enrollments: enrollments.map(e => ({
        student_name: e.student_name,
        student_email: e.student_email,
        enrolled_at: e.enrolled_at,
        completed_at: e.completed_at,
        progress_percent: e.progress_percent || 0,
        last_accessed_at: e.last_accessed_at
      })),
      modules: modules.map(m => ({
        id: m.id,
        title: m.title,
        order: m.module_order
      })),
      lessons: lessons.map(l => ({
        id: l.lesson_id,
        title: l.lesson_title,
        module_title: l.module_title,
        order: l.lesson_order
      })),
      lesson_progress: lessonProgress.map(lp => ({
        student_name: lp.student_name,
        student_email: lp.student_email,
        lesson_title: lp.lesson_title,
        status: lp.status,
        time_spent_minutes: Math.round((lp.time_spent_seconds || 0) / 60),
        completed_at: lp.completed_at
      })),
      quiz_attempts: quizAttempts.map(qa => ({
        student_name: qa.student_name,
        student_email: qa.student_email,
        quiz_id: qa.quiz_id,
        score: qa.score,
        attempt_number: qa.attempt_number,
        created_at: qa.created_at
      })),
      code_submissions: codeSubmissions.map(cs => ({
        student_name: cs.student_name,
        student_email: cs.student_email,
        challenge_id: cs.challenge_id,
        is_correct: cs.is_correct,
        attempt_number: cs.attempt_number,
        created_at: cs.created_at
      }))
    };

    if (format === 'json') {
      // Return JSON
      const filename = 'course-' + course.slug + '-export-' + new Date().toISOString().split('T')[0] + '.json';
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
      return res.json(exportData);
    } else {
      // Return CSV - flatten the data for CSV format
      const filename = 'course-' + course.slug + '-export-' + new Date().toISOString().split('T')[0] + '.csv';
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');

      // Build CSV content with multiple sections
      let csv = '';

      // Course info section
      csv += '### COURSE INFO ###\n';
      csv += 'Field,Value\n';
      csv += 'Course ID,' + course.id + '\n';
      csv += 'Title,"' + course.title + '"\n';
      csv += 'Category,' + (course.category || '') + '\n';
      csv += 'Level,' + (course.level || '') + '\n';
      csv += 'Total Enrollments,' + exportData.summary.total_enrollments + '\n';
      csv += 'Completed Enrollments,' + exportData.summary.completed_enrollments + '\n';
      csv += 'Average Progress,' + exportData.summary.average_progress + '%\n';
      csv += 'Exported At,' + exportData.summary.exported_at + '\n';
      csv += '\n';

      // Enrollments section
      csv += '### ENROLLMENTS ###\n';
      csv += 'Student Name,Student Email,Enrolled At,Completed At,Progress %,Last Accessed\n';
      exportData.enrollments.forEach(e => {
        csv += '"' + e.student_name + '","' + e.student_email + '",' + (e.enrolled_at || '') + ',' + (e.completed_at || '') + ',' + e.progress_percent + ',' + (e.last_accessed_at || '') + '\n';
      });
      csv += '\n';

      // Lesson Progress section
      csv += '### LESSON PROGRESS ###\n';
      csv += 'Student Name,Student Email,Lesson Title,Status,Time Spent (min),Completed At\n';
      exportData.lesson_progress.forEach(lp => {
        csv += '"' + lp.student_name + '","' + lp.student_email + '","' + lp.lesson_title + '",' + lp.status + ',' + lp.time_spent_minutes + ',' + (lp.completed_at || '') + '\n';
      });
      csv += '\n';

      // Quiz Attempts section
      if (exportData.quiz_attempts.length > 0) {
        csv += '### QUIZ ATTEMPTS ###\n';
        csv += 'Student Name,Student Email,Quiz ID,Score,Attempt #,Date\n';
        exportData.quiz_attempts.forEach(qa => {
          csv += '"' + qa.student_name + '","' + qa.student_email + '",' + qa.quiz_id + ',' + qa.score + ',' + qa.attempt_number + ',' + qa.created_at + '\n';
        });
        csv += '\n';
      }

      // Code Submissions section
      if (exportData.code_submissions.length > 0) {
        csv += '### CODE SUBMISSIONS ###\n';
        csv += 'Student Name,Student Email,Challenge ID,Correct,Attempt #,Date\n';
        exportData.code_submissions.forEach(cs => {
          csv += '"' + cs.student_name + '","' + cs.student_email + '",' + cs.challenge_id + ',' + (cs.is_correct ? 'Yes' : 'No') + ',' + cs.attempt_number + ',' + cs.created_at + '\n';
        });
      }

      return res.send(csv);
    }
  } catch (error) {
    console.error('Error exporting course data:', error);
    res.status(500).json({ error: 'Failed to export course data' });
  }
});

/**
 * GET /api/analytics/export-all
 * Export all courses data as CSV or JSON (instructor only)
 * Query params: format=csv|json (default: json)
 */
router.get('/export-all', requireInstructor, (req, res) => {
  try {
    const format = req.query.format || 'json';

    // Validate format
    if (!['csv', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Invalid format. Use csv or json.' });
    }

    // Get all courses with their stats
    const courses = queryAll(`
      SELECT
        c.*,
        COUNT(DISTINCT e.user_id) as enrollment_count,
        AVG(e.progress_percent) as avg_progress
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    // Get overall stats
    const stats = {
      total_courses: courses.length,
      total_students: queryOne('SELECT COUNT(*) as count FROM users WHERE role != "instructor_admin"')?.count || 0,
      total_enrollments: queryOne('SELECT COUNT(*) as count FROM enrollments')?.count || 0,
      completed_lessons: queryOne('SELECT COUNT(*) as count FROM lesson_progress WHERE status = "completed"')?.count || 0,
      total_time_hours: Math.round((queryOne('SELECT COALESCE(SUM(time_spent_seconds), 0) as total FROM lesson_progress')?.total || 0) / 3600 * 10) / 10,
      exported_at: new Date().toISOString()
    };

    const exportData = {
      summary: stats,
      courses: courses.map(c => ({
        id: c.id,
        title: c.title,
        slug: c.slug,
        category: c.category,
        level: c.level,
        is_premium: c.is_premium,
        is_published: c.is_published,
        enrollment_count: c.enrollment_count || 0,
        avg_progress: Math.round(c.avg_progress || 0),
        created_at: c.created_at
      }))
    };

    if (format === 'json') {
      const filename = 'all-courses-export-' + new Date().toISOString().split('T')[0] + '.json';
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');
      return res.json(exportData);
    } else {
      const filename = 'all-courses-export-' + new Date().toISOString().split('T')[0] + '.csv';
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="' + filename + '"');

      let csv = '### SUMMARY ###\n';
      csv += 'Metric,Value\n';
      csv += 'Total Courses,' + stats.total_courses + '\n';
      csv += 'Total Students,' + stats.total_students + '\n';
      csv += 'Total Enrollments,' + stats.total_enrollments + '\n';
      csv += 'Completed Lessons,' + stats.completed_lessons + '\n';
      csv += 'Total Time (hours),' + stats.total_time_hours + '\n';
      csv += 'Exported At,' + stats.exported_at + '\n';
      csv += '\n';

      csv += '### COURSES ###\n';
      csv += 'ID,Title,Category,Level,Premium,Published,Enrollments,Avg Progress,Created At\n';
      exportData.courses.forEach(c => {
        csv += c.id + ',"' + c.title + '",' + (c.category || '') + ',' + (c.level || '') + ',' + (c.is_premium ? 'Yes' : 'No') + ',' + (c.is_published ? 'Yes' : 'No') + ',' + c.enrollment_count + ',' + c.avg_progress + '%,' + c.created_at + '\n';
      });

      return res.send(csv);
    }
  } catch (error) {
    console.error('Error exporting all courses data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});

/**
 * POST /api/analytics/import
 * Import course data from JSON file with duplicate handling (instructor only)
 * Body: { data: {...}, duplicateAction: 'skip' | 'overwrite' }
 */
router.post('/import', requireInstructor, (req, res) => {
  try {
    const { data, duplicateAction = 'skip' } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'No data provided for import' });
    }

    // Validate duplicate action
    if (!['skip', 'overwrite'].includes(duplicateAction)) {
      return res.status(400).json({ error: 'Invalid duplicateAction. Use skip or overwrite.' });
    }

    const now = new Date().toISOString();
    const results = {
      imported: [],
      skipped: [],
      overwritten: [],
      errors: []
    };

    // Handle different import formats
    let coursesToImport = [];

    // Check if it's the export-all format (has courses array)
    if (data.courses && Array.isArray(data.courses)) {
      coursesToImport = data.courses;
    }
    // Check if it's a single course export format
    else if (data.course) {
      coursesToImport = [data.course];
    }
    // Check if it's a direct array of courses
    else if (Array.isArray(data)) {
      coursesToImport = data;
    }
    else {
      return res.status(400).json({
        error: 'Invalid import format. Expected courses array or course object.',
        hint: 'Use data exported from /api/analytics/export-all or /api/analytics/export/:courseId'
      });
    }

    for (const courseData of coursesToImport) {
      try {
        // Validate required fields
        if (!courseData.title || !courseData.slug) {
          results.errors.push({
            item: courseData.title || 'Unknown',
            error: 'Missing required fields: title and slug are required'
          });
          continue;
        }

        // Check for existing course by slug
        const existing = queryOne('SELECT * FROM courses WHERE slug = ?', [courseData.slug]);

        if (existing) {
          if (duplicateAction === 'skip') {
            results.skipped.push({
              id: existing.id,
              title: existing.title,
              slug: existing.slug,
              reason: 'Course with this slug already exists'
            });
            continue;
          } else if (duplicateAction === 'overwrite') {
            // Update existing course
            run(`
              UPDATE courses SET
                title = ?,
                description = ?,
                category = ?,
                level = ?,
                is_premium = ?,
                is_published = ?,
                duration_hours = ?,
                tags = ?,
                updated_at = ?
              WHERE id = ?
            `, [
              courseData.title,
              courseData.description || existing.description,
              courseData.category || existing.category,
              courseData.level || existing.level,
              courseData.is_premium !== undefined ? (courseData.is_premium ? 1 : 0) : existing.is_premium,
              courseData.is_published !== undefined ? (courseData.is_published ? 1 : 0) : existing.is_published,
              courseData.duration_hours || existing.duration_hours,
              JSON.stringify(courseData.tags || []),
              now,
              existing.id
            ]);

            results.overwritten.push({
              id: existing.id,
              title: courseData.title,
              slug: courseData.slug
            });
            continue;
          }
        }

        // Insert new course
        const result = run(`
          INSERT INTO courses (title, slug, description, category, level, is_premium, is_published, duration_hours, tags, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          courseData.title,
          courseData.slug,
          courseData.description || '',
          courseData.category || 'General',
          courseData.level || 'Principiante',
          courseData.is_premium ? 1 : 0,
          courseData.is_published !== undefined ? (courseData.is_published ? 1 : 0) : 1,
          courseData.duration_hours || 0,
          JSON.stringify(courseData.tags || []),
          now,
          now
        ]);

        results.imported.push({
          id: result.lastInsertRowid,
          title: courseData.title,
          slug: courseData.slug
        });

      } catch (itemError) {
        results.errors.push({
          item: courseData.title || courseData.slug || 'Unknown',
          error: itemError.message
        });
      }
    }

    res.json({
      success: true,
      summary: {
        total: coursesToImport.length,
        imported: results.imported.length,
        skipped: results.skipped.length,
        overwritten: results.overwritten.length,
        errors: results.errors.length
      },
      details: results,
      message: `Import complete: ${results.imported.length} new, ${results.skipped.length} skipped, ${results.overwritten.length} overwritten, ${results.errors.length} errors`
    });

  } catch (error) {
    console.error('Error importing data:', error);
    res.status(500).json({ error: 'Failed to import data: ' + error.message });
  }
});

/**
 * POST /api/analytics/import/preview
 * Preview import to detect duplicates before actually importing
 */
router.post('/import/preview', requireInstructor, (req, res) => {
  try {
    const { data } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'No data provided for preview' });
    }

    const preview = {
      newItems: [],
      duplicates: [],
      invalid: []
    };

    // Handle different import formats
    let coursesToImport = [];

    if (data.courses && Array.isArray(data.courses)) {
      coursesToImport = data.courses;
    } else if (data.course) {
      coursesToImport = [data.course];
    } else if (Array.isArray(data)) {
      coursesToImport = data;
    } else {
      return res.status(400).json({
        error: 'Invalid import format',
        hint: 'Use data exported from /api/analytics/export-all or /api/analytics/export/:courseId'
      });
    }

    for (const courseData of coursesToImport) {
      if (!courseData.title || !courseData.slug) {
        preview.invalid.push({
          item: courseData.title || courseData.slug || 'Unknown',
          reason: 'Missing required fields (title, slug)'
        });
        continue;
      }

      // Check for existing course
      const existing = queryOne('SELECT id, title, slug, updated_at FROM courses WHERE slug = ?', [courseData.slug]);

      if (existing) {
        preview.duplicates.push({
          importItem: {
            title: courseData.title,
            slug: courseData.slug,
            category: courseData.category,
            level: courseData.level
          },
          existingItem: {
            id: existing.id,
            title: existing.title,
            slug: existing.slug,
            updatedAt: existing.updated_at
          }
        });
      } else {
        preview.newItems.push({
          title: courseData.title,
          slug: courseData.slug,
          category: courseData.category,
          level: courseData.level
        });
      }
    }

    res.json({
      success: true,
      totalItems: coursesToImport.length,
      preview,
      hasDuplicates: preview.duplicates.length > 0,
      hasInvalid: preview.invalid.length > 0,
      message: preview.duplicates.length > 0
        ? `Found ${preview.duplicates.length} duplicate(s). Choose how to handle them before importing.`
        : `Ready to import ${preview.newItems.length} item(s).`
    });

  } catch (error) {
    console.error('Error previewing import:', error);
    res.status(500).json({ error: 'Failed to preview import: ' + error.message });
  }
});

/**
 * GET /api/analytics/export-structure/:courseId
 * Export complete course structure (course, modules, lessons, lesson_content) for round-trip import
 * This is different from the analytics export - this exports the actual course content for backup/restore
 */
router.get('/export-structure/:courseId', requireInstructor, (req, res) => {
  try {
    const courseId = req.params.courseId;

    // Get course info
    const course = queryOne('SELECT * FROM courses WHERE id = ?', [courseId]);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    // Get all modules for this course
    const modules = queryAll(`
      SELECT id, course_id, title, description, order_index, bloom_objective, project_milestone, duration_hours
      FROM modules
      WHERE course_id = ?
      ORDER BY order_index
    `, [courseId]);

    // Get all lessons for this course with full details
    const lessons = queryAll(`
      SELECT
        l.id,
        l.module_id,
        l.title,
        l.description,
        l.order_index,
        l.bloom_level,
        l.structure_4c,
        l.content_type,
        l.duration_minutes,
        l.created_at,
        l.updated_at
      FROM lessons l
      JOIN modules m ON l.module_id = m.id
      WHERE m.course_id = ?
      ORDER BY m.order_index, l.order_index
    `, [courseId]);

    // Get all lesson_content for lessons in this course
    const lessonContent = queryAll(`
      SELECT
        lc.id,
        lc.lesson_id,
        lc.type,
        lc.content,
        lc.order_index
      FROM lesson_content lc
      JOIN lessons l ON lc.lesson_id = l.id
      JOIN modules m ON l.module_id = m.id
      WHERE m.course_id = ?
      ORDER BY m.order_index, l.order_index, lc.order_index
    `, [courseId]);

    // Build the structure export data
    // We need to maintain relationships by including temporary IDs
    const structureData = {
      export_version: '1.0',
      export_type: 'course_structure',
      exported_at: new Date().toISOString(),
      course: {
        title: course.title,
        slug: course.slug,
        description: course.description,
        category: course.category,
        tags: course.tags,
        level: course.level,
        is_premium: course.is_premium,
        is_published: course.is_published,
        thumbnail_url: course.thumbnail_url,
        duration_hours: course.duration_hours
      },
      modules: modules.map((m, moduleIndex) => {
        const moduleLessons = lessons.filter(l => l.module_id === m.id);
        return {
          _temp_id: `module_${moduleIndex}`,
          title: m.title,
          description: m.description,
          order_index: m.order_index,
          bloom_objective: m.bloom_objective,
          project_milestone: m.project_milestone,
          duration_hours: m.duration_hours,
          lessons: moduleLessons.map((l, lessonIndex) => {
            const lessonContentItems = lessonContent.filter(lc => lc.lesson_id === l.id);
            return {
              _temp_id: `lesson_${moduleIndex}_${lessonIndex}`,
              title: l.title,
              description: l.description,
              order_index: l.order_index,
              bloom_level: l.bloom_level,
              structure_4c: l.structure_4c,
              content_type: l.content_type,
              duration_minutes: l.duration_minutes,
              content: lessonContentItems.map(lc => ({
                type: lc.type,
                content: lc.content,
                order_index: lc.order_index
              }))
            };
          })
        };
      }),
      summary: {
        total_modules: modules.length,
        total_lessons: lessons.length,
        total_content_items: lessonContent.length
      }
    };

    const filename = `course-structure-${course.slug}-${new Date().toISOString().split('T')[0]}.json`;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.json(structureData);

  } catch (error) {
    console.error('Error exporting course structure:', error);
    res.status(500).json({ error: 'Failed to export course structure: ' + error.message });
  }
});

/**
 * POST /api/analytics/import-structure
 * Import complete course structure (course, modules, lessons, lesson_content)
 * Creates a new course with all its content, or updates an existing one
 * Body: { data: structureData, duplicateAction: 'skip' | 'overwrite' | 'create_new' }
 */
router.post('/import-structure', requireInstructor, (req, res) => {
  try {
    const { data, duplicateAction = 'create_new' } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'No data provided for import' });
    }

    // Validate import format
    if (data.export_type !== 'course_structure' || !data.course || !data.modules) {
      return res.status(400).json({
        error: 'Invalid import format. Use data exported from /api/analytics/export-structure/:courseId',
        hint: 'The data must have export_type: "course_structure", course, and modules fields'
      });
    }

    const now = new Date().toISOString();
    const courseData = data.course;

    // Validate required course fields
    if (!courseData.title || !courseData.slug) {
      return res.status(400).json({ error: 'Course title and slug are required' });
    }

    // Check for existing course by slug
    const existingCourse = queryOne('SELECT * FROM courses WHERE slug = ?', [courseData.slug]);

    let courseId;
    let action = 'created';

    if (existingCourse) {
      if (duplicateAction === 'skip') {
        return res.json({
          success: true,
          action: 'skipped',
          message: 'Course with this slug already exists',
          course: { id: existingCourse.id, title: existingCourse.title, slug: existingCourse.slug }
        });
      } else if (duplicateAction === 'overwrite') {
        // Delete existing modules, lessons, content for this course (cascade)
        const existingModules = queryAll('SELECT id FROM modules WHERE course_id = ?', [existingCourse.id]);
        for (const module of existingModules) {
          const moduleLessons = queryAll('SELECT id FROM lessons WHERE module_id = ?', [module.id]);
          for (const lesson of moduleLessons) {
            run('DELETE FROM lesson_content WHERE lesson_id = ?', [lesson.id]);
          }
          run('DELETE FROM lessons WHERE module_id = ?', [module.id]);
        }
        run('DELETE FROM modules WHERE course_id = ?', [existingCourse.id]);

        // Update course
        run(`
          UPDATE courses SET
            title = ?,
            description = ?,
            category = ?,
            level = ?,
            is_premium = ?,
            is_published = ?,
            duration_hours = ?,
            tags = ?,
            updated_at = ?
          WHERE id = ?
        `, [
          courseData.title,
          courseData.description || '',
          courseData.category || 'General',
          courseData.level || 'Principiante',
          courseData.is_premium ? 1 : 0,
          courseData.is_published !== undefined ? (courseData.is_published ? 1 : 0) : 1,
          courseData.duration_hours || 0,
          typeof courseData.tags === 'string' ? courseData.tags : JSON.stringify(courseData.tags || []),
          now,
          existingCourse.id
        ]);

        courseId = existingCourse.id;
        action = 'overwritten';
      } else {
        // create_new: Generate a new slug
        let newSlug = courseData.slug + '-imported-' + Date.now();
        courseData.slug = newSlug;

        // Insert new course
        run(`
          INSERT INTO courses (title, slug, description, category, level, is_premium, is_published, duration_hours, tags, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          courseData.title + ' (Imported)',
          newSlug,
          courseData.description || '',
          courseData.category || 'General',
          courseData.level || 'Principiante',
          courseData.is_premium ? 1 : 0,
          courseData.is_published !== undefined ? (courseData.is_published ? 1 : 0) : 1,
          courseData.duration_hours || 0,
          typeof courseData.tags === 'string' ? courseData.tags : JSON.stringify(courseData.tags || []),
          now,
          now
        ]);

        const newCourse = queryOne('SELECT id FROM courses WHERE slug = ?', [newSlug]);
        courseId = newCourse.id;
        action = 'created_new';
      }
    } else {
      // Insert new course
      run(`
        INSERT INTO courses (title, slug, description, category, level, is_premium, is_published, duration_hours, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        courseData.title,
        courseData.slug,
        courseData.description || '',
        courseData.category || 'General',
        courseData.level || 'Principiante',
        courseData.is_premium ? 1 : 0,
        courseData.is_published !== undefined ? (courseData.is_published ? 1 : 0) : 1,
        courseData.duration_hours || 0,
        typeof courseData.tags === 'string' ? courseData.tags : JSON.stringify(courseData.tags || []),
        now,
        now
      ]);

      const newCourse = queryOne('SELECT id FROM courses WHERE slug = ?', [courseData.slug]);
      courseId = newCourse.id;
    }

    // Import modules, lessons, and content
    let modulesCreated = 0;
    let lessonsCreated = 0;
    let contentCreated = 0;

    for (const moduleData of data.modules || []) {
      // Insert module
      run(`
        INSERT INTO modules (course_id, title, description, order_index, bloom_objective, project_milestone, duration_hours)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [
        courseId,
        moduleData.title || 'Untitled Module',
        moduleData.description || '',
        moduleData.order_index || 0,
        moduleData.bloom_objective || null,
        moduleData.project_milestone || null,
        moduleData.duration_hours || 0
      ]);

      // Get the module ID
      const newModule = queryOne(
        'SELECT id FROM modules WHERE course_id = ? AND order_index = ? ORDER BY id DESC LIMIT 1',
        [courseId, moduleData.order_index || 0]
      );
      const moduleId = newModule.id;
      modulesCreated++;

      // Insert lessons for this module
      for (const lessonData of moduleData.lessons || []) {
        run(`
          INSERT INTO lessons (module_id, title, description, order_index, bloom_level, structure_4c, content_type, duration_minutes, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          moduleId,
          lessonData.title || 'Untitled Lesson',
          lessonData.description || '',
          lessonData.order_index || 0,
          lessonData.bloom_level || null,
          lessonData.structure_4c || null,
          lessonData.content_type || 'text',
          lessonData.duration_minutes || 0,
          now,
          now
        ]);

        // Get the lesson ID
        const newLesson = queryOne(
          'SELECT id FROM lessons WHERE module_id = ? AND order_index = ? ORDER BY id DESC LIMIT 1',
          [moduleId, lessonData.order_index || 0]
        );
        const lessonId = newLesson.id;
        lessonsCreated++;

        // Insert lesson content
        for (const contentData of lessonData.content || []) {
          run(`
            INSERT INTO lesson_content (lesson_id, type, content, order_index, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `, [
            lessonId,
            contentData.type || 'text',
            typeof contentData.content === 'string' ? contentData.content : JSON.stringify(contentData.content || {}),
            contentData.order_index || 0,
            now,
            now
          ]);
          contentCreated++;
        }
      }
    }

    // Get the final course data for response
    const finalCourse = queryOne('SELECT * FROM courses WHERE id = ?', [courseId]);

    res.json({
      success: true,
      action,
      message: `Course structure imported successfully: ${modulesCreated} modules, ${lessonsCreated} lessons, ${contentCreated} content items`,
      course: {
        id: finalCourse.id,
        title: finalCourse.title,
        slug: finalCourse.slug,
        description: finalCourse.description,
        category: finalCourse.category,
        level: finalCourse.level,
        is_premium: finalCourse.is_premium,
        is_published: finalCourse.is_published,
        duration_hours: finalCourse.duration_hours
      },
      summary: {
        modules_created: modulesCreated,
        lessons_created: lessonsCreated,
        content_created: contentCreated
      }
    });

  } catch (error) {
    console.error('Error importing course structure:', error);
    res.status(500).json({ error: 'Failed to import course structure: ' + error.message });
  }
});

/**
 * GET /api/analytics/audit-trail
 * Feature #40: Retrieve audit trail events for security auditing
 * Requires instructor/admin role
 */
router.get('/audit-trail', requireInstructor, (req, res) => {
  try {
    const { limit = 50, userId, eventType } = req.query;

    let sql = `
      SELECT ae.*, u.name as user_name, u.email as user_email
      FROM analytics_events ae
      LEFT JOIN users u ON ae.user_id = u.id
      WHERE ae.event_type LIKE 'audit:%'
    `;
    const params = [];

    if (userId) {
      sql += ' AND ae.user_id = ?';
      params.push(userId);
    }

    if (eventType) {
      sql += ' AND ae.event_type = ?';
      params.push(eventType);
    }

    sql += ' ORDER BY ae.created_at DESC LIMIT ?';
    params.push(parseInt(limit) || 50);

    const events = queryAll(sql, params);

    // Parse metadata JSON for each event
    const parsedEvents = events.map(e => ({
      ...e,
      metadata: e.metadata ? JSON.parse(e.metadata) : {}
    }));

    res.json({
      success: true,
      count: parsedEvents.length,
      events: parsedEvents
    });
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({ error: 'Failed to fetch audit trail' });
  }
});

export default router;// trigger reload feature234 feature40
