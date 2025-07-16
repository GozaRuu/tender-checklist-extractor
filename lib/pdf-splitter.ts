import { PDFDocument } from "pdf-lib";
import config from "./config";

export interface SplitOptions {
  chunkSize?: number; // how many pages per slice
  overlap?: number; // how many pages of overlap
}

// Get configuration
const pdfConfig = config.getPdfConfig();

/**
 * Splits the given PDF buffer into overlapping chunks.
 *
 * @param buffer    - the ArrayBuffer of the source PDF
 * @param opts      - chunkSize (pages per slice) and overlap (pages to repeat)
 * @returns         - an array of Buffers, one per chunk
 */
export async function splitPdfChunks(
  buffer: ArrayBuffer,
  opts: SplitOptions = {}
): Promise<Buffer[]> {
  const {
    chunkSize = pdfConfig.splitting.defaultChunkSize,
    overlap = pdfConfig.splitting.defaultOverlap,
  } = opts;
  const srcDoc = await PDFDocument.load(buffer);
  const total = srcDoc.getPageCount();
  const slices: Buffer[] = [];

  console.log(`\n=== PDF SPLITTING DEBUG ===`);
  console.log(`Total pages: ${total}`);
  console.log(`Chunk size: ${chunkSize}`);
  console.log(`Overlap: ${overlap}`);

  let start = 0;
  while (start < total) {
    // determine the end index for this slice, but cap at total
    const end = Math.min(start + chunkSize, total);
    // collect page indices [start .. end)
    const pages: number[] = [];
    for (let i = start; i < end; i++) {
      pages.push(i);
    }

    // also add the 'overlap' pages after (if any)
    for (let i = 1; i <= overlap; i++) {
      const idx = end + i - 1;
      if (idx < total) pages.push(idx);
    }

    // and prepend the 'overlap' pages before
    for (let i = 1; i <= overlap; i++) {
      const idx = start - i;
      if (idx >= 0) pages.unshift(idx);
    }

    // de-dupe & sort
    const unique = Array.from(new Set(pages)).sort((a, b) => a - b);

    console.log(
      `Creating chunk ${slices.length + 1}: pages [${unique.join(", ")}]`
    );

    const newDoc = await PDFDocument.create();
    const copied = await newDoc.copyPages(srcDoc, unique);
    copied.forEach((p) => newDoc.addPage(p));

    const bytes = await newDoc.save();
    slices.push(Buffer.from(bytes));

    // advance by chunkSize (not counting overlap)
    start += chunkSize;
  }

  console.log(`Created ${slices.length} PDF chunks`);
  console.log(`=== PDF SPLITTING COMPLETED ===\n`);

  return slices;
}

/**
 * Get the page count of a PDF
 */
export async function getPdfPageCount(buffer: ArrayBuffer): Promise<number> {
  const srcDoc = await PDFDocument.load(buffer);
  return srcDoc.getPageCount();
}

/**
 * Convert a Buffer to a File object (for Claude processing)
 */
export function bufferToFile(buffer: Buffer, filename: string): File {
  const blob = new Blob([buffer], { type: "application/pdf" });
  return new File([blob], filename, { type: "application/pdf" });
}

/**
 * Determine if a PDF should be split based on page count
 */
export function shouldSplitPdf(
  pageCount: number,
  threshold: number = pdfConfig.splitting.splitThreshold
): boolean {
  return pageCount > threshold;
}
