import fs from 'node:fs';
import path from 'node:path';

export interface DryrunHighlight {
  id: string;
  label: string;
  ok: boolean;
  status: number | null;
  elapsedMs: number;
  answerLength: number;
  citations: number;
  answerPreview: string;
}

export interface DryrunSnapshot {
  runId: string;
  generatedAt: string;
  totalRuns: number;
  okCount: number;
  failCount: number;
  successRate: number;
  avgMs: number;
  p95Ms: number;
  qualityNote: string;
  reportPath: string;
  summaryPath: string;
  highlights: DryrunHighlight[];
}

const snapshotPath = path.join(process.cwd(), 'data', 'dryrun', 'latest-document-dryrun.json');
const reportPath = path.join(process.cwd(), 'data', 'dryrun', 'latest-document-dryrun.md');

export function getLatestDryrunSnapshot(): DryrunSnapshot | null {
  if (!fs.existsSync(snapshotPath)) return null;
  return JSON.parse(fs.readFileSync(snapshotPath, 'utf-8')) as DryrunSnapshot;
}

export function getLatestDryrunReport(): string | null {
  if (!fs.existsSync(reportPath)) return null;
  return fs.readFileSync(reportPath, 'utf-8');
}
