"use client";

import { useState } from "react";
import { UploadForm } from "@/components/upload-form";
import { ResultsDisplay } from "@/components/results-display";

interface QuestionAnswer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
}

interface FormData {
  questions: { question: string }[];
  files: File[];
}

export default function Home() {
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<QuestionAnswer[]>([]);
  const [filesProcessed, setFilesProcessed] = useState(0);
  const [questionsAnswered, setQuestionsAnswered] = useState(0);
  const [showResults, setShowResults] = useState(false);

  const handleFormSubmit = async (data: FormData) => {
    setIsLoading(true);
    setShowResults(false);

    try {
      const formData = new FormData();

      // Add questions to form data
      data.questions.forEach((q, index) => {
        formData.append(`questions.${index}.question`, q.question);
      });

      // Add files to form data
      data.files.forEach((file) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/ingest", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to process documents");
      }

      const result = await response.json();

      setResults(result.results);
      setFilesProcessed(result.filesProcessed);
      setQuestionsAnswered(result.questionsAnswered);
      setShowResults(true);
    } catch (error) {
      console.error("Error processing documents:", error);
      // Show error state
      setResults([]);
      setShowResults(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Tender Document Extractor
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Upload PDF tender documents and ask questions to extract specific
              information. Our AI will analyze your documents and provide
              detailed answers to help you understand requirements, deadlines,
              and evaluation criteria.
            </p>
          </div>

          {/* Main Content */}
          <div className="space-y-8">
            {!showResults && (
              <UploadForm onSubmit={handleFormSubmit} isLoading={isLoading} />
            )}

            {(isLoading || showResults) && (
              <ResultsDisplay
                results={results}
                isLoading={isLoading}
                filesProcessed={filesProcessed}
                questionsAnswered={questionsAnswered}
              />
            )}
          </div>

          {/* Footer */}
          <footer className="mt-16 text-center text-sm text-gray-500">
            <p>
              Powered by Claude AI and OpenAI. Your documents are processed
              securely and not stored permanently.
            </p>
          </footer>
        </div>
      </div>
    </div>
  );
}
