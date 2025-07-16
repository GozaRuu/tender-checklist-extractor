"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  FileText,
  HelpCircle,
  Check,
  X,
  AlertCircle,
  File,
} from "lucide-react";
import type { FileResult } from "@/lib/types";

interface ResultsDisplayProps {
  fileResults: FileResult[];
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return "bg-green-100 text-green-800";
  if (confidence >= 0.6) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.8) return "Hoch";
  if (confidence >= 0.6) return "Mittel";
  return "Niedrig";
}

function parseConditionResult(answer: string): {
  result: "WAHR" | "FALSCH" | "UNBEKANNT";
  explanation: string;
} {
  const upperAnswer = answer.toUpperCase();

  if (upperAnswer.startsWith("WAHR")) {
    return {
      result: "WAHR",
      explanation: answer.substring(answer.indexOf(":") + 1).trim(),
    };
  } else if (upperAnswer.startsWith("FALSCH")) {
    return {
      result: "FALSCH",
      explanation: answer.substring(answer.indexOf(":") + 1).trim(),
    };
  } else if (upperAnswer.startsWith("UNBEKANNT")) {
    return {
      result: "UNBEKANNT",
      explanation: answer.substring(answer.indexOf(":") + 1).trim(),
    };
  }

  return {
    result: "UNBEKANNT",
    explanation: answer,
  };
}

export function ResultsDisplay({ fileResults }: ResultsDisplayProps) {
  if (fileResults.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-500">Keine Ergebnisse verfügbar</p>
        </CardContent>
      </Card>
    );
  }

  // Calculate summary stats across all files
  const allAnswers = fileResults.flatMap((file) => file.answers);
  const allQuestions = allAnswers.filter((r) => r.type === "question");
  const allConditions = allAnswers.filter((r) => r.type === "condition");
  const conditionsTrueCount = allConditions.filter(
    (c) => parseConditionResult(c.answer).result === "WAHR"
  ).length;
  const conditionsFalseCount = allConditions.filter(
    (c) => parseConditionResult(c.answer).result === "FALSCH"
  ).length;

  return (
    <div className="space-y-6">
      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Zusammenfassung</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {fileResults.length}
              </div>
              <div className="text-sm text-gray-600">Dateien verarbeitet</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {allQuestions.length}
              </div>
              <div className="text-sm text-gray-600">Fragen beantwortet</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {conditionsTrueCount}
              </div>
              <div className="text-sm text-gray-600">Bedingungen erfüllt</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {conditionsFalseCount}
              </div>
              <div className="text-sm text-gray-600">
                Bedingungen nicht erfüllt
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* File Results */}
      {fileResults.map((fileResult, fileIndex) => {
        const questions = fileResult.answers.filter(
          (r) => r.type === "question"
        );
        const conditions = fileResult.answers.filter(
          (r) => r.type === "condition"
        );

        return (
          <Card key={fileIndex}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <File className="h-5 w-5" />
                {fileResult.filename}
                <Badge variant="secondary" className="ml-2">
                  {fileResult.answers.length} Antworten
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {/* Questions for this file */}
                {questions.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 font-medium mb-4">
                      <HelpCircle className="h-4 w-4" />
                      Fragen ({questions.length})
                    </h4>
                    <div className="space-y-3">
                      {questions.map((result, index) => (
                        <div key={index} className="border rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-900 mb-2">
                                {result.query}
                              </h5>
                              <div className="flex items-center gap-2 mb-2">
                                <Badge
                                  variant="outline"
                                  className={getConfidenceColor(
                                    result.confidence
                                  )}
                                >
                                  Vertrauen:{" "}
                                  {getConfidenceLabel(result.confidence)} (
                                  {(result.confidence * 100).toFixed(1)}%)
                                </Badge>
                              </div>
                            </div>
                          </div>

                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap">
                              {result.answer}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Conditions for this file */}
                {conditions.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 font-medium mb-4">
                      <Check className="h-4 w-4" />
                      Bedingungen ({conditions.length})
                    </h4>
                    <div className="space-y-3">
                      {conditions.map((result, index) => {
                        const conditionResult = parseConditionResult(
                          result.answer
                        );
                        return (
                          <div key={index} className="border rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <h5 className="font-medium text-gray-900 mb-2">
                                  {result.query}
                                </h5>
                                <div className="flex items-center gap-2 mb-2">
                                  <Badge
                                    variant="outline"
                                    className={
                                      conditionResult.result === "WAHR"
                                        ? "bg-green-100 text-green-800"
                                        : conditionResult.result === "FALSCH"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-gray-100 text-gray-800"
                                    }
                                  >
                                    {conditionResult.result === "WAHR" && (
                                      <Check className="h-3 w-3 mr-1" />
                                    )}
                                    {conditionResult.result === "FALSCH" && (
                                      <X className="h-3 w-3 mr-1" />
                                    )}
                                    {conditionResult.result === "UNBEKANNT" && (
                                      <AlertCircle className="h-3 w-3 mr-1" />
                                    )}
                                    {conditionResult.result}
                                  </Badge>
                                  <Badge
                                    variant="outline"
                                    className={getConfidenceColor(
                                      result.confidence
                                    )}
                                  >
                                    Vertrauen:{" "}
                                    {getConfidenceLabel(result.confidence)} (
                                    {(result.confidence * 100).toFixed(1)}%)
                                  </Badge>
                                </div>
                              </div>
                            </div>

                            {conditionResult.explanation && (
                              <div className="bg-gray-50 rounded-lg p-3">
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                                  {conditionResult.explanation}
                                </p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
