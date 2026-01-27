import { createContext, useContext, useState, ReactNode } from 'react';

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

export interface Message {
    id: string;
    type: 'sync' | 'reasoning' | 'async-task';
    sender: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    citations?: Citation[];
    reasoning?: {
        steps: ReasoningStep[];
        isExpanded: boolean;
    };
    task?: AsyncTask;
    agents?: string[];
    pending?: boolean;
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

const mockAgents: Agent[] = [
    // Research
    { id: 'quick-search', name: 'Quick Search', icon: 'search', description: 'Fast web lookup for instant answers', category: 'research', isFavorite: true, isActive: false },
    { id: 'dexter', name: 'Dexter', icon: 'experiment', description: 'Deep research - runs in background, emails results', category: 'research', isFavorite: false, isActive: false, isBackground: true },
    { id: 'market-analyzer', name: 'Market Analyzer', icon: 'line-chart', description: 'Real-time market trends and analysis', category: 'research', isFavorite: false, isActive: false },
    { id: 'news-aggregator', name: 'News Aggregator', icon: 'read', description: 'Latest news from trusted sources', category: 'research', isFavorite: false, isActive: false },

    // Compliance
    { id: 'compliance-checker', name: 'Compliance Checker', icon: 'check-circle', description: 'Verify regulatory compliance', category: 'compliance', isFavorite: true, isActive: false },
    { id: 'policy-reviewer', name: 'Policy Reviewer', icon: 'book', description: 'Review documents against policies', category: 'compliance', isFavorite: false, isActive: false },
    { id: 'risk-assessor', name: 'Risk Assessor', icon: 'warning', description: 'Identify and assess potential risks', category: 'compliance', isFavorite: false, isActive: false },

    // Finance
    { id: 'financial-modeler', name: 'Financial Modeler', icon: 'fund', description: 'Build and analyze financial models', category: 'finance', isFavorite: true, isActive: false },
    { id: 'data-cruncher', name: 'Data Cruncher', icon: 'bar-chart', description: 'Analyze data and generate insights', category: 'finance', isFavorite: false, isActive: true },
    { id: 'audit-assistant', name: 'Audit Assistant', icon: 'audit', description: 'Prepare audit documentation', category: 'finance', isFavorite: false, isActive: false },

    // Automation
    { id: 'report-generator', name: 'Report Generator', icon: 'file-text', description: 'Create formatted reports automatically', category: 'automation', isFavorite: true, isActive: false },
    { id: 'email-composer', name: 'Email Composer', icon: 'mail', description: 'Draft professional emails', category: 'automation', isFavorite: false, isActive: false },
    { id: 'meeting-scheduler', name: 'Meeting Scheduler', icon: 'calendar', description: 'Schedule and organize meetings', category: 'automation', isFavorite: false, isActive: false },
    { id: 'task-manager', name: 'Task Manager', icon: 'schedule', description: 'Create and track tasks', category: 'automation', isFavorite: false, isActive: false },
];

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

    // Agents state
    const [agents, setAgents] = useState<Agent[]>(mockAgents);
    const [agentSearch, setAgentSearch] = useState('');

    // Background tasks
    const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>([]);

    // Messages
    const [messages, setMessages] = useState<Message[]>([]);

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

    const toggleAgentFavorite = (agentId: string) => {
        setAgents((prev) =>
            prev.map((agent) =>
                agent.id === agentId ? { ...agent, isFavorite: !agent.isFavorite } : agent
            )
        );
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
