import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';

describe('action.yml Schema Validation', () => {
  let actionContent: string;
  let actionYaml: any;

  beforeEach(() => {
    const path = join(process.cwd(), 'action.yml');
    actionContent = readFileSync(path, 'utf-8');
    actionYaml = parse(actionContent);
  });

  describe('Basic Structure', () => {
    it('should have name and description', () => {
      expect(actionYaml.name).toBeDefined();
      expect(actionYaml.description).toBeDefined();
      expect(actionYaml.runs).toBeDefined();
    });

    it('should use node20 runtime', () => {
      expect(actionYaml.runs.using).toBe('node20');
    });

    it('should reference dist/index.js', () => {
      expect(actionYaml.runs.main).toBe('dist/index.js');
    });
  });

  describe('Inputs', () => {
    it('should have required inputs', () => {
      const inputs = actionYaml.inputs;
      expect(inputs.provider).toBeDefined();
      expect(inputs.api_key).toBeDefined();
      expect(inputs.source_documents).toBeDefined();
    });

    it('should define all inputs documented in SYSTEM.md', () => {
      const expectedInputs = [
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

      expectedInputs.forEach(input => {
        expect(actionYaml.inputs).toHaveProperty(input);
      });
    });

    it('should have descriptions for all inputs', () => {
      Object.entries(actionYaml.inputs).forEach(([name, input]: [string, any]) => {
        expect(input.description).toBeDefined();
        expect(input.description.length).toBeGreaterThan(10);
      });
    });

    it('should specify strictness options', () => {
      const strictness = actionYaml.inputs.strictness;
      expect(strictness.description).toContain('strict');
      expect(strictness.description).toContain('balanced');
      expect(strictness.description).toContain('lenient');
    });

    it('should specify provider options', () => {
      const provider = actionYaml.inputs.provider;
      expect(provider.description).toContain('anthropic');
      expect(provider.description).toContain('openai');
      expect(provider.description).toContain('google');
    });
  });

  describe('Outputs', () => {
    it('should have verdict output', () => {
      expect(actionYaml.outputs.verdict).toBeDefined();
      expect(actionYaml.outputs.verdict.description).toBeDefined();
    });

    it('should have summary output', () => {
      expect(actionYaml.outputs.summary).toBeDefined();
      expect(actionYaml.outputs.summary.description).toBeDefined();
    });

    it('should document verdict values', () => {
      const verdictDesc = actionYaml.outputs.verdict.description;
      expect(verdictDesc).toContain('pass');
      expect(verdictDesc).toContain('fail');
      expect(verdictDesc).toContain('skip');
    });
  });

  describe('Input Validation Rules', () => {
    it('should require provider when needed', () => {
      expect(actionYaml.inputs.provider.required).toBe(true);
    });

    it('should require api_key', () => {
      expect(actionYaml.inputs.api_key.required).toBe(true);
    });

    it('should require source_documents', () => {
      expect(actionYaml.inputs.source_documents.required).toBe(true);
    });

    it('should have boolean inputs marked as such', () => {
      const booleanInputs = [
        'immutable_spec',
        'comment_on_pr',
        'inline_review_comments',
        'fail_closed_on_error',
        'auto_approve',
      ];

      booleanInputs.forEach(input => {
        const inputDef = actionYaml.inputs[input];
        expect(inputDef).toBeDefined();
        expect(inputDef.description).toBeTruthy();
      });
    });
  });
});
