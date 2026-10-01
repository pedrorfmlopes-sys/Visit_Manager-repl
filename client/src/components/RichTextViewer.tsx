import DOMPurify from 'isomorphic-dompurify';

interface RichTextViewerProps {
  content: string;
  className?: string;
}

export function RichTextViewer({ content, className = '' }: RichTextViewerProps) {
  if (!content) return null;

  // Distinguish between HTML and plain text
  const isHtml = content.includes('<');

  if (isHtml) {
    const sanitizedContent = DOMPurify.sanitize(content, {
      FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form', 'base', 'link'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onmouseout', 'onmousemove', 'onmousedown', 'onmouseup', 'onkeydown', 'onkeypress', 'onkeyup', 'onfocus', 'onblur', 'onchange', 'onsubmit'],
      ALLOW_DATA_ATTR: true,
    });

    return (
      <div
        className={`prose prose-sm dark:prose-invert max-w-none ${className}`}
        dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        data-testid="rich-text-content"
      />
    );
  }

  // Plain text: preserve line breaks
  return (
    <p className={`text-sm text-foreground whitespace-pre-wrap ${className}`} data-testid="rich-text-content">
      {content}
    </p>
  );
}
