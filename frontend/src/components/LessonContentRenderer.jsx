import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import { parseExercises } from '../utils/exercise-parser';

/**
 * LessonContentRenderer - Central markdown renderer for lesson content.
 *
 * Renders markdown with:
 * - GFM (tables, strikethrough, task lists)
 * - Syntax highlighting for code blocks
 * - Raw HTML support (for <details>, etc.)
 * - Custom code block renderer (ExecutableCodeBlock for python/sql)
 * - Interactive exercise and quiz detection and rendering
 *
 * Props:
 * - content: markdown string to render
 * - courseContext: { language } - hints about course type for runtime selection
 * - interactive: boolean - if true, code blocks become executable (default: true)
 * - onExerciseComplete: callback when an inline exercise is completed
 * - exerciseProgress: object mapping exercise indices to their progress
 * - className: additional CSS classes
 */

// Lazy-load heavy components only when needed
const ExecutableCodeBlock = React.lazy(() => import('./ExecutableCodeBlock'));
const InlineQuiz = React.lazy(() => import('./InlineQuiz'));
const InlineExercise = React.lazy(() => import('./InlineExercise'));

/**
 * Recursively extract plain text from React children.
 * rehype-highlight wraps code tokens in <span> elements,
 * so String(children) produces "[object Object]".
 */
function extractText(children) {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (children?.props?.children != null) return extractText(children.props.children);
  return '';
}

function LessonContentRenderer({
  content,
  courseContext = {},
  interactive = true,
  onExerciseComplete,
  exerciseProgress = {},
  className = ''
}) {
  // Strip thinking tokens from LLM output (Qwen3 <think>...</think>)
  const cleanContent = useMemo(() => {
    if (!content) return '';
    return content
      .replace(/<think>[\s\S]*?<\/think>/gi, '')
      .replace(/^\s*\n+/, '')
      .trim();
  }, [content]);

  // Parse exercise sections from markdown content
  const segments = useMemo(() => {
    if (!cleanContent) return [];
    if (!interactive) {
      // Non-interactive mode: render everything as plain markdown
      return [{ type: 'markdown', content: cleanContent }];
    }
    const { segments } = parseExercises(cleanContent);
    return segments;
  }, [cleanContent, interactive]);

  // Custom components for ReactMarkdown
  const components = useMemo(() => ({
    // Custom code block renderer
    code({ node, inline, className: codeClassName, children, ...props }) {
      const match = /language-(\w+)/.exec(codeClassName || '');
      const language = match ? match[1] : '';
      const codeContent = extractText(children).replace(/\n$/, '');

      // Inline code - render normally
      if (inline) {
        return (
          <code className="bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-sm font-mono text-primary-700 dark:text-primary-300" {...props}>
            {children}
          </code>
        );
      }

      // Block code with python or sql language - make executable if interactive
      if (interactive && (language === 'python' || language === 'sql')) {
        return (
          <React.Suspense fallback={
            <pre className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 overflow-x-auto">
              <code className="font-mono text-sm text-gray-100">{codeContent}</code>
            </pre>
          }>
            <ExecutableCodeBlock
              code={codeContent}
              language={language}
              courseContext={courseContext}
            />
          </React.Suspense>
        );
      }

      // Regular code block - styled pre/code
      return (
        <pre className="bg-gray-900 dark:bg-gray-950 rounded-lg p-4 overflow-x-auto my-4 shadow-md">
          <code className={`font-mono text-sm text-gray-100 ${codeClassName || ''}`} {...props}>
            {children}
          </code>
        </pre>
      );
    },

    // Headings
    h1: ({ children }) => (
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mt-8 mb-4 first:mt-0">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mt-6 mb-3">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mt-5 mb-2">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-base font-semibold text-gray-800 dark:text-gray-200 mt-4 mb-2">
        {children}
      </h4>
    ),

    // Paragraphs
    p: ({ children }) => (
      <p className="text-gray-700 dark:text-gray-300 mb-4 leading-relaxed">
        {children}
      </p>
    ),

    // Lists
    ul: ({ children }) => (
      <ul className="list-disc list-inside space-y-1 mb-4 text-gray-700 dark:text-gray-300 ml-2">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside space-y-1 mb-4 text-gray-700 dark:text-gray-300 ml-2">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="text-gray-600 dark:text-gray-400 leading-relaxed">
        {children}
      </li>
    ),

    // Blockquotes
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-primary-500 bg-primary-50 dark:bg-primary-900/20 pl-4 py-2 my-4 text-gray-700 dark:text-gray-300 italic rounded-r-lg">
        {children}
      </blockquote>
    ),

    // Tables
    table: ({ children }) => (
      <div className="overflow-x-auto my-4 rounded-lg border border-gray-200 dark:border-gray-700">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          {children}
        </table>
      </div>
    ),
    thead: ({ children }) => (
      <thead className="bg-gray-50 dark:bg-gray-800">
        {children}
      </thead>
    ),
    th: ({ children }) => (
      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-300 uppercase tracking-wider">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 border-t border-gray-100 dark:border-gray-800">
        {children}
      </td>
    ),

    // Links
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary-600 dark:text-primary-400 hover:underline font-medium"
      >
        {children}
      </a>
    ),

    // Horizontal rule
    hr: () => (
      <hr className="my-6 border-gray-200 dark:border-gray-700" />
    ),

    // Strong / emphasis
    strong: ({ children }) => (
      <strong className="font-semibold text-gray-900 dark:text-white">
        {children}
      </strong>
    ),

    // Images
    img: ({ src, alt }) => (
      <img
        src={src}
        alt={alt}
        className="rounded-lg shadow-md my-4 max-w-full h-auto"
        loading="lazy"
      />
    ),
  }), [interactive, courseContext]);

  if (!cleanContent) {
    return null;
  }

  return (
    <div className={`lesson-content-renderer ${className}`}>
      {segments.map((segment, idx) => {
        if (segment.type === 'markdown') {
          return (
            <ReactMarkdown
              key={idx}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight, rehypeRaw]}
              components={components}
            >
              {segment.content}
            </ReactMarkdown>
          );
        }

        if (segment.type === 'quiz' && segment.questions && segment.questions.length > 0) {
          return (
            <React.Suspense key={idx} fallback={
              <div className="my-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
                <div className="space-y-2">
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
            }>
              <InlineQuiz
                questions={segment.questions}
                exerciseIndex={idx}
                onComplete={onExerciseComplete}
                initialProgress={exerciseProgress[idx]}
              />
            </React.Suspense>
          );
        }

        if (segment.type === 'exercise') {
          return (
            <React.Suspense key={idx} fallback={
              <div className="my-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-3" />
                <div className="h-32 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            }>
              <InlineExercise
                content={segment.content}
                language={segment.language}
                exerciseType={segment.exerciseType}
                courseContext={courseContext}
                exerciseIndex={idx}
                onComplete={onExerciseComplete}
              />
            </React.Suspense>
          );
        }

        // Fallback: render as markdown
        return (
          <ReactMarkdown
            key={idx}
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[rehypeHighlight, rehypeRaw]}
            components={components}
          >
            {segment.content || ''}
          </ReactMarkdown>
        );
      })}
    </div>
  );
}

export default LessonContentRenderer;
