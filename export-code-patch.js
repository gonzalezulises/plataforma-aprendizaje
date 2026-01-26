const fs = require('fs');

const codeToAppend = `

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
    const enrollments = queryAll(\`
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
    \`, [courseId]);

    // Get all modules for this course
    const modules = queryAll(\`
      SELECT id, title, description, "order" as module_order
      FROM modules
      WHERE course_id = ?
      ORDER BY "order"
    \`, [courseId]);

    // Get all lessons for this course
    const lessons = queryAll(\`
      SELECT
        l.id as lesson_id,
        l.title as lesson_title,
        l.module_id,
        m.title as module_title,
        l."order" as lesson_order
      FROM lessons l
      JOIN modules m ON l.module_id = m.id
      WHERE m.course_id = ?
      ORDER BY m."order", l."order"
    \`, [courseId]);

    // Get lesson progress for all students in this course
    const lessonProgress = queryAll(\`
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
    \`, [courseId]);

    // Get quiz attempts for this course (if quiz table exists)
    let quizAttempts = [];
    try {
      quizAttempts = queryAll(\`
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
      \`, [courseId]);
    } catch (e) {
      // Quiz tables may not exist
    }

    // Get code submissions for this course (if challenges table exists)
    let codeSubmissions = [];
    try {
      codeSubmissions = queryAll(\`
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
      \`, [courseId]);
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
      csv += '### COURSE INFO ###\\n';
      csv += 'Field,Value\\n';
      csv += 'Course ID,' + course.id + '\\n';
      csv += 'Title,"' + course.title + '"\\n';
      csv += 'Category,' + (course.category || '') + '\\n';
      csv += 'Level,' + (course.level || '') + '\\n';
      csv += 'Total Enrollments,' + exportData.summary.total_enrollments + '\\n';
      csv += 'Completed Enrollments,' + exportData.summary.completed_enrollments + '\\n';
      csv += 'Average Progress,' + exportData.summary.average_progress + '%\\n';
      csv += 'Exported At,' + exportData.summary.exported_at + '\\n';
      csv += '\\n';

      // Enrollments section
      csv += '### ENROLLMENTS ###\\n';
      csv += 'Student Name,Student Email,Enrolled At,Completed At,Progress %,Last Accessed\\n';
      exportData.enrollments.forEach(e => {
        csv += '"' + e.student_name + '","' + e.student_email + '",' + (e.enrolled_at || '') + ',' + (e.completed_at || '') + ',' + e.progress_percent + ',' + (e.last_accessed_at || '') + '\\n';
      });
      csv += '\\n';

      // Lesson Progress section
      csv += '### LESSON PROGRESS ###\\n';
      csv += 'Student Name,Student Email,Lesson Title,Status,Time Spent (min),Completed At\\n';
      exportData.lesson_progress.forEach(lp => {
        csv += '"' + lp.student_name + '","' + lp.student_email + '","' + lp.lesson_title + '",' + lp.status + ',' + lp.time_spent_minutes + ',' + (lp.completed_at || '') + '\\n';
      });
      csv += '\\n';

      // Quiz Attempts section
      if (exportData.quiz_attempts.length > 0) {
        csv += '### QUIZ ATTEMPTS ###\\n';
        csv += 'Student Name,Student Email,Quiz ID,Score,Attempt #,Date\\n';
        exportData.quiz_attempts.forEach(qa => {
          csv += '"' + qa.student_name + '","' + qa.student_email + '",' + qa.quiz_id + ',' + qa.score + ',' + qa.attempt_number + ',' + qa.created_at + '\\n';
        });
        csv += '\\n';
      }

      // Code Submissions section
      if (exportData.code_submissions.length > 0) {
        csv += '### CODE SUBMISSIONS ###\\n';
        csv += 'Student Name,Student Email,Challenge ID,Correct,Attempt #,Date\\n';
        exportData.code_submissions.forEach(cs => {
          csv += '"' + cs.student_name + '","' + cs.student_email + '",' + cs.challenge_id + ',' + (cs.is_correct ? 'Yes' : 'No') + ',' + cs.attempt_number + ',' + cs.created_at + '\\n';
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
    const courses = queryAll(\`
      SELECT
        c.*,
        COUNT(DISTINCT e.user_id) as enrollment_count,
        AVG(e.progress_percent) as avg_progress
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    \`);

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

      let csv = '### SUMMARY ###\\n';
      csv += 'Metric,Value\\n';
      csv += 'Total Courses,' + stats.total_courses + '\\n';
      csv += 'Total Students,' + stats.total_students + '\\n';
      csv += 'Total Enrollments,' + stats.total_enrollments + '\\n';
      csv += 'Completed Lessons,' + stats.completed_lessons + '\\n';
      csv += 'Total Time (hours),' + stats.total_time_hours + '\\n';
      csv += 'Exported At,' + stats.exported_at + '\\n';
      csv += '\\n';

      csv += '### COURSES ###\\n';
      csv += 'ID,Title,Category,Level,Premium,Published,Enrollments,Avg Progress,Created At\\n';
      exportData.courses.forEach(c => {
        csv += c.id + ',"' + c.title + '",' + (c.category || '') + ',' + (c.level || '') + ',' + (c.is_premium ? 'Yes' : 'No') + ',' + (c.is_published ? 'Yes' : 'No') + ',' + c.enrollment_count + ',' + c.avg_progress + '%,' + c.created_at + '\\n';
      });

      return res.send(csv);
    }
  } catch (error) {
    console.error('Error exporting all courses data:', error);
    res.status(500).json({ error: 'Failed to export data' });
  }
});
`;

// Read the current analytics.js file
const filePath = 'C:/Users/gonza/claude-projects/backend/src/routes/analytics.js';
let content = fs.readFileSync(filePath, 'utf8');

// Find the position before "export default router;"
const exportDefault = 'export default router;';
const idx = content.lastIndexOf(exportDefault);

if (idx !== -1) {
  // Insert the new code before the export statement
  content = content.slice(0, idx) + codeToAppend + '\n' + exportDefault;
  fs.writeFileSync(filePath, content);
  console.log('Successfully added export endpoints to analytics.js');
} else {
  console.error('Could not find export default statement');
}
