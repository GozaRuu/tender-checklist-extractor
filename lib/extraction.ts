import type { DocumentChunk, ProcessedChunk, QuestionAnswer } from "./types";
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
 * Main function to process documents and answer questions
 */
export async function parseDocuments(
  files: File[],
  questions: string[]
): Promise<QuestionAnswer[]> {
  try {
    console.log("Starting document processing...");

    // Generate a unique session ID for this processing session
    const sessionId = generateSessionId();
    console.log(`Session ID: ${sessionId}`);

    // Step 1: Create document chunks
    const allChunks: DocumentChunk[] = [];
    for (const file of files) {
      const chunks = await createPDFChunks(file);
      allChunks.push(...chunks);
    }

    console.log(`Created ${allChunks.length} document chunks`);

    // Step 2: Process chunks with Claude
    const processedChunks: ProcessedChunk[] = [];
    for (let i = 0; i < allChunks.length; i++) {
      const chunk = allChunks[i];
      const file = files.find((f) => f.name === chunk.metadata.filename);

      if (!file) {
        console.error(`File not found for chunk: ${chunk.id}`);
        continue;
      }

      console.log(`Processing chunk ${i + 1}/${allChunks.length}: ${chunk.id}`);

      try {
        const processedText = await processChunkWithClaude(file, chunk);

        // Split into paragraphs for embedding
        const paragraphs = splitTextIntoParagraphs(processedText);
        const embeddings = await generateEmbeddings(paragraphs);

        // Create processed chunks
        paragraphs.forEach((paragraph, idx) => {
          processedChunks.push({
            id: `${chunk.id}-paragraph-${idx}`,
            text: paragraph,
            embedding: embeddings[idx],
            metadata: chunk.metadata,
          });
        });
      } catch (error) {
        console.error(`Error processing chunk ${chunk.id}:`, error);
        // Continue with other chunks
      }
    }

    console.log(`Created ${processedChunks.length} processed chunks`);

    // Step 3: Store embeddings
    await storeEmbeddings(processedChunks, sessionId);
    console.log("Embeddings stored successfully");

    // Step 4: Answer questions
    const results: QuestionAnswer[] = [];
    for (const question of questions) {
      console.log(`Answering question: ${question}`);

      try {
        const relevantChunks = await searchRelevantChunks(question, sessionId);
        const context = relevantChunks.map(
          (chunk) => chunk.metadata?.text || ""
        );
        const answer = await answerQuestion(question, context);

        results.push({
          question,
          answer,
          confidence:
            relevantChunks.length > 0 ? relevantChunks[0].score || 0 : 0,
          sources: relevantChunks.map(
            (chunk) => chunk.metadata?.filename || "Unknown"
          ),
        });
      } catch (error) {
        console.error(`Error answering question "${question}":`, error);
        results.push({
          question,
          answer:
            "Error: Unable to answer this question due to processing error.",
          confidence: 0,
          sources: [],
        });
      }
    }

    console.log("Document processing completed");

    // Clean up embeddings after processing
    await cleanupEmbeddings(sessionId);

    return results;
  } catch (error) {
    console.error("Error in parseDocuments:", error);
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
