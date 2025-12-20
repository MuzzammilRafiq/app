export interface EmbeddingRecord {
  id: string;
  embedding: string;
  metadata: string;
  path: string;
  createdAt: number;
  updatedAt: number;
}

export interface Embed {
  embedding: string;
  metadata: string;
  path: string;
}

export interface PathRecord {
  path: string;
  isFolder: boolean;
  noOfItems: number;
  createdAt: number;
  updatedAt: number;
}

export interface TextPathRecord extends PathRecord {
  type: "text";
}

export interface ImagePathRecord extends PathRecord {
  type: "image";
}
