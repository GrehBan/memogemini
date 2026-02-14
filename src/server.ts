import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

import { SemanticMemo } from "./semantic/memo.js";
import { FileMemory } from "./file/memo.js";
import { FactMemo } from "./fact/memo.js";

const server = new McpServer({
  name: 'memogemini-server',
  version: '1.0.0',
});

const fm = new FileMemory();
const sm = new SemanticMemo();
const factm = new FactMemo();

// Initialize external connections
try {
  await factm.connect();
  console.error("Connected to Redis");
} catch (err) {
  console.error("Failed to connect to Redis, fact tools may not work", err);
}

server.registerTool(
  "write_note",
  {
    description: "Write a note to file memory. Notes are stored as markdown files in organized folders.",
    inputSchema: z.object({
      folder: z.string().describe("The folder name to organize the note (e.g., 'projects', 'tasks')"),
      name: z.string().describe("The name of the note file (without extension)"),
      content: z.string().describe("The markdown content of the note"),
    }),
  },
  async ({ folder, name, content }) => {
    try {
      await fm.write(folder, name, content);
      await server.sendLoggingMessage({
        level: "info",
        data: `Note saved: ${folder}/${name}`,
      });

      return {
        content: [{ type: "text", text: `Successfully saved note to ${folder}/${name}.md` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error saving note: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "read_note",
  {
    description: "Read a note from file memory.",
    inputSchema: z.object({
      folder: z.string().describe("The folder where the note is located"),
      name: z.string().describe("The name of the note to read"),
    }),
  },
  async ({ folder, name }) => {
    try {
      const text = await fm.read(folder, name);
      if (text === null) {
        return {
          content: [{ type: "text", text: `Note '${name}' not found in folder '${folder}'.` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: text }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error reading note: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "list_notes",
  {
    description: "List all notes in a specific folder.",
    inputSchema: z.object({
      folder: z.string().describe("The folder to list notes from"),
    }),
  },
  async ({ folder }) => {
    try {
      const notes = await fm.listDocs(folder);
      return {
        content: [{ type: "text", text: notes.length > 0 ? `Notes in '${folder}':\n- ${notes.join("\n- ")}` : `No notes found in folder '${folder}'.` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error listing notes: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "forget_note",
  {
    description: "Delete a note from file memory.",
    inputSchema: z.object({
      folder: z.string().describe("The folder where the note is located"),
      name: z.string().describe("The name of the note to delete"),
    }),
  },
  async ({ folder, name }) => {
    try {
      await fm.delete(folder, name);
      return {
        content: [{ type: "text", text: `Successfully deleted note ${folder}/${name}.md` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error deleting note: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "remember",
  {
    description: "Save text to semantic memory for later contextual search.",
    inputSchema: z.object({
      text: z.string().describe("The text content to remember"),
      metadata: z.record(z.any()).optional().describe("Optional metadata to associate with this memory"),
    }),
  },
  async ({ text, metadata }) => {
    try {
      await sm.remember(text, metadata ?? {});
      await server.sendLoggingMessage({
        level: "debug",
        data: `Semantic memory added: ${text.slice(0, 50)}...`,
      });

      return {
        content: [{ type: "text", text: "Successfully saved to semantic memory." }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error saving to semantic memory: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "search_memory",
  {
    description: "Search semantic memory for information relevant to a query.",
    inputSchema: z.object({
      query: z.string().describe("The search query"),
      n: z.number().min(1).max(20).default(5).describe("Number of results to return"),
    }),
  },
  async ({ query, n }) => {
    try {
      const result = await sm.search(query, n);
      return {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error searching memory: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "forget_memory",
  {
    description: "Delete a memory from semantic memory using its ID or a similarity query.",
    inputSchema: z.object({
      id: z.string().optional().describe("The specific ID of the memory to forget"),
      query: z.string().optional().describe("A query to find and forget the most similar memory"),
    }),
  },
  async ({ id, query }) => {
    try {
      if (id) {
        await sm.forget(id);
        return { content: [{ type: "text", text: `Successfully forgot memory with ID ${id}` }] };
      } else if (query) {
        const count = await sm.forgetByQuery(query);
        return { content: [{ type: "text", text: count > 0 ? `Successfully forgot memory similar to: ${query}` : "No similar memory found to forget." }] };
      } else {
        return { content: [{ type: "text", text: "Please provide either an 'id' or a 'query'." }], isError: true };
      }
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error forgetting memory: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "checkpoint_semantic",
  {
    description: "Trigger a manual snapshot of the semantic memory (Qdrant).",
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const snapshotName = await sm.createSnapshot();
      return {
        content: [{ type: "text", text: `Semantic snapshot created: ${snapshotName}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error creating semantic snapshot: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "remember_fact",
  {
    description: "Save a specific fact as a key-value pair for exact recall.",
    inputSchema: z.object({
      key: z.string().describe("The unique key for this fact"),
      value: z.string().describe("The value or description of the fact"),
    }),
  },
  async ({ key, value }) => {
    try {
      await factm.remember(key, value);
      return {
        content: [{ type: "text", text: `Successfully saved fact: ${key}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error saving fact: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "recall_fact",
  {
    description: "Retrieve a specific fact by its key.",
    inputSchema: z.object({
      key: z.string().describe("The key of the fact to retrieve"),
    }),
  },
  async ({ key }) => {
    try {
      const fact = await factm.recall(key);
      if (!fact) {
        return {
          content: [{ type: "text", text: `Fact "${key}" not found.` }],
          isError: true,
        };
      }

      return {
        content: [{ type: "text", text: `Fact "${key}": ${fact.value}\nLast updated: ${fact.updatedAt}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error recalling fact: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "forget_fact",
  {
    description: "Delete a fact from the key-value store.",
    inputSchema: z.object({
      key: z.string().describe("The key of the fact to forget"),
    }),
  },
  async ({ key }) => {
    try {
      await factm.forget(key);
      return {
        content: [{ type: "text", text: `Successfully forgot fact: ${key}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error forgetting fact: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "list_facts",
  {
    description: "List all known facts from the key-value store.",
    inputSchema: z.object({}),
  },
  async () => {
    try {
      const facts = await factm.getAll();
      const keys = Object.keys(facts);

      if (keys.length === 0) {
        return {
          content: [{ type: "text", text: "No facts found in the store." }],
        };
      }

      return {
        content: [{ type: "text", text: `Stored facts:\n- ${keys.join("\n- ")}` }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error listing facts: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

server.registerTool(
  "checkpoint_facts",
  {
    description: "Trigger a manual persistent snapshot (RDB) of all facts in Redis.",
    inputSchema: z.object({}),
  },
  async () => {
    try {
      await factm.checkpoint();
      return {
        content: [{ type: "text", text: "Manual checkpoint (BGSAVE) triggered successfully." }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error triggering checkpoint: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

const transport = new StdioServerTransport();
await server.connect(transport);
