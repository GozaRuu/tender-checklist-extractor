// Shared types for the tender document extraction system

export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    filename: string;
    chunkIndex: number;
    pageStart: number;
    pageEnd: number;
  };
}

export interface ProcessedChunk {
  id: string;
  text: string;
  embedding: number[];
  metadata: {
    filename: string;
    chunkIndex: number;
    pageStart: number;
    pageEnd: number;
  };
}

export interface QuestionAnswer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
}

export type EmbeddingsMetadata = {
  text: string;
  filename: string;
  chunkIndex: number;
  pageStart: number;
  pageEnd: number;
};

export interface VectorSearchResult {
  id: string;
  score: number;
  metadata: EmbeddingsMetadata;
}
