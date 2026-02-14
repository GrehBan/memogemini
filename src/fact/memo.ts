import { IFactMemo, Fact } from "./interface.js";
import { createClient, RedisClientType } from "redis";
import { config } from "../config.js";

export class FactMemo implements IFactMemo {
  private client: RedisClientType;
  private factsDB: string;

  constructor(host: string = config.REDIS_HOST, port: number = config.REDIS_PORT) {
    this.client = createClient({ socket: { host, port } });
    this.factsDB = "agent:facts";
  }

  async connect(): Promise<void> {
    if (!this.client.isOpen) {
      await this.client.connect();
      // Auto-configure persistence on connection
      try {
        await this.client.configSet("appendonly", "yes");
        await this.client.configSet("save", "900 1 300 10 60 10000");
        console.error("Redis persistence (AOF/RDB) auto-configured.");
      } catch (e) {
        console.error("Warning: Could not auto-configure Redis persistence. Ensure you have permissions.", e);
      }
    }
  }

  async disconnect(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.destroy();
    }
  }

  async remember(key: string, value: string): Promise<void> {
    await this.connect();

    const nowIso = new Date().toISOString();
    const fact: Fact = { value, updatedAt: nowIso };

    await this.client.hSet(this.factsDB, key, JSON.stringify(fact));
  }

  async recall(key: string): Promise<Fact | undefined> {
    await this.connect();

    const raw = await this.client.hGet(this.factsDB, key);
    if (!raw) return undefined;

    return JSON.parse(raw) as Fact;
  }

  async forget(key: string): Promise<void> {
    await this.connect();
    await this.client.hDel(this.factsDB, key);
  }

  async getAll(): Promise<Record<string, Fact>> {
    await this.connect();

    const raw = await this.client.hGetAll(this.factsDB);
    const result: Record<string, Fact> = {};

    for (const [k, v] of Object.entries(raw)) {
      result[k] = JSON.parse(v) as Fact;
    }

    return result;
  }

  async checkpoint(): Promise<void> {
    await this.connect();
    try {
      await this.client.bgSave();
    } catch (e: any) {
      if (e.message.includes("Background save already in progress")) {
        return;
      }
      throw e;
    }
  }
}
