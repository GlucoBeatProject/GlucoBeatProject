'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import { CSSProperties } from 'react';

interface Props {
  content: string;
}

interface CodeBlockProps {
  className?: string;
  children?: React.ReactNode;
  [key: string]: any; // 그 외 다른 props를 받을 수 있도록 설정
}

export function CodeBlock({ content }: Props) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, className, style, children, ...props }) {
          return (
            <SyntaxHighlighter
              style={vscDarkPlus as any}
              language="sql"
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
