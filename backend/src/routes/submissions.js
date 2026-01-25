/**
 * Submissions Routes - Soft Delete Support
 * Feature #166: Soft delete preserves historical data
 *
 * This module provides endpoints for managing submissions with soft delete support.
 * Soft deleted items are hidden from normal UI views but preserved for historical reports.
 */

import express from 'express';
import { queryAll, queryOne, run, getDatabase, saveDatabase } from '../config/database.js';

const router = express.Router();

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
 * DELETE /api/submissions/code/:id - Soft delete a code submission
 * Sets deleted_at timestamp instead of removing the record
 */
router.delete('/code/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;

    // Verify the submission exists and belongs to the user
    const submission = queryOne(
      'SELECT * FROM code_submissions WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (submission.deleted_at) {
      return res.status(400).json({ error: 'Submission already deleted' });
    }

    // Soft delete: set deleted_at timestamp
    const now = new Date().toISOString();
    run(
      'UPDATE code_submissions SET deleted_at = ? WHERE id = ?',
      [now, id]
    );

    res.json({
      success: true,
      message: 'Submission deleted successfully',
      deleted_at: now,
      submission_id: id
    });
  } catch (error) {
    console.error('Error soft deleting code submission:', error);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

/**
 * DELETE /api/submissions/project/:id - Soft delete a project submission
 * Sets deleted_at timestamp instead of removing the record
 */
router.delete('/project/:id', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;

    // Verify the submission exists and belongs to the user
    const submission = queryOne(
      'SELECT * FROM project_submissions WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (submission.deleted_at) {
      return res.status(400).json({ error: 'Submission already deleted' });
    }

    // Soft delete: set deleted_at timestamp
    const now = new Date().toISOString();
    run(
      'UPDATE project_submissions SET deleted_at = ? WHERE id = ?',
      [now, id]
    );

    res.json({
      success: true,
      message: 'Submission deleted successfully',
      deleted_at: now,
      submission_id: id
    });
  } catch (error) {
    console.error('Error soft deleting project submission:', error);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

/**
 * GET /api/submissions/code/active - Get user's active (non-deleted) code submissions
 * Excludes soft-deleted items for normal UI display
 */
router.get('/code/active', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const { challenge_id } = req.query;

    let sql = `
      SELECT id, challenge_id, code, output, error, test_results, is_correct,
             execution_time_ms, attempt_number, created_at
      FROM code_submissions
      WHERE user_id = ? AND deleted_at IS NULL
    `;
    const params = [userId];

    if (challenge_id) {
      sql += ' AND challenge_id = ?';
      params.push(challenge_id);
    }

    sql += ' ORDER BY created_at DESC';

    const submissions = queryAll(sql, params);

    // Parse test_results JSON
    const parsedSubmissions = submissions.map(s => ({
      ...s,
      test_results: JSON.parse(s.test_results || '[]')
    }));

    res.json({ submissions: parsedSubmissions });
  } catch (error) {
    console.error('Error fetching active code submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

/**
 * GET /api/submissions/project/active - Get user's active (non-deleted) project submissions
 * Excludes soft-deleted items for normal UI display
 */
router.get('/project/active', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const { project_id } = req.query;

    let sql = `
      SELECT ps.*, p.title as project_title, p.course_id
      FROM project_submissions ps
      JOIN projects p ON ps.project_id = p.id
      WHERE ps.user_id = ? AND ps.deleted_at IS NULL
    `;
    const params = [userId];

    if (project_id) {
      sql += ' AND ps.project_id = ?';
      params.push(project_id);
    }

    sql += ' ORDER BY ps.submitted_at DESC';

    const submissions = queryAll(sql, params);

    res.json({ submissions });
  } catch (error) {
    console.error('Error fetching active project submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

/**
 * GET /api/submissions/history/code - Get ALL code submissions including deleted (for historical reports)
 * This endpoint is used for audit trails and historical analytics
 */
router.get('/history/code', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const { challenge_id, include_deleted } = req.query;

    // Default: include all (for historical reports)
    // If include_deleted=false, exclude deleted items
    const includeDeleted = include_deleted !== 'false';

    let sql = `
      SELECT id, challenge_id, code, output, error, test_results, is_correct,
             execution_time_ms, attempt_number, created_at, deleted_at
      FROM code_submissions
      WHERE user_id = ?
    `;
    const params = [userId];

    if (!includeDeleted) {
      sql += ' AND deleted_at IS NULL';
    }

    if (challenge_id) {
      sql += ' AND challenge_id = ?';
      params.push(challenge_id);
    }

    sql += ' ORDER BY created_at DESC';

    const submissions = queryAll(sql, params);

    // Parse test_results JSON and add is_deleted flag
    const parsedSubmissions = submissions.map(s => ({
      ...s,
      test_results: JSON.parse(s.test_results || '[]'),
      is_deleted: s.deleted_at !== null
    }));

    res.json({
      submissions: parsedSubmissions,
      total: parsedSubmissions.length,
      deleted_count: parsedSubmissions.filter(s => s.is_deleted).length,
      active_count: parsedSubmissions.filter(s => !s.is_deleted).length
    });
  } catch (error) {
    console.error('Error fetching code submission history:', error);
    res.status(500).json({ error: 'Failed to fetch submission history' });
  }
});

/**
 * GET /api/submissions/history/project - Get ALL project submissions including deleted (for historical reports)
 * This endpoint is used for audit trails and historical analytics
 */
router.get('/history/project', requireAuth, (req, res) => {
  try {
    const userId = req.session.user.id;
    const { project_id, include_deleted } = req.query;

    // Default: include all (for historical reports)
    const includeDeleted = include_deleted !== 'false';

    let sql = `
      SELECT ps.*, p.title as project_title, p.course_id
      FROM project_submissions ps
      JOIN projects p ON ps.project_id = p.id
      WHERE ps.user_id = ?
    `;
    const params = [userId];

    if (!includeDeleted) {
      sql += ' AND ps.deleted_at IS NULL';
    }

    if (project_id) {
      sql += ' AND ps.project_id = ?';
      params.push(project_id);
    }

    sql += ' ORDER BY ps.submitted_at DESC';

    const submissions = queryAll(sql, params);

    // Add is_deleted flag for UI display
    const parsedSubmissions = submissions.map(s => ({
      ...s,
      is_deleted: s.deleted_at !== null
    }));

    res.json({
      submissions: parsedSubmissions,
      total: parsedSubmissions.length,
      deleted_count: parsedSubmissions.filter(s => s.is_deleted).length,
      active_count: parsedSubmissions.filter(s => !s.is_deleted).length
    });
  } catch (error) {
    console.error('Error fetching project submission history:', error);
    res.status(500).json({ error: 'Failed to fetch submission history' });
  }
});

/**
 * POST /api/submissions/code/:id/restore - Restore a soft-deleted code submission
 * Clears the deleted_at timestamp
 */
router.post('/code/:id/restore', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;

    // Verify the submission exists and belongs to the user
    const submission = queryOne(
      'SELECT * FROM code_submissions WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (!submission.deleted_at) {
      return res.status(400).json({ error: 'Submission is not deleted' });
    }

    // Restore: clear deleted_at timestamp
    run(
      'UPDATE code_submissions SET deleted_at = NULL WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Submission restored successfully',
      submission_id: id
    });
  } catch (error) {
    console.error('Error restoring code submission:', error);
    res.status(500).json({ error: 'Failed to restore submission' });
  }
});

/**
 * POST /api/submissions/project/:id/restore - Restore a soft-deleted project submission
 * Clears the deleted_at timestamp
 */
router.post('/project/:id/restore', requireAuth, (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user.id;

    // Verify the submission exists and belongs to the user
    const submission = queryOne(
      'SELECT * FROM project_submissions WHERE id = ? AND user_id = ?',
      [id, userId]
    );

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    if (!submission.deleted_at) {
      return res.status(400).json({ error: 'Submission is not deleted' });
    }

    // Restore: clear deleted_at timestamp
    run(
      'UPDATE project_submissions SET deleted_at = NULL WHERE id = ?',
      [id]
    );

    res.json({
      success: true,
      message: 'Submission restored successfully',
      submission_id: id
    });
  } catch (error) {
    console.error('Error restoring project submission:', error);
    res.status(500).json({ error: 'Failed to restore submission' });
  }
});

export default router;
