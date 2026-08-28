import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('FUNCTIONAL.md - User Stories Validation', () => {
  let functionalContent: string;

  beforeEach(() => {
    const path = join(process.cwd(), 'FUNCTIONAL.md');
    functionalContent = readFileSync(path, 'utf-8');
  });

  describe('User Story 1: Automatic Specification Alignment Validation', () => {
    it('should document automatic PR validation', () => {
      expect(functionalContent).toContain('automatic');
      expect(functionalContent).toContain('PR');
    });

    it('should define verdict types', () => {
      expect(functionalContent).toMatch(/pass|pass_with_drift|fail|skip/);
    });

    it('should mention Check Run reporting', () => {
      expect(functionalContent).toContain('Check Run');
    });
  });

  describe('User Story 2: Contributor Feedback', () => {
    it('should specify comment posting behavior', () => {
      expect(functionalContent).toContain('comment is posted');
    });

    it('should mention inline review comments', () => {
      expect(functionalContent).toContain('inline review comments');
    });

    it('should include guidance in feedback', () => {
      expect(functionalContent).toContain('Suggested fix');
    });
  });

  describe('User Story 3: Drift Detection', () => {
    it('should distinguish between pass and pass_with_drift', () => {
      expect(functionalContent).toContain('pass_with_drift');
    });

    it('should define severity levels', () => {
      expect(functionalContent).toContain('notice');
      expect(functionalContent).toContain('warning');
      expect(functionalContent).toContain('failure');
    });

    it('should document strictness levels', () => {
      expect(functionalContent).toContain('strict');
      expect(functionalContent).toContain('balanced');
      expect(functionalContent).toContain('lenient');
    });
  });

  describe('User Story 4: Multiple Specification Conventions', () => {
    it('should list supported conventions', () => {
      expect(functionalContent).toContain('speckit');
      expect(functionalContent).toContain('openspec');
      expect(functionalContent).toContain('kiro');
      expect(functionalContent).toContain('bmad');
      expect(functionalContent).toContain('domain-modeling');
    });

    it('should explain convention mapping', () => {
      expect(functionalContent).toContain('convention is mapped to an LLM prompt');
    });
  });

  describe('User Story 5: Auto-Approval', () => {
    it('should define auto-approval conditions', () => {
      expect(functionalContent).toContain('auto-approve');
    });

    it('should require explicit approval token', () => {
      expect(functionalContent).toContain('approval token');
    });

    it('should allow bypass label', () => {
      expect(functionalContent).toContain('bypass label');
    });
  });

  describe('User Story 6: Graceful Error Handling', () => {
    it('should specify skip behavior for unavailable specs', () => {
      expect(functionalContent).toContain('skip');
      expect(functionalContent).toMatch(/unavailable|cannot be read/);
    });

    it('should mention error handling behavior', () => {
      expect(functionalContent).toContain('failClosedOnError') || expect(functionalContent).toContain('fail_closed_on_error');
    });

    it('should define error scenarios', () => {
      expect(functionalContent).toContain('Specification files not found');
      expect(functionalContent).toContain('LLM API timeout');
    });
  });

  describe('User Story 7: Path Exclusion', () => {
    it('should explain path exclusion', () => {
      expect(functionalContent).toContain('exclude') || expect(functionalContent).toContain('skip');
    });

    it('should use minimatch syntax', () => {
      expect(functionalContent).toContain('minimatch');
    });

    it('should show example exclusions', () => {
      expect(functionalContent).toContain('node_modules');
    });
  });

  describe('User Story 8: Draft PR Handling', () => {
    it('should specify draft PR behavior', () => {
      expect(functionalContent).toContain('draft PR');
    });

    it('should return skip verdict for drafts', () => {
      expect(functionalContent).toContain('draft');
    });
  });

  describe('Acceptance Criteria - Gherkin Scenarios', () => {
    it('should include Scenario A: Successful Alignment', () => {
      expect(functionalContent).toContain('Scenario A');
      expect(functionalContent).toContain('Successful Alignment Check');
    });

    it('should include Scenario B: Drift Detection', () => {
      expect(functionalContent).toContain('Scenario B');
      expect(functionalContent).toContain('Drift Detection');
    });

    it('should include Scenario C: Auto-Approval', () => {
      expect(functionalContent).toContain('Scenario C');
      expect(functionalContent).toContain('Auto-Approval');
    });

    it('should include Scenario D: Draft PR Skip', () => {
      expect(functionalContent).toContain('Scenario D');
    });

    it('should include Scenario E: Graceful Degradation', () => {
      expect(functionalContent).toContain('Scenario E');
      expect(functionalContent).toContain('Graceful Degradation');
    });
  });

  describe('Non-Functional Requirements', () => {
    it('should specify performance targets', () => {
      expect(functionalContent).toContain('Performance');
      expect(functionalContent).toContain('30 seconds');
    });

    it('should mention reliability requirements', () => {
      expect(functionalContent).toContain('Reliability');
    });

    it('should include security requirements', () => {
      expect(functionalContent).toContain('Security');
    });
  });
});
