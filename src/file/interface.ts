export interface IFileMemory {
  write(folder: string, name: string, content: string): Promise<void>;
  read(folder: string, name: string): Promise<string | null>;
  listDocs(folder: string): Promise<string[]>;
  delete(folder: string, name: string): Promise<void>;
}
