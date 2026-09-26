import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getConversations, getConversation, type ConversationSummary } from '../api';

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

    conversations: ConversationSummary[];
    isLoadingHistory: boolean;
    hasMoreHistory: boolean;
    refreshHistory: () => Promise<void>;
    refreshAllData: () => Promise<void>;
    loadMoreHistory: () => Promise<void>;
    loadConversation: (id: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
    children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversationId, setConversationId] = useState<string | null>(null);

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
        await refreshHistory();
    };

    useEffect(() => {
        refreshAllData();
    }, []);

    const addMessage = (message: Omit<Message, 'id' | 'timestamp'>) => {
        const id = crypto.randomUUID();
        const newMessage: Message = {
            ...message,
            id,
            timestamp: new Date(),
        };
        setMessages((prev) => [...prev, newMessage]);
        return id;
    };

    const updateMessage = (id: string, updates: Partial<Message> | ((prev: Message) => Partial<Message>)) => {
        setMessages((prev) =>
            prev.map((msg) => {
                if (msg.id === id) {
                    const actualUpdates = typeof updates === 'function' ? updates(msg) : updates;
                    return { ...msg, ...actualUpdates };
                }
                return msg;
            })
        );
    };

    const loadMoreHistory = async () => {
        if (isLoadingHistory || !hasMoreHistory) return;
        setIsLoadingHistory(true);
        try {
            const data = await getConversations(HISTORY_PAGE_SIZE, conversations.length);
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
            const uiMessages: Message[] = data.messages.map(msg => ({
                id: msg.id,
                type: msg.reasoning ? 'reasoning' : 'sync',
                sender: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content,
                timestamp: new Date(msg.created_at),
                attachments: msg.attachments as Attachment[] | undefined,
                reasoning: msg.reasoning,
                citations: msg.citations,
                agents: msg.agents,
            }));
            setMessages(uiMessages);
        } catch (error) {
            console.error('Failed to load conversation:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    useEffect(() => {
        if (conversationId) {
            refreshHistory();
        }
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
    if (!context) {
        throw new Error('useChat must be used within a ChatProvider');
    }
    return context;
}
