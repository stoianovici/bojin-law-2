/**
 * Embedding Generation Service
 * Story 3.2.6: AI Training Pipeline for Legacy Document Processing
 *
 * Generates embeddings using OpenAI text-embedding-3-small model
 */

import { OpenAI } from 'openai';
import { encoding_for_model } from 'tiktoken';
import type { GenerateEmbeddingsInput, GenerateEmbeddingsOutput } from '@legal-platform/types';
import logger from '../lib/logger';

/**
 * Embedding Generation Service Class
 * Generates embeddings for text chunks using OpenAI API
 */
export class EmbeddingGenerationService {
  private openai: OpenAI;
  private encoding: ReturnType<typeof encoding_for_model>;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || '',
    });

    // Use cl100k_base encoding (same as gpt-4)
    this.encoding = encoding_for_model('gpt-4');
  }

  /**
   * Generate embeddings for text
   * Splits text into chunks and generates embeddings for each
   * @param input - Generation input with text and parameters
   * @returns Embeddings with chunk information
   */
  async generateEmbeddings(input: GenerateEmbeddingsInput): Promise<GenerateEmbeddingsOutput> {
    const startTime = Date.now();
    const maxChunkTokens = input.maxChunkTokens || 512;

    try {
      // Split text into chunks
      const chunks = this.splitIntoChunks(input.text, maxChunkTokens);

      logger.info('Text split into chunks', {
        totalChunks: chunks.length,
        maxChunkTokens,
      });

      // Generate embeddings for all chunks in batch
      const embeddings = await this.generateBatchEmbeddings(chunks);

      const totalTokensUsed = chunks.reduce((sum, chunk) => sum + chunk.tokenCount, 0);

      const duration = Date.now() - startTime;

      logger.info('Embeddings generated successfully', {
        totalChunks: chunks.length,
        totalTokensUsed,
        durationMs: duration,
      });

      return {
        chunks: chunks.map((chunk, index) => ({
          index,
          text: chunk.text,
          embedding: embeddings[index],
          tokenCount: chunk.tokenCount,
        })),
        totalTokensUsed,
      };
    } catch (error) {
      logger.error('Embedding generation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Split text into chunks based on token count
   * @param text - Full text to split
   * @param maxTokens - Maximum tokens per chunk
   * @returns Array of text chunks with token counts
   */
  private splitIntoChunks(
    text: string,
    maxTokens: number
  ): Array<{ text: string; tokenCount: number }> {
    const sentences = this.splitIntoSentences(text);
    const chunks: Array<{ text: string; tokenCount: number }> = [];
    let currentChunk: string[] = [];
    let currentTokens = 0;

    for (const sentence of sentences) {
      const sentenceTokens = this.countTokens(sentence);

      // If single sentence exceeds max tokens, split it further
      if (sentenceTokens > maxTokens) {
        if (currentChunk.length > 0) {
          chunks.push({
            text: currentChunk.join(' '),
            tokenCount: currentTokens,
          });
          currentChunk = [];
          currentTokens = 0;
        }

        // Split long sentence into smaller chunks
        const words = sentence.split(/\s+/);
        let wordChunk: string[] = [];
        let wordTokens = 0;

        for (const word of words) {
          const wordTokenCount = this.countTokens(word);
          if (wordTokens + wordTokenCount > maxTokens && wordChunk.length > 0) {
            chunks.push({
              text: wordChunk.join(' '),
              tokenCount: wordTokens,
            });
            wordChunk = [word];
            wordTokens = wordTokenCount;
          } else {
            wordChunk.push(word);
            wordTokens += wordTokenCount;
          }
        }

        if (wordChunk.length > 0) {
          chunks.push({
            text: wordChunk.join(' '),
            tokenCount: wordTokens,
          });
        }

        continue;
      }

      // Add sentence to current chunk if it fits
      if (currentTokens + sentenceTokens <= maxTokens) {
        currentChunk.push(sentence);
        currentTokens += sentenceTokens;
      } else {
        // Save current chunk and start new one
        if (currentChunk.length > 0) {
          chunks.push({
            text: currentChunk.join(' '),
            tokenCount: currentTokens,
          });
        }
        currentChunk = [sentence];
        currentTokens = sentenceTokens;
      }
    }

    // Add remaining chunk
    if (currentChunk.length > 0) {
      chunks.push({
        text: currentChunk.join(' '),
        tokenCount: currentTokens,
      });
    }

    return chunks;
  }

  /**
   * Split text into sentences
   * @param text - Text to split
   * @returns Array of sentences
   */
  private splitIntoSentences(text: string): string[] {
    // Split on sentence boundaries (., !, ?) followed by whitespace
    return text.split(/(?<=[.!?])\s+/).filter((sentence) => sentence.trim().length > 0);
  }

  /**
   * Count tokens in text
   * @param text - Text to count tokens for
   * @returns Token count
   */
  private countTokens(text: string): number {
    return this.encoding.encode(text).length;
  }

  /**
   * Generate embeddings for multiple chunks in batch
   * @param chunks - Array of text chunks
   * @returns Array of embedding vectors
   */
  private async generateBatchEmbeddings(
    chunks: Array<{ text: string; tokenCount: number }>
  ): Promise<number[][]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: chunks.map((chunk) => chunk.text),
        encoding_format: 'float',
      });

      return response.data.map((item) => item.embedding);
    } catch (error) {
      logger.error('OpenAI API call failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Generate single embedding for query/search
   * @param text - Query text
   * @returns Embedding vector
   */
  async generateQueryEmbedding(text: string): Promise<number[]> {
    try {
      const response = await this.openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: text,
        encoding_format: 'float',
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('Query embedding generation failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param a - First embedding vector
   * @param b - Second embedding vector
   * @returns Similarity score (0-1)
   */
  calculateSimilarity(a: number[], b: number[]): number {
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
}

export const embeddingGenerationService = new EmbeddingGenerationService();
