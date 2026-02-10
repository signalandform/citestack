import ReactMarkdown from 'react-markdown';

const proseClasses = {
  h1: 'mt-6 text-xl font-semibold text-[var(--fg-default)] first:mt-0',
  h2: 'mt-6 text-lg font-semibold text-[var(--fg-default)]',
  h3: 'mt-4 text-base font-medium text-[var(--fg-default)]',
  p: 'mt-2 text-sm text-[var(--fg-default)]',
  ul: 'mt-2 list-inside list-disc space-y-1 text-sm text-[var(--fg-default)]',
  ol: 'mt-2 list-inside list-decimal space-y-1 text-sm text-[var(--fg-default)]',
  li: 'text-[var(--fg-default)]',
  blockquote: 'mt-2 border-l-2 border-[var(--border-default)] pl-4 text-sm text-[var(--fg-muted)] italic',
  a: 'text-[var(--accent)] underline hover:no-underline',
  strong: 'font-medium text-[var(--fg-default)]',
};

export function LegalMarkdown({ content }: { content: string }) {
  return (
    <div className="legal-prose">
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className={proseClasses.h1}>{children}</h1>,
          h2: ({ children }) => <h2 className={proseClasses.h2}>{children}</h2>,
          h3: ({ children }) => <h3 className={proseClasses.h3}>{children}</h3>,
          p: ({ children }) => <p className={proseClasses.p}>{children}</p>,
          ul: ({ children }) => <ul className={proseClasses.ul}>{children}</ul>,
          ol: ({ children }) => <ol className={proseClasses.ol}>{children}</ol>,
          li: ({ children }) => <li className={proseClasses.li}>{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className={proseClasses.blockquote}>{children}</blockquote>
          ),
          a: ({ href, children }) => (
            <a href={href} className={proseClasses.a} target="_self" rel="noopener noreferrer">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className={proseClasses.strong}>{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
