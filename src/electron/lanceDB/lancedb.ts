import * as lancedb from "@lancedb/lancedb";
import * as arrow from "apache-arrow";
import { createHash } from "crypto";
import assert from "assert";
import { console } from "inspector/promises";
import chalk from "chalk";

interface ImageEmbedding {
  id: string;
  filepath: string;
  vector: number[];
}

export class LanceDBManager {
  private static instance: LanceDBManager;
  private db: lancedb.Connection | undefined = undefined;
  private dbdir: string = "./lancedb";
  private tableName: string = "image_embeddings";
  private table: lancedb.Table | undefined = undefined;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private embeddingServiceUrl: string = process.env.EMBEDDING_SERVICE_URL!;

  private schema = new arrow.Schema([
    new arrow.Field("id", new arrow.Utf8()),
    new arrow.Field("filepath", new arrow.Utf8()),
    new arrow.Field("vector", new arrow.FixedSizeList(512, new arrow.Field("item", new arrow.Float32()))),
  ]);

  private constructor() {
    // Don't call initialize here - it will be called when needed
  }

  private async initialize() {
    if (this.isInitialized) {
      return;
    }

    if (this.initializationPromise) {
      await this.initializationPromise;
      return;
    }

    this.initializationPromise = this._initialize();
    await this.initializationPromise;
  }

  private async _initialize() {
    try {
      this.db = await lancedb.connect(this.dbdir);
      await this.ensureTableExists();
      this.isInitialized = true;
    } catch (error) {
      console.error(chalk.red("Error initializing LanceDB:", error));
      throw error;
    }
  }

  private async ensureTableExists() {
    if (!this.db) {
      throw new Error("Database not initialized");
    }

    const exisTables = await this.db.tableNames();
    if (exisTables.includes(this.tableName)) {
      // Check if we need to recreate the table due to schema mismatch
      try {
        this.table = await this.db.openTable(this.tableName);
        console.log(chalk.blue("Opened existing table:", this.tableName));
      } catch (error) {
        console.log(chalk.yellow("Schema mismatch detected, recreating table:", this.tableName));
        await this.db.dropTable(this.tableName);
        this.table = await this.db.createEmptyTable(this.tableName, this.schema);
        console.log(chalk.green("Recreated table:", this.tableName, "with schema for 512-dimensional vectors"));
      }
    } else {
      this.table = await this.db.createEmptyTable(this.tableName, this.schema);
      console.log(chalk.green("Created new table:", this.tableName, "with schema for 512-dimensional vectors"));
    }
  }

  public static getInstance(): LanceDBManager {
    if (!LanceDBManager.instance) {
      LanceDBManager.instance = new LanceDBManager();
    }
    return LanceDBManager.instance;
  }

  async generateEmbedding(
    filepaths: string[]
  ): Promise<{ success: boolean; error: Error | null; data: { filepath: string; stored: boolean }[] | null }> {
    try {
      if (!this.embeddingServiceUrl) {
        throw new Error("EMBEDDING_SERVICE_URL environment variable is not set");
      }
      const fileUrls = filepaths.map((filepath) => (filepath.startsWith("file://") ? filepath : `file://${filepath}`));

      const responses = await Promise.all(
        fileUrls.map(async (fileUrl) => {
          try {
            const response = await fetch(`${this.embeddingServiceUrl}/filepath`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                url: fileUrl,
              }),
            });
            if (!response.ok) {
              throw new Error(`Embedding service error: ${response.status}`);
            }
            const data = await response.json();
            return { [fileUrl]: new Float32Array(JSON.parse(data)) };
          } catch (error) {
            console.error(chalk.red(`Error generating embedding for ${fileUrl}:`, error));
            return { [fileUrl]: null };
          }
        })
      );

      const embeddingData = Object.fromEntries(responses.map((response) => Object.entries(response)[0]));

      // Save successful embeddings to database
      const successfulEmbeddings = Object.entries(embeddingData)
        .filter(([_, embedding]) => embedding !== null)
        .map(([fileUrl, embedding]) => ({
          filepath: fileUrl,
          vector: embedding as Float32Array,
        }));

      let storedSuccessfully = false;
      if (successfulEmbeddings.length > 0) {
        const saveResult = await this.create(successfulEmbeddings);
        if (!saveResult.success) {
          console.warn(chalk.yellow("Failed to save some embeddings to database:", saveResult.error));
          storedSuccessfully = false;
        } else {
          console.log(chalk.green(`Successfully saved ${successfulEmbeddings.length} embeddings to database`));
          storedSuccessfully = true;
        }
      }

      // Create result array with filepath and stored status
      const resultData = filepaths.map((filepath) => {
        const fileUrl = filepath.startsWith("file://") ? filepath : `file://${filepath}`;
        const embedding = embeddingData[fileUrl];
        const wasGenerated = embedding !== null;
        const wasStored = wasGenerated && storedSuccessfully;

        return {
          filepath: filepath,
          stored: wasStored,
        };
      });

      return {
        success: true,
        error: null,
        data: resultData,
      };
    } catch (error) {
      console.error(chalk.red(`Error generating embedding: ${String(error)}`));
      return { success: false, error: error as Error, data: null };
    }
  }

  // now do crud
  async create(data: { filepath: string; vector: Float32Array }[]): Promise<{ success: boolean; error: Error | null }> {
    try {
      await this.initialize();
      assert(
        data.length === data.length,
        `Filepath ${data.length} and embedding ${data.length} must have the same length`
      );

      const embeddings = [];
      const existingIds = new Set<string>();

      // First, get all existing IDs to check for duplicates
      try {
        const existingRecords = await this.table!.query().toArray();
        existingRecords.forEach((record: any) => existingIds.add(record.id));
      } catch (error) {
        console.warn("Could not fetch existing records, proceeding with insert:", error);
      }

      let updatedCount = 0;
      let insertedCount = 0;

      for (let i = 0; i < data.length; i++) {
        const id = createHash("sha256").update(data[i].filepath).digest("hex");
        const embedding = {
          id: id,
          filepath: data[i].filepath,
          vector: Array.from(data[i].vector),
        };

        if (existingIds.has(id)) {
          // Update existing record
          await this.table!.update({
            where: `id = '${id}'`,
            values: {
              vector: embedding.vector,
              filepath: embedding.filepath, // Update filepath too in case it changed
            },
          });
          updatedCount++;
          console.log(chalk.yellow(`Updated existing embedding for: ${data[i].filepath}`));
        } else {
          // Add to batch for new insertions
          embeddings.push(embedding);
          insertedCount++;
        }
      }

      // Insert new embeddings if any
      if (embeddings.length > 0) {
        await this.table!.add(embeddings);
        console.log(chalk.green(`Inserted ${embeddings.length} new embeddings`));
      }

      if (updatedCount > 0) {
        console.log(chalk.blue(`Updated ${updatedCount} existing embeddings`));
      }

      return { success: true, error: null };
    } catch (error) {
      console.error("Error adding/updating image embedding:", error);
      return { success: false, error: error as Error };
    }
  }

  async search(
    vector: Float32Array,
    limit: number = 3
  ): Promise<{ success: boolean; error: Error | null; data: ImageEmbedding[] | null }> {
    try {
      await this.initialize();
      const res = await this.table!.search(Array.from(vector), "vector").limit(limit).toArray();
      console.log(chalk.green(`Search completed, found ${res.length} results`));
      return { success: true, error: null, data: res };
    } catch (error) {
      console.error("Error searching image embedding:", error);
      return { success: false, error: error as Error, data: null };
    }
  }

  async getAll(): Promise<{ success: boolean; error: Error | null; data: ImageEmbedding[] | null }> {
    try {
      await this.initialize();
      const res = await this.table!.query().toArray();
      return { success: true, error: null, data: res };
    } catch (error) {
      console.error("Error getting all image embeddings:", error);
      return { success: false, error: error as Error, data: null };
    }
  }

  async searchByText(query: string, limit: number = 10): Promise<string[]> {
    try {
      if (!this.embeddingServiceUrl) {
        throw new Error("EMBEDDING_SERVICE_URL environment variable is not set");
      }

      // Generate embedding for the text query
      const response = await fetch(`${this.embeddingServiceUrl}/text`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: query,
        }),
      });

      if (!response.ok) {
        throw new Error(`Text embedding service error: ${response.status}`);
      }

      const embeddingData = await response.json();
      const queryEmbedding = new Float32Array(JSON.parse(embeddingData));
      // Search for similar embeddings
      const searchResult = await this.search(queryEmbedding, limit);

      if (!searchResult.success || !searchResult.data) {
        console.warn("Text search returned no results or failed:", searchResult.error);
        return [];
      }

      // Extract only filepaths and remove "file://" prefix if present
      const filepaths = searchResult.data.map((result: ImageEmbedding) => {
        let filepath = result.filepath;
        if (filepath.startsWith("file://")) {
          filepath = filepath.substring(7); // Remove "file://" prefix
        }
        return filepath;
      });

      console.log(chalk.green(`Text search for "${query}" found ${filepaths.length} results`));
      return filepaths;
    } catch (error) {
      console.error(chalk.red(`Error in searchByText for query "${query}":`, error));
      throw error;
    }
  }
}

if (require.main === module) {
  const db = LanceDBManager.getInstance();

  // Test generating embeddings
  const filepaths = [
    "/Users/malikmuzzammilrafiq/Pictures/i/image-96.jpg",
    "/Users/malikmuzzammilrafiq/Pictures/i/image-97.jpg",
    "/Users/malikmuzzammilrafiq/Pictures/i/image-98.jpg",
  ];

  await db.generateEmbedding(filepaths);
  const searchResults = await db.searchByText("white and black butterfly", 1);
  console.log(chalk.green(JSON.stringify(searchResults, null, 2)));
}
