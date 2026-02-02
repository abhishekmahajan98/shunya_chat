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
