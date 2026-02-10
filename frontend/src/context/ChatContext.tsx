import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { toggleAgentFavorite as apiToggleFavorite, getConversations, getConversation, type ConversationSummary } from '../api';
import { useAuth } from './AuthContext';

// Types
export interface User {
    id: string;
    name: string;
    email: string;
    avatar?: string;
}

export type MemberRole = 'viewer' | 'editor' | 'admin';

export interface SpaceMember {
    userId: string;
    user: User;
    role: MemberRole;
    addedAt: Date;
}

export interface SpaceItem {
    id: string;
    name: string;
    type: 'folder' | 'document';
    status?: 'processing' | 'completed' | 'error';
    size?: number; // in KB
    children?: SpaceItem[];
}

export interface Space {
    id: string;
    name: string;
    icon: string;
    isPinned: boolean;
    isPersonal?: boolean;
    type: 'personal' | 'shared';
    documentCount: number;
    children?: SpaceItem[];
    ownerId: string;
    owner?: User;
    members?: SpaceMember[];
}

export type AgentCategory = 'research' | 'compliance' | 'finance' | 'automation';

export interface Agent {
    id: string;
    name: string;
    icon: string;
    description: string;
    category: AgentCategory;
    isFavorite: boolean;
    isActive: boolean;
    isBackground?: boolean;
    hasAccess: boolean;
}

export interface ScopeSelection {
    spaceId: string;
    spaceName: string;
    selectedItems: { id: string; name: string; type: 'folder' | 'document' }[];
}

export interface Citation {
    id: string;
    title: string;
    page?: number;
}

export interface ReasoningStep {
    id: string;
    text: string;
    status: 'pending' | 'running' | 'complete' | 'failed';
}

export interface AsyncTask {
    status: 'pending' | 'running' | 'complete' | 'failed';
    progress: number;
    label: string;
}

export interface BackgroundTask {
    id: string;
    agentId: string;
    agentName: string;
    query: string;
    status: 'running' | 'complete';
    progress: number;
    willEmail: boolean;
    completedAt?: Date;
}

export interface Attachment {
    id: string;
    name: string;
    type: string;
    url: string;
    size: number;
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

// Context Type
interface ChatContextType {
    // Spaces
    spaces: Space[];
    selectedScope: ScopeSelection | null;
    setSelectedScope: (scope: ScopeSelection | null) => void;
    toggleSpacePin: (spaceId: string) => void;
    spaceSearch: string;
    setSpaceSearch: (search: string) => void;

    // Space Management
    addSpaceMember: (spaceId: string, userId: string, role: MemberRole) => void;
    removeSpaceMember: (spaceId: string, userId: string) => void;
    updateMemberRole: (spaceId: string, userId: string, newRole: MemberRole) => void;
    addDocumentToSpace: (spaceId: string, document: SpaceItem, parentId?: string) => void;
    uploadDocument: (spaceId: string, file: File, parentId?: string) => Promise<void>;
    createFolder: (spaceId: string, name: string, parentId?: string) => Promise<void>;
    removeDocumentFromSpace: (spaceId: string, documentId: string) => void;
    updateSpace: (spaceId: string, updates: Partial<Space>) => void;

    // Agents
    agents: Agent[];
    toggleAgent: (agentId: string) => void;
    toggleAgentFavorite: (agentId: string) => void;
    activeAgents: Agent[];
    agentSearch: string;
    setAgentSearch: (search: string) => void;

    // Background Tasks
    backgroundTasks: BackgroundTask[];
    addBackgroundTask: (task: Omit<BackgroundTask, 'id'>) => string;
    updateBackgroundTask: (id: string, updates: Partial<BackgroundTask>) => void;

    // Messages
    messages: Message[];
    addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string;
    updateMessage: (id: string, updates: Partial<Message> | ((prev: Message) => Partial<Message>)) => void;
    clearMessages: () => void;
    conversationId: string | null;
    setConversationId: (id: string | null) => void;

    // History
    conversations: ConversationSummary[];
    isLoadingHistory: boolean;
    hasMoreHistory: boolean;
    refreshHistory: () => Promise<void>;
    loadMoreHistory: () => Promise<void>;
    loadConversation: (id: string) => Promise<void>;

    // UI Helpers (if needed by context consumers)
    sidebarTab: 'chats' | 'spaces';
    setSidebarTab: (tab: 'chats' | 'spaces') => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
    children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
    const { isAuthenticated } = useAuth();

    // Spaces state
    const [spaces, setSpaces] = useState<Space[]>([]);
    const [selectedScope, setSelectedScope] = useState<ScopeSelection | null>(null);
    const [spaceSearch, setSpaceSearch] = useState('');

    // Agents state
    const [agents, setAgents] = useState<Agent[]>([]);
    const [agentSearch, setAgentSearch] = useState('');

    // UI State
    const [sidebarTab, setSidebarTab] = useState<'chats' | 'spaces'>('chats');

    // Background tasks
    const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);

    // Messages
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversationId, setConversationId] = useState<string | null>(null);

    // History
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

    const fetchInitialData = async () => {
        const { getSpaces, getAgents } = await import('../api');

        // 1. Fetch Spaces
        try {
            const backendSpaces = await getSpaces();
            const mappedSpaces: Space[] = backendSpaces.map(s => ({
                id: s.id,
                name: s.name,
                icon: s.type === 'personal' ? 'user' : 'folder',
                isPinned: false,
                isPersonal: s.type === 'personal',
                type: s.type || 'shared',
                documentCount: 0,
                ownerId: s.owner_id,
            }));
            setSpaces(mappedSpaces);
        } catch (error) {
            console.error('Failed to fetch spaces:', error);
        }

        // 2. Fetch Agents
        try {
            const backendAgents = await getAgents();
            const mergedAgents: Agent[] = backendAgents.map(a => ({
                id: a.id,
                name: a.name,
                icon: a.icon,
                description: a.description,
                category: a.category,
                isFavorite: a.isFavorite,
                isActive: false,
                hasAccess: a.hasAccess,
            }));
            setAgents(mergedAgents);
        } catch (error) {
            console.error('Failed to fetch agents:', error);
        }

        // 3. Refresh history
        await refreshHistory();
    };

    useEffect(() => {
        if (isAuthenticated) {
            fetchInitialData();
        }
    }, [isAuthenticated]);

    const toggleSpacePin = (spaceId: string) => {
        setSpaces((prev) =>
            prev.map((space) =>
                space.id === spaceId ? { ...space, isPinned: !space.isPinned } : space
            )
        );
    };

    const toggleAgent = (agentId: string) => {
        setAgents((prev) =>
            prev.map((agent) =>
                agent.id === agentId ? { ...agent, isActive: !agent.isActive } : agent
            )
        );
    };

    const toggleAgentFavorite = async (agentId: string) => {
        setAgents((prev) =>
            prev.map((agent) =>
                agent.id === agentId ? { ...agent, isFavorite: !agent.isFavorite } : agent
            )
        );

        try {
            await apiToggleFavorite(agentId);
        } catch (error) {
            console.error('Failed to toggle favorite:', error);
            setAgents((prev) =>
                prev.map((agent) =>
                    agent.id === agentId ? { ...agent, isFavorite: !agent.isFavorite } : agent
                )
            );
        }
    };

    const activeAgents = agents.filter((a) => a.isActive);

    const addBackgroundTask = (task: Omit<BackgroundTask, 'id'>) => {
        const id = crypto.randomUUID();
        setBackgroundTasks((prev) => [...prev, { ...task, id }]);
        return id;
    };

    const updateBackgroundTask = (id: string, updates: Partial<BackgroundTask>) => {
        setBackgroundTasks((prev) =>
            prev.map((task) => (task.id === id ? { ...task, ...updates } : task))
        );
    };

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

    const addSpaceMember = (_spaceId: string, _userId: string, _role: MemberRole) => { };
    const removeSpaceMember = (_spaceId: string, _userId: string) => { };
    const updateMemberRole = (_spaceId: string, _userId: string, _newRole: MemberRole) => { };

    const addDocumentToSpace = (_spaceId: string, _document: SpaceItem, _parentId?: string) => { };

    const uploadDocument = async (spaceId: string, file: File, parentId?: string) => {
        try {
            const { uploadDocumentToSpace } = await import('../api');
            await uploadDocumentToSpace(spaceId, file, parentId);
            await fetchInitialData();
        } catch (error) {
            console.error('Failed to upload document:', error);
            throw error;
        }
    };

    const createFolder = async (spaceId: string, name: string, parentId?: string) => {
        try {
            const { createFolder: apiCreateFolder } = await import('../api');
            await apiCreateFolder(spaceId, name, parentId);
            await fetchInitialData();
        } catch (error) {
            console.error('Failed to create folder:', error);
            throw error;
        }
    };

    const removeDocumentFromSpace = async (spaceId: string, documentId: string) => {
        try {
            const { deleteDocument } = await import('../api');
            await deleteDocument(spaceId, documentId);
            await fetchInitialData();
        } catch (error) {
            console.error('Failed to remove document:', error);
            throw error;
        }
    };

    const updateSpace = (spaceId: string, updates: Partial<Space>) => {
        setSpaces((prev) =>
            prev.map((space) =>
                space.id === spaceId ? { ...space, ...updates } : space
            )
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
                attachments: msg.attachments as any,
                reasoning: msg.reasoning,
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
                spaces,
                selectedScope,
                setSelectedScope,
                toggleSpacePin,
                spaceSearch,
                setSpaceSearch,
                addSpaceMember,
                removeSpaceMember,
                updateMemberRole,
                addDocumentToSpace,
                uploadDocument,
                createFolder,
                removeDocumentFromSpace,
                updateSpace,
                agents,
                toggleAgent,
                toggleAgentFavorite,
                activeAgents,
                agentSearch,
                setAgentSearch,
                backgroundTasks,
                addBackgroundTask,
                updateBackgroundTask,
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
                loadMoreHistory,
                loadConversation,
                sidebarTab,
                setSidebarTab,
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
