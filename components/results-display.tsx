"use client";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  AlertCircle,
  FileText,
  Clock,
  User,
  HelpCircle,
} from "lucide-react";

interface QuestionAnswer {
  question: string;
  answer: string;
  confidence: number;
  sources: string[];
}

interface ResultsDisplayProps {
  results: QuestionAnswer[];
  isLoading?: boolean;
  filesProcessed?: number;
  questionsAnswered?: number;
}

export function ResultsDisplay({
  results,
  isLoading = false,
  filesProcessed = 0,
  questionsAnswered = 0,
}: ResultsDisplayProps) {
  if (isLoading) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 animate-spin" />
            Processing Documents...
          </CardTitle>
          <CardDescription>
            Extracting information from your tender documents. This may take a
            few minutes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <FileText className="h-4 w-4" />
              Processing documents and generating embeddings...
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full animate-pulse"
                style={{ width: "70%" }}
              ></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!results || results.length === 0) {
    return (
      <Card className="w-full max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
            No Results
          </CardTitle>
          <CardDescription>
            No results were found. Please try uploading documents and asking
            questions.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return "bg-green-100 text-green-800";
    if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800";
    return "bg-red-100 text-red-800";
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return "High";
    if (confidence >= 0.6) return "Medium";
    return "Low";
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Extraction Complete
          </CardTitle>
          <CardDescription>
            Successfully processed {filesProcessed} document
            {filesProcessed !== 1 ? "s" : ""} and answered {questionsAnswered}{" "}
            question{questionsAnswered !== 1 ? "s" : ""}.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Results */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Question & Answer Checklist</h2>

        {results.map((result, index) => (
          <Card key={index} className="border-l-4 border-l-blue-500">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg flex items-start gap-2">
                  <HelpCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                  <span className="leading-tight">{result.question}</span>
                </CardTitle>
                <Badge
                  variant="secondary"
                  className={getConfidenceColor(result.confidence)}
                >
                  {getConfidenceLabel(result.confidence)} Confidence
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <div className="space-y-4">
                {/* Answer */}
                <div className="bg-gray-50 p-4 rounded-lg">
                  <div className="flex items-start gap-2">
                    <User className="h-4 w-4 text-gray-500 mt-1 flex-shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Answer:
                      </p>
                      <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">
                        {result.answer}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Sources */}
                {result.sources && result.sources.length > 0 && (
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="text-sm text-gray-600">Sources:</span>
                    {[...new Set(result.sources)].map((source, sourceIndex) => (
                      <Badge
                        key={sourceIndex}
                        variant="outline"
                        className="text-xs"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        {source}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Action Buttons */}
      <Card className="bg-blue-50">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
            <div className="text-sm text-gray-600">
              Need to ask more questions or upload additional documents?
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
              >
                Start New Analysis
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm"
              >
                Print Results
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
