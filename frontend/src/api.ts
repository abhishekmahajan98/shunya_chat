const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/**
 * Get auth headers for API requests
 */
function getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
}

export interface ModelInfo {
    id: string;
    name: string;
    provider: 'google' | 'anthropic';
    description: string;
}

export interface MessageResponse {
    conversation_id: string;
    message_id: string;
    role: 'assistant';
    content: string;
}

export interface ConversationSummary {
    id: string;
    title: string;
    model: string;
    created_at: string;
    updated_at: string;
}

export interface MessageOut {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
    attachments?: { id: string; name: string; type: string; url: string; size: number }[];
    reasoning?: { steps: { id: string; text: string; status: 'pending' | 'running' | 'complete' | 'failed' }[]; isExpanded?: boolean };
}

export interface ConversationDetail {
    id: string;
    title: string;
    model: string;
    messages: MessageOut[];
    created_at: string;
    updated_at: string;
}

/**
 * Get available models from the backend.
 */
export async function getModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${API_BASE_URL}/api/models`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch models');
    }
    return response.json();

}

/**
 * Send a message to the chat API.
 */
export async function sendMessage(
    model: string,
    content: string,
    conversationId?: string
): Promise<MessageResponse> {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
        },
        body: JSON.stringify({
            model,
            content,
            conversation_id: conversationId,
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || 'Failed to send message');
    }

    return response.json();
}

/**
 * Get list of conversations with pagination.
 */
export async function getConversations(limit: number = 20, offset: number = 0): Promise<ConversationSummary[]> {
    const response = await fetch(`${API_BASE_URL}/api/conversations?limit=${limit}&offset=${offset}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch conversations');
    }
    return response.json();
}

/**
 * Get a conversation with all messages.
 */
export async function getConversation(conversationId: string): Promise<ConversationDetail> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch conversation');
    }
    return response.json();
}

/**
 * Delete a conversation.
 */
export async function deleteConversation(conversationId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete conversation');
    }
}

export interface StreamChunk {
    type: 'meta' | 'thinking' | 'text' | 'done' | 'error';
    content?: string;
    conversation_id?: string;
}

// Agent-specific types
export interface AgentStatus {
    agent: string;
    name: string;
    status: 'starting' | 'running' | 'complete' | 'error';
}

export interface AgentResult {
    agent: string;
    status: 'success' | 'error';
    data?: any;
    error?: string;
}

export interface Citation {
    id: string;
    title: string;
    page?: number;
}

export interface AgentStreamChunk {
    type: 'meta' | 'thinking' | 'text' | 'done' | 'error' | 'agent_status' | 'agent_result' | 'citations' | 'plan_created' | 'status' | 'tool_start' | 'tool_end' | 'tool_error';
    content?: string;
    conversation_id?: string;
    // Agent-specific fields
    agent?: string;
    name?: string;
    id?: string;        // Unique step ID
    parent_id?: string; // Parent ID for hiearchy
    status?: string; // 'starting' | 'running' | 'complete' | 'error' | 'pending' | 'failed'
    goal?: string;   // For agent_status and plan
    data?: any;
    output?: string;
    tool_run_id?: string;
    tool_name?: string;
    input?: string;
    error?: string; // added this
    citations?: { id: string; title: string; page?: number }[];
    // Plan
    plan?: { agent: string; goal: string; id?: string }[];
}

// Agent Registry Types
export type AgentCategory = 'research' | 'compliance' | 'finance' | 'automation';

export interface AgentInfo {
    id: string;
    name: string;
    icon: string;
    description: string;
    category: AgentCategory;
    url: string;
    hasAccess: boolean;
    isFavorite: boolean;
}

/**
 * Stream a message response from the chat API.
 * Calls onChunk for each received chunk.
 */
export async function streamMessage(
    model: string,
    content: string,
    onChunk: (chunk: AgentStreamChunk) => void,
    conversationId?: string,
    activeAgents?: string[],
    attachments?: any[],
    selectedSpaces?: string[],
    selectedDocuments?: string[]
): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
        },
        body: JSON.stringify({
            model,
            content,
            conversation_id: conversationId,
            active_agents: activeAgents,
            attachments,
            selected_spaces: selectedSpaces,
            selected_documents: selectedDocuments,
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || 'Failed to stream message');
    }

    const reader = response.body?.getReader();
    if (!reader) {
        throw new Error('No response body');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.startsWith('data: ')) {
                try {
                    const data = JSON.parse(line.slice(6));
                    onChunk(data);
                } catch {
                    // Skip invalid JSON
                }
            }
        }
    }
}

/**
 * Get all available agents from the backend registry.
 */
export async function getAgents(): Promise<AgentInfo[]> {
    const response = await fetch(`${API_BASE_URL}/api/agents`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch agents');
    }
    return response.json();
}

/**
 * Get user's favorite agents.
 */
export async function getFavoriteAgents(): Promise<AgentInfo[]> {
    const response = await fetch(`${API_BASE_URL}/api/agents/favorites`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to fetch favorite agents');
    }
    return response.json();
}

/**
 * Toggle favorite status for an agent.
 */
export async function toggleAgentFavorite(agentId: string): Promise<{ id: string; isFavorite: boolean }> {
    const response = await fetch(`${API_BASE_URL}/api/agents/${agentId}/favorite`, {
        method: 'PUT',
        headers: getAuthHeaders(),
    });
    if (!response.ok) {
        throw new Error('Failed to toggle favorite');
    }
    return response.json();
}

export interface RegisterAgentRequest {
    id: string;
    name: string;
    icon: string;
    description: string;
    category: AgentCategory;
    url: string;
}

/**
 * Register a new agent.
 */
export async function registerAgent(agent: RegisterAgentRequest): Promise<{ id: string; status: string }> {
    const response = await fetch(`${API_BASE_URL}/api/agents`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
        },
        body: JSON.stringify(agent),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || 'Failed to register agent');
    }

    return response.json();
}

export async function uploadFile(file: File): Promise<{ url: string; path: string; name: string; type: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        headers: getAuthHeaders(), // Does not need Content-Type for FormData
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || 'Failed to upload file');
    }

    return response.json();
}

/**
 * Spaces & Documents API
 */

export interface Space {
    id: string;
    name: string;
    description?: string;
    owner_id: string;
    is_public: boolean;
    type: 'personal' | 'shared';
    metadata?: any;
    created_at: string;
}

export interface Document {
    id: string;
    space_id: string;
    parent_id?: string;
    name: string;
    type: 'document' | 'folder';
    status: 'processing' | 'completed' | 'error';
    mime_type?: string;
    size_bytes?: number;
    created_at: string;
}

export async function getSpaces(): Promise<Space[]> {
    const response = await fetch(`${API_BASE_URL}/api/spaces`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch spaces');
    return response.json();
}

export async function createSpace(name: string, description?: string, isPublic: boolean = false): Promise<Space> {
    const response = await fetch(`${API_BASE_URL}/api/spaces`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
        },
        body: JSON.stringify({ name, description, is_public: isPublic }),
    });
    if (!response.ok) throw new Error('Failed to create space');
    return response.json();
}

export async function getSpace(spaceId: string): Promise<Space & { documents: Document[] }> {
    const response = await fetch(`${API_BASE_URL}/api/spaces/${spaceId}`, {
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to fetch space details');
    return response.json();
}

export async function uploadDocumentToSpace(spaceId: string, file: File, parentId?: string): Promise<Document> {
    const formData = new FormData();
    formData.append('file', file);

    let url = `${API_BASE_URL}/api/spaces/${spaceId}/upload`;
    if (parentId) {
        url += `?parent_id=${parentId}`;
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
    });
    if (!response.ok) throw new Error('Failed to upload document');
    return response.json();
}

export async function createFolder(spaceId: string, name: string, parentId?: string): Promise<Document> {
    const response = await fetch(`${API_BASE_URL}/api/spaces/${spaceId}/folders`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...getAuthHeaders(),
        },
        body: JSON.stringify({ name, parent_id: parentId }),
    });
    if (!response.ok) throw new Error('Failed to create folder');
    return response.json();
}

export async function deleteDocument(spaceId: string, documentId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/spaces/${spaceId}/documents/${documentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete document');
}

export async function deleteSpace(spaceId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/spaces/${spaceId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });
    if (!response.ok) throw new Error('Failed to delete space');
}
