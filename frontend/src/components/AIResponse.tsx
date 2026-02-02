import React, { useState, memo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { CopyOutlined, CheckOutlined, DownloadOutlined } from '@ant-design/icons';
import 'katex/dist/katex.min.css';

import mermaid from 'mermaid';
import { useEffect, useRef, useId } from 'react';

// Initialize mermaid
mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    securityLevel: 'loose',
    fontFamily: 'Inter, system-ui, sans-serif',
    suppressErrorRendering: true,
});

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

// Mermaid Diagram Component with Error Boundary and Fallback
const MermaidBlock = ({ chart }: { chart: string }) => {
    const id = useId().replace(/:/g, '');
    const containerRef = useRef<HTMLDivElement>(null);
    const [svgContent, setSvgContent] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let isMounted = true;

        const renderChart = async () => {
            try {
                // Reset error state when chart changes (retry rendering)
                setError(null);

                // If chart is empty, do nothing
                if (!chart.trim()) return;

                const { svg } = await mermaid.render(`mermaid-${id}`, chart);

                if (isMounted) {
                    setSvgContent(svg);
                    setError(null);
                }
            } catch (err) {
                // Only log if it's not a parse error (which happens frequently during streaming)
                console.debug('Mermaid render error:', err);
                if (isMounted) {
                    setError(err instanceof Error ? err.message : 'Unknown error');
                }
            }
        };

        // Debounce slightly to allow typing to finish
        const timeout = setTimeout(renderChart, 200);
        return () => {
            isMounted = false;
            clearTimeout(timeout);
        };
    }, [chart, id]);

    // Update innerHTML when svgContent changes
    useEffect(() => {
        if (containerRef.current && svgContent && !error) {
            containerRef.current.innerHTML = svgContent;
        }
    }, [svgContent, error]);

    if (error) {
        // Fallback to showing code block if rendering fails (e.g. invalid syntax or streaming)
        // Show error message only if specifically requested or for debugging, 
        // effectively treating it as a "work in progress" or "raw view"
        return (
            <div style={{ border: '1px solid var(--color-border)', borderRadius: 8, overflow: 'hidden', margin: '16px 0' }}>
                <div style={{ padding: '8px 16px', background: '#2d1a1a', color: '#ff6b6b', fontSize: 12, borderBottom: '1px solid #4a2a2a', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Diagram Preview (Syntax Error)</span>
                </div>
                <CodeBlock language="mermaid" value={chart} />
            </div>
        );
    }

    return (
        <div
            ref={containerRef}
            style={{
                margin: '16px 0',
                textAlign: 'center',
                background: '#1a1a1a',
                padding: 16,
                borderRadius: 8,
                overflowX: 'auto',
                minHeight: 100
            }}
        />
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

// Table Wrapper with CSV Export
const TableWrapper = ({ children, compact }: { children: React.ReactNode, compact: boolean }) => {
    const tableRef = useRef<HTMLTableElement>(null);

    const handleExportCSV = () => {
        if (!tableRef.current) return;

        const rows = Array.from(tableRef.current.querySelectorAll('tr'));
        const csvContent = rows.map(row => {
            const cells = Array.from(row.querySelectorAll('th, td'));
            return cells.map(cell => {
                const text = cell.textContent?.replace(/"/g, '""') || '';
                return `"${text}"`;
            }).join(',');
        }).join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', 'table_export.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div style={{ position: 'relative', margin: compact ? '8px 0' : '16px 0' }}>
            {/* Export Button */}
            <div style={{
                position: 'absolute',
                top: -30,
                right: 0,
                display: 'flex',
                justifyContent: 'flex-end',
                marginBottom: 4,
                zIndex: 10
            }}>
                <button
                    onClick={handleExportCSV}
                    style={{
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--color-text-secondary)',
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
                        e.currentTarget.style.color = 'var(--color-primary)';
                        e.currentTarget.style.background = 'var(--color-surface-hover)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--color-text-secondary)';
                        e.currentTarget.style.background = 'transparent';
                    }}
                    title="Export to CSV"
                >
                    <DownloadOutlined /> Export CSV
                </button>
            </div>

            <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 8 }}>
                <table ref={tableRef} style={{
                    width: '100%',
                    borderCollapse: 'collapse',
                    fontSize: compact ? 12 : 14,
                }}>
                    {children}
                </table>
            </div>
        </div>
    );
};

// Helper to safely extract text from children
const extractText = (children: React.ReactNode): string => {
    if (typeof children === 'string') return children;
    if (Array.isArray(children)) {
        return children.map(child => extractText(child)).join('');
    }
    const childObj = children as any;
    if (typeof children === 'object' && children && childObj.props) {
        return extractText(childObj.props.children);
    }
    return String(children || '');
};

// Main AI Response Component
const AIResponse = ({ content, compact = false }: AIResponseProps) => {
    return (
        <div className={`ai-response ${compact ? 'compact' : ''}`} style={{ lineHeight: compact ? 1.5 : 1.6, fontSize: compact ? 13 : undefined }}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    // Code blocks and inline code
                    code({ node, className, children, ...props }: any) {
                        const match = /language-(\w+)/.exec(className || '');
                        const language = match ? match[1] : '';

                        // Use safe extraction instead of String(children) to avoid commas
                        const codeString = extractText(children).replace(/\n$/, '');

                        // Detect if inline based on whether it has multiple lines or a language
                        const isInline = !match && !codeString.includes('\n');

                        // Block code with syntax highlighting
                        if (!isInline) {
                            if (language === 'mermaid') {
                                return <MermaidBlock chart={codeString} />;
                            }

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
                        return <TableWrapper compact={compact}>{children}</TableWrapper>;
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

export default memo(AIResponse);
