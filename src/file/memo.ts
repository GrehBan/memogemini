import { IFileMemory } from "./interface.js";
import { promises as fs } from "fs";
import path from "path";
import { config } from "../config.js";

export class FileMemory implements IFileMemory {
  private base: string;

  constructor(basePath: string = config.NOTES_DIR) {
    this.base = path.resolve(basePath);
  }

  private async ensureDir(dirPath: string) {
    await fs.mkdir(dirPath, { recursive: true });
  }

  private resolvePath(folder: string, name: string): string {
    const safeBase = this.base;
    const folderPath = path.join(safeBase, folder);
    const filePath = path.join(folderPath, `${name}.md`);

    if (!filePath.startsWith(safeBase)) {
      throw new Error("Invalid path: Path traversal detected");
    }
    return filePath;
  }

  async write(folder: string, name: string, content: string): Promise<void> {
    const filePath = this.resolvePath(folder, name);
    await this.ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, content, "utf8");
  }

  async read(folder: string, name: string): Promise<string | null> {
    try {
      const filePath = this.resolvePath(folder, name);
      return await fs.readFile(filePath, "utf8");
    } catch (e) {
      return null;
    }
  }

  async listDocs(folder: string): Promise<string[]> {
    const folderPath = path.join(this.base, folder);
    // Basic check for folder traversal
    if (!folderPath.startsWith(this.base)) {
        return [];
    }

    try {
      const files = await fs.readdir(folderPath);
      return files
        .filter((f) => f.endsWith(".md"))
        .map((f) => f.replace(/\.md$/, ""));
    } catch (e) {
      return [];
    }
  }

  async delete(folder: string, name: string): Promise<void> {
    try {
      const filePath = this.resolvePath(folder, name);
      await fs.unlink(filePath);
    } catch (e: any) {
      if (e.code !== 'ENOENT') {
        throw e;
      }
    }
  }
}
