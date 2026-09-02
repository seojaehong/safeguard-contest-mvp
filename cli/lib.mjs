// SafeClaw CLI — pure logic (argument parsing, MCP transport parsing, output
// formatting, exit-code decisions). Kept dependency-free and side-effect-free
// (no process.exit / no console.*) so it can be unit-tested directly.
//
// The executable entrypoint (cli/safeclaw.mjs) is a thin wrapper around this
// module: it wires process.argv/env/stdin to these functions and does the
// actual fetch() + printing + process.exitCode.

export const DEFAULT_BASE = "https://www.safeclaw.kr";
export const MCP_PATH = "/api/mcp/mcp";

export const COMMANDS = ["docpack", "weather", "validate", "cases", "evidence"];

export class CliError extends Error {
  constructor(message, code = "ERROR", exitCode = 1) {
    super(message);
    this.name = "CliError";
    this.code = code;
    this.exitCode = exitCode;
  }
}

// ── argument parsing ────────────────────────────────────────────────────

/**
 * Parses process.argv.slice(2) into a structured command invocation.
 * Never throws for --help/-h anywhere in argv (help wins over validation).
 */
export function parseArgs(argv) {
  const args = [...argv];

  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    return { help: true, command: null };
  }
  if (args[0] === "--version" || args[0] === "-v") {
    return { version: true, command: null };
  }

  const command = args[0];
  if (!COMMANDS.includes(command)) {
    throw new CliError(
      `알 수 없는 명령: "${command}" (사용 가능: ${COMMANDS.join(", ")}). --help 참고.`,
      "USAGE",
      2
    );
  }

  const rest = args.slice(1);
  if (rest.includes("--help") || rest.includes("-h")) {
    return { help: true, command };
  }

  const options = {};
  const positional = [];
  for (let i = 0; i < rest.length; i++) {
    const token = rest[i];
    if (token === "--json") {
      options.json = true;
    } else if (token === "--mode") {
      const value = rest[++i];
      if (value === undefined) {
        throw new CliError("--mode 값이 필요합니다 (full|enhanced|template).", "USAGE", 2);
      }
      options.mode = value;
    } else if (token.startsWith("--mode=")) {
      options.mode = token.slice("--mode=".length);
    } else if (token.startsWith("--")) {
      throw new CliError(`알 수 없는 옵션: "${token}"`, "USAGE", 2);
    } else {
      positional.push(token);
    }
  }

  return { help: false, command, options, positional };
}

const VALID_MODES = ["full", "enhanced", "template"];

/** Validates a fully-parsed docpack invocation, raising CliError(exit 2) on misuse. */
export function validateDocpackArgs({ positional, options }) {
  const question = positional[0];
  if (!question) {
    throw new CliError('docpack: "<질문>" 인자가 필요합니다.', "USAGE", 2);
  }
  if (options.mode && !VALID_MODES.includes(options.mode)) {
    throw new CliError(
      `docpack: --mode는 ${VALID_MODES.join("|")} 중 하나여야 합니다 (받은 값: "${options.mode}").`,
      "USAGE",
      2
    );
  }
  return { question, mode: options.mode ?? "full", json: Boolean(options.json) };
}

export function validateWeatherArgs({ positional }) {
  const region = positional[0];
  if (!region) {
    throw new CliError("weather: <지역> 인자가 필요합니다.", "USAGE", 2);
  }
  return { region };
}

export function validateValidateArgs({ positional }) {
  const source = positional[0];
  if (!source) {
    throw new CliError('validate: <파일|-> 인자가 필요합니다.', "USAGE", 2);
  }
  return { source };
}

export function validateCasesArgs({ positional }) {
  const keyword = positional[0];
  if (!keyword) {
    throw new CliError("cases: <키워드> 인자가 필요합니다.", "USAGE", 2);
  }
  return { keyword };
}

export function validateEvidenceArgs({ positional }) {
  return { docType: positional[0] };
}

// ── config resolution ───────────────────────────────────────────────────

/** Resolves token/base from an env-like object. Throws CliError if token missing. */
export function resolveConfig(env) {
  const token = env.SAFECLAW_TOKEN?.trim();
  if (!token) {
    throw new CliError(
      "SAFECLAW_TOKEN 환경변수가 설정되지 않았습니다.\n" +
        "  예: SAFECLAW_TOKEN=sc2_xxxxx safeclaw weather 서울\n" +
        "  토큰은 SafeClaw MCP 토큰과 동일한 풀을 사용합니다 (docs/mcp-server.md 참고).",
      "NO_TOKEN",
      1
    );
  }
  const rawBase = env.SAFECLAW_BASE?.trim() || DEFAULT_BASE;
  let parsedBase;
  try {
    parsedBase = new URL(rawBase);
  } catch {
    throw new CliError("SAFECLAW_BASE가 올바른 URL이 아닙니다.", "INVALID_BASE", 1);
  }
  if (parsedBase.username || parsedBase.password || parsedBase.search || parsedBase.hash) {
    throw new CliError(
      "SAFECLAW_BASE에는 사용자정보, 쿼리 또는 fragment를 넣을 수 없습니다.",
      "INVALID_BASE",
      1
    );
  }
  const hostname = parsedBase.hostname.toLowerCase();
  const loopback = hostname === "localhost" || hostname.endsWith(".localhost") ||
    hostname === "127.0.0.1" || hostname === "::1";
  const insecureLoopbackAllowed = env.SAFECLAW_ALLOW_INSECURE_HTTP === "true";
  if (parsedBase.protocol !== "https:" && !(
    parsedBase.protocol === "http:" && loopback && insecureLoopbackAllowed
  )) {
    throw new CliError(
      "SAFECLAW_BASE는 HTTPS여야 합니다. 로컬 HTTP는 SAFECLAW_ALLOW_INSECURE_HTTP=true일 때만 허용됩니다.",
      "INSECURE_BASE",
      1
    );
  }
  const base = parsedBase.toString().replace(/\/+$/, "");
  return { token, base };
}

// ── MCP transport (Streamable HTTP, JSON-RPC over SSE) ──────────────────

/**
 * Parses a Streamable-HTTP SSE response body into the JSON-RPC messages it
 * carries. Each SSE event is a run of lines; "data: " lines hold JSON.
 * Multiple data lines within one event are joined (per SSE spec) before parse.
 */
export function parseSseMessages(bodyText) {
  const messages = [];
  const events = bodyText.replace(/\r\n/g, "\n").split("\n\n");
  for (const block of events) {
    const dataLines = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).replace(/^ /, ""));
    if (dataLines.length === 0) continue;
    const payload = dataLines.join("\n");
    try {
      messages.push(JSON.parse(payload));
    } catch {
      // Not JSON (e.g. a plain-JSON non-SSE body slipped through elsewhere) — skip.
    }
  }
  // Fallback: body wasn't SSE-framed at all, just try raw JSON.
  if (messages.length === 0) {
    try {
      messages.push(JSON.parse(bodyText));
    } catch {
      // leave empty; caller raises a PARSE error
    }
  }
  return messages;
}

export function buildToolCallRequest(id, toolName, args) {
  return {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name: toolName, arguments: args },
  };
}

/**
 * Calls one MCP tool over Streamable HTTP and returns { data, isError }.
 * `data` is the JSON-parsed tool payload (or the raw text if it wasn't JSON).
 * `fetchImpl` is injectable for tests; defaults to the global fetch (Node 18+).
 */
export async function callTool({ base, token, tool, args, timeoutMs, fetchImpl = fetch }) {
  const id = Date.now();
  const body = JSON.stringify(buildToolCallRequest(id, tool, args));
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetchImpl(`${base}${MCP_PATH}`, {
      method: "POST",
      redirect: "error",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${token}`,
      },
      body,
      signal: controller.signal,
    });
  } catch (err) {
    if (err && err.name === "AbortError") {
      throw new CliError(`요청 시간 초과 (${Math.round(timeoutMs / 1000)}s)`, "TIMEOUT", 1);
    }
    throw new CliError(`네트워크 오류: ${err.message}`, "NETWORK", 1);
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();

  if (!res.ok) {
    let message = text;
    try {
      const parsed = JSON.parse(text);
      message = parsed.error_description || parsed.error || text;
    } catch {
      // keep raw text
    }
    if (res.status === 401) {
      throw new CliError(`인증 실패 (401): ${message}`, "AUTH", 1);
    }
    if (res.status === 429) {
      throw new CliError(`요청 제한 초과 (429, 분당 20회): ${message}`, "RATE_LIMIT", 1);
    }
    if (res.status === 501) {
      throw new CliError(`SafeClaw MCP가 서버에서 비활성화되어 있습니다 (501): ${message}`, "DISABLED", 1);
    }
    throw new CliError(`HTTP ${res.status}: ${message}`, "HTTP", 1);
  }

  const messages = parseSseMessages(text);
  const match = messages.find((m) => m && m.id === id) ?? messages[messages.length - 1];
  if (!match) {
    throw new CliError("서버 응답을 파싱할 수 없습니다 (예상치 못한 형식).", "PARSE", 1);
  }
  if (match.error) {
    const msg = match.error.message ?? JSON.stringify(match.error);
    throw new CliError(`RPC 오류: ${msg}`, "RPC", 1);
  }

  const result = match.result;
  const contentText = result?.content?.[0]?.text;
  if (typeof contentText !== "string") {
    throw new CliError("도구 응답 형식이 예상과 다릅니다 (content[0].text 없음).", "PARSE", 1);
  }

  let data;
  try {
    data = JSON.parse(contentText);
  } catch {
    data = contentText;
  }

  return { data, isError: Boolean(result?.isError) };
}

// ── output formatting ───────────────────────────────────────────────────

function formatDocumentEntry(key, value) {
  if (typeof value === "string") {
    return `  - ${key}: ${value.length}자`;
  }
  const flag = value.truncated ? ` (전체 ${value.totalLength}자, 미리보기만 표시됨)` : "";
  return `  - ${key}: ${value.totalLength}자${flag}`;
}

export function formatDocpack(data) {
  const lines = [];
  lines.push(`[SafeClaw 문서팩] ${data.summary ?? "(요약 없음)"}`);
  if (data.scenario) {
    const s = data.scenario;
    lines.push("");
    lines.push("현장 시나리오");
    if (s.siteName) lines.push(`  현장: ${s.siteName}`);
    if (s.companyType) lines.push(`  업종: ${s.companyType}`);
    if (s.workSummary) lines.push(`  작업: ${s.workSummary}`);
    if (typeof s.workerCount === "number") lines.push(`  인원: ${s.workerCount}명`);
    if (s.weatherNote) lines.push(`  기상: ${s.weatherNote}`);
  }
  lines.push("");
  lines.push(`모드: ${data.mode ?? "(알 수 없음)"}`);
  const docKeys = Object.keys(data.documents ?? {});
  lines.push("");
  lines.push(`문서 (${docKeys.length}종)`);
  for (const key of docKeys) {
    lines.push(formatDocumentEntry(key, data.documents[key]));
  }
  if (data.evidenceLabels) {
    lines.push("");
    lines.push("증빙 라벨 (중대재해처벌법 시행령 제4조)");
    for (const [key, label] of Object.entries(data.evidenceLabels)) {
      const article = label?.article ?? "";
      lines.push(`  - ${key}: ${article}`);
    }
  }
  if (data.fullDocumentsNote) {
    lines.push("");
    lines.push(data.fullDocumentsNote);
  }
  return lines.join("\n");
}

export function formatWeather(data) {
  const lines = [];
  lines.push(`[SafeClaw 기상] ${data.region ?? "(지역 없음)"}`);
  if (data.fallbackRegion) {
    lines.push(
      `  주의: "${data.requestedRegion}"은 지원 지역이 아니어서 ${data.resolvedRegion} 기준으로 응답됨`
    );
  }
  lines.push(`  요약: ${data.summary ?? "-"}`);
  if (data.temperatureC) lines.push(`  기온: ${data.temperatureC}℃`);
  if (data.windSpeedMps) lines.push(`  풍속: ${data.windSpeedMps}m/s`);
  if (data.precipitationProbability) lines.push(`  강수확률: ${data.precipitationProbability}%`);
  if (data.actions?.length) {
    lines.push("  대응 조치:");
    for (const action of data.actions) lines.push(`    - ${action}`);
  }
  if (data.signals?.length) {
    lines.push("  세부 신호:");
    for (const s of data.signals) lines.push(`    - [${s.endpoint}] ${s.summary}`);
  }
  return lines.join("\n");
}

export function formatValidate(data) {
  const lines = [];
  const removed = data.removedCitations ?? [];
  if (removed.length === 0) {
    lines.push("[SafeClaw 인용 검증] 제거된 조문 없음 — 모든 인용이 화이트리스트를 통과했습니다.");
  } else {
    lines.push(`[SafeClaw 인용 검증] 제거된(미검증) 조문 ${removed.length}건:`);
    for (const citation of removed) lines.push(`  - ${citation}`);
  }
  lines.push("");
  lines.push("검증 후 텍스트:");
  lines.push(data.gatedText ?? "");
  return lines.join("\n");
}

export function formatCases(data) {
  const lines = [];
  lines.push(`[SafeClaw 유사 재해사례] "${data.keyword}" — ${data.count}건 (${data.mode})`);
  for (const c of data.cases ?? []) {
    lines.push("");
    lines.push(`- ${c.title}`);
    if (c.industry || c.accidentType) {
      lines.push(`  업종/유형: ${[c.industry, c.accidentType].filter(Boolean).join(" / ")}`);
    }
    lines.push(`  요약: ${c.summary}`);
    lines.push(`  예방 포인트: ${c.preventionPoint}`);
    if (c.sourceUrl) lines.push(`  출처: ${c.sourceUrl}`);
  }
  if ((data.cases ?? []).length === 0) {
    lines.push("  (검색 결과 없음)");
  }
  return lines.join("\n");
}

export function formatEvidence(data) {
  const lines = [];
  if (data.docType) {
    lines.push(`[SafeClaw 증빙 매핑] docType=${data.docType}`);
    if (data.mapped && data.label) {
      lines.push(`  조항: ${data.label.article}`);
      if (data.label.purpose) lines.push(`  목적: ${data.label.purpose}`);
      if (data.label.related) lines.push(`  관련: ${data.label.related}`);
    } else {
      lines.push(`  ${data.note ?? "매핑 없음"}`);
    }
    return lines.join("\n");
  }
  lines.push("[SafeClaw 증빙 매핑] 전체 (중대재해처벌법 시행령 제4조)");
  for (const [key, label] of Object.entries(data.allMappings ?? {})) {
    lines.push(`  - ${key}: ${label.article}`);
  }
  return lines.join("\n");
}

/** exit code for `validate`: 1 if any citation was removed, else 0. */
export function validateExitCode(data) {
  return (data.removedCitations ?? []).length > 0 ? 1 : 0;
}

export const HELP_TEXT = `safeclaw — SafeClaw MCP 도구를 커맨드라인에서 호출하는 CLI 어댑터

사용법:
  safeclaw <command> [args] [options]

명령:
  docpack "<질문>" [--mode full|enhanced|template] [--json]
      안전 문서팩 생성 (generate_safety_docpack). 기본 --mode full.
  weather <지역>
      현장 기상 신호 조회 (get_weather_signals). 지원 지역: 서울/인천/안산/부산/광주/대구/창원.
  validate <파일|->
      법령 조문 인용 검증 (validate_safety_citations). "-"는 stdin. 제거된 조문이 있으면 exit 1.
  cases <키워드>
      유사 재해사례 검색 (search_accident_cases).
  evidence [docType]
      중대재해처벌법 시행령 제4조 증빙 매핑 조회 (get_evidence_mapping). docType 생략 시 전체.

공통 옵션:
  --json          원본 JSON 그대로 출력 (사람이 읽기 좋은 요약 대신)
  --help, -h      도움말 출력
  --version, -v   버전 출력

환경변수:
  SAFECLAW_TOKEN  (필수) SafeClaw MCP 토큰과 동일한 인증 토큰
  SAFECLAW_BASE   (선택) 기본값 https://www.safeclaw.kr
  SAFECLAW_ALLOW_INSECURE_HTTP  (선택) true일 때 loopback HTTP만 허용

예시:
  SAFECLAW_TOKEN=sc2_xxx safeclaw weather 서울
  SAFECLAW_TOKEN=sc2_xxx safeclaw docpack "3층 외벽 비계 해체 작업" --mode full --json
  cat draft.txt | SAFECLAW_TOKEN=sc2_xxx safeclaw validate -

Exit codes: 0=성공, 1=런타임 오류(인증/네트워크/타임아웃/인용제거 등), 2=사용법 오류.
`;

export const VERSION = "0.1.0";
