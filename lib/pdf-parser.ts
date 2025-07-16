import Anthropic from "@anthropic-ai/sdk";
import type { DocumentChunk } from "./types";
import {
  splitPdfChunks,
  getPdfPageCount,
  bufferToFile,
  shouldSplitPdf,
  type SplitOptions,
} from "./pdf-splitter";

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
 * Process a PDF chunk with Claude to extract structured content
 */
export async function processChunkWithClaude(
  file: File,
  chunk: DocumentChunk
): Promise<string> {
  try {
    // Use the stored PDF buffer if available, otherwise use the original file
    const pdfBase64 = chunk.metadata.pdfBuffer
      ? chunk.metadata.pdfBuffer.toString("base64")
      : await fileToBase64(file);

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
              text: `Bitte extrahieren und strukturieren Sie den Textinhalt aus diesem deutschen Ausschreibungsdokument${
                chunk.metadata.totalChunks > 1
                  ? ` (Chunk ${chunk.metadata.chunkIndex + 1} von ${
                      chunk.metadata.totalChunks
                    })`
                  : ""
              }. Konzentrieren Sie sich auf:
              
              1. Wichtige Informationen und Anforderungen
              2. Technische Spezifikationen
              3. Termine und Fristen (besonders Abgabefristen)
              4. Kontaktinformationen
              5. Bewertungskriterien
              6. Einreichungsanforderungen
              7. Ausschreibungsdetails und Umfang
              8. Preisgestaltung und kommerzielle Bedingungen
              9. Formale Anforderungen (wie Angebote eingereicht werden sollen)
              10. Fristen für Bieterfragen
              
              Bitte stellen Sie eine klare, gut strukturierte Zusammenfassung in deutscher Sprache bereit, die alle wichtigen Details und Kontextinformationen bewahrt. Gliedern Sie den Inhalt in logische Abschnitte, die für die Beantwortung von Fragen zu diesem Ausschreibungsdokument nützlich wären.
              
              Achten Sie besonders auf:
              - Alle Datumsangaben und Fristen
              - Formale Anforderungen für die Angebotseinreichung
              - Bewertungskriterien
              - Kontaktinformationen
              - Technische Spezifikationen
              
              ${
                chunk.metadata.totalChunks > 1
                  ? `
              HINWEIS: Dies ist ein Teil eines mehrteiligen Dokuments. Bitte extrahieren Sie alle verfügbaren Informationen aus diesem Abschnitt und weisen Sie darauf hin, wenn Informationen möglicherweise in anderen Teilen des Dokuments enthalten sind.`
                  : ""
              }`,
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
  console.log(`\n=== SPLITTING TEXT INTO PARAGRAPHS ===`);
  console.log(`Original text length: ${text.length}`);

  // Split by double newlines first, then by single newlines if paragraphs are too long
  const paragraphs = text.split(/\n\s*\n/).filter((p) => p.trim().length > 0);
  console.log(`Initial paragraphs count: ${paragraphs.length}`);
  console.log(`Initial paragraph lengths: ${paragraphs.map((p) => p.length)}`);

  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    // If paragraph is too long, split by sentences
    if (paragraph.length > 1000) {
      console.log(
        `Paragraph too long (${paragraph.length} chars), splitting by sentences`
      );
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

  console.log(`Final chunks count: ${chunks.length}`);
  console.log(`Final chunk lengths: ${chunks.map((c) => c.length)}`);
  console.log(`Sample chunks (first 3):`);
  chunks.slice(0, 3).forEach((chunk, i) => {
    console.log(
      `  Chunk ${i}: "${chunk.substring(0, 100)}${
        chunk.length > 100 ? "..." : ""
      }"`
    );
  });
  console.log(`=== TEXT SPLITTING COMPLETED ===\n`);

  return chunks;
}

/**
 * Detect if input is a question or condition
 */
function isCondition(input: string): boolean {
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
  return hasConditionKeyword && !hasQuestionWord && !endsWithQuestionMark;
}

/**
 * Answer a question or evaluate a condition using retrieved context with Claude
 */
export async function answerQuestion(
  input: string,
  context: string[]
): Promise<string> {
  try {
    const contextText = context.join("\n\n");
    const isConditionInput = isCondition(input);

    const prompt = isConditionInput
      ? `Basierend auf dem folgenden Kontext aus deutschen Ausschreibungsdokumenten, bewerten Sie bitte die folgende Bedingung und antworten Sie nur mit "WAHR" oder "FALSCH", gefolgt von einer kurzen Begründung.

Kontext:
${contextText}

Bedingung: ${input}

Antworten Sie im Format:
WAHR/FALSCH: [Kurze Begründung]

Wenn die Information nicht im Kontext verfügbar ist, antworten Sie mit "UNBEKANNT: Information nicht verfügbar".`
      : `Basierend auf dem folgenden Kontext aus deutschen Ausschreibungsdokumenten, beantworten Sie bitte die Frage präzise und umfassend auf Deutsch. Wenn die Information nicht im Kontext verfügbar ist, geben Sie das klar an.

Kontext:
${contextText}

Frage: ${input}

Bitte geben Sie eine detaillierte Antwort basierend auf dem bereitgestellten Kontext.`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      messages: [
        {
          content: [
            {
              type: "text",
              text: prompt,
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
    throw new Error(`Failed to answer question: ${input}`);
  }
}
