#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const logsRoot = process.env.SAFETYGUARD_LOGS_ROOT || path.join(root, 'logs', 'dryrun-documents');
const outDir = process.env.SAFETYGUARD_PUBLISH_DIR || path.join(root, 'data', 'dryrun');

const candidates = fs.existsSync(logsRoot)
  ? fs.readdirSync(logsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
  : [];

if (candidates.length === 0) {
  throw new Error(`No dry-run log directories found under ${logsRoot}`);
}

const latestId = candidates[candidates.length - 1];
const latestDir = path.join(logsRoot, latestId);
const summary = JSON.parse(fs.readFileSync(path.join(latestDir, 'summary.json'), 'utf-8'));
const details = JSON.parse(fs.readFileSync(path.join(latestDir, 'details.json'), 'utf-8'));
const report = fs.readFileSync(path.join(latestDir, 'report.md'), 'utf-8');

const snapshot = {
  runId: latestId,
  generatedAt: summary.generatedAt,
  totalRuns: summary.totalRuns,
  okCount: summary.okCount,
  failCount: summary.failCount,
  successRate: summary.successRate,
  avgMs: summary.avgMs,
  p95Ms: summary.p95Ms,
  qualityNote:
    summary.failCount === 0 && details.every((item) => item.answerLength >= 80)
      ? 'All document dry-run cases returned output, but quality may still be generic.'
      : 'One or more document dry-run cases failed or returned weak output.',
  reportPath: path.relative(root, path.join(latestDir, 'report.md')),
  summaryPath: path.relative(root, path.join(latestDir, 'summary.json')),
  highlights: details.slice(0, 10).map((item) => ({
    id: item.id,
    label: item.label,
    ok: item.ok,
    status: item.status,
    elapsedMs: item.elapsedMs,
    answerLength: item.answerLength ?? 0,
    citations: item.citations ?? 0,
    answerPreview: item.answerPreview ?? '',
  })),
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'latest-document-dryrun.json'), JSON.stringify(snapshot, null, 2));
fs.writeFileSync(path.join(outDir, 'latest-document-dryrun.md'), report);
console.log(JSON.stringify({ outDir, runId: latestId }, null, 2));
