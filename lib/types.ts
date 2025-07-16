// Core document processing types
export interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    filename: string;
    page: number;
    chunkIndex: number;
    totalChunks: number;
  };
}

export interface ProcessedChunk {
  id: string;
  text: string;
  embedding: number[];
  metadata: DocumentChunk["metadata"];
}

export interface QuestionAnswer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
}

// Embeddings types
export interface EmbeddingsMetadata {
  text: string;
  filename: string;
  page: number;
  chunkIndex: number;
  totalChunks: number;
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: EmbeddingsMetadata;
}
