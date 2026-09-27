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
    /** When set, this tool ran inside a subagent (e.g. verifier / gatherer). */
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
    sender: 'user' | 'assistant';
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
}

interface ChatContextType {
    messages: Message[];
    addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string;
    updateMessage: (id: string, updates: Partial<Message> | ((prev: Message) => Partial<Message>)) => void;
    clearMessages: () => void;
    conversationId: string | null;
    setConversationId: (id: string | null) => void;

    availableAgents: AgentInfo[];
    selectedAgentIds: string[];
    toggleAgent: (agentId: string) => void;
    setSelectedAgentIds: (ids: string[]) => void;

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

    const refreshAllData = async () => {
        try {
            const agents = await getAgents();
            setAvailableAgents(agents);
        } catch (error) {
            console.error('Failed to load agents:', error);
        }
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
                    .filter((m) => m.role === 'user' || m.role === 'assistant')
                    .map((msg) => ({
                        id: msg.id,
                        type: 'sync' as const,
                        sender: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
                        content: msg.content,
                        timestamp: new Date(msg.created_at),
                        attachments: msg.attachments as Attachment[] | undefined,
                        agents: msg.agents || (msg.additional_kwargs?.active_agents as string[] | undefined),
                        todos: (msg.additional_kwargs?.todos as TodoItem[] | undefined) || undefined,
                        citations: (msg.additional_kwargs?.citations as Citation[] | undefined) || undefined,
                    }))
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
