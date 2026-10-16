import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'

interface Props {
  content: string
  className?: string
}

export function MarkdownRenderer({ content, className = '' }: Props) {
  return (
    <div className={`markdown-body ${className}`}>
      <style>{`
        /* 外层列表：每条差距项之间拉开间距 */
        .markdown-body ul {
          padding-left: 1.5rem;
          margin-top: 0.5rem;
          margin-bottom: 0.5rem;
        }
        /* 二级嵌套列表（差距说明 / 提升建议） */
        .markdown-body ul ul {
          padding-left: 1rem;
          margin-top: 0.2rem;
          margin-bottom: 0.2rem;
        }
        .markdown-body ul li {
          margin-top: 0.75rem;
        }
        .markdown-body ul ul li {
          margin-top: 0.2rem;
          font-size: 0.95rem;
          color: #444;
        }

        /* ── Code block styling ─────────────────────────────── */
        .markdown-body pre {
          margin: 0.75rem 0;
          padding: 0;
          border-radius: 0.5rem;
          overflow: hidden;
          border: 1px solid #e5e7eb;
          background: #f6f8fa !important;
        }
        .markdown-body pre code.hljs {
          padding: 0.9rem 1rem;
          font-size: 0.8rem;
          line-height: 1.6;
          background: #f6f8fa !important;
          border-radius: 0;
        }
        /* inline code */
        .markdown-body :not(pre) > code {
          background: #f3f4f6;
          color: #d63384;
          padding: 0.1em 0.35em;
          border-radius: 0.25rem;
          font-size: 0.85em;
          border: 1px solid #e9ecef;
        }
      `}</style>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
