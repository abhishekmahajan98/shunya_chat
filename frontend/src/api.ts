const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

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
    const response = await fetch(`${API_BASE_URL}/api/models`);
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
 * Get list of conversations.
 */
export async function getConversations(): Promise<ConversationSummary[]> {
    const response = await fetch(`${API_BASE_URL}/api/conversations`);
    if (!response.ok) {
        throw new Error('Failed to fetch conversations');
    }
    return response.json();
}

/**
 * Get a conversation with all messages.
 */
export async function getConversation(conversationId: string): Promise<ConversationDetail> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`);
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

/**
 * Stream a message response from the chat API.
 * Calls onChunk for each received chunk.
 */
export async function streamMessage(
    model: string,
    content: string,
    onChunk: (chunk: StreamChunk) => void,
    conversationId?: string
): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            content,
            conversation_id: conversationId,
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

export interface AgentStreamChunk {
    type: 'meta' | 'thinking' | 'text' | 'done' | 'error' | 'agent_status' | 'agent_result' | 'citations';
    content?: string;
    conversation_id?: string;
    // Agent-specific fields
    agent?: string;
    name?: string;
    status?: string;
    data?: any;
    citations?: { id: string; title: string; page?: number }[];
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
 * Get auth headers for API requests
 */
function getAuthHeaders(): Record<string, string> {
    const token = localStorage.getItem('auth_token');
    return token ? { 'Authorization': `Bearer ${token}` } : {};
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

/**
 * Stream a message with agent support.
 * Uses the /chat/agent endpoint which activates agents based on intent.
 * @param activeAgents - List of agent IDs that are currently activated in the UI
 */
export async function streamAgentMessage(
    model: string,
    content: string,
    onChunk: (chunk: AgentStreamChunk) => void,
    conversationId?: string,
    activeAgents?: string[]
): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/chat/agent`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model,
            content,
            conversation_id: conversationId,
            active_agents: activeAgents,
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
