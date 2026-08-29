import { readFileSync } from 'fs';
import { join } from 'path';
import yaml from 'yaml';
import { describe, it, expect } from 'vitest';

describe('Release Workflow', () => {
  it('has valid YAML syntax', () => {
    const workflowPath = join(process.cwd(), '.github', 'workflows', 'release.yml');
    const content = readFileSync(workflowPath, 'utf-8');

    // Should not throw
    const parsed = yaml.parse(content);
    expect(parsed).toBeDefined();
  });

  it('has correct trigger configuration', () => {
    const workflowPath = join(process.cwd(), '.github', 'workflows', 'release.yml');
    const content = readFileSync(workflowPath, 'utf-8');
    const parsed = yaml.parse(content);

    expect(parsed.on).toBeDefined();
    expect(parsed.on.push).toBeDefined();
    expect(parsed.on.push.tags).toContain('v*');
  });

  it('has required permissions', () => {
    const workflowPath = join(process.cwd(), '.github', 'workflows', 'release.yml');
    const content = readFileSync(workflowPath, 'utf-8');
    const parsed = yaml.parse(content);

    expect(parsed.permissions).toBeDefined();
    expect(parsed.permissions.contents).toBe('write');
  });

  it('has release job with required steps', () => {
    const workflowPath = join(process.cwd(), '.github', 'workflows', 'release.yml');
    const content = readFileSync(workflowPath, 'utf-8');
    const parsed = yaml.parse(content);

    expect(parsed.jobs).toBeDefined();
    expect(parsed.jobs.release).toBeDefined();

    const stepNames = parsed.jobs.release.steps.map((s: any) => s.name);
    expect(stepNames).toContain('Checkout code');
    expect(stepNames).toContain('Extract version');
    expect(stepNames).toContain('Create GitHub Release');
    expect(stepNames).toContain('Update major version branch');
  });
});
