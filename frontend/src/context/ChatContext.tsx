import { createContext, useContext, useState, ReactNode } from 'react';

// Types
export interface SpaceItem {
    id: string;
    name: string;
    type: 'folder' | 'document';
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

const mockSpaces: Space[] = [
    { id: 'personal', name: 'Personal Space', icon: '👤', isPinned: true, isPersonal: true, documentCount: 8, children: personalSpaceChildren },
    { id: 'q4-reports', name: 'Q4 Reports', icon: '📊', isPinned: true, documentCount: 15 },
    { id: 'legal', name: 'Legal Documents', icon: '⚖️', isPinned: false, documentCount: 42 },
    { id: 'marketing', name: 'Marketing Analytics', icon: '📈', isPinned: false, documentCount: 28 },
    { id: 'client-portfolios', name: 'Client Portfolios', icon: '💼', isPinned: false, documentCount: 156 },
    { id: 'compliance', name: 'Compliance Records', icon: '✅', isPinned: false, documentCount: 89 },
    { id: 'hr', name: 'HR Policies', icon: '👥', isPinned: false, documentCount: 34 },
    { id: 'finance', name: 'Financial Statements', icon: '💰', isPinned: false, documentCount: 67 },
    { id: 'audit', name: 'Audit Trail', icon: '🔍', isPinned: false, documentCount: 203 },
    { id: 'contracts', name: 'Contracts', icon: '📝', isPinned: false, documentCount: 78 },
];

const mockAgents: Agent[] = [
    // Research
    { id: 'quick-search', name: 'Quick Search', icon: '🔍', description: 'Fast web lookup for instant answers', category: 'research', isFavorite: true, isActive: false },
    { id: 'dexter', name: 'Dexter', icon: '🔬', description: 'Deep research - runs in background, emails results', category: 'research', isFavorite: false, isActive: false, isBackground: true },
    { id: 'market-analyzer', name: 'Market Analyzer', icon: '📈', description: 'Real-time market trends and analysis', category: 'research', isFavorite: false, isActive: false },
    { id: 'news-aggregator', name: 'News Aggregator', icon: '📰', description: 'Latest news from trusted sources', category: 'research', isFavorite: false, isActive: false },

    // Compliance
    { id: 'compliance-checker', name: 'Compliance Checker', icon: '✅', description: 'Verify regulatory compliance', category: 'compliance', isFavorite: true, isActive: false },
    { id: 'policy-reviewer', name: 'Policy Reviewer', icon: '📜', description: 'Review documents against policies', category: 'compliance', isFavorite: false, isActive: false },
    { id: 'risk-assessor', name: 'Risk Assessor', icon: '⚠️', description: 'Identify and assess potential risks', category: 'compliance', isFavorite: false, isActive: false },

    // Finance
    { id: 'financial-modeler', name: 'Financial Modeler', icon: '💹', description: 'Build and analyze financial models', category: 'finance', isFavorite: true, isActive: false },
    { id: 'data-cruncher', name: 'Data Cruncher', icon: '📊', description: 'Analyze data and generate insights', category: 'finance', isFavorite: false, isActive: true },
    { id: 'audit-assistant', name: 'Audit Assistant', icon: '📑', description: 'Prepare audit documentation', category: 'finance', isFavorite: false, isActive: false },

    // Automation
    { id: 'report-generator', name: 'Report Generator', icon: '📄', description: 'Create formatted reports automatically', category: 'automation', isFavorite: true, isActive: false },
    { id: 'email-composer', name: 'Email Composer', icon: '📧', description: 'Draft professional emails', category: 'automation', isFavorite: false, isActive: false },
    { id: 'meeting-scheduler', name: 'Meeting Scheduler', icon: '📅', description: 'Schedule and organize meetings', category: 'automation', isFavorite: false, isActive: false },
    { id: 'task-manager', name: 'Task Manager', icon: '📝', description: 'Create and track tasks', category: 'automation', isFavorite: false, isActive: false },
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

    return (
        <ChatContext.Provider
            value={{
                spaces,
                selectedScope,
                setSelectedScope,
                toggleSpacePin,
                spaceSearch,
                setSpaceSearch,
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
