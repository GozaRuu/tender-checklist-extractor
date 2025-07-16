import configData from "./config.json";

export interface Config {
  ai: {
    claude: {
      model: string;
      maxTokensExtraction: number;
      maxTokensAnswering: number;
      conditionKeywords: string[];
    };
    openai: {
      embeddingModel: string;
      embeddingDimensions: number;
    };
  };
  processing: {
    extraction: {
      batchSize: number;
      totalStepsMultiplier: number;
      baseStepsCount: number;
    };
    embeddings: {
      batchSize: number;
      defaultTopK: number;
      indexingDelayMs: number;
    };
    retry: {
      maxRetries: number;
      baseDelayMs: number;
      maxDelayMs: number;
    };
  };
  pdf: {
    validation: {
      maxFileSizeBytes: number;
      maxFileSizeMB: number;
      allowedMimeTypes: string[];
      allowedExtensions: string[];
    };
    splitting: {
      defaultChunkSize: number;
      defaultOverlap: number;
      splitThreshold: number;
      minPagesPerChunk: number;
      maxPagesPerChunk: number;
    };
  };
  text: {
    processing: {
      maxParagraphLength: number;
      maxSentenceChunkLength: number;
      minTextLength: number;
      paragraphSplitRegex: string;
      sentenceSplitRegex: string;
      dateRegex: string;
      emailRegex: string;
      phoneRegex: string;
      deadlineKeywords: string[];
    };
  };
  session: {
    sessionIdLength: number;
    namespacePrefix: string;
    cleanupAfterProcessing: boolean;
  };
  logging: {
    enableDebugLogs: boolean;
    enablePerformanceLogs: boolean;
    logLevel: string;
  };
  limits: {
    maxQuestionsPerSession: number;
    maxFilesPerSession: number;
    maxProcessingTimeMs: number;
    maxTotalFileSize: number;
  };
}

class ConfigManager {
  private config: Config;

  constructor() {
    this.config = configData as Config;
    this.validateConfig();
  }

  private validateConfig(): void {
    if (!this.config.ai?.claude?.model) {
      throw new Error("Claude model configuration is required");
    }

    if (!this.config.ai?.openai?.embeddingModel) {
      throw new Error("OpenAI embedding model configuration is required");
    }

    if (this.config.pdf.validation.maxFileSizeBytes <= 0) {
      throw new Error("PDF max file size must be greater than 0");
    }

    if (this.config.pdf.splitting.defaultChunkSize <= 0) {
      throw new Error("PDF chunk size must be greater than 0");
    }

    if (this.config.processing.extraction.batchSize <= 0) {
      throw new Error("Extraction batch size must be greater than 0");
    }
  }

  public getConfig(): Config {
    return this.config;
  }

  public getAiConfig() {
    return this.config.ai;
  }

  public getProcessingConfig() {
    return this.config.processing;
  }

  public getPdfConfig() {
    return this.config.pdf;
  }

  public getTextConfig() {
    return this.config.text;
  }

  public getSessionConfig() {
    return this.config.session;
  }

  public getLoggingConfig() {
    return this.config.logging;
  }

  public getLimitsConfig() {
    return this.config.limits;
  }

  public isDebugEnabled(): boolean {
    return this.config.logging.enableDebugLogs;
  }

  public isPerformanceLogsEnabled(): boolean {
    return this.config.logging.enablePerformanceLogs;
  }

  public updateConfig(updates: Partial<Config>): void {
    this.config = { ...this.config, ...updates };
    this.validateConfig();
  }
}

// Export singleton instance
export const config = new ConfigManager();
export default config;
