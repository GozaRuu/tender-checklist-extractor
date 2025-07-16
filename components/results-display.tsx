"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, HelpCircle, Check, X, AlertCircle } from "lucide-react";
import type { QuestionAnswer } from "@/lib/types";

interface ResultsDisplayProps {
  results: QuestionAnswer[];
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

export function ResultsDisplay({ results }: ResultsDisplayProps) {
  if (results.length === 0) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <p className="text-gray-500">Keine Ergebnisse verfügbar</p>
        </CardContent>
      </Card>
    );
  }

  const questions = results.filter((r) => r.type === "question");
  const conditions = results.filter((r) => r.type === "condition");

  return (
    <div className="space-y-6">
      {/* Questions Results */}
      {questions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <HelpCircle className="h-5 w-5" />
              Fragen Ergebnisse ({questions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {questions.map((result, index) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900 mb-2">
                        {result.query}
                      </h3>
                      <div className="flex items-center gap-2 mb-2">
                        <Badge
                          variant="outline"
                          className={getConfidenceColor(result.confidence)}
                        >
                          Vertrauen: {getConfidenceLabel(result.confidence)} (
                          {(result.confidence * 100).toFixed(1)}%)
                        </Badge>
                        <Badge variant="secondary">
                          {result.sources.length} Quelle(n)
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">
                      {result.answer}
                    </p>
                  </div>

                  {result.sources.length > 0 && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <FileText className="h-4 w-4" />
                      <span>Quellen: {result.sources.join(", ")}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Conditions Results */}
      {conditions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Check className="h-5 w-5" />
              Bedingungen Ergebnisse ({conditions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {conditions.map((result, index) => {
                const conditionResult = parseConditionResult(result.answer);
                return (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900 mb-2">
                          {result.query}
                        </h3>
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
                            className={getConfidenceColor(result.confidence)}
                          >
                            Vertrauen: {getConfidenceLabel(result.confidence)} (
                            {(result.confidence * 100).toFixed(1)}%)
                          </Badge>
                          <Badge variant="secondary">
                            {result.sources.length} Quelle(n)
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {conditionResult.explanation && (
                      <div className="bg-gray-50 rounded-lg p-3 mb-3">
                        <p className="text-sm text-gray-700 whitespace-pre-wrap">
                          {conditionResult.explanation}
                        </p>
                      </div>
                    )}

                    {result.sources.length > 0 && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <FileText className="h-4 w-4" />
                        <span>Quellen: {result.sources.join(", ")}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Zusammenfassung</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {questions.length}
              </div>
              <div className="text-sm text-gray-600">Fragen beantwortet</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {
                  conditions.filter(
                    (c) => parseConditionResult(c.answer).result === "WAHR"
                  ).length
                }
              </div>
              <div className="text-sm text-gray-600">Bedingungen erfüllt</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {
                  conditions.filter(
                    (c) => parseConditionResult(c.answer).result === "FALSCH"
                  ).length
                }
              </div>
              <div className="text-sm text-gray-600">
                Bedingungen nicht erfüllt
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
