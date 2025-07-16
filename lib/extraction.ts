import type {
  DocumentChunk,
  ProcessedChunk,
  QuestionAnswer,
  DocumentExtractionDebug,
  QueryType,
  FileResult,
  ProcessingResult,
} from "./types";
import {
  generateEmbeddings,
  storeEmbeddings,
  searchRelevantChunks,
  cleanupEmbeddings,
} from "./embeddings";
import { createPDFChunks, processPDFChunk } from "./pdf-parser";
import { answerQuestion } from "./ai-service";
import { splitTextIntoParagraphs } from "./text-processing";
import config from "./config";

// Get configuration
const aiConfig = config.getAiConfig();
const processingConfig = config.getProcessingConfig();
const sessionConfig = config.getSessionConfig();

/**
 * Generate a unique session ID for processing
 */
function generateSessionId(): string {
  return `${sessionConfig.namespacePrefix}${Date.now()}-${Math.random()
    .toString(36)
    .substr(2, sessionConfig.sessionIdLength)}`;
}

/**
 * Generate a file-specific session ID
 */
function generateFileSessionId(
  baseSessionId: string,
  filename: string
): string {
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9]/g, "_");
  return `${baseSessionId}_${sanitizedFilename}`;
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
  // Get condition keywords from config
  const conditionKeywords = aiConfig.claude.conditionKeywords;

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
): Promise<ProcessingResult> {
  try {
    console.log("Starting document processing...");

    // Generate a unique session ID for this processing session
    const baseSessionId = generateSessionId();
    console.log(`Base Session ID: ${baseSessionId}`);

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

    // Step 1: Create document chunks in parallel
    emitProgress(
      "chunking",
      `Creating chunks for ${files.length} files in parallel`
    );

    const chunkPromises = files.map(async (file) => {
      emitProgress("chunking", `Creating chunks for ${file.name}`, file.name);
      const chunks = await createPDFChunks(file);
      return { file, chunks };
    });

    const fileChunksArray = await Promise.all(chunkPromises);

    // Calculate total chunks across all files
    const totalChunks = fileChunksArray.reduce(
      (sum, { chunks }) => sum + chunks.length,
      0
    );
    console.log(
      `Created ${totalChunks} document chunks across ${files.length} files`
    );

    // Calculate actual total steps now that we know the chunk count
    const actualTotalSteps =
      totalChunks * processingConfig.extraction.totalStepsMultiplier +
      queries.length * files.length + // Questions per file
      processingConfig.extraction.baseStepsCount;

    emitProgress(
      "chunks_created",
      `Created ${totalChunks} document chunks across ${files.length} files`,
      undefined,
      undefined,
      actualTotalSteps
    );

    // Step 2: Process each file separately
    const fileResults: FileResult[] = [];
    const debugInfo: DocumentExtractionDebug[] = [];

    // Process each file individually
    for (const { file, chunks } of fileChunksArray) {
      const fileSessionId = generateFileSessionId(baseSessionId, file.name);

      emitProgress(
        "processing_file",
        `Processing file: ${file.name}`,
        file.name
      );

      // Step 2a: Process chunks for this file
      const processedChunks: ProcessedChunk[] = [];

      // Process chunks in parallel with batching to avoid rate limits
      const BATCH_SIZE = processingConfig.extraction.batchSize;
      const chunkBatches = [];

      for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
        chunkBatches.push(chunks.slice(i, i + BATCH_SIZE));
      }

      for (let batchIndex = 0; batchIndex < chunkBatches.length; batchIndex++) {
        const batch = chunkBatches[batchIndex];

        console.log(
          `Processing batch ${batchIndex + 1}/${chunkBatches.length} with ${
            batch.length
          } chunks for ${file.name}`
        );

        const batchPromises = batch.map(async (chunk, indexInBatch) => {
          const overallIndex = batchIndex * BATCH_SIZE + indexInBatch;

          console.log(
            `Processing chunk ${overallIndex + 1}/${chunks.length}: ${
              chunk.id
            } in ${file.name}`
          );
          emitProgress(
            "processing",
            `Processing chunk ${overallIndex + 1}/${chunks.length}`,
            file.name,
            chunk.id
          );

          try {
            const processedText = await processPDFChunk(file, chunk);

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

      console.log(
        `Created ${processedChunks.length} processed chunks for ${file.name}`
      );
      emitProgress(
        "embeddings_ready",
        `Created ${processedChunks.length} processed chunks for ${file.name}`,
        file.name
      );

      // Step 2b: Store embeddings for this file
      emitProgress(
        "storing_embeddings",
        `Storing embeddings for ${file.name}...`,
        file.name
      );

      console.log(`\n=== STORING EMBEDDINGS FOR ${file.name} ===`);
      console.log(`File Session ID: ${fileSessionId}`);
      console.log(`About to store ${processedChunks.length} processed chunks`);

      await storeEmbeddings(processedChunks, fileSessionId);
      console.log(`Embeddings stored successfully for ${file.name}`);
      emitProgress(
        "embeddings_stored",
        `Embeddings stored for ${file.name}`,
        file.name
      );

      // Step 2c: Answer questions for this file
      const fileAnswers: QuestionAnswer[] = [];

      for (let i = 0; i < queries.length; i++) {
        const query = queries[i];
        const queryType = detectQueryType(query);

        console.log(
          `\n=== PROCESSING QUERY ${i + 1}/${queries.length} FOR ${
            file.name
          } ===`
        );
        console.log(`Query: ${query}`);
        console.log(`Type: ${queryType}`);
        console.log(`File Session ID: ${fileSessionId}`);

        emitProgress(
          "answering",
          `Processing ${queryType} ${i + 1}/${queries.length} for ${
            file.name
          }: ${query}`,
          file.name
        );

        try {
          const relevantChunks = await searchRelevantChunks(
            query,
            fileSessionId
          );
          console.log(
            `Found ${relevantChunks.length} relevant chunks for ${file.name}`
          );

          const context = relevantChunks.map(
            (chunk) => chunk.metadata.text || ""
          );
          console.log(
            `Context lengths for ${file.name}: ${context.map((c) => c.length)}`
          );

          const answer = await answerQuestion(query, context);

          fileAnswers.push({
            query,
            answer,
            confidence:
              relevantChunks.length > 0 ? relevantChunks[0].score || 0 : 0,
            sources: [file.name], // Only this file as source
            type: queryType,
            debugInfo: {
              relevantChunks,
              contextUsed: context,
            },
          });

          emitProgress(
            "question_answered",
            `Processed ${queryType} for ${file.name}: ${query}`,
            file.name
          );
        } catch (error) {
          console.error(
            `Error processing ${queryType} "${query}" for ${file.name}:`,
            error
          );
          emitProgress(
            "error",
            `Error processing ${queryType}: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
            file.name
          );
          fileAnswers.push({
            query,
            answer:
              "Error: Unable to process this query due to processing error.",
            confidence: 0,
            sources: [file.name],
            type: queryType,
            debugInfo: {
              relevantChunks: [],
              contextUsed: [],
            },
          });
        }
      }

      // Add file result
      fileResults.push({
        filename: file.name,
        answers: fileAnswers,
      });

      // Clean up embeddings for this file
      console.log(`\n=== CLEANING UP EMBEDDINGS FOR ${file.name} ===`);
      console.log(`File Session ID: ${fileSessionId}`);
      await cleanupEmbeddings(fileSessionId);
    }

    console.log("Document processing completed");
    emitProgress("completed", "All files processed successfully");

    return { fileResults, debugInfo };
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

    const processedText = await processPDFChunk(file, chunk);
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
  topK: number = processingConfig.embeddings.defaultTopK
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
