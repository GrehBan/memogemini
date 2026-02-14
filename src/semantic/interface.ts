export type SearchResult = {
  ids: string[][];
  documents: (string | null)[][];
  metadatas: (Record<string, any> | null)[][];
  distances?: number[][] | null;
  scores?: number[][] | null;
};

export interface ISemanticMemo {
  remember(text: string, metadata: Record<string, any>): Promise<void>;
  search(query: string, results_count: number): Promise<SearchResult>;
  forget(id: string): Promise<void>;
  forgetByQuery(query: string): Promise<number>;
  createSnapshot(): Promise<string>;
}
