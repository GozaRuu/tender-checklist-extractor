import config from "./config";

// Get configuration
const textConfig = config.getTextConfig();

/**
 * Split text into overlapping chunks for better embedding and retrieval
 */
export function splitTextIntoParagraphs(text: string): string[] {
  console.log(`\n=== SPLITTING TEXT INTO PARAGRAPHS ===`);
  console.log(`Original text length: ${text.length}`);

  // Clean and normalize text first
  const cleanText = normalizeText(text);
  console.log(`Cleaned text length: ${cleanText.length}`);

  // Split by multiple criteria to create better chunks
  const chunks: string[] = [];

  // First, split by major sections (double newlines)
  const sections = cleanText
    .split(new RegExp(textConfig.processing.paragraphSplitRegex))
    .filter((s) => s.trim().length >= textConfig.processing.minTextLength);

  console.log(`Initial sections count: ${sections.length}`);

  for (const section of sections) {
    if (section.length <= textConfig.processing.maxParagraphLength) {
      // Section is good size, add as-is
      chunks.push(section.trim());
    } else {
      // Section is too long, split by sentences with overlap
      const sentences = section
        .split(new RegExp(textConfig.processing.sentenceSplitRegex))
        .filter((s) => s.trim().length > 0);

      let currentChunk = "";
      let sentenceBuffer: string[] = [];

      for (let i = 0; i < sentences.length; i++) {
        const sentence = sentences[i].trim();
        sentenceBuffer.push(sentence);

        const testChunk = sentenceBuffer.join(". ");

        if (testChunk.length > textConfig.processing.maxSentenceChunkLength) {
          // Current chunk is full, save it
          if (currentChunk.trim()) {
            chunks.push(currentChunk.trim());
          }

          // Start new chunk with overlap (keep last 2 sentences)
          const overlapSentences = sentenceBuffer.slice(-2);
          currentChunk = overlapSentences.join(". ");
          sentenceBuffer = overlapSentences;
        } else {
          currentChunk = testChunk;
        }
      }

      // Add final chunk if it has content
      if (
        currentChunk.trim() &&
        currentChunk.trim().length >= textConfig.processing.minTextLength
      ) {
        chunks.push(currentChunk.trim());
      }
    }
  }

  // Post-process chunks to ensure quality
  const finalChunks = chunks
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length >= textConfig.processing.minTextLength)
    .map((chunk) => addContextualInfo(chunk));

  console.log(`Final chunks count: ${finalChunks.length}`);
  console.log(`Final chunk lengths: ${finalChunks.map((c) => c.length)}`);
  console.log(
    `Average chunk length: ${
      finalChunks.reduce((sum, c) => sum + c.length, 0) / finalChunks.length
    }`
  );
  console.log(`Sample chunks (first 2):`);
  finalChunks.slice(0, 2).forEach((chunk, i) => {
    console.log(
      `  Chunk ${i}: "${chunk.substring(0, 150)}${
        chunk.length > 150 ? "..." : ""
      }"`
    );
  });
  console.log(`=== TEXT SPLITTING COMPLETED ===\n`);

  return finalChunks;
}

/**
 * Add contextual information to chunks for better retrieval
 */
function addContextualInfo(chunk: string): string {
  // Extract key information patterns
  const metadata = extractMetadata(chunk);
  let enhancedChunk = chunk;

  // Add context markers for better retrieval
  if (metadata.dates.length > 0) {
    enhancedChunk = `[TERMINE/FRISTEN] ${enhancedChunk}`;
  }
  if (metadata.emails.length > 0 || metadata.phones.length > 0) {
    enhancedChunk = `[KONTAKT] ${enhancedChunk}`;
  }
  if (metadata.deadlines.length > 0) {
    enhancedChunk = `[FRISTEN] ${enhancedChunk}`;
  }
  if (
    chunk.toLowerCase().includes("einreichung") ||
    chunk.toLowerCase().includes("abgabe")
  ) {
    enhancedChunk = `[EINREICHUNG] ${enhancedChunk}`;
  }
  if (
    chunk.toLowerCase().includes("elektronisch") ||
    chunk.toLowerCase().includes("schriftlich")
  ) {
    enhancedChunk = `[EINREICHUNGSFORM] ${enhancedChunk}`;
  }
  if (
    chunk.toLowerCase().includes("bewertung") ||
    chunk.toLowerCase().includes("kriterien")
  ) {
    enhancedChunk = `[BEWERTUNG] ${enhancedChunk}`;
  }

  return enhancedChunk;
}

/**
 * Normalize text by removing extra whitespace and normalizing line breaks
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n") // Normalize line breaks
    .replace(/\r/g, "\n") // Normalize line breaks
    .replace(/\n+/g, "\n") // Remove multiple consecutive newlines
    .replace(/[ \t]+/g, " ") // Replace multiple spaces/tabs with single space
    .replace(/\s*\n\s*/g, "\n") // Clean up spacing around newlines
    .replace(/[^\S\n]+/g, " ") // Replace all non-newline whitespace with single space
    .trim(); // Remove leading/trailing whitespace
}

/**
 * Extract metadata from text content (e.g., dates, deadlines, contact info)
 */
export function extractMetadata(text: string): {
  dates: string[];
  emails: string[];
  phones: string[];
  deadlines: string[];
} {
  const metadata = {
    dates: [] as string[],
    emails: [] as string[],
    phones: [] as string[],
    deadlines: [] as string[],
  };

  // Extract dates (German format) - improved regex
  const dateRegex =
    /\b\d{1,2}\.?\s*\d{1,2}\.?\s*\d{2,4}\b|\b\d{1,2}\.\d{1,2}\.\d{4}\b/g;
  const dates = text.match(dateRegex) || [];
  metadata.dates = [...new Set(dates.map((d) => d.trim()))];

  // Extract emails
  const emailRegex = new RegExp(textConfig.processing.emailRegex, "g");
  const emails = text.match(emailRegex) || [];
  metadata.emails = [...new Set(emails)];

  // Extract phone numbers
  const phoneRegex = new RegExp(textConfig.processing.phoneRegex, "g");
  const phones = text.match(phoneRegex) || [];
  metadata.phones = [...new Set(phones)];

  // Extract deadlines (German keywords) - improved detection
  const deadlineKeywords = [
    ...textConfig.processing.deadlineKeywords,
    "termin",
    "zeitpunkt",
    "datum",
    "bis",
    "spätestens",
    "ende",
    "ablauf",
  ];
  const deadlines: string[] = [];

  deadlineKeywords.forEach((keyword) => {
    const regex = new RegExp(`[^.!?]*${keyword}[^.!?]*[.!?]`, "gi");
    const matches = text.match(regex) || [];
    deadlines.push(...matches.map((m) => m.trim()));
  });

  metadata.deadlines = [...new Set(deadlines)];

  return metadata;
}

/**
 * Clean and format text for better readability
 */
export function formatText(text: string): string {
  return text
    .replace(/\s+/g, " ") // Replace multiple spaces with single space
    .replace(/\n\s*\n/g, "\n\n") // Ensure double newlines for paragraphs
    .replace(/([.!?])\s*\n/g, "$1\n\n") // Add paragraph breaks after sentences
    .replace(/^\s+|\s+$/g, "") // Trim whitespace
    .replace(/\n{3,}/g, "\n\n"); // Limit to maximum 2 consecutive newlines
}
