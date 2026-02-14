import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const configSchema = z.object({
  PORT: z.string().optional(), // For future http server if needed, or ignored for stdio
  REDIS_HOST: z.string().default("localhost"),
  REDIS_PORT: z.coerce.number().default(6379),
  QDRANT_URL: z.string().default("http://localhost:6333"),
  QDRANT_COLLECTION: z.string().default("memories"),
  EMBED_MODEL: z.string().default("sentence-transformers/all-MiniLM-L6-v2"),
  NOTES_DIR: z.string().default("./agent_notes"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export const config = configSchema.parse(process.env);
