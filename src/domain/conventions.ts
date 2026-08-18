import type { ConventionName, SourceDocumentEntry } from '../core/types.js';

const KNOWN_CONVENTIONS: ConventionName[] = ['speckit', 'openspec', 'kiro', 'bmad', 'domain-modeling'];

export function parseSourceDocumentEntry(line: string): SourceDocumentEntry {
  const separatorIndex = line.indexOf(' - ');
  const rawConvention = (separatorIndex === -1 ? line : line.slice(0, separatorIndex)).trim();
  const explicitPath = separatorIndex === -1 ? undefined : line.slice(separatorIndex + 3).trim();

  if (rawConvention.toLowerCase() === 'other') {
    if (!explicitPath) {
      throw new Error(`"Other" source_documents entry requires a path: "${line}"`);
    }
    return { convention: 'other', explicitPath };
  }

  const convention = KNOWN_CONVENTIONS.find((c) => c === rawConvention.toLowerCase());
  if (!convention) {
    throw new Error(
      `Unknown source_documents convention "${rawConvention}". Expected one of: ${KNOWN_CONVENTIONS.join(', ')}, or "Other - <path>".`
    );
  }
  return explicitPath ? { convention, explicitPath } : { convention };
}

export function parseSourceDocumentsInput(input: string): SourceDocumentEntry[] {
  return input
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map(parseSourceDocumentEntry);
}

const CONVENTION_DEFAULT_GLOBS: Record<Exclude<ConventionName, 'other'>, string[]> = {
  speckit: ['.specify/memory/constitution.md', 'specs/*/spec.md'],
  openspec: ['openspec/specs/**', 'openspec/changes/*/specs/**'],
  kiro: ['.kiro/specs/*/requirements.md', '.kiro/specs/*/design.md', '.kiro/specs/*/tasks.md'],
  bmad: ['docs/prd.md', 'docs/architecture.md', 'docs/stories/*.story.md'],
  'domain-modeling': ['CONTEXT.md', 'docs/adr/**'],
};

export function resolveGlobs(entry: SourceDocumentEntry): string[] {
  if (entry.convention === 'other') {
    return [entry.explicitPath as string];
  }
  if (entry.explicitPath) {
    return [entry.explicitPath];
  }
  return CONVENTION_DEFAULT_GLOBS[entry.convention];
}
