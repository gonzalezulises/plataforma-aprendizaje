import express from 'express';
import { queryAll, queryOne, run, getDatabase, saveDatabase } from '../config/database.js';

const router = express.Router();

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
router.get('/my/submissions', (req, res) => {
  try {
    const userId = req.session?.user?.id || 'test-user';
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
router.get('/my/pending', (req, res) => {
  try {
    const userId = req.session?.user?.id || 'test-user';
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
 * Get all submissions awaiting review (instructor only)
 * MUST be before /:id routes
 */
router.get('/pending/review', (req, res) => {
  try {
    const submissions = queryAll(
      `SELECT ps.*, p.title as project_title, p.course_id
       FROM project_submissions ps
       JOIN projects p ON ps.project_id = p.id
       WHERE ps.status = 'submitted'
       ORDER BY ps.submitted_at ASC`,
      []
    );
    res.json({ submissions });
  } catch (error) {
    console.error('Error fetching pending submissions:', error);
    res.status(500).json({ error: 'Failed to fetch pending submissions' });
  }
});

/**
 * Get all submissions (instructor only - for review page)
 * MUST be before /:id routes
 */
router.get('/all/submissions', (req, res) => {
  try {
    const { status } = req.query;
    let query = `SELECT ps.*, p.title as project_title, p.course_id
                 FROM project_submissions ps
                 JOIN projects p ON ps.project_id = p.id`;
    let params = [];

    if (status) {
      query += ` WHERE ps.status = ?`;
      params.push(status);
    }

    query += ` ORDER BY ps.submitted_at DESC`;

    const submissions = queryAll(query, params);
    res.json({ submissions });
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
 * Create a new project
 */
router.post('/', (req, res) => {
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
router.post('/:id/submit', (req, res) => {
  try {
    const { content, github_url } = req.body;
    const projectId = req.params.id;

    // Get user from session or use a default for testing
    const userId = req.session?.user?.id || 'test-user';

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
 * Get all submissions for a project
 */
router.get('/:id/submissions', (req, res) => {
  try {
    const projectId = req.params.id;
    const submissions = queryAll(
      'SELECT * FROM project_submissions WHERE project_id = ? ORDER BY submitted_at DESC',
      [projectId]
    );
    res.json({ submissions });
  } catch (error) {
    console.error('Error fetching submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

/**
 * Get a specific submission by ID
 */
router.get('/submissions/:submissionId', (req, res) => {
  try {
    const submission = queryOne(
      'SELECT * FROM project_submissions WHERE id = ?',
      [req.params.submissionId]
    );
    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }
    res.json({ submission });
  } catch (error) {
    console.error('Error fetching submission:', error);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

export default router;
// trigger reload do., 25 de ene. de 2026 20:51:33
