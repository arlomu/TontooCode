import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

const components: Components = {
  a: ({ node: _node, className, ...props }) => (
    // eslint-disable-next-line jsx-a11y/anchor-has-content
    <a
      {...props}
      target="_blank"
      rel="noreferrer"
      className={cn('text-tt-signal underline decoration-tt-signal/40 underline-offset-2', className)}
    />
  ),
  code: ({ node: _node, className, ...props }) => (
    <code {...props} className={cn('font-mono2 rounded bg-tt-panel px-1 py-0.5 text-[0.82em]', className)} />
  ),
  pre: ({ node: _node, className, children, ...props }) => (
    <pre
      {...props}
      className={cn(
        'font-mono2 overflow-x-auto rounded-lg border border-tt-hairline bg-tt-panel p-3 text-[12.5px] leading-relaxed',
        className,
      )}
    >
      {children}
    </pre>
  ),
  table: ({ node: _node, ...props }) => (
    <div className="overflow-x-auto">
      <table {...props} className="w-full border-collapse text-sm" />
    </div>
  ),
  th: ({ node: _node, ...props }) => (
    <th {...props} className="border-b border-tt-hairline px-2 py-1.5 text-left font-semibold" />
  ),
  td: ({ node: _node, ...props }) => (
    <td {...props} className="border-b border-tt-hairline/60 px-2 py-1.5 align-top" />
  ),
  ul: ({ node: _node, ...props }) => <ul {...props} className="list-disc space-y-1 pl-5" />,
  ol: ({ node: _node, ...props }) => <ol {...props} className="list-decimal space-y-1 pl-5" />,
  h1: ({ node: _node, ...props }) => (
    <h1 {...props} className="font-display text-lg font-bold" />
  ),
  h2: ({ node: _node, ...props }) => (
    <h2 {...props} className="font-display text-[15px] font-bold" />
  ),
  h3: ({ node: _node, ...props }) => <h3 {...props} className="text-sm font-bold" />,
  blockquote: ({ node: _node, ...props }) => (
    <blockquote {...props} className="border-l-2 border-tt-signal/50 pl-3 text-tt-ink-2" />
  ),
  hr: ({ node: _node, ...props }) => <hr {...props} className="border-tt-hairline" />,
  p: ({ node: _node, ...props }) => <p {...props} className="leading-relaxed" />,
};

interface MarkdownProps {
  text: string;
  className?: string;
  streaming?: boolean;
}

/** Assistant body text. `streaming` appends the live caret at the tip. */
export const Markdown = memo(function Markdown({ text, className, streaming }: MarkdownProps) {
  return (
    <div className={cn('space-y-2.5 text-[14px]', streaming && 'tt-caret', className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {text}
      </ReactMarkdown>
    </div>
  );
});
