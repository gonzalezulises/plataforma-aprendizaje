import express from 'express';
import { queryAll, queryOne, run, getDatabase, saveDatabase } from '../config/database.js';

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

// Ensure projects tables exist
function ensureProjectTables() {
  try {
    const db = getDatabase();

    // Projects table
    db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        requirements TEXT,
        due_date TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Project submissions table
    db.run(`
      CREATE TABLE IF NOT EXISTS project_submissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        project_id INTEGER NOT NULL,
        content TEXT NOT NULL,
        github_url TEXT,
        status TEXT NOT NULL DEFAULT 'submitted',
        submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects(id)
      )
    `);

    // Create indexes
    db.run(`CREATE INDEX IF NOT EXISTS idx_project_submissions_user ON project_submissions(user_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_project_submissions_project ON project_submissions(project_id)`);

    saveDatabase();
    console.log('Project tables initialized');
  } catch (error) {
    console.error('Error initializing project tables:', error);
  }
}

// Initialize tables when module loads
setTimeout(ensureProjectTables, 1000);

/**
 * Get all projects
 */
router.get('/', (req, res) => {
  try {
    const projects = queryAll('SELECT * FROM projects ORDER BY created_at DESC');
    res.json({ projects });
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

/**
 * Get all submissions for the current user
 * MUST be before /:id routes to avoid matching "my" as an id
 */
router.get('/my/submissions', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const submissions = queryAll(
      `SELECT ps.*, p.title as project_title, p.course_id
       FROM project_submissions ps
       JOIN projects p ON ps.project_id = p.id
       WHERE ps.user_id = ?
       ORDER BY ps.submitted_at DESC`,
      [userId]
    );
    res.json({ submissions });
  } catch (error) {
    console.error('Error fetching user submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

/**
 * Get pending projects for the current user (not yet submitted)
 * MUST be before /:id routes
 */
router.get('/my/pending', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    // Get all projects that the user hasn't submitted yet
    // Only get projects from courses the user is enrolled in
    const pendingProjects = queryAll(
      `SELECT p.*, c.title as course_title, c.slug as course_slug
       FROM projects p
       JOIN courses c ON p.course_id = c.slug OR p.course_id = CAST(c.id AS TEXT)
       JOIN enrollments e ON e.course_id = c.id
       WHERE e.user_id = ?
       AND NOT EXISTS (
         SELECT 1 FROM project_submissions ps
         WHERE ps.project_id = p.id AND ps.user_id = ?
       )
       ORDER BY p.due_date ASC NULLS LAST, p.created_at DESC`,
      [userId, userId]
    );
    res.json({ projects: pendingProjects });
  } catch (error) {
    console.error('Error fetching pending projects:', error);
    res.status(500).json({ error: 'Failed to fetch pending projects' });
  }
});

/**
 * Get all submissions awaiting review for courses owned by the instructor (instructor only)
 * Feature #24: Instructors can only view submissions for courses they own
 * MUST be before /:id routes
 */
router.get('/pending/review', requireInstructor, (req, res) => {
  try {
    const instructorId = req.session.user.id;
    const submissions = queryAll(
      `SELECT ps.*, p.title as project_title, p.course_id, c.title as course_title
       FROM project_submissions ps
       JOIN projects p ON ps.project_id = p.id
       JOIN courses c ON (p.course_id = c.slug OR p.course_id = CAST(c.id AS TEXT))
       WHERE ps.status = 'submitted' AND c.instructor_id = ?
       ORDER BY ps.submitted_at ASC`,
      [instructorId]
    );
    res.json({ submissions });
  } catch (error) {
    console.error('Error fetching pending submissions:', error);
    res.status(500).json({ error: 'Failed to fetch pending submissions' });
  }
});

/**
 * Get all submissions for courses owned by the instructor (instructor only - for review page)
 * Feature #24: Instructors can only view submissions for courses they own
 * MUST be before /:id routes
 */
router.get('/all/submissions', requireInstructor, (req, res) => {
  try {
    const { status } = req.query;
    const instructorId = req.session.user.id;

    // Build query to only get submissions from courses owned by this instructor
    // Feature #24/#25: Instructors can only view submissions for their own courses
    // Projects are linked to courses via course_id (which can be slug or course id)
    let query = `
      SELECT ps.*, p.title as project_title, p.course_id, c.title as course_title
      FROM project_submissions ps
      JOIN projects p ON ps.project_id = p.id
      JOIN courses c ON (p.course_id = c.slug OR p.course_id = CAST(c.id AS TEXT))
      WHERE c.instructor_id = ?
    `;
    let params = [instructorId];

    if (status) {
      query += ` AND ps.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY ps.submitted_at DESC`;

    const submissions = queryAll(query, params);
    res.json({ submissions, instructor_id: instructorId });
  } catch (error) {
    console.error('Error fetching all submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

/**
 * Get a single project by ID
 */
router.get('/:id', (req, res) => {
  try {
    const project = queryOne('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    res.json({ project });
  } catch (error) {
    console.error('Error fetching project:', error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

/**
 * Create a new project (instructor only)
 */
router.post('/', requireInstructor, (req, res) => {
  try {
    const { course_id, title, description, requirements, due_date } = req.body;

    if (!course_id || !title) {
      return res.status(400).json({ error: 'course_id and title are required' });
    }

    const now = new Date().toISOString();
    const result = run(
      `INSERT INTO projects (course_id, title, description, requirements, due_date, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [course_id, title, description || null, requirements || null, due_date || null, now, now]
    );

    const project = queryOne('SELECT * FROM projects WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ project });
  } catch (error) {
    console.error('Error creating project:', error);
    res.status(500).json({ error: 'Failed to create project' });
  }
});

/**
 * Submit a project
 */
router.post('/:id/submit', requireAuth, (req, res) => {
  try {
    const { content, github_url } = req.body;
    const projectId = req.params.id;

    // Get user from session (authentication required)
    const userId = req.session.user.id;

    if (!content) {
      return res.status(400).json({ error: 'content is required' });
    }

    // Check if project exists
    const project = queryOne('SELECT * FROM projects WHERE id = ?', [projectId]);
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    const now = new Date().toISOString();
    const result = run(
      `INSERT INTO project_submissions (user_id, project_id, content, github_url, status, submitted_at, updated_at)
       VALUES (?, ?, ?, ?, 'submitted', ?, ?)`,
      [userId, projectId, content, github_url || null, now, now]
    );

    const submission = queryOne('SELECT * FROM project_submissions WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ submission });
  } catch (error) {
    console.error('Error submitting project:', error);
    res.status(500).json({ error: 'Failed to submit project' });
  }
});

/**
 * Get submissions for a project
 * Feature #23: Users can only see their own submissions
 * Feature #24: Instructors can only see submissions for courses they own
 * - Regular users: can only see their own submissions for this project
 * - Instructors: can see submissions only if they own the course
 */
router.get('/:id/submissions', requireAuth, (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.session.user.id;
    const isInstructor = req.session.user.role === 'instructor_admin';

    let submissions;
    if (isInstructor) {
      // Feature #24: Instructors can only see submissions for projects in courses they own
      const project = queryOne(`
        SELECT p.*, c.instructor_id
        FROM projects p
        JOIN courses c ON (p.course_id = c.slug OR p.course_id = CAST(c.id AS TEXT))
        WHERE p.id = ?
      `, [projectId]);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      // Feature #25: Check if instructor owns this course
      // Must deny access when instructor_id is null/undefined
      const courseOwnerId = project.instructor_id;
      const ownsThisCourse = courseOwnerId !== null &&
                             courseOwnerId !== undefined &&
                             String(courseOwnerId) === String(userId);
      console.log('[Feature25] Project: instructor_id=' + courseOwnerId + ', userId=' + userId + ', owns=' + ownsThisCourse);
      if (!ownsThisCourse) {
        console.log('[Feature25] ACCESS DENIED - instructor does not own course');
        return res.status(403).json({ error: 'Access denied: You can only view submissions for your own courses' });
      }

      submissions = queryAll(
        'SELECT * FROM project_submissions WHERE project_id = ? ORDER BY submitted_at DESC',
        [projectId]
      );
    } else {
      // Regular users can only see their own submissions
      submissions = queryAll(
        'SELECT * FROM project_submissions WHERE project_id = ? AND user_id = ? ORDER BY submitted_at DESC',
        [projectId, userId]
      );
    }
    res.json({ submissions });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

/**
 * Get a specific submission by ID
 * Feature #23: Users can only see their own submissions
 * Feature #24: Instructors can only see submissions for courses they own
 * - Regular users: can only access their own submissions
 * - Instructors: can access submissions only for courses they own
 */
router.get('/submissions/:submissionId', requireAuth, (req, res) => {
  try {
    const submissionId = req.params.submissionId;
    const userId = req.session.user.id;
    const isInstructor = req.session.user.role === 'instructor_admin';

    // Get submission with course ownership info
    const submission = queryOne(`
      SELECT ps.*, p.course_id, c.instructor_id
      FROM project_submissions ps
      JOIN projects p ON ps.project_id = p.id
      JOIN courses c ON (p.course_id = c.slug OR p.course_id = CAST(c.id AS TEXT))
      WHERE ps.id = ?
    `, [submissionId]);

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Check access permissions
    const isOwner = submission.user_id === userId || submission.user_id === String(userId);

    // Feature #25: Instructor can only access if they own the course
    const subInstructorId = submission.instructor_id;
    const isCourseInstructor = subInstructorId !== null &&
                               subInstructorId !== undefined &&
                               String(subInstructorId) === String(userId);

    console.log('[Feature25] Submission: user_id=' + submission.user_id + ', instructor_id=' + subInstructorId);
    console.log('[Feature25] isOwner=' + isOwner + ', isInstructor=' + isInstructor + ', isCourseInstructor=' + isCourseInstructor);

    if (!isOwner && !(isInstructor && isCourseInstructor)) {
      console.log('[Feature25] ACCESS DENIED - cannot access submission');
      return res.status(403).json({ error: 'Access denied: You can only view your own submissions or submissions from your courses' });
    }

    res.json({ submission });
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

export default router;
// trigger reload Feature25 test - v2 2026-01-26T20:27
// Trigger reload Feature25 1769459351
