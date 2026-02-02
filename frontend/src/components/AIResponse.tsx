import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import 'katex/dist/katex.min.css';

interface AIResponseProps {
    content: string;
    compact?: boolean;
}

// Code Block with Copy Button and Language Header
const CodeBlock = ({
    language,
    value
}: {
    language: string;
    value: string;
}) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div style={{
            position: 'relative',
            margin: '12px 0',
            borderRadius: 8,
            overflow: 'hidden',
            border: '1px solid var(--color-border)',
        }}>
            {/* Header with Language & Copy Button */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '8px 16px',
                backgroundColor: '#1e1e1e',
                color: '#9d9d9d',
                fontSize: 12,
                borderBottom: '1px solid #333',
            }}>
                <span style={{
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                }}>
                    {language || 'code'}
                </span>
                <button
                    onClick={handleCopy}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: copied ? '#52c41a' : '#9d9d9d',
                        cursor: 'pointer',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        borderRadius: 4,
                        transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                        if (!copied) e.currentTarget.style.color = '#fff';
                    }}
                    onMouseLeave={(e) => {
                        if (!copied) e.currentTarget.style.color = '#9d9d9d';
                    }}
                >
                    {copied ? (
                        <><CheckOutlined /> Copied!</>
                    ) : (
                        <><CopyOutlined /> Copy</>
                    )}
                </button>
            </div>

            {/* Syntax Highlighted Code */}
            <SyntaxHighlighter
                language={language || 'text'}
                style={vscDarkPlus}
                customStyle={{
                    margin: 0,
                    borderRadius: 0,
                    fontSize: 13,
                    lineHeight: 1.5,
                }}
                showLineNumbers={value.split('\n').length > 3}
                wrapLongLines={true}
            >
                {value}
            </SyntaxHighlighter>
        </div>
    );
};

// Inline Code (for `code` in the middle of text)
const InlineCode = ({ children }: { children: React.ReactNode }) => (
    <code style={{
        background: 'var(--color-surface-hover)',
        color: 'var(--color-primary)',
        padding: '2px 6px',
        borderRadius: 4,
        fontSize: '0.9em',
        fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace',
    }}>
        {children}
    </code>
);

// Main AI Response Component
const AIResponse = ({ content, compact = false }: AIResponseProps) => {
    return (
        <div className={`ai-response ${compact ? 'compact' : ''}`} style={{ lineHeight: compact ? 1.5 : 1.6, fontSize: compact ? 13 : undefined }}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    // Code blocks and inline code
                    code({ node, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const language = match ? match[1] : '';
                        const codeString = String(children).replace(/\n$/, '');

                        // Detect if inline based on whether it has multiple lines or a language
                        const isInline = !match && !codeString.includes('\n');

                        // Block code with syntax highlighting
                        if (!isInline) {
                            return (
                                <CodeBlock
                                    language={language}
                                    value={codeString}
                                />
                            );
                        }

                        // Inline code
                        return <InlineCode {...props}>{children}</InlineCode>;
                    },

                    // Styled paragraphs
                    p({ children }) {
                        return (
                            <p style={{
                                margin: compact ? '6px 0' : '12px 0',
                                lineHeight: compact ? 1.5 : 1.7,
                            }}>
                                {children}
                            </p>
                        );
                    },

                    // Headers
                    h1({ children }) {
                        return (
                            <h1 style={{
                                fontSize: compact ? 16 : 24,
                                fontWeight: 700,
                                margin: compact ? '12px 0 8px' : '20px 0 12px',
                                borderBottom: '1px solid var(--color-border)',
                                paddingBottom: 8,
                            }}>
                                {children}
                            </h1>
                        );
                    },
                    h2({ children }) {
                        return (
                            <h2 style={{
                                fontSize: compact ? 15 : 20,
                                fontWeight: 600,
                                margin: compact ? '10px 0 6px' : '18px 0 10px',
                            }}>
                                {children}
                            </h2>
                        );
                    },
                    h3({ children }) {
                        return (
                            <h3 style={{
                                fontSize: compact ? 14 : 16,
                                fontWeight: 600,
                                margin: compact ? '8px 0 4px' : '16px 0 8px',
                            }}>
                                {children}
                            </h3>
                        );
                    },

                    // Lists
                    ul({ children }) {
                        return (
                            <ul style={{
                                margin: compact ? '6px 0' : '12px 0',
                                paddingLeft: 24,
                            }}>
                                {children}
                            </ul>
                        );
                    },
                    ol({ children }) {
                        return (
                            <ol style={{
                                margin: compact ? '6px 0' : '12px 0',
                                paddingLeft: 24,
                            }}>
                                {children}
                            </ol>
                        );
                    },
                    li({ children }) {
                        return (
                            <li style={{
                                margin: compact ? '2px 0' : '6px 0',
                                lineHeight: compact ? 1.4 : 1.6,
                            }}>
                                {children}
                            </li>
                        );
                    },

                    // Blockquotes
                    blockquote({ children }) {
                        return (
                            <blockquote style={{
                                margin: compact ? '8px 0' : '12px 0',
                                padding: compact ? '8px 12px' : '12px 16px',
                                borderLeft: '4px solid var(--color-primary)',
                                background: 'var(--color-surface)',
                                borderRadius: '0 8px 8px 0',
                                fontStyle: 'italic',
                                color: 'var(--color-text-secondary)',
                                fontSize: compact ? '0.95em' : undefined,
                            }}>
                                {children}
                            </blockquote>
                        );
                    },

                    // Links
                    a({ children, href }) {
                        return (
                            <a
                                href={href}
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{
                                    color: 'var(--color-primary)',
                                    textDecoration: 'none',
                                    borderBottom: '1px solid transparent',
                                    transition: 'border-color 0.2s ease',
                                }}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.borderBottomColor = 'var(--color-primary)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.borderBottomColor = 'transparent';
                                }}
                            >
                                {children}
                            </a>
                        );
                    },

                    // Tables (GFM)
                    table({ children }) {
                        return (
                            <div style={{ overflowX: 'auto', margin: compact ? '8px 0' : '12px 0' }}>
                                <table style={{
                                    width: '100%',
                                    borderCollapse: 'collapse',
                                    fontSize: compact ? 12 : 14,
                                }}>
                                    {children}
                                </table>
                            </div>
                        );
                    },
                    th({ children }) {
                        return (
                            <th style={{
                                padding: compact ? '6px 8px' : '10px 12px',
                                textAlign: 'left',
                                borderBottom: '2px solid var(--color-border)',
                                fontWeight: 600,
                                background: 'var(--color-surface)',
                            }}>
                                {children}
                            </th>
                        );
                    },
                    td({ children }) {
                        return (
                            <td style={{
                                padding: compact ? '6px 8px' : '10px 12px',
                                borderBottom: '1px solid var(--color-border)',
                            }}>
                                {children}
                            </td>
                        );
                    },

                    // Horizontal rule
                    hr() {
                        return (
                            <hr style={{
                                border: 'none',
                                borderTop: '1px solid var(--color-border)',
                                margin: compact ? '12px 0' : '20px 0',
                            }} />
                        );
                    },

                    // Strong and emphasis
                    strong({ children }) {
                        return <strong style={{ fontWeight: 600 }}>{children}</strong>;
                    },
                    em({ children }) {
                        return <em style={{ fontStyle: 'italic' }}>{children}</em>;
                    },
                }}
            >
                {content}
            </ReactMarkdown>
        </div>
    );
};

export default AIResponse;
