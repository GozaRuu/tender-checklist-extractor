"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle,
  Circle,
  AlertCircle,
  Clock,
  FileText,
  Loader2,
  Zap,
  Database,
  MessageSquare,
  Trash2,
} from "lucide-react";

interface ProgressEvent {
  type: "progress" | "completion" | "error";
  step: string;
  message: string;
  filename?: string;
  chunkId?: string;
  currentStep: number;
  totalSteps: number;
  timestamp: number;
  results?: any[];
  error?: string;
}

interface ProgressTimelineProps {
  formData: FormData;
  onComplete: (results: any) => void; // Changed from any[] to any
  onError: (error: string) => void;
}

function getStepIcon(step: string, isCompleted: boolean, isError: boolean) {
  if (isError) {
    return <AlertCircle className="h-4 w-4 text-red-500" />;
  }

  const iconMap: { [key: string]: React.ReactNode } = {
    starting: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
    chunking: <FileText className="h-4 w-4 text-blue-500" />,
    chunks_created: <FileText className="h-4 w-4 text-green-500" />,
    processing: <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />,
    embedding_prep: <Database className="h-4 w-4 text-blue-500" />,
    chunk_processed: <CheckCircle className="h-4 w-4 text-green-500" />,
    embeddings_ready: <Database className="h-4 w-4 text-green-500" />,
    storing_embeddings: <Database className="h-4 w-4 text-blue-500" />,
    embeddings_stored: <Database className="h-4 w-4 text-green-500" />,
    answering: <MessageSquare className="h-4 w-4 text-blue-500" />,
    question_answered: <CheckCircle className="h-4 w-4 text-green-500" />,
    cleaning_up: <Trash2 className="h-4 w-4 text-yellow-500" />,
    completed: <CheckCircle className="h-4 w-4 text-green-500" />,
    error: <AlertCircle className="h-4 w-4 text-red-500" />,
  };

  if (isCompleted) {
    return iconMap[step] || <CheckCircle className="h-4 w-4 text-green-500" />;
  }

  return iconMap[step] || <Circle className="h-4 w-4 text-gray-400" />;
}

function formatTimestamp(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString();
}

export function ProgressTimeline({
  formData,
  onComplete,
  onError,
}: ProgressTimelineProps) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [totalSteps, setTotalSteps] = useState(0);
  const eventsEndRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!formData) return;

    const startProcessing = async () => {
      setIsProcessing(true);
      setEvents([]);
      setIsCompleted(false);
      setCurrentStep(0);
      setTotalSteps(0);

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      try {
        console.log("Starting processing with streaming...");

        const response = await fetch("/api/ingest", {
          method: "POST",
          body: formData,
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No response body");
        }

        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            console.log("Stream completed");
            break;
          }

          buffer += decoder.decode(value, { stream: true });

          // Process complete JSON lines
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim()) {
              try {
                const event: ProgressEvent = JSON.parse(line);
                console.log("Received event:", event);

                setEvents((prev) => [...prev, event]);

                if (event.type === "progress") {
                  setCurrentStep(event.currentStep);
                  setTotalSteps(event.totalSteps);
                } else if (event.type === "completion") {
                  setIsCompleted(true);
                  setIsProcessing(false);
                  onComplete(event.results || { results: [], debugInfo: [] });
                } else if (event.type === "error") {
                  setIsProcessing(false);
                  onError(event.error || "Processing failed");
                }
              } catch (error) {
                console.error("Error parsing event:", error, "Line:", line);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error in streaming:", error);
        setIsProcessing(false);

        // Don't show error for aborted requests (user navigated away)
        if (error instanceof Error && error.name === "AbortError") {
          console.log("Processing was cancelled");
          return;
        }

        onError(error instanceof Error ? error.message : "Processing failed");
      }
    };

    startProcessing();

    return () => {
      // Clean up abort controller if it exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [formData, onComplete, onError]);

  // Auto-scroll to latest event
  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  const progressPercentage =
    totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0;

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Processing Timeline
          {isProcessing && (
            <Badge variant="outline" className="ml-2">
              <div className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              Processing
            </Badge>
          )}
          {isCompleted && (
            <Badge variant="outline" className="ml-2">
              <CheckCircle className="h-3 w-3 text-green-500 mr-1" />
              Completed
            </Badge>
          )}
        </CardTitle>

        {totalSteps > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-gray-600">
              <span>
                Step {currentStep} of {totalSteps}
              </span>
              <span>{Math.round(progressPercentage)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${progressPercentage}%` }}
              />
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="space-y-4 max-h-96 overflow-y-auto">
          {events.length === 0 && isProcessing ? (
            <div className="text-center py-8 text-gray-500">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
              Starting processing...
            </div>
          ) : (
            events.map((event, index) => {
              const isLast = index === events.length - 1;
              const isError = event.type === "error";
              const isCompleted =
                event.type === "completion" ||
                (!isLast && !isError && !isProcessing);

              return (
                <div key={index} className="flex items-start gap-3 relative">
                  {/* Timeline line */}
                  {!isLast && (
                    <div className="absolute left-2 top-6 w-0.5 h-6 bg-gray-200" />
                  )}

                  {/* Step icon */}
                  <div className="flex-shrink-0 mt-1">
                    {getStepIcon(event.step, isCompleted, isError)}
                  </div>

                  {/* Event content */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-start justify-between">
                      <div className="flex-grow">
                        <p className="text-sm font-medium text-gray-900">
                          {event.message}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatTimestamp(event.timestamp)}
                        </p>
                      </div>

                      {event.type === "progress" && (
                        <span className="text-xs text-gray-400 ml-2">
                          {event.currentStep}/{event.totalSteps}
                        </span>
                      )}
                    </div>

                    {event.type === "progress" &&
                      (event.filename || event.chunkId) && (
                        <div className="flex gap-2 text-xs text-gray-500 mt-1">
                          {event.filename && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              {event.filename}
                            </span>
                          )}
                          {event.chunkId && <span>ID: {event.chunkId}</span>}
                        </div>
                      )}

                    {event.type === "error" && event.error && (
                      <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                        <p className="text-sm text-red-800">{event.error}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div ref={eventsEndRef} />
        </div>
      </CardContent>
    </Card>
  );
}
