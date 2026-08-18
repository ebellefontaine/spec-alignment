import type { Adapters, Config, EvaluationResult } from './types.js';
import { decideDiscovery } from '../domain/discovery.js';
import { findImmutableSpecViolation } from '../domain/immutableSpecCheck.js';
import { estimateTokens, filterByRelevance } from '../domain/relevanceFilter.js';
import { buildFilterPrompt, buildJudgePrompt } from '../domain/promptBuilder.js';
import {
  errorResult,
  immutableSpecViolationResult,
  mapJudgeResultToEvaluation,
  skipResult,
} from '../domain/verdictMapper.js';

const TOKEN_BUDGET = 150_000;

export async function runAction(adapters: Adapters, config: Config): Promise<EvaluationResult> {
  const diffFiles = await adapters.getDiff();

  const discoveryDecision = decideDiscovery(config, diffFiles);
  if (discoveryDecision.skip) {
    return writeBack(adapters, config, skipResult(discoveryDecision.skipReason));
  }

  const allGlobs = discoveryDecision.documentsToRead.map((doc) => doc.glob);
  if (config.immutableSpec) {
    const violatedPaths = findImmutableSpecViolation(diffFiles, allGlobs);
    if (violatedPaths.length > 0) {
      return writeBack(adapters, config, immutableSpecViolationResult(violatedPaths));
    }
  }

  const sourceDocumentBatches = await Promise.all(
    discoveryDecision.documentsToRead.map((doc) => adapters.readSourceDocument(doc.glob, doc.convention))
  );
  const sourceDocuments = sourceDocumentBatches.flat();

  if (sourceDocuments.length === 0) {
    return writeBack(
      adapters,
      config,
      skipResult('No source documents found on disk matching the configured source_documents entries')
    );
  }

  let filtered = filterByRelevance(diffFiles, sourceDocuments, TOKEN_BUDGET);
  if (!filtered.withinBudget) {
    try {
      const filterPrompt = buildFilterPrompt(filtered.diffFiles, filtered.sourceDocuments);
      const selection = await adapters.llmJudge.filterRelevance({
        provider: config.provider,
        apiKey: config.apiKey,
        model: config.model,
        prompt: filterPrompt,
      });
      const narrowedDocs = sourceDocuments.filter((doc) =>
        selection.selectedSourceDocumentPaths.includes(doc.path)
      );
      const narrowedTokens = estimateTokens(diffFiles, narrowedDocs);
      if (narrowedTokens > TOKEN_BUDGET) {
        return writeBack(adapters, config, errorResult('PR too large to check, even after relevance filtering'));
      }
      filtered = { diffFiles, sourceDocuments: narrowedDocs, withinBudget: true };
    } catch (err) {
      return writeBack(
        adapters,
        config,
        errorResult(`Spec check unavailable: relevance-filtering call failed (${(err as Error).message})`)
      );
    }
  }

  let result: EvaluationResult;
  try {
    const prompt = buildJudgePrompt(filtered.diffFiles, filtered.sourceDocuments, config.strictness, config.fileTree);
    const judgeResult = await adapters.llmJudge.judge({
      provider: config.provider,
      apiKey: config.apiKey,
      model: config.model,
      prompt,
    });
    result = mapJudgeResultToEvaluation(judgeResult);
  } catch (err) {
    result = errorResult(`Spec check unavailable: judge call failed (${(err as Error).message})`);
  }

  return writeBack(adapters, config, result);
}

async function writeBack(adapters: Adapters, config: Config, result: EvaluationResult): Promise<EvaluationResult> {
  await adapters.githubClient.upsertCheckRun(result, config.failClosedOnError);
  if (config.commentOnPr) {
    await adapters.githubClient.upsertPrComment(result);
  }
  if (config.inlineReviewComments && result.findings.length > 0) {
    await adapters.githubClient.postInlineReviewComments(result);
  }
  if (config.autoApprove && result.verdict === 'pass' && config.approvalToken) {
    await adapters.githubClient.approvePr(config.approvalToken);
  }
  return result;
}
