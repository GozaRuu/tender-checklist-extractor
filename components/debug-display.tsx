"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronDown,
  ChevronUp,
  FileText,
  Eye,
  Code,
  Database,
} from "lucide-react";
import type {
  QuestionAnswer,
  DocumentExtractionDebug,
  VectorSearchResult,
} from "@/lib/types";

interface DebugDisplayProps {
  debugInfo: DocumentExtractionDebug[];
  results: QuestionAnswer[];
}

export function DebugDisplay({ debugInfo, results }: DebugDisplayProps) {
  const [expandedExtraction, setExpandedExtraction] = useState<string | null>(
    null
  );
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);

  const toggleExtraction = (filename: string) => {
    setExpandedExtraction(expandedExtraction === filename ? null : filename);
  };

  const toggleQuestion = (question: string) => {
    setExpandedQuestion(expandedQuestion === question ? null : question);
  };

  return (
    <div className="space-y-6">
      {/* Raw Claude Extractions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Raw Claude PDF Extractions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {debugInfo.map((debug, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className="flex items-center gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      {debug.filename}
                    </Badge>
                    <Badge variant="secondary">
                      {debug.chunks.length} chunks
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleExtraction(debug.filename)}
                  >
                    {expandedExtraction === debug.filename ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                {expandedExtraction === debug.filename && (
                  <div className="mt-4 space-y-4">
                    {/* Raw extraction */}
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Code className="h-4 w-4" />
                        Raw Claude Extraction
                      </h4>
                      <textarea
                        value={debug.rawExtraction}
                        readOnly
                        className="w-full h-64 p-3 border rounded-md text-sm font-mono bg-gray-50 resize-y"
                        placeholder="No extraction available"
                      />
                    </div>

                    {/* Chunks created */}
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Chunks Created for Embeddings
                      </h4>
                      <div className="space-y-2">
                        {debug.chunks.map(
                          (chunk: string, chunkIndex: number) => (
                            <div
                              key={chunkIndex}
                              className="border rounded p-3 bg-gray-50"
                            >
                              <div className="text-xs text-gray-500 mb-1">
                                Chunk {chunkIndex + 1} of {debug.chunks.length}
                              </div>
                              <div className="text-sm whitespace-pre-wrap">
                                {chunk}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Question Answer Debug */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5" />
            Question Answering Debug
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {results.map((result, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {result.type === "question" ? "Frage" : "Bedingung"}{" "}
                      {index + 1}
                    </Badge>
                    <Badge variant="secondary">
                      {result.debugInfo?.relevantChunks?.length || 0} chunks
                      used
                    </Badge>
                    <Badge variant="secondary">
                      {(result.confidence * 100).toFixed(1)}% confidence
                    </Badge>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleQuestion(result.query)}
                  >
                    {expandedQuestion === result.query ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </div>

                <div className="mb-2">
                  <strong>
                    {result.type === "question" ? "Frage" : "Bedingung"}:
                  </strong>{" "}
                  {result.query}
                </div>

                <div className="mb-2">
                  <strong>Antwort:</strong> {result.answer}
                </div>

                {expandedQuestion === result.query && result.debugInfo && (
                  <div className="mt-4 space-y-4">
                    {/* Context used */}
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Context Sent to Claude
                      </h4>
                      <div className="space-y-2">
                        {result.debugInfo.contextUsed.map(
                          (context: string, contextIndex: number) => (
                            <div
                              key={contextIndex}
                              className="border rounded p-3 bg-blue-50"
                            >
                              <div className="text-xs text-blue-600 mb-1">
                                Context Chunk {contextIndex + 1}
                              </div>
                              <div className="text-sm whitespace-pre-wrap">
                                {context}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>

                    {/* Relevant chunks with scores */}
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Database className="h-4 w-4" />
                        Relevant Chunks Found (by similarity)
                      </h4>
                      <div className="space-y-2">
                        {result.debugInfo.relevantChunks.map(
                          (chunk: VectorSearchResult, chunkIndex: number) => (
                            <div
                              key={chunkIndex}
                              className="border rounded p-3 bg-green-50"
                            >
                              <div className="flex items-center justify-between mb-1">
                                <div className="text-xs text-green-600">
                                  Chunk from{" "}
                                  {chunk.metadata?.filename || "Unknown"}
                                  (Page {chunk.metadata?.page || "Unknown"})
                                </div>
                                <Badge variant="outline" className="text-xs">
                                  Score: {(chunk.score * 100).toFixed(1)}%
                                </Badge>
                              </div>
                              <div className="text-sm whitespace-pre-wrap">
                                {chunk.metadata?.text || "No text available"}
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
