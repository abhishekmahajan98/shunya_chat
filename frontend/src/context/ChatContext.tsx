import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getAgents, toggleAgentFavorite as apiToggleFavorite, getConversations, getConversation, type ConversationSummary } from '../api';
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
    size?: number; // in KB
    children?: SpaceItem[];
}

export interface Space {
    id: string;
    name: string;
    icon: string;
    isPinned: boolean;
    isPersonal?: boolean;
    documentCount: number;
    children?: SpaceItem[];
    ownerId?: string;       // undefined for personal space
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
    status: 'pending' | 'running' | 'complete';
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

// Mock Data - Personal Space with folder hierarchy
const personalSpaceChildren: SpaceItem[] = [
    {
        id: 'folder-work',
        name: 'Work',
        type: 'folder',
        children: [
            { id: 'doc-q4-report', name: 'Q4 Report.pdf', type: 'document' },
            { id: 'doc-budget', name: 'Budget 2024.xlsx', type: 'document' },
            { id: 'doc-meeting-notes', name: 'Meeting Notes.md', type: 'document' },
        ],
    },
    {
        id: 'folder-research',
        name: 'Research',
        type: 'folder',
        children: [
            { id: 'doc-market-analysis', name: 'Market Analysis.pdf', type: 'document' },
            { id: 'doc-competitor', name: 'Competitor Review.docx', type: 'document' },
        ],
    },
    {
        id: 'folder-personal',
        name: 'Personal',
        type: 'folder',
        children: [
            { id: 'doc-notes', name: 'Quick Notes.md', type: 'document' },
        ],
    },
    { id: 'doc-readme', name: 'README.md', type: 'document' },
];

// Mock Users
export const mockUsers: User[] = [
    { id: 'current-user', name: 'You', email: 'you@company.com' },
    { id: 'alice', name: 'Alice Smith', email: 'alice@company.com' },
    { id: 'bob', name: 'Bob Johnson', email: 'bob@company.com' },
    { id: 'carol', name: 'Carol White', email: 'carol@company.com' },
    { id: 'david', name: 'David Lee', email: 'david@company.com' },
    { id: 'emma', name: 'Emma Davis', email: 'emma@company.com' },
];

const currentUser = mockUsers[0];
const alice = mockUsers[1];
const bob = mockUsers[2];
const carol = mockUsers[3];

const mockSpaces: Space[] = [
    { id: 'personal', name: 'Personal Space', icon: 'user', isPinned: true, isPersonal: true, documentCount: 8, children: personalSpaceChildren },
    {
        id: 'q4-reports',
        name: 'Q4 Reports',
        icon: 'bar-chart',
        isPinned: true,
        documentCount: 15,
        ownerId: 'current-user',
        owner: currentUser,
        members: [
            { userId: 'alice', user: alice, role: 'editor', addedAt: new Date('2024-10-01') },
            { userId: 'bob', user: bob, role: 'viewer', addedAt: new Date('2024-10-15') },
        ],
        children: [
            { id: 'doc-q4-summary', name: 'Q4 Summary.pdf', type: 'document', size: 245 },
            { id: 'doc-revenue', name: 'Revenue Report.xlsx', type: 'document', size: 128 },
            { id: 'doc-projections', name: 'Projections.docx', type: 'document', size: 89 },
        ],
    },
    {
        id: 'legal',
        name: 'Legal Documents',
        icon: 'safety',
        isPinned: false,
        documentCount: 42,
        ownerId: 'alice',
        owner: alice,
        members: [
            { userId: 'current-user', user: currentUser, role: 'viewer', addedAt: new Date('2024-09-01') },
        ],
    },
    {
        id: 'marketing',
        name: 'Marketing Analytics',
        icon: 'line-chart',
        isPinned: false,
        documentCount: 28,
        ownerId: 'current-user',
        owner: currentUser,
        members: [
            { userId: 'carol', user: carol, role: 'admin', addedAt: new Date('2024-08-01') },
            { userId: 'bob', user: bob, role: 'editor', addedAt: new Date('2024-08-15') },
        ],
    },
    { id: 'client-portfolios', name: 'Client Portfolios', icon: 'wallet', isPinned: false, documentCount: 156, ownerId: 'current-user', owner: currentUser },
    { id: 'compliance', name: 'Compliance Records', icon: 'check-circle', isPinned: false, documentCount: 89, ownerId: 'current-user', owner: currentUser },
    { id: 'hr', name: 'HR Policies', icon: 'team', isPinned: false, documentCount: 34, ownerId: 'alice', owner: alice, members: [{ userId: 'bob', user: bob, role: 'admin', addedAt: new Date() }] },
    { id: 'finance', name: 'Financial Statements', icon: 'dollar', isPinned: false, documentCount: 67, ownerId: 'current-user', owner: currentUser },
    {
        id: 'engineering',
        name: 'Engineering Team',
        icon: 'code',
        isPinned: false,
        documentCount: 120,
        ownerId: 'bob',
        owner: bob,
        members: [
            { userId: 'alice', user: alice, role: 'editor', addedAt: new Date() },
            { userId: 'carol', user: carol, role: 'viewer', addedAt: new Date() }
        ]
    },
    { id: 'audit', name: 'Audit Trail', icon: 'audit', isPinned: false, documentCount: 203, ownerId: 'bob', owner: bob },
    { id: 'contracts', name: 'Contracts', icon: 'file-text', isPinned: false, documentCount: 78, ownerId: 'current-user', owner: currentUser },
];

// Note: Agents are now fetched from backend API in ChatProvider

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
    updateMessage: (id: string, updates: Partial<Message>) => void;
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
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
    children: ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
    // Spaces state
    const [spaces, setSpaces] = useState<Space[]>(mockSpaces);
    const [selectedScope, setSelectedScope] = useState<ScopeSelection | null>({
        spaceId: 'personal',
        spaceName: 'Personal Space',
        selectedItems: [],
    });
    const [spaceSearch, setSpaceSearch] = useState('');

    // Agents state - start empty, fetch from API
    const [agents, setAgents] = useState<Agent[]>([]);
    const [agentSearch, setAgentSearch] = useState('');
    const [agentsLoading, setAgentsLoading] = useState(true);

    // Fetch agents from backend on mount
    useEffect(() => {
        const fetchAgentsFromBackend = async () => {
            try {
                const backendAgents = await getAgents();
                // Merge with local state (isActive is local-only)
                const mergedAgents: Agent[] = backendAgents.map(a => ({
                    id: a.id,
                    name: a.name,
                    icon: a.icon,
                    description: a.description,
                    category: a.category,
                    isFavorite: a.isFavorite,
                    isActive: false, // Local state only
                    hasAccess: a.hasAccess,
                }));
                setAgents(mergedAgents);
            } catch (error) {
                console.error('Failed to fetch agents:', error);
                // Keep empty array on error
            } finally {
                setAgentsLoading(false);
            }
        };
        fetchAgentsFromBackend();
    }, []);

    // Background tasks
    const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);

    // Messages
    const [messages, setMessages] = useState<Message[]>([]);
    const [conversationId, setConversationId] = useState<string | null>(null);

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
        // Optimistic update
        setAgents((prev) =>
            prev.map((agent) =>
                agent.id === agentId ? { ...agent, isFavorite: !agent.isFavorite } : agent
            )
        );

        // Sync with backend
        try {
            await apiToggleFavorite(agentId);
        } catch (error) {
            console.error('Failed to toggle favorite:', error);
            // Revert on error
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

    const updateMessage = (id: string, updates: Partial<Message>) => {
        setMessages((prev) =>
            prev.map((msg) => (msg.id === id ? { ...msg, ...updates } : msg))
        );
    };

    // Space Management Functions
    const addSpaceMember = (spaceId: string, userId: string, role: MemberRole) => {
        const user = mockUsers.find(u => u.id === userId);
        if (!user) return;

        setSpaces((prev) =>
            prev.map((space) => {
                if (space.id !== spaceId) return space;
                const newMember: SpaceMember = {
                    userId,
                    user,
                    role,
                    addedAt: new Date(),
                };
                return {
                    ...space,
                    members: [...(space.members || []), newMember],
                };
            })
        );
    };

    const removeSpaceMember = (spaceId: string, userId: string) => {
        setSpaces((prev) =>
            prev.map((space) => {
                if (space.id !== spaceId) return space;
                return {
                    ...space,
                    members: (space.members || []).filter(m => m.userId !== userId),
                };
            })
        );
    };

    const updateMemberRole = (spaceId: string, userId: string, newRole: MemberRole) => {
        setSpaces((prev) =>
            prev.map((space) => {
                if (space.id !== spaceId) return space;
                return {
                    ...space,
                    members: (space.members || []).map(m =>
                        m.userId === userId ? { ...m, role: newRole } : m
                    ),
                };
            })
        );
    };

    const addDocumentToSpace = (spaceId: string, document: SpaceItem, parentId?: string) => {
        setSpaces((prev) =>
            prev.map((space) => {
                if (space.id !== spaceId) return space;

                if (!parentId) {
                    // Add to root
                    return {
                        ...space,
                        children: [...(space.children || []), document],
                        documentCount: document.type === 'document' ? space.documentCount + 1 : space.documentCount,
                    };
                }

                // Add to subfolder
                const addToFolder = (items: SpaceItem[]): SpaceItem[] => {
                    return items.map(item => {
                        if (item.id === parentId && item.type === 'folder') {
                            return {
                                ...item,
                                children: [...(item.children || []), document],
                            };
                        }
                        if (item.children) {
                            return {
                                ...item,
                                children: addToFolder(item.children),
                            };
                        }
                        return item;
                    });
                };

                return {
                    ...space,
                    children: space.children ? addToFolder(space.children) : undefined,
                    documentCount: document.type === 'document' ? space.documentCount + 1 : space.documentCount,
                };
            })
        );
    };

    const removeDocumentFromSpace = (spaceId: string, documentId: string) => {
        setSpaces((prev) =>
            prev.map((space) => {
                if (space.id !== spaceId) return space;
                const removeDoc = (items: SpaceItem[]): SpaceItem[] => {
                    return items
                        .filter(item => item.id !== documentId)
                        .map(item => ({
                            ...item,
                            children: item.children ? removeDoc(item.children) : undefined,
                        }));
                };
                return {
                    ...space,
                    children: space.children ? removeDoc(space.children) : undefined,
                    documentCount: Math.max(0, space.documentCount - 1),
                };
            })
        );
    };

    const updateSpace = (spaceId: string, updates: Partial<Space>) => {
        setSpaces((prev) =>
            prev.map((space) =>
                space.id === spaceId ? { ...space, ...updates } : space
            )
        );
    };

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

            // Map API messages to UI messages
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

    // Get auth state
    const { isAuthenticated } = useAuth();

    // Load history on mount
    useEffect(() => {
        if (isAuthenticated) {
            // Small delay to ensure token is fully persisted in localStorage
            const timer = setTimeout(() => {
                refreshHistory();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [isAuthenticated]);

    // Refresh history when a new conversation is created
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
                // Space Management
                addSpaceMember,
                removeSpaceMember,
                updateMemberRole,
                addDocumentToSpace,
                removeDocumentFromSpace,
                updateSpace,
                // Agents
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

                // History
                conversations,
                isLoadingHistory,
                hasMoreHistory,
                refreshHistory,
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


