const fs = require('fs');
const path = 'C:/Users/gonza/claude-projects/backend/src/routes/projects.js';

let content = fs.readFileSync(path, 'utf8');

// The file has CRLF line endings, so we need to match them
const CRLF = '\r\n';

// Fix the first access control check (for /:id/submissions)
const oldCheck1 = `// Check if instructor owns this course${CRLF}      if (project.instructor_id !== userId && project.instructor_id !== String(userId)) {${CRLF}        return res.status(403).json({ error: 'Access denied: You can only view submissions for your own courses' });${CRLF}      }`;

const newCheck1 = `// Feature #25: Check if instructor owns this course${CRLF}      // Must deny access when instructor_id is null/undefined${CRLF}      const courseOwnerId = project.instructor_id;${CRLF}      const ownsThisCourse = courseOwnerId !== null &&${CRLF}                             courseOwnerId !== undefined &&${CRLF}                             String(courseOwnerId) === String(userId);${CRLF}      console.log('[Feature25] Project: instructor_id=' + courseOwnerId + ', userId=' + userId + ', owns=' + ownsThisCourse);${CRLF}      if (!ownsThisCourse) {${CRLF}        console.log('[Feature25] ACCESS DENIED - instructor does not own course');${CRLF}        return res.status(403).json({ error: 'Access denied: You can only view submissions for your own courses' });${CRLF}      }`;

if (content.includes(oldCheck1)) {
  content = content.replace(oldCheck1, newCheck1);
  console.log('Fixed first check (project submissions)');
} else {
  console.log('First check pattern not found');
}

// Fix the second access control check (for /submissions/:submissionId)
const oldCheck2 = `// Check access permissions${CRLF}    const isOwner = submission.user_id === userId || submission.user_id === String(userId);${CRLF}    const isCourseInstructor = submission.instructor_id === userId || submission.instructor_id === String(userId);${CRLF}${CRLF}    if (!isOwner && !(isInstructor && isCourseInstructor)) {${CRLF}      return res.status(403).json({ error: 'Access denied: You can only view your own submissions or submissions from your courses' });${CRLF}    }`;

const newCheck2 = `// Check access permissions${CRLF}    const isOwner = submission.user_id === userId || submission.user_id === String(userId);${CRLF}${CRLF}    // Feature #25: Instructor can only access if they own the course${CRLF}    const subInstructorId = submission.instructor_id;${CRLF}    const isCourseInstructor = subInstructorId !== null &&${CRLF}                               subInstructorId !== undefined &&${CRLF}                               String(subInstructorId) === String(userId);${CRLF}${CRLF}    console.log('[Feature25] Submission: user_id=' + submission.user_id + ', instructor_id=' + subInstructorId);${CRLF}    console.log('[Feature25] isOwner=' + isOwner + ', isInstructor=' + isInstructor + ', isCourseInstructor=' + isCourseInstructor);${CRLF}${CRLF}    if (!isOwner && !(isInstructor && isCourseInstructor)) {${CRLF}      console.log('[Feature25] ACCESS DENIED - cannot access submission');${CRLF}      return res.status(403).json({ error: 'Access denied: You can only view your own submissions or submissions from your courses' });${CRLF}    }`;

if (content.includes(oldCheck2)) {
  content = content.replace(oldCheck2, newCheck2);
  console.log('Fixed second check (submission by id)');
} else {
  console.log('Second check pattern not found');
}

fs.writeFileSync(path, content);
console.log('Done!');
