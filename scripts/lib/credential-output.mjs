import { chmod, lstat, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const REVEAL_FLAG = "--reveal";
const OUTPUT_FILE_FLAG = "--output-file";

function outputUsage(commandUsage) {
  return `${commandUsage} (${REVEAL_FLAG} | ${OUTPUT_FILE_FLAG} <absolute path>)`;
}

export async function prepareCredentialOutput({
  argv,
  startIndex,
  commandUsage,
  stdout = process.stdout,
  platform = process.platform,
  inspectPath = lstat,
  inspectParent = stat,
}) {
  const args = argv.slice(startIndex);
  if (args.length === 1 && args[0] === REVEAL_FLAG) {
    if (stdout.isTTY !== true) {
      throw new Error(`${REVEAL_FLAG} requires an interactive TTY; use ${OUTPUT_FILE_FLAG} for automation.`);
    }
    return { mode: "reveal" };
  }

  if (args.length === 2 && args[0] === OUTPUT_FILE_FLAG && args[1]?.trim()) {
    if (platform === "win32") {
      throw new Error(`${OUTPUT_FILE_FLAG} is unavailable on Windows because POSIX 0600 permissions cannot be verified; use ${REVEAL_FLAG} in an interactive TTY.`);
    }
    const outputPath = path.resolve(args[1].trim());
    try {
      await inspectPath(outputPath);
      throw new Error(`Credential output file already exists: ${outputPath}`);
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error;
    }
    const parent = await inspectParent(path.dirname(outputPath));
    if (!parent.isDirectory()) throw new Error(`Credential output parent is not a directory: ${path.dirname(outputPath)}`);
    return { mode: "file", outputPath };
  }

  throw new Error(`Choose exactly one credential output mode. ${outputUsage(commandUsage)}`);
}

export async function emitCredential({
  secret,
  output,
  stdout = process.stdout,
  stderr = process.stderr,
  writeSecretFile = writeFile,
  setMode = chmod,
  inspectWrittenFile = stat,
}) {
  if (output.mode === "reveal") {
    stdout.write(`${secret}\n`);
    return { mode: "reveal", outputPath: null };
  }

  await writeSecretFile(output.outputPath, `${secret}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  await setMode(output.outputPath, 0o600);
  const written = await inspectWrittenFile(output.outputPath);
  if ((written.mode & 0o777) !== 0o600) {
    throw new Error(`Credential output permissions are not 0600: ${output.outputPath}`);
  }
  stderr.write(`Credential written to ${output.outputPath} with mode 0600.\n`);
  return { mode: "file", outputPath: output.outputPath };
}
