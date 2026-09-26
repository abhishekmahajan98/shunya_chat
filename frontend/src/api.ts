const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export interface ModelInfo {
    id: string;
    name: string;
    provider: 'google' | 'anthropic';
    description: string;
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
    citations?: { id: string; title: string; url?: string; page?: number }[];
    agents?: string[];
}

export interface ConversationDetail {
    id: string;
    title: string;
    model: string;
    messages: MessageOut[];
    created_at: string;
    updated_at: string;
}

export interface StreamChunk {
    type: 'meta' | 'thinking' | 'text' | 'done' | 'error';
    content?: string;
    conversation_id?: string;
    message_id?: string;
}

export async function getModels(): Promise<ModelInfo[]> {
    const response = await fetch(`${API_BASE_URL}/api/models`);
    if (!response.ok) {
        throw new Error('Failed to fetch models');
    }
    return response.json();
}

export async function getConversations(limit: number = 20, offset: number = 0): Promise<ConversationSummary[]> {
    const response = await fetch(`${API_BASE_URL}/api/conversations?limit=${limit}&offset=${offset}`);
    if (!response.ok) {
        throw new Error('Failed to fetch conversations');
    }
    return response.json();
}

export async function getConversation(conversationId: string): Promise<ConversationDetail> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`);
    if (!response.ok) {
        throw new Error('Failed to fetch conversation');
    }
    return response.json();
}

export async function deleteConversation(conversationId: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/conversations/${conversationId}`, {
        method: 'DELETE',
    });
    if (!response.ok) {
        throw new Error('Failed to delete conversation');
    }
}

export async function streamMessage(
    model: string,
    content: string,
    onChunk: (chunk: StreamChunk) => void,
    conversationId?: string,
    attachments?: { id: string; name: string; type: string; url: string; size: number }[],
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
            attachments,
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

export async function uploadFile(file: File): Promise<{ url: string; path: string; name: string; type: string; size: number }> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(`${API_BASE_URL}/api/upload`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
        throw new Error(error.detail || 'Failed to upload file');
    }

    return response.json();
}
