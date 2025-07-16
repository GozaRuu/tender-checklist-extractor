import { Index } from "@upstash/vector";
import OpenAI from "openai";
import type {
  EmbeddingsMetadata,
  ProcessedChunk,
  VectorSearchResult,
} from "./types";
import config from "./config";

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

// Initialize vector index
const vectorIndex = new Index<EmbeddingsMetadata>({
  url: process.env.UPSTASH_VECTOR_REST_URL!,
  token: process.env.UPSTASH_VECTOR_REST_TOKEN!,
});

// Get configuration
const aiConfig = config.getAiConfig();
const processingConfig = config.getProcessingConfig();
const sessionConfig = config.getSessionConfig();

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
    console.log(`\n=== GENERATING EMBEDDINGS ===`);
    console.log(`Number of text chunks: ${textChunks.length}`);
    console.log(`Model: ${aiConfig.openai.embeddingModel}`);

    const embeddings: number[][] = [];

    // Process each text chunk individually
    for (const chunk of textChunks) {
      console.log(
        `Processing chunk (length: ${chunk.length}): "${chunk.substring(
          0,
          100
        )}${chunk.length > 100 ? "..." : ""}"`
      );

      const response = await openai.embeddings.create({
        model: aiConfig.openai.embeddingModel,
        input: chunk,
      });

      const embedding = response.data[0].embedding;
      console.log(`Generated embedding with ${embedding.length} dimensions`);

      embeddings.push(embedding);
    }

    console.log(`Generated ${embeddings.length} embeddings`);
    console.log(`Embedding dimensions: ${embeddings[0]?.length}`);
    console.log(`=== EMBEDDINGS GENERATION COMPLETED ===\n`);

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
    console.log(`\n=== STORING EMBEDDINGS ===`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`Number of processed chunks: ${processedChunks.length}`);

    const namespace = createNamespace(sessionId);

    const vectors = processedChunks.map((chunk, index) => ({
      id: `${sessionId}:chunk:${index}`,
      vector: chunk.embedding,
      metadata: {
        text: chunk.text,
        filename: chunk.metadata.filename,
        page: chunk.metadata.page,
        chunkIndex: chunk.metadata.chunkIndex,
        totalChunks: chunk.metadata.totalChunks,
      },
    }));

    console.log(`Created ${vectors.length} vectors to store`);
    console.log(`Sample vector IDs: ${vectors.slice(0, 3).map((v) => v.id)}`);
    console.log(
      `Sample text lengths: ${vectors
        .slice(0, 3)
        .map((v) => v.metadata.text.length)}`
    );

    // Store in batches to avoid hitting rate limits
    const batchSize = processingConfig.embeddings.batchSize;
    for (let i = 0; i < vectors.length; i += batchSize) {
      const batch = vectors.slice(i, i + batchSize);
      console.log(
        `Storing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          vectors.length / batchSize
        )} (${batch.length} vectors)`
      );

      const result = await namespace.upsert(batch);
      console.log(`Batch ${Math.floor(i / batchSize) + 1} result:`, result);
    }

    // Add a delay to ensure embeddings are properly indexed
    console.log(`Waiting 2 seconds for embeddings to be indexed...`);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Verify embeddings were stored correctly
    await testEmbeddingsStorage(sessionId);

    console.log(`=== EMBEDDINGS STORED SUCCESSFULLY ===\n`);
  } catch (error) {
    console.error("Error storing embeddings:", error);
    throw new Error("Failed to store embeddings");
  }
}

/**
 * Test if embeddings were stored correctly
 */
async function testEmbeddingsStorage(sessionId: string): Promise<void> {
  try {
    console.log(`\n=== TESTING EMBEDDINGS STORAGE ===`);
    const namespace = createNamespace(sessionId);

    // Try to fetch the first few chunks
    const testIds = [
      `${sessionId}:chunk:0`,
      `${sessionId}:chunk:1`,
      `${sessionId}:chunk:2`,
    ];
    const fetchResult = await namespace.fetch(testIds);

    console.log(`Fetch test results:`, fetchResult);
    console.log(
      `Successfully fetched ${fetchResult.length} out of ${testIds.length} test vectors`
    );

    // Try a simple query to see if we can retrieve anything
    const testQuery = await namespace.query({
      vector: new Array(1536).fill(0.1), // Simple test vector for text-embedding-3-small
      topK: 3,
      includeMetadata: true,
    });

    console.log(`Simple query test results:`, testQuery);
    console.log(`Query returned ${testQuery.length} results`);

    console.log(`=== EMBEDDINGS STORAGE TEST COMPLETED ===\n`);
  } catch (error) {
    console.error("Error testing embeddings storage:", error);
  }
}

/**
 * Search for relevant chunks using similarity search
 */
export async function searchRelevantChunks(
  question: string,
  sessionId: string,
  topK: number = processingConfig.embeddings.defaultTopK
): Promise<VectorSearchResult[]> {
  try {
    console.log(`\n=== SEARCHING RELEVANT CHUNKS ===`);
    console.log(`Question: ${question}`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`TopK: ${topK}`);

    const namespace = createNamespace(sessionId);

    // First, let's check if we have any vectors in the namespace
    try {
      const testFetch = await namespace.fetch([`${sessionId}:chunk:0`]);
      console.log(`Test fetch result for ${sessionId}:chunk:0:`, testFetch);
    } catch (fetchError) {
      console.log(`Test fetch error:`, fetchError);
    }

    const response = await openai.embeddings.create({
      model: aiConfig.openai.embeddingModel,
      input: question,
    });

    const embedding = response.data[0].embedding;
    console.log(
      `Generated embedding for question (length: ${embedding.length})`
    );

    const results = await namespace.query({
      vector: embedding,
      topK,
      includeMetadata: true,
    });

    console.log(`Raw query results:`, results);
    console.log(`Number of results: ${results.length}`);

    const mappedResults = results.map((result) => ({
      id: String(result.id),
      score: result.score || 0,
      metadata: {
        text: result.metadata?.text || "",
        filename: result.metadata?.filename || "Unknown",
        page: result.metadata?.page || 1,
        chunkIndex: result.metadata?.chunkIndex || 0,
        totalChunks: result.metadata?.totalChunks || 1,
      },
    }));

    console.log(
      `Mapped results:`,
      mappedResults.map((r) => ({
        id: r.id,
        score: r.score,
        textLength: r.metadata.text.length,
        filename: r.metadata.filename,
      }))
    );

    console.log(`=== SEARCH COMPLETED ===\n`);
    return mappedResults;
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
