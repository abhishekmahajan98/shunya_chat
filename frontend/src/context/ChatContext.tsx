import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getConversations, getConversation, getAgents, type ConversationSummary, type AgentInfo } from '../api';

export interface Citation {
    id: string;
    title: string;
    url?: string;
    page?: number;
    agent?: string;
    detail?: string;
}

export interface ReasoningStep {
    id: string;
    text: string;
    detail?: string;
    status: 'pending' | 'running' | 'complete' | 'failed';
    category?: string;
    /** When set, this tool ran inside a subagent (e.g. "sub agent 1"). */
    via?: string;
}

export interface Attachment {
    id: string;
    name: string;
    type: string;
    url: string;
    size: number;
}

export interface AsyncTask {
    status: 'pending' | 'running' | 'complete' | 'failed';
    progress: number;
    label: string;
}

export interface TodoItem {
    content: string;
    status: 'pending' | 'in_progress' | 'completed' | string;
}

export interface Message {
    id: string;
    type: 'sync' | 'reasoning' | 'async-task';
    sender: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    citations?: Citation[];
    reasoning?: {
        steps: ReasoningStep[];
        isExpanded?: boolean;
    };
    todos?: TodoItem[];
    task?: AsyncTask;
    agents?: string[];
    pending?: boolean;
    attachments?: Attachment[];
    /** When set, this is a compaction notice (expandable summary). */
    compactionSummary?: string;
}

interface ChatContextType {
    messages: Message[];
    addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string;
    updateMessage: (id: string, updates: Partial<Message> | ((prev: Message) => Partial<Message>)) => void;
    insertMessageBefore: (beforeId: string, message: Omit<Message, 'id' | 'timestamp'>) => string;
    removeMessage: (id: string) => void;
    clearMessages: () => void;
    conversationId: string | null;
    setConversationId: (id: string | null) => void;

    availableAgents: AgentInfo[];
    selectedAgentIds: string[];
    toggleAgent: (agentId: string) => void;
    setSelectedAgentIds: (ids: string[]) => void;
    refreshAgents: () => Promise<void>;

    conversations: ConversationSummary[];
    isLoadingHistory: boolean;
    hasMoreHistory: boolean;
    refreshHistory: () => Promise<void>;
    refreshAllData: () => Promise<void>;
    loadMoreHistory: () => Promise<void>;
    loadConversation: (id: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversationId, setConversationId] = useState<string | null>(null);
    const [availableAgents, setAvailableAgents] = useState<AgentInfo[]>([]);
    const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([]);

    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const HISTORY_PAGE_SIZE = 20;

    const refreshHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const data = await getConversations(HISTORY_PAGE_SIZE, 0);
            setConversations(data);
            setHasMoreHistory(data.length === HISTORY_PAGE_SIZE);
        } catch (error) {
            console.error('Failed to load history:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const refreshAgents = async () => {
        try {
            const agents = await getAgents();
            setAvailableAgents(agents);
        } catch (error) {
            console.error('Failed to load agents:', error);
        }
    };

    const refreshAllData = async () => {
        await refreshAgents();
        await refreshHistory();
    };

    useEffect(() => {
        refreshAllData();
    }, []);

    const toggleAgent = (agentId: string) => {
        setSelectedAgentIds((prev) =>
            prev.includes(agentId) ? prev.filter((id) => id !== agentId) : [...prev, agentId]
        );
    };

    const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
        const id = crypto.randomUUID();
        setMessages((prev) => [...prev, { ...message, id, timestamp: new Date() }]);
        return id;
    };

    const updateMessage = (id: string, updates: Partial<Message> | ((prev: Message) => Partial<Message>)) => {
        setMessages((prev) =>
            prev.map((msg) => {
                if (msg.id !== id) return msg;
                const actualUpdates = typeof updates === 'function' ? updates(msg) : updates;
                return { ...msg, ...actualUpdates };
            })
        );
    };

    const insertMessageBefore = (beforeId: string, message: Omit<Message, 'id' | 'timestamp'>) => {
        const id = crypto.randomUUID();
        const row: Message = { ...message, id, timestamp: new Date() };
        setMessages((prev) => {
            const idx = prev.findIndex((m) => m.id === beforeId);
            if (idx < 0) return [...prev, row];
            const next = [...prev];
            next.splice(idx, 0, row);
            return next;
        });
        return id;
    };

    const removeMessage = (id: string) => {
        setMessages((prev) => prev.filter((m) => m.id !== id));
    };

    const loadMoreHistory = async () => {
        if (isLoadingHistory || !hasMoreHistory) return;
        setIsLoadingHistory(true);
        try {
            const data = await getConversations(HISTORY_PAGE_SIZE, conversations.length);
            setConversations((prev) => [...prev, ...data]);
            setHasMoreHistory(data.length === HISTORY_PAGE_SIZE);
        } catch (error) {
            console.error('Failed to load more history:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    const loadConversation = async (id: string) => {
        if (id === conversationId) return;
        setIsLoadingHistory(true);
        try {
            const data = await getConversation(id);
            setConversationId(data.id);
            setMessages(
                data.messages
                    .filter((m) => m.role === 'user' || m.role === 'assistant' || m.role === 'system')
                    .map((msg) => {
                        const kwargs = msg.additional_kwargs || {};
                        const isCompaction = kwargs.kind === 'compaction' || msg.role === 'system';
                        return {
                            id: msg.id,
                            type: 'sync' as const,
                            sender: isCompaction
                                ? ('system' as const)
                                : msg.role === 'user'
                                  ? ('user' as const)
                                  : ('assistant' as const),
                            content: msg.content,
                            timestamp: new Date(msg.created_at),
                            attachments: msg.attachments as Attachment[] | undefined,
                            agents: msg.agents || (kwargs.active_agents as string[] | undefined),
                            todos: (kwargs.todos as TodoItem[] | undefined) || undefined,
                            citations: (kwargs.citations as Citation[] | undefined) || undefined,
                            compactionSummary: isCompaction
                                ? String(kwargs.summary || '')
                                : undefined,
                        };
                    })
            );
        } catch (error) {
            console.error('Failed to load conversation:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (conversationId) refreshHistory();
    }, [conversationId]);

    return (
        <ChatContext.Provider
            value={{
                messages,
                addMessage,
                updateMessage,
                insertMessageBefore,
                removeMessage,
                clearMessages: () => {
                    setMessages([]);
                    refreshHistory();
                },
                conversationId,
                setConversationId,
                availableAgents,
                selectedAgentIds,
                toggleAgent,
                setSelectedAgentIds,
                refreshAgents,
                conversations,
                isLoadingHistory,
                hasMoreHistory,
                refreshHistory,
                refreshAllData,
                loadMoreHistory,
                loadConversation,
            }}
        >
            {children}
        </ChatContext.Provider>
    );
}

export function useChat() {
    const context = useContext(ChatContext);
    if (!context) throw new Error('useChat must be used within a ChatProvider');
    return context;
}
