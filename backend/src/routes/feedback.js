import express from 'express';
import { queryAll, queryOne, run, getDatabase, saveDatabase } from '../config/database.js';
import { sendFeedbackNotificationEmail, isEmailNotificationEnabled } from '../utils/emailService.js';

const router = express.Router();

/**
 * Middleware to check if user is authenticated
 * Feature #26: API endpoints validate authentication tokens
 */
function requireAuth(req, res, next) {
  if (!req.session || !req.session.isAuthenticated || !req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

/**
 * Middleware to check if user is an instructor
 */
function requireInstructor(req, res, next) {
  if (!req.session || !req.session.isAuthenticated || !req.session.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  if (req.session.user.role !== 'instructor_admin') {
    return res.status(403).json({ error: 'Instructor access required' });
  }
  next();
}

// Ensure feedback tables exist
function ensureFeedbackTables() {
  try {
    const db = getDatabase();

    // Rubrics table - defines evaluation criteria for projects
    db.run(`
      CREATE TABLE IF NOT EXISTS rubrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id TEXT,
        project_id INTEGER,
        name TEXT NOT NULL,
        description TEXT,
        criteria TEXT NOT NULL DEFAULT '[]',
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Feedback table - stores instructor feedback on submissions
    db.run(`
      CREATE TABLE IF NOT EXISTS feedback (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        submission_id INTEGER NOT NULL,
        type TEXT NOT NULL DEFAULT 'rubric',
        content TEXT NOT NULL DEFAULT '{}',
        scores TEXT NOT NULL DEFAULT '{}',
        total_score REAL,
        max_score REAL,
        comment TEXT,
        video_url TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for feedback lookups
    db.run(`CREATE INDEX IF NOT EXISTS idx_feedback_submission ON feedback(submission_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_rubrics_project ON rubrics(project_id)`);

    saveDatabase();
    console.log('Feedback tables initialized');
  } catch (error) {
    console.error('Error initializing feedback tables:', error);
  }
}

// Initialize tables when module loads
setTimeout(ensureFeedbackTables, 1500);

/**
 * Get all rubrics
 */
router.get('/rubrics', (req, res) => {
  try {
    const rubrics = queryAll('SELECT * FROM rubrics ORDER BY created_at DESC');
    // Parse criteria JSON for each rubric
    const parsedRubrics = rubrics.map(r => ({
      ...r,
      criteria: JSON.parse(r.criteria || '[]')
    }));
    res.json({ rubrics: parsedRubrics });
  } catch (error) {
    console.error('Error fetching rubrics:', error);
    res.status(500).json({ error: 'Failed to fetch rubrics' });
  }
});

/**
 * Get a rubric by ID
 */
router.get('/rubrics/:id', (req, res) => {
  try {
    const rubric = queryOne('SELECT * FROM rubrics WHERE id = ?', [req.params.id]);
    if (!rubric) {
      return res.status(404).json({ error: 'Rubric not found' });
    }
    rubric.criteria = JSON.parse(rubric.criteria || '[]');
    res.json({ rubric });
  } catch (error) {
    console.error('Error fetching rubric:', error);
    res.status(500).json({ error: 'Failed to fetch rubric' });
  }
});

/**
 * Create a new rubric (instructor only)
 */
router.post('/rubrics', requireInstructor, (req, res) => {
  try {
    const { course_id, project_id, name, description, criteria } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    const now = new Date().toISOString();
    const criteriaJson = JSON.stringify(criteria || []);

    const result = run(
      `INSERT INTO rubrics (course_id, project_id, name, description, criteria, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [course_id || null, project_id || null, name, description || null, criteriaJson, now, now]
    );

    const rubric = queryOne('SELECT * FROM rubrics WHERE id = ?', [result.lastInsertRowid]);
    rubric.criteria = JSON.parse(rubric.criteria || '[]');
    res.status(201).json({ rubric });
  } catch (error) {
    console.error('Error creating rubric:', error);
    res.status(500).json({ error: 'Failed to create rubric' });
  }
});

/**
 * Get feedback for a submission
 */
router.get('/submissions/:submissionId/feedback', (req, res) => {
  try {
    const feedback = queryAll(
      'SELECT * FROM feedback WHERE submission_id = ? ORDER BY created_at DESC',
      [req.params.submissionId]
    );
    // Parse JSON fields
    const parsedFeedback = feedback.map(f => ({
      ...f,
      content: JSON.parse(f.content || '{}'),
      scores: JSON.parse(f.scores || '{}')
    }));
    res.json({ feedback: parsedFeedback });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

/**
 * Create feedback for a submission (instructor only)
 */
router.post('/submissions/:submissionId/feedback', requireInstructor, (req, res) => {
  try {
    const { type, content, scores, total_score, max_score, comment, video_url } = req.body;
    const submissionId = req.params.submissionId;

    // Get user from session (authentication required)
    const createdBy = req.session.user.id;

    // Verify submission exists
    const submission = queryOne(
      'SELECT * FROM project_submissions WHERE id = ?',
      [submissionId]
    );

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    const now = new Date().toISOString();
    const contentJson = JSON.stringify(content || {});
    const scoresJson = JSON.stringify(scores || {});

    const result = run(
      `INSERT INTO feedback (submission_id, type, content, scores, total_score, max_score, comment, video_url, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        submissionId,
        type || 'rubric',
        contentJson,
        scoresJson,
        total_score || null,
        max_score || null,
        comment || null,
        video_url || null,
        createdBy,
        now,
        now
      ]
    );

    // Update submission status to 'reviewed'
    run(
      `UPDATE project_submissions SET status = 'reviewed', updated_at = ? WHERE id = ?`,
      [now, submissionId]
    );

    // Create notification for the student
    const notificationContent = JSON.stringify({
      submissionId: parseInt(submissionId),
      feedbackId: result.lastInsertRowid,
      total_score,
      max_score,
      type: type || 'rubric'
    });

    run(
      `INSERT INTO notifications (user_id, type, title, message, content, is_read, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [
        submission.user_id,
        'feedback_received',
        'Nueva Retroalimentacion',
        `Tu entrega ha recibido retroalimentacion. Puntuacion: ${total_score || 0}/${max_score || 100}`,
        notificationContent,
        now
      ]
    );

    // Feature #201: Send email notification for new feedback
    try {
      // Get student info and preferences
      const student = queryOne(
        'SELECT id, email, name, preferences FROM users WHERE id = ?',
        [submission.user_id]
      );

      if (student && student.email) {
        // Check if user has email_feedback_received notifications enabled
        const shouldSendEmail = isEmailNotificationEnabled(student.preferences, 'email_feedback_received');

        if (shouldSendEmail) {
          // Get course and project info for richer email content
          const project = queryOne(
            'SELECT p.title as project_name, c.title as course_name FROM projects p ' +
            'LEFT JOIN courses c ON p.course_id = c.id ' +
            'WHERE p.id = ?',
            [submission.project_id]
          );

          // Get instructor info
          const instructor = queryOne(
            'SELECT name FROM users WHERE id = ?',
            [createdBy]
          );

          // Generate feedback link (frontend URL - matches route /feedback/:submissionId)
          const feedbackLink = `http://localhost:5173/feedback/${submissionId}`;

          // Send email notification
          sendFeedbackNotificationEmail({
            studentEmail: student.email,
            studentName: student.name,
            courseName: project?.course_name || 'Curso',
            projectName: project?.project_name || submission.project_id ? `Proyecto #${submission.project_id}` : 'Tu entrega',
            score: total_score,
            maxScore: max_score,
            feedbackLink: feedbackLink,
            instructorName: instructor?.name
          });

          console.log(`[Feedback] Email notification sent to ${student.email} for submission ${submissionId}`);
        } else {
          console.log(`[Feedback] Email notification skipped for user ${submission.user_id} (disabled in preferences)`);
        }
      } else {
        console.log(`[Feedback] Could not send email: student ${submission.user_id} not found or no email`);
      }
    } catch (emailError) {
      // Don't fail the request if email fails - just log it
      console.error('[Feedback] Error sending email notification:', emailError);
    }

    // Fetch the newly created feedback
    // result.lastInsertRowid might be BigInt, so we need to handle it
    const feedbackId = result.lastInsertRowid ? Number(result.lastInsertRowid) : null;
    let feedback = null;

    if (feedbackId) {
      feedback = queryOne('SELECT * FROM feedback WHERE id = ?', [feedbackId]);
    }

    // If we couldn't get by ID, get the most recent one for this submission
    if (!feedback) {
      feedback = queryOne(
        'SELECT * FROM feedback WHERE submission_id = ? ORDER BY created_at DESC LIMIT 1',
        [submissionId]
      );
    }

    if (feedback) {
      feedback.content = JSON.parse(feedback.content || '{}');
      feedback.scores = JSON.parse(feedback.scores || '{}');
    }

    res.status(201).json({ feedback: feedback || { success: true, submissionId } });
  } catch (error) {
    console.error('Error creating feedback:', error);
    res.status(500).json({ error: 'Failed to create feedback' });
  }
});

/**
 * Update feedback (instructor only)
 */
router.put('/feedback/:id', requireInstructor, (req, res) => {
  try {
    const { type, content, scores, total_score, max_score, comment, video_url } = req.body;
    const feedbackId = req.params.id;

    // Check if feedback exists
    const existingFeedback = queryOne('SELECT * FROM feedback WHERE id = ?', [feedbackId]);
    if (!existingFeedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }

    const now = new Date().toISOString();
    const contentJson = content ? JSON.stringify(content) : existingFeedback.content;
    const scoresJson = scores ? JSON.stringify(scores) : existingFeedback.scores;

    run(
      `UPDATE feedback
       SET type = ?, content = ?, scores = ?, total_score = ?, max_score = ?, comment = ?, video_url = ?, updated_at = ?
       WHERE id = ?`,
      [
        type || existingFeedback.type,
        contentJson,
        scoresJson,
        total_score !== undefined ? total_score : existingFeedback.total_score,
        max_score !== undefined ? max_score : existingFeedback.max_score,
        comment !== undefined ? comment : existingFeedback.comment,
        video_url !== undefined ? video_url : existingFeedback.video_url,
        now,
        feedbackId
      ]
    );

    const feedback = queryOne('SELECT * FROM feedback WHERE id = ?', [feedbackId]);
    feedback.content = JSON.parse(feedback.content || '{}');
    feedback.scores = JSON.parse(feedback.scores || '{}');

    res.json({ feedback });
  } catch (error) {
    console.error('Error updating feedback:', error);
    res.status(500).json({ error: 'Failed to update feedback' });
  }
});

/**
 * Get a single feedback by ID
 */
router.get('/feedback/:id', (req, res) => {
  try {
    const feedback = queryOne('SELECT * FROM feedback WHERE id = ?', [req.params.id]);
    if (!feedback) {
      return res.status(404).json({ error: 'Feedback not found' });
    }
    feedback.content = JSON.parse(feedback.content || '{}');
    feedback.scores = JSON.parse(feedback.scores || '{}');
    res.json({ feedback });
  } catch (error) {
    console.error('Error fetching feedback:', error);
    res.status(500).json({ error: 'Failed to fetch feedback' });
  }
});

/**
 * Get default rubric criteria (for UI convenience)
 */
router.get('/default-rubric', (req, res) => {
  const defaultCriteria = [
    {
      id: 'code_quality',
      name: 'Calidad del Codigo',
      description: 'Claridad, organizacion y buenas practicas de programacion',
      maxScore: 25
    },
    {
      id: 'functionality',
      name: 'Funcionalidad',
      description: 'El codigo funciona correctamente y cumple los requisitos',
      maxScore: 25
    },
    {
      id: 'documentation',
      name: 'Documentacion',
      description: 'Comentarios claros y documentacion apropiada',
      maxScore: 25
    },
    {
      id: 'creativity',
      name: 'Creatividad',
      description: 'Soluciones originales y mejoras adicionales',
      maxScore: 25
    }
  ];

  res.json({
    criteria: defaultCriteria,
    maxTotalScore: 100
  });
});

export default router;
// Feature #201 trigger reload do., 25 de ene. de 2026 19:23:33
