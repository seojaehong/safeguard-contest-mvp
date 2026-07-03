#!/usr/bin/env node
// SafeClaw CLI — thin executable wrapper around cli/lib.mjs.
//
// This is the process boundary: process.argv/env/stdin/stdout/stderr/exitCode
// live here. All parsing/formatting/exit-code logic lives in lib.mjs so it can
// be unit-tested without spawning a process.

import { readFileSync } from "node:fs";

import {
  CliError,
  HELP_TEXT,
  VERSION,
  callTool,
  formatCases,
  formatDocpack,
  formatEvidence,
  formatValidate,
  formatWeather,
  parseArgs,
  resolveConfig,
  validateCasesArgs,
  validateDocpackArgs,
  validateEvidenceArgs,
  validateExitCode,
  validateValidateArgs,
  validateWeatherArgs,
} from "./lib.mjs";

const DOCPACK_TIMEOUT_MS = 300_000;
const DEFAULT_TIMEOUT_MS = 60_000;

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function readSource(source) {
  if (source === "-") {
    return readStdin();
  }
  return readFileSync(source, "utf8");
}

async function main(argv, env) {
  const parsed = parseArgs(argv);

  if (parsed.help) {
    process.stdout.write(HELP_TEXT);
    return 0;
  }
  if (parsed.version) {
    process.stdout.write(`safeclaw ${VERSION}\n`);
    return 0;
  }

  const { command, options, positional } = parsed;
  const { token, base } = resolveConfig(env);

  switch (command) {
    case "docpack": {
      const { question, mode, json } = validateDocpackArgs({ options, positional });
      const { data, isError } = await callTool({
        base,
        token,
        tool: "generate_safety_docpack",
        args: { question, mode, includeFull: false },
        timeoutMs: DOCPACK_TIMEOUT_MS,
      });
      if (isError) {
        process.stderr.write(`[SafeClaw 오류] ${JSON.stringify(data)}\n`);
        return 1;
      }
      process.stdout.write((json ? JSON.stringify(data, null, 2) : formatDocpack(data)) + "\n");
      return 0;
    }
    case "weather": {
      const { region } = validateWeatherArgs({ options, positional });
      const { data, isError } = await callTool({
        base,
        token,
        tool: "get_weather_signals",
        args: { region },
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
      if (isError) {
        process.stderr.write(`[SafeClaw 오류] ${JSON.stringify(data)}\n`);
        return 1;
      }
      process.stdout.write((options.json ? JSON.stringify(data, null, 2) : formatWeather(data)) + "\n");
      return 0;
    }
    case "validate": {
      const { source } = validateValidateArgs({ options, positional });
      const text = await readSource(source);
      const { data, isError } = await callTool({
        base,
        token,
        tool: "validate_safety_citations",
        args: { text },
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
      if (isError) {
        process.stderr.write(`[SafeClaw 오류] ${JSON.stringify(data)}\n`);
        return 1;
      }
      process.stdout.write((options.json ? JSON.stringify(data, null, 2) : formatValidate(data)) + "\n");
      return validateExitCode(data);
    }
    case "cases": {
      const { keyword } = validateCasesArgs({ options, positional });
      const { data, isError } = await callTool({
        base,
        token,
        tool: "search_accident_cases",
        args: { keyword },
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
      if (isError) {
        process.stderr.write(`[SafeClaw 오류] ${JSON.stringify(data)}\n`);
        return 1;
      }
      process.stdout.write((options.json ? JSON.stringify(data, null, 2) : formatCases(data)) + "\n");
      return 0;
    }
    case "evidence": {
      const { docType } = validateEvidenceArgs({ options, positional });
      const { data, isError } = await callTool({
        base,
        token,
        tool: "get_evidence_mapping",
        args: docType ? { docType } : {},
        timeoutMs: DEFAULT_TIMEOUT_MS,
      });
      if (isError) {
        process.stderr.write(`[SafeClaw 오류] ${JSON.stringify(data)}\n`);
        return 1;
      }
      process.stdout.write((options.json ? JSON.stringify(data, null, 2) : formatEvidence(data)) + "\n");
      return 0;
    }
    default:
      // Unreachable: parseArgs already validates command against COMMANDS.
      throw new CliError(`알 수 없는 명령: ${command}`, "USAGE", 2);
  }
}

main(process.argv.slice(2), process.env)
  .then((exitCode) => {
    process.exitCode = exitCode;
  })
  .catch((err) => {
    if (err instanceof CliError) {
      process.stderr.write(`오류: ${err.message}\n`);
      process.exitCode = err.exitCode;
      return;
    }
    if (err && err.code === "ENOENT") {
      process.stderr.write(`오류: 파일을 찾을 수 없습니다: ${err.path}\n`);
      process.exitCode = 1;
      return;
    }
    process.stderr.write(`예상치 못한 오류: ${err?.stack ?? err}\n`);
    process.exitCode = 1;
  });
