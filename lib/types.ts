// Core document processing types
export interface DocumentChunk {
  id: string;
  text: string;
  metadata: {
    filename: string;
    page: number;
    chunkIndex: number;
    totalChunks: number;
    pdfBuffer?: Buffer; // For storing split PDF chunks
  };
}

export interface ProcessedChunk {
  id: string;
  text: string;
  embedding: number[];
  metadata: DocumentChunk["metadata"];
}

export type QueryType = "question" | "condition";

export interface QueryInput {
  text: string;
  type: QueryType;
}

export interface QuestionAnswer {
  query: string;
  answer: string;
  confidence: number;
  sources: string[];
  type: QueryType;
  debugInfo?: {
    relevantChunks: VectorSearchResult[];
    contextUsed: string[];
  };
}

// New type for file-specific results
export interface FileResult {
  filename: string;
  answers: QuestionAnswer[];
}

// Updated main result structure
export interface ProcessingResult {
  fileResults: FileResult[];
  debugInfo: DocumentExtractionDebug[];
}

// Embeddings types
export interface EmbeddingsMetadata {
  text: string;
  filename: string;
  page: number;
  chunkIndex: number;
  totalChunks: number;
  [key: string]: string | number | boolean | undefined; // Add index signature for compatibility
}

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: EmbeddingsMetadata;
}

// Debug types
export interface DocumentExtractionDebug {
  filename: string;
  rawExtraction: string;
  chunks: string[];
}
