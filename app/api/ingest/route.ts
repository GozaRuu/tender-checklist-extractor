import { NextRequest, NextResponse } from "next/server";
import { parseDocuments } from "@/lib";

// Simple progress streaming interface
interface ProgressUpdate {
  type: "progress" | "completion" | "error";
  step: string;
  message: string;
  filename?: string;
  chunkId?: string;
  currentStep: number;
  totalSteps: number;
  timestamp: number;
  results?: {
    results: unknown[];
    debugInfo: unknown[];
  };
  error?: string;
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

    // Session ID is generated internally by parseDocuments
    // const sessionId = formData.get("sessionId") as string;

    // Extract questions from form data
    const questions: string[] = [];
    let questionIndex = 0;
    while (formData.has(`questions.${questionIndex}.question`)) {
      const question = formData.get(
        `questions.${questionIndex}.question`
      ) as string;
      if (question?.trim()) {
        questions.push(question.trim());
      }
      questionIndex++;
    }

    // Extract PDF files
    const files: File[] = [];
    const fileEntries = formData.getAll("files");

    for (const fileEntry of fileEntries) {
      if (fileEntry instanceof File && fileEntry.type === "application/pdf") {
        files.push(fileEntry);
      }
    }

    // Validate input
    if (questions.length === 0) {
      return NextResponse.json(
        { error: "At least one question is required" },
        { status: 400 }
      );
    }

    if (files.length === 0) {
      return NextResponse.json(
        { error: "At least one PDF file is required" },
        { status: 400 }
      );
    }

    // Initial estimate for total steps (will be updated during processing)
    let totalSteps = files.length * 2 + questions.length + 2; // Rough estimate

    // Create streaming response
    const encoder = new TextEncoder();
    let currentStep = 0;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Progress callback with ability to update total steps
          const onProgress = (
            step: string,
            message: string,
            filename?: string,
            chunkId?: string,
            updateTotalSteps?: number
          ) => {
            currentStep++;

            // Update total steps if provided
            if (updateTotalSteps !== undefined) {
              totalSteps = updateTotalSteps;
            }

            const update: ProgressUpdate = {
              type: "progress",
              step,
              message,
              filename,
              chunkId,
              currentStep,
              totalSteps,
              timestamp: Date.now(),
            };

            const chunk = encoder.encode(JSON.stringify(update) + "\n");

            // Check if controller is still open before enqueueing
            try {
              controller.enqueue(chunk);
            } catch (error) {
              console.warn(
                "Controller already closed, skipping progress update:",
                error
              );
            }
          };

          // Process documents with progress callback
          console.log(
            `Processing ${files.length} files with ${questions.length} questions`
          );

          const { results, debugInfo } = await parseDocuments(
            files,
            questions,
            onProgress
          );

          // Send completion update
          const completionUpdate: ProgressUpdate = {
            type: "completion",
            step: "completed",
            message: "Processing completed successfully",
            currentStep: totalSteps,
            totalSteps,
            timestamp: Date.now(),
            results: { results, debugInfo },
          };

          const chunk = encoder.encode(JSON.stringify(completionUpdate) + "\n");

          try {
            controller.enqueue(chunk);
            controller.close();
          } catch (error) {
            console.warn(
              "Controller already closed, skipping completion update:",
              error
            );
          }
        } catch (error) {
          console.error("Error processing documents:", error);

          const errorUpdate: ProgressUpdate = {
            type: "error",
            step: "error",
            message: "Processing failed",
            currentStep: currentStep,
            totalSteps,
            timestamp: Date.now(),
            error: error instanceof Error ? error.message : "Unknown error",
          };

          const chunk = encoder.encode(JSON.stringify(errorUpdate) + "\n");
          controller.enqueue(chunk);
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error in ingest route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
