import fs from "node:fs";
import path from "node:path";
import { getDirs } from "../get-folder.js";
import { DatabaseSync } from "node:sqlite";
import { randomUUID } from "crypto";
import type { EmbeddingRecord, Embed, ImagePathRecord } from "./types.js";

export class ImageEmbeddingStore {
  private static instance: ImageEmbeddingStore | null = null;
  private readonly db: DatabaseSync;
  private readonly imageTable = "image";
  private readonly pathTrackingTable = "image_path_tracking";

  private constructor() {
    const { aiDir } = getDirs();
    const dbPath = path.join(aiDir, "image_embeddings.db");
    this.ensureParentDir(dbPath);
    this.db = new DatabaseSync(dbPath);
    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");
    this.initializeSchema();
  }

  static getInstance(): ImageEmbeddingStore {
    if (!ImageEmbeddingStore.instance) {
      ImageEmbeddingStore.instance = new ImageEmbeddingStore();
    }
    return ImageEmbeddingStore.instance;
  }

  private ensureParentDir(dbPath: string): void {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  // Escape % _ and \\ for use in a LIKE pattern with ESCAPE '\\'
  private escapeLike(input: string): string {
    return input.replace(/[\\%_]/g, "\\$&");
  }

  private initializeSchema(): void {
    const createImageTable = `
      CREATE TABLE IF NOT EXISTS ${this.imageTable} (
        id TEXT PRIMARY KEY,
        embedding TEXT NOT NULL,
        metadata TEXT NOT NULL,
        path TEXT NOT NULL,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );
    `;
    
    const createPathTrackingTable = `
      CREATE TABLE IF NOT EXISTS ${this.pathTrackingTable} (
        path TEXT PRIMARY KEY,
        is_folder INTEGER NOT NULL,
        no_of_items INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000),
        updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now') * 1000)
      );
    `;
    
    const createImagePathIndex = `
      CREATE INDEX IF NOT EXISTS idx_image_path 
      ON ${this.imageTable}(path);
    `;
    
    const createPathTrackingFolderIndex = `
      CREATE INDEX IF NOT EXISTS idx_path_tracking_is_folder 
      ON ${this.pathTrackingTable}(is_folder);
    `;

    this.db.exec("BEGIN TRANSACTION");
    try {
      this.db.exec(createImageTable);
      this.db.exec(createPathTrackingTable);
      this.db.exec(createImagePathIndex);
      this.db.exec(createPathTrackingFolderIndex);
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  insert(embedding: string, metadata: string, path: string): EmbeddingRecord {
    const id = randomUUID();
    const now = Date.now();

    this.db.exec("BEGIN TRANSACTION");
    try {
      const sql = `INSERT INTO ${this.imageTable} (id, embedding, metadata, path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`;
      const stmt = this.db.prepare(sql);
      stmt.run(id, embedding, metadata, path, now, now);

      this.upsertPathTracking(path, false);

      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }

    return {
      id,
      embedding,
      metadata,
      path,
      createdAt: now,
      updatedAt: now,
    };
  }

  getById(id: string): EmbeddingRecord | null {
    const sql = `SELECT id, embedding, metadata, path, created_at as createdAt, updated_at as updatedAt FROM ${this.imageTable} WHERE id = ?`;
    const stmt = this.db.prepare(sql);
    const row = stmt.get(id) as
      | {
          id: string;
          embedding: string;
          metadata: string;
          path: string;
          createdAt: number;
          updatedAt: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      id: row.id,
      embedding: row.embedding,
      metadata: row.metadata,
      path: row.path,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  getAll(): Embed[] {
    const sql = `SELECT embedding, metadata, path FROM ${this.imageTable}`;
    const stmt = this.db.prepare(sql);
    const rows = stmt.all() as Array<{
      embedding: string;
      metadata: string;
      path: string;
    }>;

    return rows.map((row) => ({
      embedding: row.embedding,
      metadata: row.metadata,
      path: row.path,
    }));
  }

  delete(filePath: string): boolean {
    if (!filePath) {
      throw new Error('Path cannot be empty');
    }
    
    const isFolder = filePath.endsWith('/');
    
    this.db.exec("BEGIN TRANSACTION");
    try {
      let result;
      
      if (isFolder) {
        const folderPathWithoutSlash = filePath.slice(0, -1);
        const escapedFolder = this.escapeLike(folderPathWithoutSlash);
        
        const deleteSql = `
          DELETE FROM ${this.imageTable}
          WHERE path = ? 
             OR path LIKE ? ESCAPE '\\'
        `;
        
        const stmt = this.db.prepare(deleteSql);
        result = stmt.run(folderPathWithoutSlash, `${escapedFolder}/%`);
        
        const deleteTrackingSql = `
          DELETE FROM ${this.pathTrackingTable}
          WHERE path = ? 
             OR path LIKE ? ESCAPE '\\'
        `;
        const trackingStmt = this.db.prepare(deleteTrackingSql);
        trackingStmt.run(folderPathWithoutSlash, `${escapedFolder}/%`);

        // Update parent's item count, if any
        const parentPath = this.getParentPath(folderPathWithoutSlash);
        if (parentPath) {
          this.updateParentCount(parentPath);
        }
      } else {
        const deleteSql = `
          DELETE FROM ${this.imageTable}
          WHERE path = ?
        `;
        
        const stmt = this.db.prepare(deleteSql);
        result = stmt.run(filePath);
        
        const deleteTrackingSql = `
          DELETE FROM ${this.pathTrackingTable}
          WHERE path = ?
        `;
        const trackingStmt = this.db.prepare(deleteTrackingSql);
        trackingStmt.run(filePath);

        // Update parent's item count, if any
        const parentPath = this.getParentPath(filePath);
        if (parentPath) {
          this.updateParentCount(parentPath);
        }
      }
      
      this.db.exec("COMMIT");
      return result.changes > 0;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  private upsertPathTracking(filePath: string, isFolder: boolean): void {
    const now = Date.now();
    
    const upsertSql = `
      INSERT INTO ${this.pathTrackingTable} (path, is_folder, no_of_items, created_at, updated_at)
      VALUES (?, ?, 1, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        no_of_items = 1,
        updated_at = ?
    `;
    const stmt = this.db.prepare(upsertSql);
    stmt.run(filePath, isFolder ? 1 : 0, now, now, now);
    
    if (!isFolder) {
      const parentPath = this.getParentPath(filePath);
      if (parentPath) {
        this.updateParentCount(parentPath, now);
      }
    }
  }

  private getParentPath(filePath: string): string | null {
    const lastSlash = filePath.lastIndexOf('/');
    if (lastSlash <= 0) {
      return null;
    }
    return filePath.substring(0, lastSlash);
  }

  // Recompute and upsert the parent's no_of_items based on current files in the table
  private updateParentCount(parentPath: string, timestamp?: number): void {
    const now = timestamp ?? Date.now();
    const countSql = `
      SELECT COUNT(*) as count 
      FROM ${this.imageTable} 
      WHERE path LIKE ? ESCAPE '\\'
    `;
    const countStmt = this.db.prepare(countSql);
    const escapedParent = this.escapeLike(parentPath);
    const countResult = countStmt.get(`${escapedParent}/%`) as { count: number } | undefined;
    const fileCount = countResult?.count || 0;

    const upsertParentSql = `
      INSERT INTO ${this.pathTrackingTable} (path, is_folder, no_of_items, created_at, updated_at)
      VALUES (?, 1, ?, ?, ?)
      ON CONFLICT(path) DO UPDATE SET
        no_of_items = ?,
        updated_at = ?
    `;
    const parentStmt = this.db.prepare(upsertParentSql);
    parentStmt.run(parentPath, fileCount, now, now, fileCount, now);
  }

  getAllTrackedPaths(): ImagePathRecord[] {
    const sql = `
      SELECT path, is_folder as isFolder, no_of_items as noOfItems, 
             created_at as createdAt, updated_at as updatedAt
      FROM ${this.pathTrackingTable}
      ORDER BY path
    `;
    const stmt = this.db.prepare(sql);
    const rows = stmt.all() as Array<{
      path: string;
      isFolder: number;
      noOfItems: number;
      createdAt: number;
      updatedAt: number;
    }>;

    return rows.map((row) => ({
      type: 'image' as const,
      path: row.path,
      isFolder: row.isFolder === 1,
      noOfItems: row.noOfItems,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  getTrackedPath(filePath: string): ImagePathRecord | null {
    const sql = `
      SELECT path, is_folder as isFolder, no_of_items as noOfItems, 
             created_at as createdAt, updated_at as updatedAt
      FROM ${this.pathTrackingTable}
      WHERE path = ?
    `;
    const stmt = this.db.prepare(sql);
    const row = stmt.get(filePath) as
      | {
          path: string;
          isFolder: number;
          noOfItems: number;
          createdAt: number;
          updatedAt: number;
        }
      | undefined;

    if (!row) {
      return null;
    }

    return {
      type: 'image' as const,
      path: row.path,
      isFolder: row.isFolder === 1,
      noOfItems: row.noOfItems,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  getTrackedFolders(): ImagePathRecord[] {
    const sql = `
      SELECT path, is_folder as isFolder, no_of_items as noOfItems, 
             created_at as createdAt, updated_at as updatedAt
      FROM ${this.pathTrackingTable}
      WHERE is_folder = 1
      ORDER BY path
    `;
    const stmt = this.db.prepare(sql);
    const rows = stmt.all() as Array<{
      path: string;
      isFolder: number;
      noOfItems: number;
      createdAt: number;
      updatedAt: number;
    }>;

    return rows.map((row) => ({
      type: 'image' as const,
      path: row.path,
      isFolder: true,
      noOfItems: row.noOfItems,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  clear(): void {
    this.db.exec(`DELETE FROM ${this.imageTable}`);
    this.db.exec(`DELETE FROM ${this.pathTrackingTable}`);
  }

  close(): void {
    this.db.close();
    ImageEmbeddingStore.instance = null;
  }
}

export default ImageEmbeddingStore.getInstance();
