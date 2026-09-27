const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface ModelInfo {
    id: string;
    name: string;
    provider: 'google' | 'anthropic' | 'openai';
    description: string;
}

export interface AgentInfo {
    id: string;
    name: string;
    description: string;
}

export interface Assistant {
    id: string;
    name: string;
    description?: string | null;
    graph_id: 'basic_agent' | 'deep_agent';
    system_prompt?: string | null;
    config?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}

export interface ConversationSummary {
    id: string;
    title: string;
    model: string;
    created_at: string;
    updated_at: string;
    assistant_id?: string;
}

export interface MessageOut {
    id: string;
    role: 'user' | 'assistant' | 'tool' | 'system';
    content: string;
    created_at: string;
    attachments?: { id: string; name: string; type: string; url: string; size: number }[];
    reasoning?: { steps: { id: string; text: string; status: 'pending' | 'running' | 'complete' | 'failed' }[]; isExpanded?: boolean };
    citations?: { id: string; title: string; url?: string; page?: number }[];
    agents?: string[];
    additional_kwargs?: Record<string, unknown>;
}

export interface ConversationDetail {
    id: string;
    title: string;
    model: string;
    messages: MessageOut[];
    created_at: string;
    updated_at: string;
    assistant_id?: string;
}

export interface StreamChunk {
    type: 'meta' | 'thinking' | 'text' | 'done' | 'error' | 'status' | 'tool_start' | 'tool_end' | 'todos' | 'citations';
    content?: string;
    conversation_id?: string;
    thread_id?: string;
    assistant_id?: string;
    message_id?: string;
    tool_run_id?: string;
    tool_name?: string;
    name?: string;
    input?: string;
    output?: string;
    label?: string;
    detail?: string;
    summary?: string;
    category?: string;
    /** Subagent that owns this nested tool call (verifier / gatherer). */
    via?: string;
    step_id?: string;
    agents?: string[];
    graph_id?: string;
    todos?: { content: string; status: string }[];
    citations?: { id: string; title: string; url?: string; agent?: string; detail?: string }[];
}

export async function getMe(): Promise<{ id: string; email: string; name: string }> {
    const response = await fetch(`${API_BASE_URL}/api/me`);
    if (!response.ok) throw new Error('Failed to fetch user');
    return response.json();
}

export async function getModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${API_BASE_URL}/api/models`);
    if (!response.ok) throw new Error('Failed to fetch models');
    return response.json();
}

export async function getAgents(): Promise<AgentInfo[]> {
    const response = await fetch(`${API_BASE_URL}/api/agents`);
    if (!response.ok) throw new Error('Failed to fetch agents');
    return response.json();
}

export async function getAssistants(): Promise<Assistant[]> {
    const response = await fetch(`${API_BASE_URL}/api/assistants`);
    if (!response.ok) throw new Error('Failed to fetch assistants');
    return response.json();
}

export async function getConversations(limit: number = 20, offset: number = 0): Promise<ConversationSummary[]> {
    const params = new URLSearchParams({ limit: String(limit), offset: String(offset) });
    const response = await fetch(`${API_BASE_URL}/api/threads?${params}`);
    if (!response.ok) throw new Error('Failed to fetch conversations');
    return response.json();
}

export async function getConversation(conversationId: string): Promise<ConversationDetail> {
    const response = await fetch(`${API_BASE_URL}/api/threads/${conversationId}`);
    if (!response.ok) throw new Error('Failed to fetch conversation');
    return response.json();
}

export async function deleteConversation(conversationId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/threads/${conversationId}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete conversation');
}

export async function streamMessage(
    model: string,
    content: string,
    onChunk: (chunk: StreamChunk) => void,
    conversationId?: string,
    attachments?: { id: string; name: string; type: string; url: string; size: number }[],
    activeAgents?: string[],
): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            content,
            conversation_id: conversationId,
            thread_id: conversationId,
            active_agents: activeAgents || [],
            attachments,
        }),
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || 'Failed to stream message');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

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
                    onChunk(JSON.parse(line.slice(6)));
                } catch {
                    // skip
                }
            }
        }
    }
}

export async function uploadFile(file: File): Promise<{ url: string; path: string; name: string; type: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await fetch(`${API_BASE_URL}/api/upload`, { method: 'POST', body: formData });
    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || 'Failed to upload file');
    }
    return response.json();
}
