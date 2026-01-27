import ReactMarkdown from 'react-markdown';
import remarkBreaks from 'remark-breaks';

import { cn } from '@/lib/utils';

type MinimalMarkdownProps = {
  value: string;
  className?: string;
};

/**
 * Minimal, safe markdown renderer intended for user-authored journal-like text.
 *
 * Supported:
 * - Headings (# ... ######)
 * - Lists (-, *, 1.)
 * - Paragraphs + line breaks
 *
 * Not supported:
 * - Raw HTML, links, images, code blocks, etc.
 */
export function MinimalMarkdown({ value, className }: MinimalMarkdownProps) {
  return (
    <div className={className}>
      <ReactMarkdown
        skipHtml
        remarkPlugins={[remarkBreaks]}
        allowedElements={['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li']}
        unwrapDisallowed
        components={{
          h1: (props) => (
            <h1 {...props} className={cn('mt-4 text-xl font-semibold text-slate-100', props.className)} />
          ),
          h2: (props) => (
            <h2 {...props} className={cn('mt-4 text-lg font-semibold text-slate-100', props.className)} />
          ),
          h3: (props) => (
            <h3 {...props} className={cn('mt-3 text-base font-semibold text-slate-100', props.className)} />
          ),
          h4: (props) => (
            <h4 {...props} className={cn('mt-3 text-sm font-semibold text-slate-100', props.className)} />
          ),
          h5: (props) => (
            <h5 {...props} className={cn('mt-3 text-sm font-semibold text-slate-100', props.className)} />
          ),
          h6: (props) => (
            <h6 {...props} className={cn('mt-3 text-sm font-semibold text-slate-100', props.className)} />
          ),
          ul: (props) => <ul {...props} className={cn('ml-5 list-disc space-y-1', props.className)} />,
          ol: (props) => <ol {...props} className={cn('ml-5 list-decimal space-y-1', props.className)} />,
          li: (props) => <li {...props} className={cn('text-slate-300', props.className)} />,
          p: (props) => <p {...props} className={cn('text-slate-300', props.className)} />
        }}
      >
        {value}
      </ReactMarkdown>
    </div>
  );
}

