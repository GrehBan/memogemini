export type Fact = {
  value: string;
  updatedAt: string;
};

export interface IFactMemo {
    remember(key: string, value: string): Promise<void>;
    recall(key: string): Promise<Fact | undefined>;
    forget(key: string): Promise<void>;
    getAll(): Promise<Record<string, Fact>>;
    connect(): Promise<void>;
    checkpoint(): Promise<void>;
}
