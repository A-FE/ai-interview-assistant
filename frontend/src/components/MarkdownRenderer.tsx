import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

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
          margin-top: 0.75rem; /* 每个主差距条目之间留白 */
        }
        .markdown-body ul ul li {
          margin-top: 0.2rem;
          font-size: 0.95rem;
          color: #444;
        }
      `}</style>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )
}
