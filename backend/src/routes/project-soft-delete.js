/**
 * Project Submissions Soft Delete Routes
 * Feature #166: Soft delete preserves historical data
 *
 * These routes add soft delete functionality to project submissions.
 * Mount at /api/projects after main projects routes.
 */

import express from 'express';
import { queryAll, queryOne, run } from '../config/database.js';

const router = express.Router();

/**
 * Feature #166: Soft delete a submission
 * DELETE /api/projects/submissions/:submissionId/soft
 * Sets deleted_at timestamp instead of removing the record
 */
router.delete('/submissions/:submissionId/soft', (req, res) => {
  try {
    const { submissionId } = req.params;
    const userId = req.session?.user?.id || 'test-user';

    // Verify the submission exists
    const submission = queryOne(
      'SELECT * FROM project_submissions WHERE id = ?',
      [submissionId]
    );

    if (!submission) {
      return res.status(404).json({ error: 'Submission not found' });
    }

    // Check if already deleted
    if (submission.deleted_at) {
      return res.status(400).json({ error: 'Submission already deleted' });
    }

    // Soft delete: set deleted_at timestamp
    const now = new Date().toISOString();
    run(
      'UPDATE project_submissions SET deleted_at = ? WHERE id = ?',
      [now, submissionId]
    );

    res.json({
      success: true,
      message: 'Submission soft deleted successfully',
      deleted_at: now,
      submission_id: submissionId
    });
  } catch (error) {
    console.error('Error soft deleting submission:', error);
    res.status(500).json({ error: 'Failed to delete submission' });
  }
});

/**
 * Feature #166: Get active (non-deleted) submissions
 * GET /api/projects/active/submissions
 * Returns only submissions where deleted_at IS NULL
 */
router.get('/active/submissions', (req, res) => {
  try {
    const userId = req.session?.user?.id || 'test-user';
    const submissions = queryAll(
      `SELECT ps.*, p.title as project_title, p.course_id
       FROM project_submissions ps
       JOIN projects p ON ps.project_id = p.id
       WHERE ps.user_id = ? AND ps.deleted_at IS NULL
       ORDER BY ps.submitted_at DESC`,
      [userId]
    );
    res.json({ submissions });
  } catch (error) {
    console.error('Error fetching active submissions:', error);
    res.status(500).json({ error: 'Failed to fetch submissions' });
  }
});

/**
 * Feature #166: Get historical submissions (including deleted)
 * GET /api/projects/history/submissions
 * Returns ALL submissions for historical reports/audit trail
 */
router.get('/history/submissions', (req, res) => {
  try {
    const userId = req.session?.user?.id || 'test-user';
    const { include_deleted } = req.query;

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

    sql += ' ORDER BY ps.submitted_at DESC';

    const submissions = queryAll(sql, params);

    // Add is_deleted flag for UI
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
    console.error('Error fetching submission history:', error);
    res.status(500).json({ error: 'Failed to fetch submission history' });
  }
});

/**
 * Feature #166: Restore a soft-deleted submission
 * POST /api/projects/submissions/:submissionId/restore
 */
router.post('/submissions/:submissionId/restore', (req, res) => {
  try {
    const { submissionId } = req.params;

    // Verify the submission exists and is deleted
    const submission = queryOne(
      'SELECT * FROM project_submissions WHERE id = ?',
      [submissionId]
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
      [submissionId]
    );

    res.json({
      success: true,
      message: 'Submission restored successfully',
      submission_id: submissionId
    });
  } catch (error) {
    console.error('Error restoring submission:', error);
    res.status(500).json({ error: 'Failed to restore submission' });
  }
});

export default router;
