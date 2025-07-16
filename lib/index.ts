// Main extraction functionality
export {
  parseDocuments,
  processSingleDocument,
  findSimilarContent,
} from "./extraction";

// PDF processing functions
export {
  createPDFChunks,
  processPDFChunk,
  fileToBase64,
  getPDFInfo,
  validatePDFFile,
} from "./pdf-parser";

// PDF splitting functions
export {
  splitPdfChunks,
  getPdfPageCount,
  bufferToFile,
  shouldSplitPdf,
  type SplitOptions,
} from "./pdf-splitter";

// AI service functions
export { processChunkWithClaude, answerQuestion } from "./ai-service";

// Text processing functions
export {
  splitTextIntoParagraphs,
  normalizeText,
  extractMetadata,
  formatText,
} from "./text-processing";

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
