import type {
  DocumentChunk,
  ProcessedChunk,
  QuestionAnswer,
  DocumentExtractionDebug,
  QueryType,
} from "./types";
import {
  generateEmbeddings,
  storeEmbeddings,
  searchRelevantChunks,
  cleanupEmbeddings,
} from "./embeddings";
import {
  createPDFChunks,
  processChunkWithClaude,
  splitTextIntoParagraphs,
  answerQuestion,
} from "./pdf-parser";

/**
 * Generate a unique session ID for processing
 */
function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Simple progress callback type
 */
type ProgressCallback = (
  step: string,
  message: string,
  filename?: string,
  chunkId?: string,
  updateTotalSteps?: number
) => void;

/**
 * Detect if input is a question or condition
 */
function detectQueryType(input: string): QueryType {
  // German condition indicators
  const conditionKeywords = [
    "ist",
    "sind",
    "war",
    "waren",
    "wird",
    "werden",
    "kann",
    "können",
    "muss",
    "müssen",
    "sollte",
    "sollten",
    "darf",
    "dürfen",
    "hat",
    "haben",
    "gibt es",
    "existiert",
    "vor dem",
    "nach dem",
    "bis zum",
    "ab dem",
    "spätestens",
    "frühestens",
  ];

  const lowercaseInput = input.toLowerCase();

  // Check for condition patterns
  const hasConditionKeyword = conditionKeywords.some((keyword) =>
    lowercaseInput.includes(keyword)
  );

  // Check for question patterns
  const hasQuestionWord =
    /^(wer|was|wann|wo|wie|warum|welche|welcher|welches|wessen|wem|wen)/i.test(
      input
    );
  const endsWithQuestionMark = input.trim().endsWith("?");

  // If it has condition keywords but no question words, it's likely a condition
  if (hasConditionKeyword && !hasQuestionWord && !endsWithQuestionMark) {
    return "condition";
  }

  return "question";
}

/**
 * Main function to process documents and answer questions
 */
export async function parseDocuments(
  files: File[],
  queries: string[],
  onProgress?: ProgressCallback
): Promise<{
  results: QuestionAnswer[];
  debugInfo: DocumentExtractionDebug[];
}> {
  try {
    console.log("Starting document processing...");

    // Generate a unique session ID for this processing session
    const sessionId = generateSessionId();
    console.log(`Session ID: ${sessionId}`);

    // Helper function to emit progress
    const emitProgress = (
      step: string,
      message: string,
      filename?: string,
      chunkId?: string,
      updateTotalSteps?: number
    ) => {
      console.log(`[${step}] ${message}`, filename, chunkId);
      onProgress?.(step, message, filename, chunkId, updateTotalSteps);
    };

    emitProgress("starting", "Starting document processing...");

    // Step 1: Create document chunks
    const allChunks: DocumentChunk[] = [];
    for (const file of files) {
      emitProgress("chunking", `Creating chunks for ${file.name}`, file.name);
      const chunks = await createPDFChunks(file);
      allChunks.push(...chunks);
    }

    console.log(`Created ${allChunks.length} document chunks`);

    // Calculate actual total steps now that we know the chunk count
    const actualTotalSteps = allChunks.length * 2 + queries.length + 2;

    emitProgress(
      "chunks_created",
      `Created ${allChunks.length} document chunks`,
      undefined,
      undefined,
      actualTotalSteps
    );

    // Step 2: Process chunks with Claude and collect debug info
    const processedChunks: ProcessedChunk[] = [];
    const debugInfo: DocumentExtractionDebug[] = [];

    // Process chunks in parallel with batching to avoid rate limits
    const BATCH_SIZE = 3; // Process 3 chunks at a time
    const chunkBatches = [];

    for (let i = 0; i < allChunks.length; i += BATCH_SIZE) {
      chunkBatches.push(allChunks.slice(i, i + BATCH_SIZE));
    }

    for (let batchIndex = 0; batchIndex < chunkBatches.length; batchIndex++) {
      const batch = chunkBatches[batchIndex];

      console.log(
        `Processing batch ${batchIndex + 1}/${chunkBatches.length} with ${
          batch.length
        } chunks`
      );

      const batchPromises = batch.map(async (chunk, indexInBatch) => {
        const overallIndex = batchIndex * BATCH_SIZE + indexInBatch;
        const file = files.find((f) => f.name === chunk.metadata.filename);

        if (!file) {
          console.error(`File not found for chunk: ${chunk.id}`);
          emitProgress(
            "error",
            `File not found for chunk: ${chunk.id}`,
            chunk.metadata.filename,
            chunk.id
          );
          return null;
        }

        console.log(
          `Processing chunk ${overallIndex + 1}/${allChunks.length}: ${
            chunk.id
          }`
        );
        emitProgress(
          "processing",
          `Processing chunk ${overallIndex + 1}/${allChunks.length}`,
          file.name,
          chunk.id
        );

        try {
          const processedText = await processChunkWithClaude(file, chunk);

          emitProgress(
            "embedding_prep",
            `Preparing embeddings for ${chunk.id}`,
            file.name,
            chunk.id
          );

          // Split into paragraphs for embedding
          const paragraphs = splitTextIntoParagraphs(processedText);
          const embeddings = await generateEmbeddings(paragraphs);

          // Store debug info
          const debugEntry = {
            filename: file.name,
            rawExtraction: processedText,
            chunks: paragraphs,
          };

          // Create processed chunks for this chunk
          const chunkProcessedChunks = paragraphs.map((paragraph, idx) => ({
            id: `${chunk.id}-paragraph-${idx}`,
            text: paragraph,
            embedding: embeddings[idx],
            metadata: chunk.metadata,
          }));

          emitProgress(
            "chunk_processed",
            `Processed chunk ${chunk.id}`,
            file.name,
            chunk.id
          );

          return { debugEntry, chunkProcessedChunks };
        } catch (error) {
          console.error(`Error processing chunk ${chunk.id}:`, error);
          emitProgress(
            "error",
            `Error processing chunk: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
            file.name,
            chunk.id
          );
          return null;
        }
      });

      // Wait for all chunks in this batch to complete
      const batchResults = await Promise.all(batchPromises);

      // Collect results from successful chunks
      batchResults.forEach((result) => {
        if (result) {
          debugInfo.push(result.debugEntry);
          processedChunks.push(...result.chunkProcessedChunks);
        }
      });
    }

    console.log(`Created ${processedChunks.length} processed chunks`);
    emitProgress(
      "embeddings_ready",
      `Created ${processedChunks.length} processed chunks`
    );

    // Step 3: Store embeddings
    emitProgress(
      "storing_embeddings",
      "Storing embeddings in vector database..."
    );

    console.log(`\n=== EXTRACTION DEBUG ===`);
    console.log(`Session ID: ${sessionId}`);
    console.log(`About to store ${processedChunks.length} processed chunks`);

    await storeEmbeddings(processedChunks, sessionId);
    console.log("Embeddings stored successfully");
    emitProgress("embeddings_stored", "Embeddings stored successfully");

    // Step 4: Answer questions and evaluate conditions
    const results: QuestionAnswer[] = [];
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      const queryType = detectQueryType(query);

      console.log(`\n=== PROCESSING QUERY ${i + 1}/${queries.length} ===`);
      console.log(`Query: ${query}`);
      console.log(`Type: ${queryType}`);
      console.log(`Session ID: ${sessionId}`);

      emitProgress(
        "answering",
        `Processing ${queryType} ${i + 1}/${queries.length}: ${query}`
      );

      try {
        const relevantChunks = await searchRelevantChunks(query, sessionId);
        console.log(`Found ${relevantChunks.length} relevant chunks`);

        const context = relevantChunks.map(
          (chunk) => chunk.metadata.text || ""
        );
        console.log(`Context lengths: ${context.map((c) => c.length)}`);

        const answer = await answerQuestion(query, context);

        results.push({
          query,
          answer,
          confidence:
            relevantChunks.length > 0 ? relevantChunks[0].score || 0 : 0,
          sources: relevantChunks.map(
            (chunk) => chunk.metadata.filename || "Unknown"
          ),
          type: queryType,
          debugInfo: {
            relevantChunks,
            contextUsed: context,
          },
        });

        emitProgress("question_answered", `Processed ${queryType}: ${query}`);
      } catch (error) {
        console.error(`Error processing ${queryType} "${query}":`, error);
        emitProgress(
          "error",
          `Error processing ${queryType}: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
        results.push({
          query,
          answer:
            "Error: Unable to process this query due to processing error.",
          confidence: 0,
          sources: [],
          type: queryType,
          debugInfo: {
            relevantChunks: [],
            contextUsed: [],
          },
        });
      }
    }

    console.log("Document processing completed");
    emitProgress("cleaning_up", "Cleaning up temporary data...");

    // Clean up embeddings after processing
    console.log(`\n=== CLEANING UP EMBEDDINGS ===`);
    console.log(`Session ID: ${sessionId}`);
    await cleanupEmbeddings(sessionId);

    return { results, debugInfo };
  } catch (error) {
    console.error("Error in parseDocuments:", error);
    onProgress?.(
      "error",
      `Processing failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    throw new Error("Failed to process documents");
  }
}

/**
 * Process a single document and return structured content
 */
export async function processSingleDocument(
  file: File
): Promise<{ filename: string; content: string; chunks: string[] }> {
  try {
    console.log(`Processing single document: ${file.name}`);

    const chunks = await createPDFChunks(file);
    const chunk = chunks[0]; // Single chunk for entire document

    const processedText = await processChunkWithClaude(file, chunk);
    const paragraphs = splitTextIntoParagraphs(processedText);

    return {
      filename: file.name,
      content: processedText,
      chunks: paragraphs,
    };
  } catch (error) {
    console.error(`Error processing single document ${file.name}:`, error);
    throw new Error(`Failed to process document: ${file.name}`);
  }
}

/**
 * Get similar documents based on a query
 */
export async function findSimilarContent(
  query: string,
  sessionId: string,
  topK: number = 3
): Promise<{ text: string; filename: string; score: number }[]> {
  try {
    const results = await searchRelevantChunks(query, sessionId, topK);

    return results.map((result) => ({
      text: result.metadata.text,
      filename: result.metadata.filename,
      score: result.score,
    }));
  } catch (error) {
    console.error("Error finding similar content:", error);
    throw new Error("Failed to find similar content");
  }
}
