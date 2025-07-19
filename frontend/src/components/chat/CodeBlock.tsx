'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';

interface Props {
  content: string;
}

export function CodeBlock({ content }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, className, children, ...props }) {
          return (
            <SyntaxHighlighter
              style={vscDarkPlus} // 하이라이팅 테마
              language="sql" // 👈 언어를 'sql'로 고정
              PreTag="div"
              {...props}
            >
              {String(children).replace(/\n$/, '')}
            </SyntaxHighlighter>
          );
        },
        p({ node, children }) {
          return <div className="mb-0">{children}</div>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
