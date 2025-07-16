import Anthropic from "@anthropic-ai/sdk";
import type { DocumentChunk } from "./types";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Configuration
const MAX_TOKENS = 4000; // max tokens for Claude

/**
 * Check if input is a condition (evaluates to true/false)
 */
function isCondition(input: string): boolean {
  const conditionKeywords = [
    "ist",
    "sind",
    "hat",
    "haben",
    "kann",
    "können",
    "soll",
    "sollen",
    "muss",
    "müssen",
    "darf",
    "dürfen",
    "wird",
    "werden",
    "vor dem",
    "nach dem",
    "bis zum",
    "ab dem",
    "erlaubt",
    "zulässig",
    "möglich",
    "erforderlich",
    "notwendig",
    "verfügbar",
    "vorhanden",
  ];

  return conditionKeywords.some((keyword) =>
    input.toLowerCase().includes(keyword)
  );
}

/**
 * Process a PDF chunk with Claude to extract structured content
 */
export async function processChunkWithClaude(
  pdfBase64: string,
  chunk: DocumentChunk
): Promise<string> {
  try {
    const chunkInfo =
      chunk.metadata.totalChunks > 1
        ? ` (Chunk ${chunk.metadata.chunkIndex + 1} von ${
            chunk.metadata.totalChunks
          })`
        : "";

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
              text: `Bitte extrahieren und strukturieren Sie den Textinhalt aus diesem deutschen Ausschreibungsdokument${chunkInfo}. Konzentrieren Sie sich auf:
              
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
