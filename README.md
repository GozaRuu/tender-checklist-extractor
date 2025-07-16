# Tender Document Extractor

A Next.js application that extracts specific information from tender documents using AI. Upload PDF documents, ask questions, and get detailed answers with confidence scores and source attribution.

## Features

- 📄 **Multi-PDF Upload**: Upload multiple PDF tender documents at once
- ❓ **Dynamic Questions**: Add as many questions as needed with a user-friendly interface
- 🤖 **AI Processing**: Uses Claude AI for document understanding and OpenAI for embeddings
- 🔍 **Vector Search**: Semantic search through document content using Upstash Vector
- 📊 **Confidence Scoring**: Get confidence ratings for each answer
- 📋 **Source Attribution**: See which documents provided the information
- 🎨 **Modern UI**: Built with shadcn/ui components and Tailwind CSS

## Architecture

### Frontend (Next.js + TypeScript + Shadcn/UI)

- **Upload Form**: Dynamic question inputs and multi-PDF file selector
- **Results Display**: Structured question-answer pairs with confidence scores
- **Responsive Design**: Works on desktop and mobile devices

### Backend Processing

1. **PDF Chunking**: Split documents into overlapping page-based chunks (4 pages + 1 overlap)
2. **Claude Processing**: Extract structured content from each chunk
3. **Embedding Generation**: Create vector embeddings using OpenAI
4. **Vector Storage**: Store embeddings in Upstash Vector database
5. **Question Answering**: Use similarity search + Claude to answer questions

### APIs Used

- **Anthropic Claude**: Document processing and question answering
- **OpenAI**: Text embeddings for semantic search
- **Upstash Vector**: Vector database for similarity search

## Getting Started

### Prerequisites

- Node.js 18+ and pnpm
- API keys for:
  - Anthropic (Claude)
  - OpenAI
  - Upstash Vector database

### Installation

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd tender-checklist-extractor
   ```

2. **Install dependencies**

   ```bash
   pnpm install
   ```

3. **Set up environment variables**
   Create a `.env.local` file in the root directory:

   ```env
   # API Keys - Replace with your actual keys
   ANTHROPIC_API_KEY=your_anthropic_api_key_here
   OPENAI_API_KEY=your_openai_api_key_here

   # Upstash Vector Database - Replace with your actual credentials
   UPSTASH_VECTOR_REST_URL=your_upstash_vector_rest_url_here
   UPSTASH_VECTOR_REST_TOKEN=your_upstash_vector_rest_token_here

   # Optional: Next.js Configuration
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   ```

4. **Run the development server**

   ```bash
   pnpm dev
   ```

5. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

### Getting API Keys

#### Anthropic Claude

1. Sign up at [console.anthropic.com](https://console.anthropic.com)
2. Create a new API key
3. Add to your `.env.local` as `ANTHROPIC_API_KEY`

#### OpenAI

1. Sign up at [platform.openai.com](https://platform.openai.com)
2. Create a new API key
3. Add to your `.env.local` as `OPENAI_API_KEY`

#### Upstash Vector

1. Sign up at [console.upstash.com](https://console.upstash.com)
2. Create a new Vector database
3. Get the REST URL and token from the database dashboard
4. Add to your `.env.local` as `UPSTASH_VECTOR_REST_URL` and `UPSTASH_VECTOR_REST_TOKEN`

## Usage

1. **Upload Documents**: Select one or more PDF tender documents
2. **Add Questions**: Use the form to add specific questions about the documents
3. **Process**: Click "Generate Checklist" to start processing
4. **Review Results**: View answers with confidence scores and source attribution
5. **Export**: Print or save the results for your records

### Example Questions

- "What is the submission deadline for this tender?"
- "What are the technical requirements?"
- "Who is the contact person for questions?"
- "What is the evaluation criteria?"
- "What documents need to be submitted?"

## Configuration

### Module Configuration

```typescript
// PDF Parser (lib/pdf-parser.ts)
const MAX_TOKENS = 4000; // max tokens for Claude

// Embeddings (lib/embeddings.ts)
const EMBEDDING_MODEL = "text-embedding-3-small"; // OpenAI embedding model

// Vector Search (lib/embeddings.ts)
const DEFAULT_TOP_K = 5; // default number of results for similarity search
const BATCH_SIZE = 100; // batch size for vector operations
```

### Vector Search

- Top-K results: 5 most relevant chunks per question
- Similarity threshold: Configured in Upstash Vector settings
- Uses namespaces for session isolation (automatic cleanup after processing)

## Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Add environment variables in the Vercel dashboard
3. Deploy

### Other Platforms

The app can be deployed on any platform that supports Next.js:

- Netlify
- Railway
- AWS
- Google Cloud

## Project Structure

```
tender-checklist-extractor/
├── app/
│   ├── api/ingest/          # API endpoint for document processing
│   ├── globals.css          # Global styles
│   ├── layout.tsx           # Root layout
│   └── page.tsx             # Main page
├── components/
│   ├── ui/                  # Shadcn/UI components
│   ├── upload-form.tsx      # Upload form with dynamic questions
│   └── results-display.tsx  # Results display component
├── lib/
│   ├── index.ts             # Main exports from lib modules
│   ├── types.ts             # Shared TypeScript types
│   ├── extraction.ts        # Main document processing orchestration
│   ├── pdf-parser.ts        # PDF processing with Claude AI
│   ├── embeddings.ts        # Vector embeddings and search
│   └── utils.ts             # Utility functions
└── public/                  # Static assets
```

### Library Module Organization

The `lib/` directory is organized into focused modules:

- **`types.ts`**: Shared TypeScript interfaces and types
- **`pdf-parser.ts`**: PDF processing with Claude AI
  - Document chunking and processing
  - Claude API integration for content extraction
  - Text splitting and paragraph processing
- **`embeddings.ts`**: Vector embeddings and search
  - OpenAI embeddings generation
  - Upstash Vector database operations
  - Similarity search and namespace management
- **`extraction.ts`**: Main orchestration logic
  - Document processing workflow
  - Question answering pipeline
  - Session management and cleanup
- **`index.ts`**: Clean exports from all modules

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Troubleshooting

### Common Issues

1. **Missing API Keys Error**

   - Error: "The OPENAI_API_KEY environment variable is missing"
   - Solution: Make sure you've created a `.env.local` file with all required API keys

2. **PDF Processing Issues**

   - Error: PDF files not being processed correctly
   - Solution: Ensure your PDF files are not password-protected and are valid PDF format

3. **Vector Database Connection**

   - Error: "Forbidden: /upsert is not allowed" or connection issues
   - Solution: Verify your Upstash Vector URL and token are correct, and ensure your database is configured for vector operations

4. **Large PDF Files**
   - Issue: Processing very large PDF files may take longer
   - Solution: Consider breaking large documents into smaller files

### API Key Setup Guide

1. **Anthropic Claude API**

   - Sign up at [console.anthropic.com](https://console.anthropic.com)
   - Navigate to "API Keys" section
   - Create a new key and copy it to your `.env.local`

2. **OpenAI API**

   - Sign up at [platform.openai.com](https://platform.openai.com)
   - Go to "API Keys" section
   - Create a new secret key and copy it to your `.env.local`

3. **Upstash Vector Database**
   - Sign up at [console.upstash.com](https://console.upstash.com)
   - Create a new Vector database
   - Copy the REST URL and token from the database dashboard

## Support

If you encounter any issues or have questions, please open an issue in the repository.
