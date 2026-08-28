import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('Documentation Completeness', () => {
  let systemContent: string;
  let functionalContent: string;

  beforeEach(() => {
    systemContent = readFileSync(join(process.cwd(), 'SYSTEM.md'), 'utf-8');
    functionalContent = readFileSync(join(process.cwd(), 'FUNCTIONAL.md'), 'utf-8');
  });

  describe('SYSTEM.md Completeness', () => {
    it('should have architecture overview section', () => {
      expect(systemContent).toContain('Architecture Overview');
    });

    it('should document all adapter interfaces', () => {
      expect(systemContent).toContain('GitAdapter');
      expect(systemContent).toContain('FilesystemAdapter');
      expect(systemContent).toContain('LlmJudgeAdapter');
      expect(systemContent).toContain('GithubClient');
    });

    it('should explain input configuration', () => {
      expect(systemContent).toContain('Input Configuration');
    });

    it('should define output specification', () => {
      expect(systemContent).toContain('Output Specification');
    });

    it('should explain verdict logic', () => {
      expect(systemContent).toContain('Verdict Logic');
      expect(systemContent).toContain('PASS');
      expect(systemContent).toContain('FAIL');
    });

    it('should document LLM prompting strategy', () => {
      expect(systemContent).toContain('LLM Prompting Strategy');
    });

    it('should include error handling section', () => {
      expect(systemContent).toContain('Error Handling');
    });

    it('should cover security considerations', () => {
      expect(systemContent).toContain('Security');
    });

    it('should provide configuration examples', () => {
      expect(systemContent).toContain('Minimal Configuration');
      expect(systemContent).toContain('Full Configuration');
    });

    it('should list supported LLM providers', () => {
      expect(systemContent).toContain('Anthropic');
      expect(systemContent).toContain('OpenAI');
      expect(systemContent).toContain('Google');
    });

    it('should explain data flow', () => {
      expect(systemContent).toContain('Data Flow');
    });

    it('should include version information', () => {
      expect(systemContent).toContain('0.1.0-beta');
    });
  });

  describe('FUNCTIONAL.md Completeness', () => {
    it('should have multiple user stories', () => {
      expect(functionalContent).toContain('As a');
      expect(functionalContent).toContain('I want');
      expect(functionalContent).toContain('So that');
    });

    it('should include acceptance criteria', () => {
      expect(functionalContent).toContain('Acceptance Criteria');
    });

    it('should have Gherkin scenarios', () => {
      expect(functionalContent).toContain('Given');
      expect(functionalContent).toContain('When');
      expect(functionalContent).toContain('Then');
    });

    it('should define non-functional requirements', () => {
      expect(functionalContent).toContain('Non-Functional Requirements');
    });

    it('should explain strictness levels', () => {
      expect(functionalContent).toMatch(/strict|STRICT/i);
      expect(functionalContent).toMatch(/balanced|BALANCED/i);
      expect(functionalContent).toMatch(/lenient|LENIENT/i);
    });

    it('should include performance targets', () => {
      expect(functionalContent).toContain('30 seconds');
    });

    it('should define all verdict types', () => {
      expect(functionalContent).toContain('pass');
      expect(functionalContent).toContain('pass_with_drift');
      expect(functionalContent).toContain('fail');
      expect(functionalContent).toContain('skip');
    });
  });

  describe('Cross-Document Consistency', () => {
    it('should use same verdict terminology', () => {
      const verdicts = ['pass', 'pass_with_drift', 'fail', 'skip', 'error'];
      verdicts.forEach(verdict => {
        expect(systemContent).toContain(verdict);
        if (verdict !== 'error') {
          // error might not be in functional
          expect(functionalContent).toContain(verdict);
        }
      });
    });

    it('should reference same strictness levels', () => {
      const levels = ['strict', 'balanced', 'lenient'];
      levels.forEach(level => {
        expect(systemContent).toContain(level);
        expect(functionalContent).toContain(level);
      });
    });

    it('should mention same adapters', () => {
      const adapters = [
        'GitAdapter',
        'FilesystemAdapter',
        'LlmJudgeAdapter',
        'GithubClient',
      ];
      adapters.forEach(adapter => {
        expect(systemContent).toContain(adapter);
      });
    });

    it('should define supported conventions', () => {
      // Both documents should mention at least some conventions
      expect(systemContent).toMatch(/speckit|openspec|kiro|bmad/);
      expect(functionalContent).toMatch(/speckit|openspec|kiro|bmad/);
    });

    it('should document same severity levels', () => {
      const levels = ['notice', 'warning', 'failure'];
      levels.forEach(level => {
        expect(systemContent).toContain(level);
        expect(functionalContent).toContain(level);
      });
    });
  });

  describe('Documentation Quality', () => {
    it('SYSTEM.md should have sections with clear headings', () => {
      const headingCount = (systemContent.match(/^## /gm) || []).length;
      expect(headingCount).toBeGreaterThanOrEqual(10);
    });

    it('FUNCTIONAL.md should have multiple sections', () => {
      const headingCount = (functionalContent.match(/^## /gm) || []).length;
      expect(headingCount).toBeGreaterThanOrEqual(3);
    });

    it('should include code examples', () => {
      expect(systemContent).toContain('```');
      expect(functionalContent).toContain('```');
    });

    it('should include tables for reference', () => {
      expect(systemContent).toContain('|');
    });

    it('SYSTEM.md should include architectural diagrams', () => {
      expect(systemContent).toContain('Flow');
    });

    it('should be scannable with bold highlighting', () => {
      expect(systemContent).toContain('**');
      expect(functionalContent).toContain('**');
    });
  });

  describe('Implementation Coverage', () => {
    it('should document all action inputs', () => {
      const inputs = [
        'provider',
        'api_key',
        'source_documents',
        'model',
        'strictness',
        'immutable_spec',
        'comment_on_pr',
        'inline_review_comments',
        'exclude_paths',
        'bypass_label',
        'fail_closed_on_error',
        'auto_approve',
        'approval_token',
      ];

      inputs.forEach(input => {
        expect(systemContent).toContain(input);
      });
    });

    it('should explain all adapter methods', () => {
      expect(systemContent).toContain('getDiff');
      expect(systemContent).toContain('readSourceDocument');
      expect(systemContent).toContain('judge');
      expect(systemContent).toContain('upsertCheckRun');
    });
  });
});
