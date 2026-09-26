import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getConversations, getConversation, getAssistants, type ConversationSummary, type Assistant } from '../api';

export interface Citation {
    id: string;
    title: string;
    url?: string;
    page?: number;
}

export interface ReasoningStep {
    id: string;
    text: string;
    status: 'pending' | 'running' | 'complete' | 'failed';
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

    assistants: Assistant[];
    selectedAssistantId: string | null;
    setSelectedAssistantId: (id: string | null) => void;

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
    const [assistants, setAssistants] = useState<Assistant[]>([]);
    const [selectedAssistantId, setSelectedAssistantId] = useState<string | null>(null);

    const [conversations, setConversations] = useState<ConversationSummary[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [hasMoreHistory, setHasMoreHistory] = useState(true);
    const HISTORY_PAGE_SIZE = 20;

    const refreshHistory = async () => {
        setIsLoadingHistory(true);
        try {
            const data = await getConversations(HISTORY_PAGE_SIZE, 0, selectedAssistantId || undefined);
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
            const list = await getAssistants();
            setAssistants(list);
            if (!selectedAssistantId && list.length > 0) {
                setSelectedAssistantId(list[0].id);
            }
        } catch (error) {
            console.error('Failed to load assistants:', error);
        }
        await refreshHistory();
    };

    useEffect(() => {
        refreshAllData();
    }, []);

    useEffect(() => {
        refreshHistory();
    }, [selectedAssistantId]);

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
            const data = await getConversations(HISTORY_PAGE_SIZE, conversations.length, selectedAssistantId || undefined);
            setConversations(prev => [...prev, ...data]);
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
            if (data.assistant_id) setSelectedAssistantId(data.assistant_id);
            setMessages(
                data.messages
                    .filter(m => m.role === 'user' || m.role === 'assistant')
                    .map(msg => ({
                        id: msg.id,
                        type: 'sync' as const,
                        sender: msg.role === 'user' ? 'user' as const : 'assistant' as const,
                        content: msg.content,
                        timestamp: new Date(msg.created_at),
                        attachments: msg.attachments as Attachment[] | undefined,
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
                assistants,
                selectedAssistantId,
                setSelectedAssistantId,
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
