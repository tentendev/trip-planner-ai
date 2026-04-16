
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkBreaks from 'remark-breaks';

interface MarkdownRendererProps {
  content: string;
}

// Walk React children and wrap [Context] bracket patterns in highlighted spans.
// Safe: only operates on string text, never renders raw HTML.
const BRACKET_RE = /(\[[^\[\]\n]+?\])/g;
const highlightBrackets = (node: React.ReactNode, keyPrefix = 'ctx'): React.ReactNode => {
  if (node == null || typeof node === 'boolean') return node;
  if (typeof node === 'number') return node;
  if (typeof node === 'string') {
    if (!BRACKET_RE.test(node)) return node;
    const parts = node.split(BRACKET_RE);
    return parts.map((part, i) => {
      if (
        part.length > 2 &&
        part.startsWith('[') &&
        part.endsWith(']') &&
        part !== '[ ]' &&
        part !== '[x]' &&
        part !== '[X]'
      ) {
        return (
          <span key={`${keyPrefix}-${i}`} className="trip-context">
            {part}
          </span>
        );
      }
      return part;
    });
  }
  if (Array.isArray(node)) {
    return node.map((c, i) => highlightBrackets(c, `${keyPrefix}-${i}`));
  }
  return node;
};

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  return (
    <div className="trip-markdown text-slate-700 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkBreaks]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight mt-12 mb-6 first:mt-0 leading-tight">
              {highlightBrackets(children)}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="group text-2xl md:text-[1.75rem] font-bold text-slate-900 tracking-tight mt-14 mb-5 first:mt-0 leading-tight flex items-baseline gap-3 pb-3 border-b border-slate-200/70">
              <span
                className="block w-1 self-stretch bg-gradient-to-b from-blue-500 to-violet-500 rounded-full flex-shrink-0 mt-1"
                aria-hidden
              />
              <span className="flex-1">{highlightBrackets(children)}</span>
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight mt-10 mb-4 leading-snug">
              {highlightBrackets(children)}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-base md:text-lg font-bold text-slate-800 mt-6 mb-3 tracking-tight">
              {highlightBrackets(children)}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="text-sm md:text-base font-bold uppercase tracking-wider text-slate-500 mt-5 mb-2">
              {highlightBrackets(children)}
            </h5>
          ),
          p: ({ children }) => (
            <p className="text-[15px] md:text-base text-slate-700 leading-[1.75] my-4">
              {highlightBrackets(children)}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900">
              {highlightBrackets(children)}
            </strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-800">{highlightBrackets(children)}</em>
          ),
          del: ({ children }) => (
            <del className="text-slate-400 line-through">{highlightBrackets(children)}</del>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 underline decoration-blue-300 decoration-1 underline-offset-[3px] hover:decoration-blue-600 hover:text-blue-700 transition-colors font-medium"
            >
              {highlightBrackets(children)}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const isInline = !/language-/.test(className || '');
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded-md bg-slate-100 text-[0.9em] font-mono text-pink-600 border border-slate-200/60"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={`block ${className || ''}`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto my-5 text-sm font-mono leading-relaxed shadow-inner">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="relative my-6 pl-5 pr-4 py-4 bg-gradient-to-r from-blue-50 to-indigo-50/60 border-l-[3px] border-blue-500 rounded-r-xl text-slate-700 [&_p]:my-1 [&_p]:text-[15px] [&_p]:leading-relaxed">
              {children}
            </blockquote>
          ),
          hr: () => (
            <hr className="my-10 border-0 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
          ),
          ul: ({ children }) => <ul className="my-4 ml-1 space-y-2">{children}</ul>,
          ol: ({ children }) => (
            <ol className="my-4 ml-5 space-y-2 list-decimal marker:text-slate-400 marker:font-semibold">
              {children}
            </ol>
          ),
          li: ({ children, className, ...props }) => {
            const isTask = (className || '').includes('task-list-item');
            if (isTask) {
              return (
                <li
                  className="flex items-start gap-3 my-1.5 list-none text-[15px] text-slate-700 leading-relaxed"
                  {...props}
                >
                  {highlightBrackets(children)}
                </li>
              );
            }
            return (
              <li
                className="relative pl-6 text-[15px] leading-relaxed text-slate-700 before:absolute before:left-1 before:top-[0.65em] before:w-1.5 before:h-1.5 before:rounded-full before:bg-gradient-to-br before:from-blue-500 before:to-violet-500 marker:text-transparent"
                {...props}
              >
                {highlightBrackets(children)}
              </li>
            );
          },
          input: ({ type, checked }) => {
            if (type !== 'checkbox') return null;
            return (
              <span
                aria-hidden
                className={`inline-flex items-center justify-center w-5 h-5 mt-[2px] rounded-md border flex-shrink-0 transition-colors ${
                  checked
                    ? 'bg-blue-600 border-blue-600 text-white shadow-sm shadow-blue-600/30'
                    : 'bg-white border-slate-300'
                }`}
              >
                {checked && (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={3}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                )}
              </span>
            );
          },
          table: ({ children }) => (
            <div className="my-7 -mx-2 md:mx-0 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-8px_rgba(15,23,42,0.08)]">
              <table className="w-full text-sm text-left border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gradient-to-b from-slate-50 to-white border-b border-slate-200/80">
              {children}
            </thead>
          ),
          tbody: ({ children }) => <tbody className="divide-y divide-slate-100">{children}</tbody>,
          tr: ({ children }) => (
            <tr className="transition-colors hover:bg-blue-50/40">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-4 md:px-5 py-3.5 text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-[0.08em] whitespace-nowrap">
              {highlightBrackets(children)}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 md:px-5 py-3.5 align-top text-[14px] md:text-[15px] text-slate-700 leading-[1.6]">
              {highlightBrackets(children)}
            </td>
          ),
          img: ({ src, alt }) => (
            <img src={src} alt={alt} className="rounded-xl my-5 shadow-md max-w-full h-auto" />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;
