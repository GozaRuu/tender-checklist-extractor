import { NextRequest, NextResponse } from "next/server";
import { parseDocuments } from "@/lib";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();

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

    // Process documents
    console.log(
      `Processing ${files.length} files with ${questions.length} questions`
    );
    const results = await parseDocuments(files, questions);

    return NextResponse.json({
      success: true,
      results,
      filesProcessed: files.length,
      questionsAnswered: questions.length,
    });
  } catch (error) {
    console.error("Error processing documents:", error);
    return NextResponse.json(
      {
        error: "Failed to process documents",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
