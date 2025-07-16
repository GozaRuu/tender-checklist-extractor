import Anthropic from "@anthropic-ai/sdk";
import type { DocumentChunk } from "./types";
import config from "./config";

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
});

// Get configuration
const aiConfig = config.getAiConfig();

/**
 * Check if input is a condition (evaluates to true/false)
 */
function isCondition(input: string): boolean {
  const conditionKeywords = aiConfig.claude.conditionKeywords;

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
      model: aiConfig.claude.model,
      max_tokens: aiConfig.claude.maxTokensExtraction,
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
              text: `Extrahieren Sie ALLE wichtigen Informationen aus diesem deutschen Ausschreibungsdokument${chunkInfo}. Strukturieren Sie die Informationen klar und vollständig:

**KRITISCHE INFORMATIONEN** (immer explizit angeben):
- Titel der Ausschreibung
- Referenznummer/Aktenzeichen
- Auftraggeber (Name, Adresse, Kontakt)
- Vergabestelle und Ansprechpartner
- Leistungsumfang und Beschreibung
- Geschätzter Auftragswert
- Laufzeit/Vertragsdauer

**FRISTEN UND TERMINE** (alle Daten vollständig):
- Abgabefrist für Angebote (Datum, Uhrzeit, Ort)
- Frist für Bieterfragen/Rückfragen
- Angebotseröffnung (Datum, Uhrzeit, Ort)
- Zuschlagstermin
- Leistungsbeginn
- Einwendungsfristen

**FORMALE ANFORDERUNGEN** (präzise Details):
- Einreichungsform (elektronisch/schriftlich)
- Anzahl der Exemplare
- Formatvorgaben
- Erforderliche Unterlagen und Nachweise
- Sprache der Angebote
- Gültigkeitsdauer der Angebote

**BEWERTUNG UND ZUSCHLAG**:
- Zuschlagskriterien
- Gewichtung der Kriterien
- Bewertungsverfahren
- Eignungsprüfung
- Mindestanforderungen

**TECHNISCHE SPEZIFIKATIONEN**:
- Detaillierte Leistungsbeschreibung
- Technische Anforderungen
- Qualitätsstandards
- Abnahmekriterien

**VERTRAGLICHE BEDINGUNGEN**:
- Zahlungsmodalitäten
- Gewährleistung
- Vertragsstrafen
- Kündigungsregelungen

Verwenden Sie eine klare, strukturierte Formatierung mit Überschriften und Aufzählungen. Bewahren Sie alle spezifischen Details, Zahlen, Daten und Kontaktinformationen exakt bei. Wenn Informationen fehlen, geben Sie dies explizit an.

${
  chunk.metadata.totalChunks > 1
    ? `
**HINWEIS**: Dies ist Teil ${chunk.metadata.chunkIndex + 1} von ${
        chunk.metadata.totalChunks
      }. Extrahieren Sie alle verfügbaren Informationen aus diesem Abschnitt und kennzeichnen Sie fehlende Informationen mit "[Siehe andere Dokumentteile]".`
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
      ? `Sie sind ein Experte für deutsche Ausschreibungen. Bewerten Sie die folgende Bedingung basierend auf dem Kontext und geben Sie eine klare, definitive Antwort.

**KONTEXT:**
${contextText}

**BEDINGUNG:** ${input}

**ANTWORTFORMAT:**
Antworten Sie NUR mit einem der folgenden Formate:

WAHR: [Präzise Begründung mit Verweis auf spezifische Dokumentstelle]
FALSCH: [Präzise Begründung mit Verweis auf spezifische Dokumentstelle]  
UNBEKANNT: [Spezifische Erklärung, warum die Information nicht verfügbar ist]

**WICHTIGE REGELN:**
- Seien Sie präzise und verweisen Sie auf konkrete Dokumentstellen
- Nutzen Sie nur Informationen aus dem bereitgestellten Kontext
- Wenn die Information nicht explizit im Kontext steht, wählen Sie UNBEKANNT
- Geben Sie kurze, aber vollständige Begründungen`
      : `Sie sind ein Experte für deutsche Ausschreibungen. Beantworten Sie die Frage basierend auf dem Kontext präzise und vollständig.

**KONTEXT:**
${contextText}

**FRAGE:** ${input}

**ANTWORTFORMAT:**
Geben Sie eine strukturierte Antwort mit:
1. **Direkte Antwort:** [Hauptantwort in 1-2 Sätzen]
2. **Details:** [Relevante Einzelheiten aus dem Kontext]
3. **Quelle:** [Verweis auf spezifische Dokumentstelle]

**WICHTIGE REGELN:**
- Seien Sie konkret und präzise
- Verwenden Sie nur Informationen aus dem bereitgestellten Kontext
- Wenn die Information nicht verfügbar ist, sagen Sie dies explizit
- Geben Sie spezifische Zahlen, Daten und Details an
- Strukturieren Sie die Antwort logisch und verständlich
- Vermeiden Sie unnötige Wiederholungen

Wenn die Information nicht im Kontext verfügbar ist, antworten Sie mit:
**INFORMATION NICHT VERFÜGBAR:** [Spezifische Erklärung, was fehlt und wo es normalerweise stehen würde]`;

    const response = await anthropic.messages.create({
      model: aiConfig.claude.model,
      max_tokens: aiConfig.claude.maxTokensAnswering,
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
