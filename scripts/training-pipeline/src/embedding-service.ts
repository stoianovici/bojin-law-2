/**
 * Local Embedding Service using multilingual-e5-base
 * Runs on your machine - no external API calls needed
 */

import { pipeline, type FeatureExtractionPipeline } from '@xenova/transformers';
import ora from 'ora';

// Model configuration
const MODEL_NAME = 'intfloat/multilingual-e5-base';
const EMBEDDING_DIMENSIONS = 768;
const MAX_CHUNK_LENGTH = 512; // tokens

let embedder: FeatureExtractionPipeline | null = null;

/**
 * Initialize the embedding model (downloads on first run, ~1.1GB)
 */
export async function initializeModel(): Promise<void> {
  if (embedder) return;

  const spinner = ora('Loading multilingual-e5-base model...').start();

  try {
    // First run downloads the model to ~/.cache/huggingface/
    embedder = await pipeline('feature-extraction', MODEL_NAME, {
      quantized: false, // Use full precision for better quality
    });

    spinner.succeed('Model loaded successfully');
  } catch (error) {
    spinner.fail('Failed to load model');
    throw error;
  }
}

/**
 * Generate embedding for a single text
 * E5 models require a prefix for queries vs passages
 */
export async function generateEmbedding(
  text: string,
  isQuery: boolean = false
): Promise<number[]> {
  if (!embedder) {
    throw new Error('Model not initialized. Call initializeModel() first.');
  }

  // E5 models use prefixes to distinguish queries from passages
  const prefixedText = isQuery ? `query: ${text}` : `passage: ${text}`;

  const output = await embedder(prefixedText, {
    pooling: 'mean',
    normalize: true,
  });

  // Convert to regular array
  return Array.from(output.data as Float32Array);
}

/**
 * Split text into chunks suitable for embedding
 */
export function splitIntoChunks(text: string, maxLength: number = MAX_CHUNK_LENGTH): string[] {
  // Simple sentence-based chunking
  const sentences = text.split(/(?<=[.!?])\s+/);
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentLength = 0;

  for (const sentence of sentences) {
    const sentenceLength = sentence.split(/\s+/).length;

    if (currentLength + sentenceLength > maxLength && currentChunk.length > 0) {
      chunks.push(currentChunk.join(' '));
      currentChunk = [sentence];
      currentLength = sentenceLength;
    } else {
      currentChunk.push(sentence);
      currentLength += sentenceLength;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join(' '));
  }

  return chunks.filter(chunk => chunk.trim().length > 0);
}

/**
 * Generate embeddings for a document (handles chunking)
 */
export async function generateDocumentEmbeddings(
  text: string
): Promise<Array<{ chunkIndex: number; chunkText: string; embedding: number[] }>> {
  const chunks = splitIntoChunks(text);
  const results: Array<{ chunkIndex: number; chunkText: string; embedding: number[] }> = [];

  for (let i = 0; i < chunks.length; i++) {
    const embedding = await generateEmbedding(chunks[i], false);
    results.push({
      chunkIndex: i,
      chunkText: chunks[i],
      embedding,
    });
  }

  return results;
}

/**
 * Calculate cosine similarity between two embeddings
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embedding dimensions must match');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

export { EMBEDDING_DIMENSIONS };
