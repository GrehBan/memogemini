# MemoGemini MCP Server

**MemoGemini MCP Server** is a Model Context Protocol (MCP) server designed to act as a "cognitive extension" for AI agents, specifically optimized for the Gemini CLI. It provides persistent memory capabilities through three distinct systems, allowing agents to retain information across sessions and projects.

## 🚀 Features

MemoGemini implements three layers of memory:

1.  **File Memory:** Persistent storage for long-form documentation, notes, and structured data using Markdown files.
2.  **Semantic Memory:** Unstructured text storage with vector embeddings for similarity-based retrieval, powered by **Qdrant**.
3.  **Fact Memory:** High-speed key-value storage for specific facts and preferences, powered by **Redis**.

## 🏗️ Project Structure

```text
memogemini-mcp-server/
├── src/
│   ├── server.ts           # Main entry point: initializes server and registers tools
│   ├── config.ts           # Centralized configuration (env vars)
│   ├── fact/               # Fact Memory (Redis) implementation
│   ├── file/               # File Memory (FS) implementation
│   └── semantic/           # Semantic Memory (Qdrant) implementation
├── tests/                  # Unit and integration tests
├── gemini-extension.json   # Configuration for Gemini CLI extension
├── package.json            # Dependencies and scripts
├── Dockerfile              # Container definition
├── docker-compose.yml      # Orchestration for app, Redis, and Qdrant
└── GEMINI.md               # System prompt for the AI agent
```

## 🛠️ Technologies

*   **Runtime:** Node.js (ES Modules)
*   **Language:** TypeScript
*   **Vector DB:** Qdrant
*   **KV Store:** Redis
*   **Embeddings:** `@huggingface/transformers`
*   **SDK:** `@modelcontextprotocol/sdk`

## 🏁 Getting Started

### Prerequisites

*   **Node.js** (v18+)
*   **Docker & Docker Compose**

### Configuration

Copy the example environment file and adjust the values:

```bash
cp .env.example .env
```

### Local Development

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Build Project:**
    ```bash
    npm run build
    ```

3.  **Run Tests:**
    ```bash
    npm test
    ```

4.  **Start Server:**
    ```bash
    npm start
    ```

### Deployment

To link extension to gemini-cli:

```bash
cd memogemini
gemini extensions link .
```
## 🔌 MCP Tools

### File Memory
*   `write_note`: Save markdown content.
*   `read_note`: Retrieve note content.
*   `list_notes`: List all notes in a folder.
*   `forget_note`: Delete a note.

### Semantic Memory
*   `remember`: Store text with embeddings.
*   `search_memory`: Semantic search in stored memories.
*   `forget_memory`: Remove a specific memory.
*   `checkpoint_semantic`: Trigger a Qdrant snapshot.

### Fact Memory
*   `remember_fact`: Store a key-value pair.
*   `recall_fact`: Retrieve a value by key.
*   `list_facts`: List all stored keys.
*   `forget_fact`: Delete a fact.
*   `checkpoint_facts`: Trigger a Redis BGSAVE.

## 🤝 Contributing

1.  **Module System:** This project uses native ES Modules.
2.  **Validation:** All tool inputs are validated using `zod`.
3.  **Config:** Use `src/config.ts` for all configuration; never hardcode values.
4.  **Testing:** Add unit tests in `tests/` for any new logic.
