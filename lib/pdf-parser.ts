import type { DocumentChunk } from "./types";
import {
  splitPdfChunks,
  getPdfPageCount,
  bufferToFile,
  shouldSplitPdf,
  type SplitOptions,
} from "./pdf-splitter";
import { processChunkWithClaude } from "./ai-service";

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
 * For large PDFs, split them into smaller chunks to avoid Claude's limits
 */
export async function createPDFChunks(
  file: File,
  splitOptions: SplitOptions = {}
): Promise<DocumentChunk[]> {
  const chunks: DocumentChunk[] = [];

  try {
    console.log(`\n=== PROCESSING PDF: ${file.name} ===`);

    // Get PDF buffer and page count
    const arrayBuffer = await file.arrayBuffer();
    const pageCount = await getPdfPageCount(arrayBuffer);

    console.log(`PDF has ${pageCount} pages`);

    // Determine if we need to split the PDF
    const needsSplitting = shouldSplitPdf(pageCount);
    console.log(`PDF splitting needed: ${needsSplitting}`);

    if (needsSplitting) {
      // Split the PDF into smaller chunks
      const splitBuffers = await splitPdfChunks(arrayBuffer, splitOptions);

      console.log(`Split PDF into ${splitBuffers.length} chunks`);

      // Create DocumentChunk objects for each split
      splitBuffers.forEach((buffer, index) => {
        const chunkId = `${file.name}-chunk-${index}`;
        chunks.push({
          id: chunkId,
          text: "", // Will be filled by Claude processing
          metadata: {
            filename: file.name,
            page: index + 1, // Approximate page number
            chunkIndex: index,
            totalChunks: splitBuffers.length,
            pdfBuffer: buffer, // Store the PDF chunk buffer
          },
        });
      });
    } else {
      // Process the entire PDF as one chunk
      const chunkId = `${file.name}-chunk-0`;
      chunks.push({
        id: chunkId,
        text: "", // Will be filled by Claude processing
        metadata: {
          filename: file.name,
          page: 1,
          chunkIndex: 0,
          totalChunks: 1,
          pdfBuffer: Buffer.from(arrayBuffer), // Store the entire PDF buffer
        },
      });
    }

    console.log(`Created ${chunks.length} document chunks for ${file.name}`);
    console.log(`=== PDF PROCESSING COMPLETED ===\n`);

    return chunks;
  } catch (error) {
    console.error("Error creating PDF chunks:", error);
    throw new Error(`Failed to process PDF: ${file.name}`);
  }
}

/**
 * Process a PDF chunk by extracting text content using Claude
 * This is a wrapper that handles the PDF to base64 conversion
 */
export async function processPDFChunk(
  file: File,
  chunk: DocumentChunk
): Promise<string> {
  try {
    // Use the stored PDF buffer if available, otherwise use the original file
    const pdfBase64 = chunk.metadata.pdfBuffer
      ? chunk.metadata.pdfBuffer.toString("base64")
      : await fileToBase64(file);

    // Call the AI service to process the chunk
    return await processChunkWithClaude(pdfBase64, chunk);
  } catch (error) {
    console.error("Error processing PDF chunk:", error);
    throw new Error(`Failed to process PDF chunk: ${chunk.id}`);
  }
}

/**
 * Extract basic PDF information without processing content
 */
export async function getPDFInfo(file: File): Promise<{
  filename: string;
  pageCount: number;
  size: number;
  needsSplitting: boolean;
}> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pageCount = await getPdfPageCount(arrayBuffer);
    const needsSplitting = shouldSplitPdf(pageCount);

    return {
      filename: file.name,
      pageCount,
      size: file.size,
      needsSplitting,
    };
  } catch (error) {
    console.error("Error getting PDF info:", error);
    throw new Error(`Failed to get PDF info: ${file.name}`);
  }
}

/**
 * Validate PDF file
 */
export function validatePDFFile(file: File): {
  isValid: boolean;
  error?: string;
} {
  // Check file type
  if (file.type !== "application/pdf") {
    return { isValid: false, error: "File must be a PDF" };
  }

  // Check file size (50MB limit)
  const maxSize = 50 * 1024 * 1024; // 50MB in bytes
  if (file.size > maxSize) {
    return { isValid: false, error: "File size must be less than 50MB" };
  }

  // Check filename
  if (!file.name.toLowerCase().endsWith(".pdf")) {
    return { isValid: false, error: "File must have .pdf extension" };
  }

  return { isValid: true };
}
