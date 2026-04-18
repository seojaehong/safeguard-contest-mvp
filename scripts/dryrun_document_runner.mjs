#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const baseUrl = process.env.SAFETYGUARD_BASE_URL || 'http://127.0.0.1:3021';
const casesPath = process.env.SAFETYGUARD_CASES_PATH || path.join(process.cwd(), 'scripts', 'dryrun_document_cases.json');
const outDir = process.env.SAFETYGUARD_OUT_DIR || path.join(process.cwd(), 'logs', 'dryrun-documents', new Date().toISOString().replace(/[:.]/g, '-'));

fs.mkdirSync(outDir, { recursive: true });
const cases = JSON.parse(fs.readFileSync(casesPath, 'utf-8'));
if (!Array.isArray(cases) || cases.length === 0) {
  throw new Error('No document dry-run cases found');
}

const details = [];
let okCount = 0;
let failCount = 0;

for (let i = 0; i < cases.length; i += 1) {
  const testCase = cases[i];
  const startedAt = Date.now();
  try {
    const response = await fetch(`${baseUrl}/api/ask`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: testCase.question }),
    });
    const text = await response.text();
    const elapsedMs = Date.now() - startedAt;
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    const answer = typeof parsed?.answer === 'string' ? parsed.answer.trim() : '';
    const citations = Array.isArray(parsed?.citations) ? parsed.citations.length : 0;
    const ok = response.ok && answer.length >= 80;
    if (ok) okCount += 1;
    else failCount += 1;

    details.push({
      index: i + 1,
      id: testCase.id,
      label: testCase.label,
      ok,
      status: response.status,
      elapsedMs,
      answerLength: answer.length,
      citations,
      answerPreview: answer.slice(0, 240),
    });
  } catch (error) {
    failCount += 1;
    details.push({
      index: i + 1,
      id: testCase.id,
      label: testCase.label,
      ok: false,
      status: null,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const elapsed = details.map((x) => x.elapsedMs).sort((a, b) => a - b);
const avgMs = elapsed.length ? Math.round(elapsed.reduce((a, b) => a + b, 0) / elapsed.length) : 0;
const p95Ms = elapsed.length ? elapsed[Math.min(elapsed.length - 1, Math.floor(elapsed.length * 0.95))] : 0;
const summary = {
  baseUrl,
  totalRuns: cases.length,
  okCount,
  failCount,
  successRate: cases.length ? Number((okCount / cases.length).toFixed(4)) : 0,
  avgMs,
  p95Ms,
  generatedAt: new Date().toISOString(),
};

const reportLines = [
  '# SafetyGuard daily document dry-run report',
  '',
  `- generatedAt: ${summary.generatedAt}`,
  `- totalRuns: ${summary.totalRuns}`,
  `- okCount: ${summary.okCount}`,
  `- failCount: ${summary.failCount}`,
  `- successRate: ${summary.successRate}`,
  `- avgMs: ${summary.avgMs}`,
  `- p95Ms: ${summary.p95Ms}`,
  '',
  '## Case results',
  '',
  ...details.map((item) => [
    `### ${item.index}. ${item.label}`,
    `- id: ${item.id}`,
    `- ok: ${item.ok}`,
    `- status: ${item.status ?? 'error'}`,
    `- elapsedMs: ${item.elapsedMs}`,
    `- answerLength: ${item.answerLength ?? 0}`,
    `- citations: ${item.citations ?? 0}`,
    item.error ? `- error: ${item.error}` : `- preview: ${item.answerPreview}`,
    '',
  ].join('\n')),
];

fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(outDir, 'details.json'), JSON.stringify(details, null, 2));
fs.writeFileSync(path.join(outDir, 'report.md'), reportLines.join('\n'));
console.log(JSON.stringify(summary, null, 2));
process.exit(failCount === 0 ? 0 : 1);
