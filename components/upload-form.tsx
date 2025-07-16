"use client";

import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Upload, FileText } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormMessage,
} from "@/components/ui/form";

// Form schema
const formSchema = z.object({
  questions: z
    .array(
      z.object({
        question: z.string().min(1, "Frage ist erforderlich"),
      })
    )
    .min(1, "Mindestens eine Frage oder Bedingung ist erforderlich"),
  files: z
    .any()
    .refine(
      (files) => files?.length > 0,
      "Mindestens eine PDF-Datei ist erforderlich"
    ),
});

type FormData = z.infer<typeof formSchema>;

interface UploadFormProps {
  onSubmit: (data: FormData) => Promise<void>;
  isLoading?: boolean;
}

export function UploadForm({ onSubmit, isLoading = false }: UploadFormProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      questions: [
        {
          question:
            "In welcher Form sind die Angebote/Teilnahmeanträge einzureichen?",
        },
        {
          question: "Wann ist die Frist für die Einreichung von Bieterfragen?",
        },
        { question: "Ist die Abgabefrist vor dem 31.12.2025?" },
        { question: "Sind elektronische Einreichungen erlaubt?" },
      ],
      files: undefined,
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    const pdfFiles = files.filter((file) => file.type === "application/pdf");

    setSelectedFiles(pdfFiles);
    form.setValue("files", pdfFiles);

    if (pdfFiles.length !== files.length) {
      form.setError("files", { message: "Nur PDF-Dateien sind erlaubt" });
    } else {
      form.clearErrors("files");
    }
  };

  const handleSubmit = async (data: FormData) => {
    try {
      await onSubmit({
        ...data,
        files: selectedFiles,
      });
    } catch (error) {
      console.error("Error submitting form:", error);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Ausschreibungsdokument Analyzer
        </CardTitle>
        <CardDescription>
          Laden Sie PDF-Dokumente hoch und stellen Sie Fragen oder definieren
          Sie Bedingungen, um Informationen aus Ausschreibungsdokumenten zu
          extrahieren.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-6"
          >
            {/* Questions Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">
                  Fragen & Bedingungen
                </Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ question: "" })}
                  className="flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Hinzufügen
                </Button>
              </div>

              <div className="space-y-3">
                {fields.map((field, index) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <FormField
                      control={form.control}
                      name={`questions.${index}.question`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormControl>
                            <Input
                              placeholder={`Frage oder Bedingung ${
                                index + 1
                              }...`}
                              {...field}
                              className="flex-1"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    {fields.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => remove(index)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* File Upload Section */}
            <div className="space-y-4">
              <Label className="text-base font-medium">PDF-Dokumente</Label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto mb-2 text-gray-400" />
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    Laden Sie PDF-Dokumente hoch, um Informationen zu
                    extrahieren
                  </p>
                  <Input
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={handleFileChange}
                    className="max-w-xs mx-auto"
                  />
                </div>
              </div>

              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-gray-700">
                    Ausgewählte Dateien ({selectedFiles.length}):
                  </p>
                  <ul className="text-sm text-gray-600 space-y-1">
                    {selectedFiles.map((file, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {form.formState.errors.files && (
                <p className="text-sm text-red-600">
                  {form.formState.errors.files.message?.toString()}
                </p>
              )}
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? "Verarbeitung..." : "Checkliste Generieren"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
