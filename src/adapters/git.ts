import { exec } from '@actions/exec';
import { minimatch } from 'minimatch';
import type { DiffFile } from '../core/types.js';
import type { GitAdapter } from './index.js';

/**
 * RealGitAdapter: Retrieves git diffs in a GitHub Actions environment.
 * Uses @actions/exec to run git diff and parses the output into DiffFile[].
 */
class RealGitAdapter implements GitAdapter {
  async getDiff(excludePatterns?: string[]): Promise<DiffFile[]> {
    let output = '';
    const exitCode = await exec('git', [
      'diff',
      'origin/HEAD...HEAD',
      '--unified=3',
      '--no-color',
    ], {
      listeners: {
        stdout: (data: Buffer) => {
          output += data.toString();
        },
      },
    });

    if (exitCode !== 0) {
      throw new Error(`git diff command failed with exit code ${exitCode}`);
    }

    let files = this.parseDiff(output);

    if (excludePatterns && excludePatterns.length > 0) {
      files = files.filter((file) => !this.matchesExcludePattern(file.path, excludePatterns));
    }

    return files;
  }

  private matchesExcludePattern(filePath: string, patterns: string[]): boolean {
    return patterns.some((pattern) => {
      const normalized = pattern.replace(/\\/g, '/');
      return minimatch(filePath, normalized, { dot: true });
    });
  }

  /**
   * Parses unified diff output into DiffFile array.
   * Handles standard git diff format with proper status detection.
   */
  private parseDiff(diffOutput: string): DiffFile[] {
    const files: DiffFile[] = [];
    const lines = diffOutput.split('\n');

    let currentFile: { path: string; status: 'added' | 'modified' | 'removed' | 'renamed' } | null = null;
    let patchLines: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Detect start of a new file diff
      if (line.startsWith('diff --git ')) {
        // Save previous file if exists
        if (currentFile !== null) {
          files.push({
            path: currentFile.path,
            status: currentFile.status,
            patch: patchLines.join('\n'),
          });
        }

        // Parse file path from "diff --git a/path b/path" or quoted paths
        // Handles both: a/path b/path and "a/path with spaces" "b/path with spaces"
        const match = line.match(/^diff --git (?:"a\/([^"]+)"|a\/(\S+)) (?:"b\/([^"]+)"|b\/(\S+))$/);
        const filePath = (match && (match[1] || match[2])) || '';

        currentFile = {
          path: filePath,
          status: 'modified', // Default status
        };
        patchLines = [line];
      } else if (line.startsWith('Binary files ')) {
        // Handle binary files - mark patch as empty and skip content
        if (currentFile !== null) {
          patchLines.push(line);
        }
      } else if (currentFile !== null) {
        // Detect file status
        if (line.startsWith('new file mode')) {
          currentFile.status = 'added';
          patchLines.push(line);
        } else if (line.startsWith('deleted file mode')) {
          currentFile.status = 'removed';
          patchLines.push(line);
        } else if (line.startsWith('similarity index 100%')) {
          // This is part of a rename - look for the next line
          patchLines.push(line);
        } else if (line.startsWith('rename from ')) {
          currentFile.status = 'renamed';
          patchLines.push(line);
        } else if (line.startsWith('rename to ')) {
          patchLines.push(line);
        } else {
          // All other lines are part of the patch
          patchLines.push(line);
        }
      }
    }

    // Don't forget the last file
    if (currentFile !== null) {
      files.push({
        path: currentFile.path,
        status: currentFile.status,
        patch: patchLines.join('\n'),
      });
    }

    return files;
  }
}

export const gitAdapter: GitAdapter = new RealGitAdapter();
