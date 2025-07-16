import Anthropic from "@anthropic-ai/sdk";
import type { DocumentChunk } from "./types";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Configuration
const MAX_TOKENS = 4000; // max tokens for Claude

/**
 * Convert File to base64 string
 */
export async function fileToBase64(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  return buffer.toString("base64");
}

/**
 * Create document chunks for processing
 * Since we're using Claude's PDF processing, we'll process the entire document
 */
export async function createPDFChunks(file: File): Promise<DocumentChunk[]> {
  const chunks: DocumentChunk[] = [];

  try {
    // For simplicity, we'll process the entire document as one chunk
    // Claude can handle the full PDF and we'll let it determine the structure
    const chunkId = `${file.name}-chunk-0`;

    chunks.push({
      id: chunkId,
      content: "", // Will be filled by Claude processing
      metadata: {
        filename: file.name,
        chunkIndex: 0,
        pageStart: 1,
        pageEnd: -1, // -1 indicates entire document
      },
    });

    return chunks;
  } catch (error) {
    console.error("Error creating PDF chunks:", error);
    throw new Error(`Failed to process PDF: ${file.name}`);
  }
}

/**
 * Process a PDF chunk with Claude to extract structured content
 */
export async function processChunkWithClaude(
  file: File,
  chunk: DocumentChunk
): Promise<string> {
  try {
    const pdfBase64 = await fileToBase64(file);

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: MAX_TOKENS,
      messages: [
        {
          content: [
            {
              type: "document",
              source: {
                media_type: "application/pdf",
                type: "base64",
                data: pdfBase64,
              },
              cache_control: { type: "ephemeral" },
            },
            {
              type: "text",
              text: `Please extract and structure the text content from this PDF document. Focus on:
              
              1. Key information and requirements
              2. Technical specifications
              3. Dates and deadlines
              4. Contact information
              5. Evaluation criteria
              6. Submission requirements
              7. Tender details and scope
              8. Pricing and commercial terms
              
              Please provide a clear, well-structured summary that preserves all important details and context. Break down the content into logical sections that would be useful for answering questions about this tender document.`,
            },
          ],
          role: "user",
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      return content.text;
    } else {
      throw new Error("Unexpected response type from Claude");
    }
  } catch (error) {
    console.error("Error processing chunk with Claude:", error);
    throw new Error(`Failed to process chunk: ${chunk.id}`);
  }
}

/**
 * Split text into paragraph-sized chunks for embedding
 */
export function splitTextIntoParagraphs(text: string): string[] {
  // Split by double newlines first, then by single newlines if paragraphs are too long
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    // If paragraph is too long, split by sentences
    if (paragraph.length > 1000) {
      const sentences = paragraph
        .split(/[.!?]+/)
        .filter((s) => s.trim().length > 0);
      let currentChunk = "";

      for (const sentence of sentences) {
        if (currentChunk.length + sentence.length > 1000) {
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
          }
          currentChunk = sentence;
        } else {
          currentChunk += (currentChunk ? ". " : "") + sentence;
        }
      }

      if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
      }
    } else {
      chunks.push(paragraph.trim());
    }
  }

  return chunks;
}

/**
 * Answer a question using retrieved context with Claude
 */
export async function answerQuestion(
  question: string,
  context: string[]
): Promise<string> {
  try {
    const contextText = context.join("\n\n");

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [
        {
          content: [
            {
              type: "text",
              text: `Based on the following context from tender documents, please answer the question accurately and comprehensively. If the information is not available in the context, please state that clearly.

Context:
${contextText}

Question: ${question}

Please provide a detailed answer based on the context provided.`,
            },
          ],
          role: "user",
        },
      ],
    });

    const content = response.content[0];
    if (content.type === "text") {
      return content.text;
    } else {
      throw new Error("Unexpected response type from Claude");
    }
  } catch (error) {
    console.error("Error answering question:", error);
    throw new Error(`Failed to answer question: ${question}`);
  }
}
