import config from "./config";

// Get configuration
const textConfig = config.getTextConfig();

/**
 * Split text into paragraph-sized chunks for embedding
 */
export function splitTextIntoParagraphs(text: string): string[] {
  console.log(`\n=== SPLITTING TEXT INTO PARAGRAPHS ===`);
  console.log(`Original text length: ${text.length}`);

  // Split by double newlines first, then by single newlines if paragraphs are too long
  const paragraphs = text
    .split(new RegExp(textConfig.processing.paragraphSplitRegex))
    .filter((p) => p.trim().length > 0);
  console.log(`Initial paragraphs count: ${paragraphs.length}`);
  console.log(`Initial paragraph lengths: ${paragraphs.map((p) => p.length)}`);

  const chunks: string[] = [];

  for (const paragraph of paragraphs) {
    // If paragraph is too long, split by sentences
    if (paragraph.length > textConfig.processing.maxParagraphLength) {
      console.log(
        `Paragraph too long (${paragraph.length} chars), splitting by sentences`
      );
      const sentences = paragraph
        .split(new RegExp(textConfig.processing.sentenceSplitRegex))
        .filter((s) => s.trim().length > 0);
      let currentChunk = "";

      for (const sentence of sentences) {
        if (
          currentChunk.length + sentence.length >
          textConfig.processing.maxSentenceChunkLength
        ) {
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
 * Normalize text by removing extra whitespace and normalizing line breaks
 */
export function normalizeText(text: string): string {
  return text
    .replace(/\r\n/g, "\n") // Normalize line breaks
    .replace(/\r/g, "\n") // Normalize line breaks
    .replace(/\n+/g, "\n") // Remove multiple consecutive newlines
    .replace(/[ \t]+/g, " ") // Replace multiple spaces/tabs with single space
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

  // Extract dates (German format)
  const dateRegex = new RegExp(textConfig.processing.dateRegex, "g");
  const dates = text.match(dateRegex) || [];
  metadata.dates = [...new Set(dates)];

  // Extract emails
  const emailRegex = new RegExp(textConfig.processing.emailRegex, "g");
  const emails = text.match(emailRegex) || [];
  metadata.emails = [...new Set(emails)];

  // Extract phone numbers
  const phoneRegex = new RegExp(textConfig.processing.phoneRegex, "g");
  const phones = text.match(phoneRegex) || [];
  metadata.phones = [...new Set(phones)];

  // Extract deadlines (German keywords)
  const deadlineKeywords = textConfig.processing.deadlineKeywords;
  const deadlines: string[] = [];

  deadlineKeywords.forEach((keyword) => {
    const regex = new RegExp(`[^.]*${keyword}[^.]*`, "gi");
    const matches = text.match(regex) || [];
    deadlines.push(...matches);
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
