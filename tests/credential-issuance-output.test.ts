import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

import { emitCredential, prepareCredentialOutput } from "@/scripts/lib/credential-output.mjs";
import { issueSupabaseAuthToken } from "@/scripts/issue_supabase_auth_token.mjs";

const usage = "Usage: credential-command";

function missingPathError(): NodeJS.ErrnoException {
  const error = new Error("missing") as NodeJS.ErrnoException;
  error.code = "ENOENT";
  return error;
}

describe("credential issuance output", () => {
  it("requires an explicit output mode before credential work", async () => {
    const inspectPath = vi.fn();
    await expect(prepareCredentialOutput({
      argv: ["node", "script.mjs"],
      startIndex: 2,
      commandUsage: usage,
      inspectPath,
    })).rejects.toThrow("Choose exactly one credential output mode");
    expect(inspectPath).not.toHaveBeenCalled();
  });

  it("rejects token reveal when stdout is not an interactive TTY", async () => {
    await expect(prepareCredentialOutput({
      argv: ["node", "script.mjs", "--reveal"],
      startIndex: 2,
      commandUsage: usage,
      stdout: { isTTY: false, write: vi.fn() },
    })).rejects.toThrow("--reveal requires an interactive TTY");
  });

  it("reveals a token only after the TTY mode was selected", async () => {
    const write = vi.fn();
    const output = await prepareCredentialOutput({
      argv: ["node", "script.mjs", "--reveal"],
      startIndex: 2,
      commandUsage: usage,
      stdout: { isTTY: true, write },
    });
    await emitCredential({ secret: "secret-token", output, stdout: { isTTY: true, write } });
    expect(write).toHaveBeenCalledWith("secret-token\n");
  });

  it("creates an exclusive 0600 output file without writing the token to stdout", async () => {
    const outputPath = path.resolve("C:/secure/operator-token");
    const stdoutWrite = vi.fn();
    const stderrWrite = vi.fn();
    const writeSecretFile = vi.fn(async () => undefined);
    const setMode = vi.fn(async () => undefined);
    const output = await prepareCredentialOutput({
      argv: ["node", "script.mjs", "--output-file", outputPath],
      startIndex: 2,
      commandUsage: usage,
      platform: "linux",
      inspectPath: vi.fn(async () => { throw missingPathError(); }),
      inspectParent: vi.fn(async () => ({ isDirectory: () => true })),
    });

    await emitCredential({
      secret: "secret-token",
      output,
      stdout: { isTTY: false, write: stdoutWrite },
      stderr: { write: stderrWrite },
      writeSecretFile,
      setMode,
      inspectWrittenFile: vi.fn(async () => ({ mode: 0o100600 })),
    });

    expect(writeSecretFile).toHaveBeenCalledWith(outputPath, "secret-token\n", {
      encoding: "utf8",
      flag: "wx",
      mode: 0o600,
    });
    expect(setMode).toHaveBeenCalledWith(outputPath, 0o600);
    expect(stdoutWrite).not.toHaveBeenCalled();
    expect(stderrWrite).toHaveBeenCalledWith(expect.stringContaining("mode 0600"));
  });

  it("rejects a pre-existing output file", async () => {
    await expect(prepareCredentialOutput({
      argv: ["node", "script.mjs", "--output-file", "/tmp/existing-token"],
      startIndex: 2,
      commandUsage: usage,
      platform: "linux",
      inspectPath: vi.fn(async () => ({ mode: 0o100600 })),
      inspectParent: vi.fn(async () => ({ isDirectory: () => true })),
    })).rejects.toThrow("Credential output file already exists");
  });

  it("keeps both credential CLIs free of direct bearer-token stdout sinks", () => {
    const mcp = readFileSync(path.join(process.cwd(), "scripts", "issue-mcp-token.mjs"), "utf8");
    const supabase = readFileSync(path.join(process.cwd(), "scripts", "issue_supabase_auth_token.mjs"), "utf8");
    expect(mcp).not.toContain("console.log(issued.token)");
    expect(supabase).not.toContain("console.log(data.session.access_token)");
    expect(mcp).toContain("prepareCredentialOutput");
    expect(supabase).toContain("prepareCredentialOutput");
  });

  it("preserves Supabase authentication while keeping presentation outside the issuer", async () => {
    const signInWithPassword = vi.fn(async () => ({
      data: { session: { access_token: "supabase-access-token" } },
      error: null,
    }));
    const createClient = vi.fn(() => ({ auth: { signInWithPassword } }));

    await expect(issueSupabaseAuthToken({
      env: {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_ANON_KEY: "anon-key",
        SAFEGUARD_AUTH_EMAIL: "operator@example.test",
        SAFEGUARD_AUTH_PASSWORD: "password-from-env",
      },
      createClient,
    })).resolves.toEqual({
      accessToken: "supabase-access-token",
      email: "operator@example.test",
    });
    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "operator@example.test",
      password: "password-from-env",
    });
  });

  it("rejects missing Supabase credentials before client creation", async () => {
    const createClient = vi.fn();
    await expect(issueSupabaseAuthToken({
      env: {},
      createClient,
    })).rejects.toThrow("Missing SUPABASE_URL");
    expect(createClient).not.toHaveBeenCalled();
  });
});
