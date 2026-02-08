# Future Features Roadmap

## 1. Hybrid Memory Strategy (State of the Art)

**Goal**: Implement a "Hybrid" memory strategy that balances cost, token usage, and long-term recall. This approach mimics the architecture of production systems like ChatGPT or Claude, combining immediate context with infinite retrieval.

### The Architecture

The strategy combines three distinct layers of context to form the final prompt:

#### A. Pinned Context (The Core)
*   **Content**: System Instructions + User Profile.
*   **Behavior**: Always present at the "top" of the prompt.
*   **Purpose**: Ensures the agent's persona, rules, and known user preferences are never forgotten, regardless of conversation length.

#### B. Sliding Window (The Flow)
*   **Content**: The raw text of the immediate last 10-15 messages (N turns).
*   **Behavior**: Always present. A "rolling" window that drops the oldest message as a new one arrives.
*   **Purpose**: Maintains high-fidelity context for the immediate conversation, ensuring seamless replies to recent questions.
*   **Extension - Summary Buffer (Optional but Recommended)**:
    *   Instead of simply deleting messages that fall out of the window, compress them into a **Moving Summary**.
    *   *Mechanism*: Maintain a running summary text of everything *before* the N turns.
    *   *Prompt Location*: Between Pinned Context and Sliding Window.
    *   *Example*:
        ```text
        System: You are a helpful assistant.
        Old Context Summary: User previously asked about React setup. We resolved a CORS issue and configured the database.
        Recent Chat: (Last 10 messages)
        User: Now I'm getting a 500 error...
        ```

#### C. Vector-Based Retrieval / RAG (The Infinite Memory)
*   **Content**: Semantically relevant chunks from the *entire* conversation history.
*   **Behavior**: "On Deployment". Retrieved only when relevant.
*   **Mechanism**:
    1.  **Storage**: Every (User Message + AI Response) pair is embedded and stored in a Vector Database (e.g., `pgvector` in Supabase).
    2.  **Retrieval**: When a new message arrives, perform a cosine similarity search against the DB for the "Top 3-5 most relevant past chunks".
    3.  **Injection**: Insert these chunks into the prompt (e.g., in a `<relevant_history>` block).
*   **Trigger Strategy**:
    *   *Always On*: Simplest. Retrieve for every message.
    *   *Conditional*: Use a lightweight classifier (or Router LLM) to decide if the user is asking about the past.
*   **Purpose**: Enables the AI to recall a specific fact, code snippet, or name from 500 messages ago.

### Integration Logic
The final prompt constructed for the LLM looks like this:

```text
[System Instructions & User Profile] (Pinned)

[Relevant Past History (RAG Results)] (Conditional)
- User previously mentioned: "My API key is abc-123" (Score: 0.89)
- User previously mentioned: "I prefer Python over JS" (Score: 0.85)

[Conversation Summary] (The "Gist" of old chat)

[Recent Chat History] (Sliding Window - Last 15 messages)
User: ...
AI: ...
User: [Current Message]
```

## 2. MCP Apps (Interactive UIs)

**Goal**: Transform Shunya Chat from a text-based interface into a rich app platform by supporting the official Model Context Protocol (MCP) Apps extension. This allows agents to render sandboxed, interactive UIs directly in the chat.

### The Architecture

#### A. Tool-Driven UI Preloading
*   Agents can include a `_meta.ui.resourceUri` in their tool definitions.
*   This points to a `ui://` resource on the MCP server.
*   The frontend can preload these assets (HTML/JS/CSS) before the tool is even executed.

#### B. Sandboxed Rendering (Modern Artifacts)
*   UIs are rendered in a secure, sandboxed `<iframe>`.
*   Supports permissions for hardware access (camera, microphone) and custom Content Security Policies (CSP).

#### C. Bidirectional Communication
*   **JSON-RPC Protocol**: The app inside the iframe communicates with the host (Shunya Chat) using the `ui/` method prefix.
*   **Tool-Triggered UI**: The host can push tool results directly to the app via `app.ontoolresult`.
*   **App-Triggered Tools**: The UI can proactively call server tools via `app.callServerTool()`, enabling "app-like" experiences (e.g., a "Get Time" button in a clock widget).

### Benefits
- **Zero-Config UIs**: Developers only need to write a standard HTML/JS bundle for their MCP server.
- **Rich Visualization**: Seamlessly render charts, complex forms, or 3D viewports.
- **Micro-App Platform**: Effectively turns Shunya Chat into an operating system for AI agents.
