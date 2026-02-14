import { ISemanticMemo, SearchResult } from "./interface.js";
import { QdrantClient } from "@qdrant/js-client-rest";
import { env, pipeline, FeatureExtractionPipeline } from "@huggingface/transformers";
import { createHash } from "crypto";
import { config } from "../config.js";
import path from "path";

// Set cache directory to a writable location
env.cacheDir = path.join(config.NOTES_DIR, ".cache");

export class SemanticMemo implements ISemanticMemo {
  private client: QdrantClient;
  private collectionName: string;
  private embed?: FeatureExtractionPipeline;
  private embedModel: string;
  private vectorSize: number = 384; // Default for all-MiniLM-L6-v2

  constructor(
    url: string = config.QDRANT_URL,
    collectionName: string = config.QDRANT_COLLECTION,
    embedModel: string = config.EMBED_MODEL
  ) {
    this.client = new QdrantClient({ url });
    this.collectionName = collectionName;
    this.embedModel = embedModel;
  }

  async getEmbedModel(): Promise<FeatureExtractionPipeline> {
    if (this.embed) return this.embed;
    this.embed = await pipeline("feature-extraction", this.embedModel) as any;
    return this.embed!;
  }

  private async getEmbedding(text: string): Promise<number[]> {
    const embed = await this.getEmbedModel();
    const output = await embed(text, { pooling: "mean", normalize: true });
    const embedding = Array.from(output.data as Float32Array);
    
    if (embedding.length !== this.vectorSize) {
      console.warn(`Embedding size mismatch: expected ${this.vectorSize}, got ${embedding.length}`);
      // Update vectorSize to match actual embedding if it's consistent
      this.vectorSize = embedding.length;
    }
    
    return embedding;
  }

  async ensureCollection() {
    try {
      const collections = await this.client.getCollections();
      const exists = collections.collections.some(c => c.name === this.collectionName);
      
      if (!exists) {
        await this.client.createCollection(this.collectionName, {
          vectors: {
            size: this.vectorSize,
            distance: "Cosine",
            on_disk: true // Maximum persistence (RDB-like behavior for storage)
          }
        });
      } else {
        const info = await this.client.getCollection(this.collectionName);
        const currentSize = (info.config.params.vectors as any)?.size;
        const currentOnDisk = (info.config.params.vectors as any)?.on_disk;

        if (currentSize !== this.vectorSize || currentOnDisk !== true) {
           console.warn(`Collection configuration mismatch (size or on_disk). Recreating collection for maximum persistence.`);
           await this.client.deleteCollection(this.collectionName);
           await this.client.createCollection(this.collectionName, {
             vectors: {
               size: this.vectorSize,
               distance: "Cosine",
               on_disk: true
             }
           });
        }
      }
    } catch (e) {
      console.error("Error ensuring Qdrant collection:", e);
      throw e;
    }
  }

  async createSnapshot(): Promise<string> {
    const result = await this.client.createSnapshot(this.collectionName);
    return result?.name || "unnamed_snapshot";
  }

  async remember(text: string, metadata: Record<string, any> = {}): Promise<void> {
    await this.ensureCollection();
    const embedding = await this.getEmbedding(text);
    const id = createHash("md5").update(text).digest("hex");
    // Qdrant expects UUID or integer ID. MD5 hex is 32 chars, we can use it as a string ID if we format it as UUID or just use it.
    // Qdrant supports string IDs (UUIDs).
    const uuid = `${id.slice(0, 8)}-${id.slice(8, 12)}-${id.slice(12, 16)}-${id.slice(16, 20)}-${id.slice(20, 32)}`;

    await this.client.upsert(this.collectionName, {
      wait: true,
      points: [
        {
          id: uuid,
          vector: embedding,
          payload: {
            document: text,
            ...metadata,
            timestamp: Date.now() / 1000
          }
        }
      ]
    });
  }

  async search(query: string, results_count: number): Promise<SearchResult> {
    await this.ensureCollection();
    const queryEmbedding = await this.getEmbedding(query);

    const result = await this.client.search(this.collectionName, {
      vector: queryEmbedding,
      limit: results_count,
      with_payload: true
    });

    return {
      ids: [result.map(r => r.id as string)],
      documents: [result.map(r => r.payload?.document as string)],
      metadatas: [result.map(r => {
        const { document, ...meta } = (r.payload || {});
        return meta;
      })],
      distances: [result.map(r => r.score)] // Qdrant returns scores (1 is best for cosine)
    };
  }

  async forget(id: string): Promise<void> {
    await this.ensureCollection();
    await this.client.delete(this.collectionName, {
      points: [id]
    });
  }

  async forgetByQuery(query: string): Promise<number> {
    await this.ensureCollection();
    const queryEmbedding = await this.getEmbedding(query);

    // Find the most similar point
    const result = await this.client.search(this.collectionName, {
      vector: queryEmbedding,
      limit: 1,
      with_payload: true
    });

    if (result.length > 0) {
      const id = result[0].id;
      await this.client.delete(this.collectionName, {
        points: [id]
      });
      return 1;
    }
    return 0;
  }
}
