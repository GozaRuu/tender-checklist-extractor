"use client";

import { useState } from "react";
import { UploadForm } from "@/components/upload-form";
import { ProgressTimeline } from "@/components/progress-timeline";
import { ResultsDisplay } from "@/components/results-display";
import { DebugDisplay } from "@/components/debug-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, AlertCircle, ArrowLeft, Bug } from "lucide-react";
import type { QuestionAnswer } from "@/lib/types";

export default function Home() {
  const [results, setResults] = useState<QuestionAnswer[]>([]);
  const [debugInfo, setDebugInfo] = useState<any[]>([]);
  const [showResults, setShowResults] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [formData, setFormData] = useState<FormData | null>(null);

  const handleFormSubmit = async (data: {
    questions: { question: string }[];
    files: File[];
  }) => {
    setIsLoading(true);
    setError("");
    setResults([]);
    setDebugInfo([]);
    setShowResults(false);
    setShowDebug(false);

    try {
      const newFormData = new FormData();

      // Add session ID
      newFormData.append("sessionId", `session-${Date.now()}`);

      // Add questions to form data
      data.questions.forEach((q, index) => {
        newFormData.append(`questions.${index}.question`, q.question);
      });

      // Add files to form data
      data.files.forEach((file) => {
        newFormData.append("files", file);
      });

      // Set form data and show timeline
      setFormData(newFormData);
      setShowTimeline(true);
    } catch (error) {
      console.error("Error preparing form data:", error);
      setError(
        error instanceof Error ? error.message : "Failed to prepare form data"
      );
      setIsLoading(false);
    }
  };

  const handleProgressComplete = (completedData: any) => {
    setResults(completedData.results || []);
    setDebugInfo(completedData.debugInfo || []);
    setShowResults(true);
    setShowTimeline(false);
    setIsLoading(false);
  };

  const handleProgressError = (errorMessage: string) => {
    setError(errorMessage);
    setShowTimeline(false);
    setIsLoading(false);
  };

  const handleStartNew = () => {
    setResults([]);
    setDebugInfo([]);
    setShowResults(false);
    setShowTimeline(false);
    setShowDebug(false);
    setError("");
    setFormData(null);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-900 mb-2">
              Tender Document Analyzer
            </h1>
            <p className="text-lg text-gray-600">
              Upload PDF documents and get AI-powered answers to your questions
            </p>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                <div className="text-sm text-red-800">{error}</div>
              </div>
            </div>
          )}

          {/* Upload Form */}
          {!showTimeline && !showResults && (
            <Card className="mb-8">
              <CardHeader>
                <CardTitle>Upload Documents & Questions</CardTitle>
              </CardHeader>
              <CardContent>
                <UploadForm onSubmit={handleFormSubmit} isLoading={isLoading} />
              </CardContent>
            </Card>
          )}

          {/* Processing Timeline */}
          {showTimeline && formData && (
            <div className="mb-8">
              <ProgressTimeline
                formData={formData}
                onComplete={handleProgressComplete}
                onError={handleProgressError}
              />
            </div>
          )}

          {/* Results */}
          {showResults && results.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">
                  Analysis Results
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => setShowDebug(!showDebug)}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <Bug className="h-4 w-4" />
                    {showDebug ? "Hide Debug" : "Show Debug"}
                  </Button>
                  <Button
                    onClick={handleStartNew}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Start New Analysis
                  </Button>
                </div>
              </div>

              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-4 w-4 text-green-600 mr-2" />
                  <div className="text-sm text-green-800">
                    Successfully processed and analyzed your documents!
                  </div>
                </div>
              </div>

              <ResultsDisplay results={results} />

              {/* Debug Display */}
              {showDebug && debugInfo.length > 0 && (
                <div className="mt-8">
                  <h3 className="text-xl font-bold text-gray-900 mb-4">
                    Debug Information
                  </h3>
                  <DebugDisplay debugInfo={debugInfo} results={results} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
