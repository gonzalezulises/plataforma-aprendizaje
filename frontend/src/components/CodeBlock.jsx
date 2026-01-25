import React, { useState } from 'react';

/**
 * CodeBlock component for displaying code snippets with syntax highlighting
 * Uses JetBrains Mono font as specified in the design system
 */
function CodeBlock({ code, language = 'python', showLineNumbers = true, title = null }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const lines = code.split('\n');

  return (
    <div className="rounded-lg overflow-hidden shadow-lg my-4">
      {/* Header bar */}
      <div className="bg-gray-800 dark:bg-gray-700 px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Traffic light dots */}
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500" />
            <div className="w-3 h-3 rounded-full bg-yellow-500" />
            <div className="w-3 h-3 rounded-full bg-green-500" />
          </div>
          {title && (
            <span className="ml-4 text-sm text-gray-400 font-mono">{title}</span>
          )}
          <span className="ml-2 text-xs text-gray-500 font-mono uppercase">{language}</span>
        </div>
        <button
          onClick={handleCopy}
          className="text-gray-400 hover:text-white transition-colors text-sm flex items-center gap-1"
        >
          {copied ? (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Copiado!
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Copiar
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      <pre className="bg-gray-900 dark:bg-gray-950 p-4 overflow-x-auto">
        <code className="font-mono text-sm text-gray-100 leading-relaxed">
          {showLineNumbers ? (
            <table className="w-full">
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td className="text-gray-500 select-none pr-4 text-right w-8 font-mono">
                      {index + 1}
                    </td>
                    <td className="font-mono whitespace-pre">{line || ' '}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <span className="font-mono whitespace-pre">{code}</span>
          )}
        </code>
      </pre>
    </div>
  );
}

export default CodeBlock;
