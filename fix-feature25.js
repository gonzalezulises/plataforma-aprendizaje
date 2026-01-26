const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/backend/src/routes/projects.js';

let content = fs.readFileSync(path, 'utf8');

// Fix the first access control check (for /:id/submissions)
const oldCheck1 = `// Check if instructor owns this course
      if (project.instructor_id !== userId && project.instructor_id !== String(userId)) {
        return res.status(403).json({ error: 'Access denied: You can only view submissions for your own courses' });
      }`;

const newCheck1 = `// Feature #25: Check if instructor owns this course
      // Must explicitly deny access when instructor_id is null/undefined
      const courseOwnerId = project.instructor_id;
      const ownsThisCourse = courseOwnerId !== null &&
                             courseOwnerId !== undefined &&
                             String(courseOwnerId) === String(userId);
      console.log('[Feature25] Project submissions check: instructor_id=' + courseOwnerId + ', userId=' + userId + ', owns=' + ownsThisCourse);
      if (!ownsThisCourse) {
        console.log('[Feature25] ACCESS DENIED - instructor does not own course');
        return res.status(403).json({ error: 'Access denied: You can only view submissions for your own courses' });
      }`;

content = content.replace(oldCheck1, newCheck1);

// Fix the second access control check (for /submissions/:submissionId)
const oldCheck2 = `// Check access permissions
    const isOwner = submission.user_id === userId || submission.user_id === String(userId);
    const isCourseInstructor = submission.instructor_id === userId || submission.instructor_id === String(userId);

    if (!isOwner && !(isInstructor && isCourseInstructor)) {
      return res.status(403).json({ error: 'Access denied: You can only view your own submissions or submissions from your courses' });
    }`;

const newCheck2 = `// Check access permissions
    const isOwner = submission.user_id === userId || submission.user_id === String(userId);

    // Feature #25: Instructor can only access if they actually own the course
    // Must explicitly deny when instructor_id is null/undefined
    const subInstructorId = submission.instructor_id;
    const isCourseInstructor = subInstructorId !== null &&
                               subInstructorId !== undefined &&
                               String(subInstructorId) === String(userId);

    console.log('[Feature25] Submission check: user_id=' + submission.user_id + ', instructor_id=' + subInstructorId + ', userId=' + userId);
    console.log('[Feature25] isOwner=' + isOwner + ', isInstructor=' + isInstructor + ', isCourseInstructor=' + isCourseInstructor);

    if (!isOwner && !(isInstructor && isCourseInstructor)) {
      console.log('[Feature25] ACCESS DENIED - cannot access submission');
      return res.status(403).json({ error: 'Access denied: You can only view your own submissions or submissions from your courses' });
    }`;

content = content.replace(oldCheck2, newCheck2);

fs.writeFileSync(path, content);
console.log('Feature #25 fix applied successfully!');
