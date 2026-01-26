const fs = require('fs');
const filePath = 'C:/Users/gonza/claude-projects/frontend/src/pages/ForumPage.jsx';
let content = fs.readFileSync(filePath, 'utf8');

// Replace title error to add role=alert and aria-live
const oldTitleError = `{fieldErrors.title && (
                  <p id="title-error" className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {fieldErrors.title}
                  </p>
                )}`;

const newTitleError = `{fieldErrors.title && (
                  <p
                    id="title-error"
                    className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1"
                    role="alert"
                    aria-live="polite"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {fieldErrors.title}
                  </p>
                )}`;

content = content.replace(oldTitleError, newTitleError);

// Replace content error to add role=alert and aria-live
const oldContentError = `{fieldErrors.content && (
                  <p id="content-error" className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {fieldErrors.content}
                  </p>
                )}`;

const newContentError = `{fieldErrors.content && (
                  <p
                    id="content-error"
                    className="mt-1 text-sm text-red-500 dark:text-red-400 flex items-center gap-1"
                    role="alert"
                    aria-live="polite"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {fieldErrors.content}
                  </p>
                )}`;

content = content.replace(oldContentError, newContentError);

fs.writeFileSync(filePath, content);
console.log('ForumPage.jsx updated with accessibility attributes');
