import { Index } from "@upstash/vector";
import OpenAI from "openai";
import type {
  EmbeddingsMetadata,
  ProcessedChunk,
  VectorSearchResult,
} from "./types";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Initialize vector index
const vectorIndex = new Index<EmbeddingsMetadata>({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});

// Configuration
const EMBEDDING_MODEL = "text-embedding-3-small";

/**
 * Create namespace for document embeddings
 */
export function createNamespace(sessionId: string) {
  return vectorIndex.namespace(sessionId);
}

/**
 * Generate embeddings for text chunks using OpenAI
 */
export async function generateEmbeddings(
  textChunks: string[]
): Promise<number[][]> {
  try {
    const embeddings: number[][] = [];

    // Process each text chunk individually
    for (const chunk of textChunks) {
      const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: chunk,
      });
      embeddings.push(response.data[0].embedding);
    }

    return embeddings;
  } catch (error) {
    console.error("Error generating embeddings:", error);
    throw new Error("Failed to generate embeddings");
  }
}

/**
 * Store embeddings in Upstash Vector using namespaces
 */
export async function storeEmbeddings(
  processedChunks: ProcessedChunk[],
  sessionId: string
): Promise<void> {
  try {
    const namespace = createNamespace(sessionId);

    const vectors = processedChunks.map((chunk, index) => ({
      id: `${sessionId}:chunk:${index}`,
      vector: chunk.embedding,
      metadata: {
        text: chunk.text,
        filename: chunk.metadata.filename,
        chunkIndex: chunk.metadata.chunkIndex,
        pageStart: chunk.metadata.pageStart,
        pageEnd: chunk.metadata.pageEnd,
      },
    }));

    // Store in batches to avoid hitting rate limits
    const batchSize = 100;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      await namespace.upsert(batch);
    }
  } catch (error) {
    console.error("Error storing embeddings:", error);
    throw new Error("Failed to store embeddings");
  }
}

/**
 * Search for relevant chunks using similarity search
 */
export async function searchRelevantChunks(
  question: string,
  sessionId: string,
  topK: number = 5
): Promise<VectorSearchResult[]> {
  try {
    const namespace = createNamespace(sessionId);

    const response = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: question,
    });

    const embedding = response.data[0].embedding;

    const results = await namespace.query({
      vector: embedding,
      topK,
      includeMetadata: true,
    });

    return results.map((result) => ({
      id: String(result.id),
      score: result.score || 0,
      metadata: result.metadata || {
        text: "",
        filename: "Unknown",
        chunkIndex: 0,
        pageStart: 1,
        pageEnd: 1,
      },
    }));
  } catch (error) {
    console.error("Error searching relevant chunks:", error);
    throw new Error("Failed to search for relevant content");
  }
}

/**
 * Clean up embeddings after processing
 */
export async function cleanupEmbeddings(sessionId: string): Promise<void> {
  try {
    const namespace = createNamespace(sessionId);
    // Delete all vectors in the namespace
    await namespace.reset();
    console.log(`Cleaned up embeddings for session: ${sessionId}`);
  } catch (error) {
    console.error("Error cleaning up embeddings:", error);
    // Non-critical error, continue processing
  }
}

/**
 * Check if embeddings exist for a session
 */
export async function embeddingsExist(sessionId: string): Promise<boolean> {
  try {
    const namespace = createNamespace(sessionId);
    const results = await namespace.fetch([`${sessionId}:chunk:0`]);
    return results && results.length > 0 && !!results[0];
  } catch (error) {
    console.error("Error checking embeddings existence:", error);
    return false;
  }
}
