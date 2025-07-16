// Main extraction functionality
export {
  parseDocuments,
  processSingleDocument,
  findSimilarContent,
} from "./extraction";

// PDF processing functions
export {
  createPDFChunks,
  processChunkWithClaude,
  splitTextIntoParagraphs,
  answerQuestion,
  fileToBase64,
} from "./pdf-parser";

// PDF splitting functions
export {
  splitPdfChunks,
  getPdfPageCount,
  bufferToFile,
  shouldSplitPdf,
  type SplitOptions,
} from "./pdf-splitter";

// Embeddings and vector operations
export {
  generateEmbeddings,
  storeEmbeddings,
  searchRelevantChunks,
  cleanupEmbeddings,
  embeddingsExist,
  createNamespace,
} from "./embeddings";

// Types
export type {
  DocumentChunk,
  ProcessedChunk,
  QuestionAnswer,
  EmbeddingsMetadata,
  VectorSearchResult,
} from "./types";
