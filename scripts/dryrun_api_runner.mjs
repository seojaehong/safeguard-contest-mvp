#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const baseUrl = process.env.SAFETYGUARD_BASE_URL || 'http://127.0.0.1:3021';
const totalRuns = Number.parseInt(process.env.SAFETYGUARD_DRYRUN_COUNT || '100', 10);
const outDir = process.env.SAFETYGUARD_OUT_DIR || path.join(process.cwd(), 'logs', 'dryrun-api', new Date().toISOString().replace(/[:.]/g, '-'));

fs.mkdirSync(outDir, { recursive: true });

const searchQueries = [
  '중대재해처벌법 안전보건관리체계',
  '산업안전보건법 도급 책임',
  '추락사고 예방 체크리스트',
  '위험성평가 절차',
  '안전보건교육 의무',
];

const askQuestions = [
  '원청과 하청의 산업안전 책임을 검토할 때 핵심 체크포인트를 정리해줘.',
  '중대재해 대응 문안 초안을 만들기 전에 어떤 사실관계부터 확인해야 해?',
  '추락사고 예방 점검표 초안을 실무 관점에서 만들어줘.',
  '안전보건관리체계 미비 리스크를 내부 보고용으로 요약해줘.',
  '도급 현장 안전 점검 시 필요한 문서 확인 항목을 정리해줘.',
];

const requests = [];
for (let i = 0; i < totalRuns; i += 1) {
  const isAsk = i % 2 === 1;
  requests.push(
    isAsk
      ? {
          kind: 'ask',
          request: {
            url: `${baseUrl}/api/ask`,
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ question: askQuestions[i % askQuestions.length] }),
          },
        }
      : {
          kind: 'search',
          request: {
            url: `${baseUrl}/api/search?q=${encodeURIComponent(searchQueries[i % searchQueries.length])}`,
            method: 'GET',
          },
        },
  );
}

const details = [];
let okCount = 0;
let failCount = 0;

for (let i = 0; i < requests.length; i += 1) {
  const item = requests[i];
  const startedAt = Date.now();
  try {
    const response = await fetch(item.request.url, {
      method: item.request.method,
      headers: item.request.headers,
      body: item.request.body,
    });
    const elapsedMs = Date.now() - startedAt;
    const text = await response.text();
    let parsed = null;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = null;
    }

    const looksOkay = response.ok && (item.kind === 'search'
      ? Array.isArray(parsed?.results)
      : typeof parsed?.answer === 'string');

    if (looksOkay) okCount += 1;
    else failCount += 1;

    details.push({
      index: i + 1,
      kind: item.kind,
      status: response.status,
      ok: looksOkay,
      elapsedMs,
      sample: parsed && item.kind === 'search'
        ? { results: parsed.results?.length ?? null }
        : parsed && item.kind === 'ask'
          ? { answerPreview: String(parsed.answer || '').slice(0, 120) }
          : { rawPreview: text.slice(0, 120) },
    });
  } catch (error) {
    failCount += 1;
    details.push({
      index: i + 1,
      kind: item.kind,
      status: null,
      ok: false,
      elapsedMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

const elapsedList = details.map((x) => x.elapsedMs).sort((a, b) => a - b);
const avgMs = elapsedList.length ? Math.round(elapsedList.reduce((a, b) => a + b, 0) / elapsedList.length) : 0;
const p95Ms = elapsedList.length ? elapsedList[Math.min(elapsedList.length - 1, Math.floor(elapsedList.length * 0.95))] : 0;

const summary = {
  baseUrl,
  totalRuns,
  okCount,
  failCount,
  successRate: totalRuns > 0 ? Number((okCount / totalRuns).toFixed(4)) : 0,
  avgMs,
  p95Ms,
  generatedAt: new Date().toISOString(),
};

fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(outDir, 'details.json'), JSON.stringify(details, null, 2));
console.log(JSON.stringify(summary, null, 2));
process.exit(failCount === 0 ? 0 : 1);
