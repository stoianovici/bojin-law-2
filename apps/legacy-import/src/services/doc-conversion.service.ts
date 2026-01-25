/**
 * DOC to PDF Conversion Service
 * Converts legacy .doc files to PDF using LibreOffice headless mode
 * Part of Story 3.2.5 - Legacy Document Import
 */

import { spawn } from 'child_process';
import { writeFile, readFile, unlink, mkdir } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync } from 'fs';

// LibreOffice command - try common paths
const SOFFICE_PATHS = [
  '/usr/bin/soffice',
  '/usr/bin/libreoffice',
  '/opt/libreoffice/program/soffice',
  '/Applications/LibreOffice.app/Contents/MacOS/soffice', // macOS
  'soffice', // PATH fallback
];

export interface ConversionResult {
  success: boolean;
  pdfBuffer?: Buffer;
  error?: string;
}

/**
 * Find the LibreOffice executable
 */
function findLibreOffice(): string | null {
  for (const path of SOFFICE_PATHS) {
    if (path === 'soffice') {
      // PATH fallback - always return this as last resort
      return 'soffice';
    }
    if (existsSync(path)) {
      return path;
    }
  }
  return null;
}

/**
 * Convert a DOC file buffer to PDF using LibreOffice
 */
export async function convertDocToPdf(docBuffer: Buffer): Promise<ConversionResult> {
  const soffice = findLibreOffice();
  if (!soffice) {
    return {
      success: false,
      error: 'LibreOffice not found. Install with: apt-get install libreoffice-writer',
    };
  }

  const tempId = randomUUID();
  const tempDir = join(tmpdir(), `doc-convert-${tempId}`);
  const inputPath = join(tempDir, 'input.doc');
  const outputPath = join(tempDir, 'input.pdf');

  try {
    // Create temp directory
    await mkdir(tempDir, { recursive: true });

    // Write input file
    await writeFile(inputPath, docBuffer);

    // Convert using LibreOffice
    // --headless: no GUI
    // --convert-to pdf: output format
    // --outdir: output directory
    const result = await new Promise<{ success: boolean; error?: string }>((resolve) => {
      const args = [
        '--headless',
        '--invisible',
        '--nodefault',
        '--nofirststartwizard',
        '--nolockcheck',
        '--nologo',
        '--convert-to',
        'pdf',
        '--outdir',
        tempDir,
        inputPath,
      ];

      const process = spawn(soffice, args, {
        timeout: 60000, // 60 second timeout
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stderr = '';

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        if (code === 0) {
          resolve({ success: true });
        } else {
          resolve({
            success: false,
            error: `LibreOffice exited with code ${code}: ${stderr}`,
          });
        }
      });

      process.on('error', (err) => {
        resolve({
          success: false,
          error: `LibreOffice spawn error: ${err.message}`,
        });
      });
    });

    if (!result.success) {
      return result as ConversionResult;
    }

    // Read the converted PDF
    if (!existsSync(outputPath)) {
      return {
        success: false,
        error: 'PDF output file not created',
      };
    }

    const pdfBuffer = await readFile(outputPath);

    return {
      success: true,
      pdfBuffer,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown conversion error',
    };
  } finally {
    // Cleanup temp files
    try {
      if (existsSync(inputPath)) await unlink(inputPath);
      if (existsSync(outputPath)) await unlink(outputPath);
      // Try to remove the temp directory
      const { rmdir } = await import('fs/promises');
      await rmdir(tempDir).catch(() => {});
    } catch {
      // Ignore cleanup errors
    }
  }
}

/**
 * Check if LibreOffice is available
 */
export function isLibreOfficeAvailable(): boolean {
  return findLibreOffice() !== null;
}

/**
 * Get LibreOffice path for diagnostics
 */
export function getLibreOfficePath(): string | null {
  return findLibreOffice();
}
