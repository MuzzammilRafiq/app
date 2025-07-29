import { connect } from "@lancedb/lancedb";

interface ImageEmbedding {
  id: number;
  filename: string;
  description: string;
  vector: Float32Array;
}

export class LanceDBManager {
  private static instance: LanceDBManager;
  private db: any;
  private table: any;
  private tableName: string = "image_embeddings";
  private isInitialized: boolean = false;
  private embeddingServiceUrl: string = "http://localhost:8000/url";

  private constructor() {
    this.initialize();
  }

  public static getInstance(): LanceDBManager {
    if (!LanceDBManager.instance) {
      LanceDBManager.instance = new LanceDBManager();
    }
    return LanceDBManager.instance;
  }

  private async initialize() {
    this.db = await connect("./lancedb");
    await this.ensureTableExists();
    this.isInitialized = true;
  }

  private async ensureTableExists() {
    try {
      this.table = await this.db.openTable(this.tableName);
    } catch (error) {
      const sampleData: ImageEmbedding[] = [
        {
          id: 0,
          filename: "sample.jpg",
          description: "sample description",
          vector: new Float32Array(Array(512).fill(0.1)),
        },
      ];

      this.table = await this.db.createTable(this.tableName, sampleData);
      await this.table.delete("id = 0");
    }
  }

  private async ensureInitialized() {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  private async generateEmbedding(imageUrl: string): Promise<Float32Array> {
    try {
      const response = await fetch(this.embeddingServiceUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url: imageUrl,
        }),
      });

      if (!response.ok) {
        throw new Error(`Embedding service error: ${response.status}`);
      }

      const data = await response.json();

      // Convert the array to Float32Array
      return new Float32Array(data);
    } catch (error) {
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }

  async addImageWithEmbedding(id: number, filename: string, imageUrl: string, description: string = ""): Promise<void> {
    await this.ensureInitialized();

    const vector = await this.generateEmbedding(imageUrl);
    const record: ImageEmbedding = {
      id,
      filename,
      description,
      vector,
    };

    await this.table.add([record]);
  }

  async addEmbedding(id: number, filename: string, description: string, vector: Float32Array): Promise<void> {
    await this.ensureInitialized();
    const record: ImageEmbedding = {
      id,
      filename,
      description,
      vector,
    };
    await this.table.add([record]);
  }

  async searchSimilar(queryVector: Float32Array, limit: number = 3): Promise<any[]> {
    await this.ensureInitialized();
    const results = await this.table.vectorSearch(queryVector).limit(limit).toArray();
    return results;
  }

  async searchSimilarByImage(imageUrl: string, limit: number = 3): Promise<any[]> {
    await this.ensureInitialized();
    const queryVector = await this.generateEmbedding(imageUrl);
    const results = await this.table.vectorSearch(queryVector).limit(limit).toArray();
    return results;
  }

  async getEmbeddingById(id: number): Promise<ImageEmbedding | null> {
    await this.ensureInitialized();
    const results = await this.table.search().where(`id = ${id}`).toArray();
    return results.length > 0 ? results[0] : null;
  }

  async getAllEmbeddings(): Promise<ImageEmbedding[]> {
    await this.ensureInitialized();
    return await this.table.toArray();
  }

  async getNextId(): Promise<number> {
    await this.ensureInitialized();
    const allEmbeddings = await this.getAllEmbeddings();
    if (allEmbeddings.length === 0) {
      return 1;
    }
    const maxId = Math.max(...allEmbeddings.map((e) => e.id));
    return maxId + 1;
  }

  async updateEmbedding(id: number, updates: Partial<Omit<ImageEmbedding, "id">>): Promise<void> {
    await this.ensureInitialized();

    const existing = await this.getEmbeddingById(id);
    if (!existing) {
      throw new Error(`Embedding with ID ${id} not found`);
    }

    const updatedRecord: ImageEmbedding = {
      ...existing,
      ...updates,
      id,
    };

    await this.deleteEmbedding(id);
    await this.table.add([updatedRecord]);
  }

  async deleteEmbedding(id: number): Promise<void> {
    await this.ensureInitialized();
    await this.table.delete(`id = ${id}`);
  }

  async deleteEmbeddings(ids: number[]): Promise<void> {
    await this.ensureInitialized();
    await this.table.delete(`id IN (${ids.join(", ")})`);
  }
}
