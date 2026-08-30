import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import {
  AUTH_TRANSACTION_STORAGE_KEY,
  buildAuthCallbackUrl,
  consumeAuthTransaction,
  createAuthTransaction,
  parseAuthHashSession,
  resolveSafeNextPath
} from "@/lib/auth-callback";

describe("parseAuthHashSession", () => {
  it("extracts access and refresh tokens from a Supabase magic-link hash", () => {
    expect(parseAuthHashSession("#access_token=access-demo&refresh_token=refresh-demo&token_type=bearer")).toEqual({
      accessToken: "access-demo",
      refreshToken: "refresh-demo"
    });
  });

  it("accepts hashes without the leading #", () => {
    expect(parseAuthHashSession("access_token=access-demo&refresh_token=refresh-demo")).toEqual({
      accessToken: "access-demo",
      refreshToken: "refresh-demo"
    });
  });

  it("ignores incomplete callback hashes", () => {
    expect(parseAuthHashSession("#access_token=access-demo")).toBeNull();
    expect(parseAuthHashSession("#refresh_token=refresh-demo")).toBeNull();
    expect(parseAuthHashSession("")).toBeNull();
  });

  it("rejects non-bearer token types", () => {
    expect(parseAuthHashSession("#access_token=access-demo&refresh_token=refresh-demo&token_type=mac")).toBeNull();
  });
});

describe("resolveSafeNextPath", () => {
  it("allows relative app paths", () => {
    expect(resolveSafeNextPath("/settings/ai-connect")).toBe("/settings/ai-connect");
    expect(resolveSafeNextPath("/workspace?scenario=ansan")).toBe("/workspace?scenario=ansan");
  });

  it("rejects external or malformed next values", () => {
    expect(resolveSafeNextPath("https://evil.example")).toBe("/workspace");
    expect(resolveSafeNextPath("//evil.example")).toBe("/workspace");
    expect(resolveSafeNextPath("/workspace\r\nSet-Cookie: bad")).toBe("/workspace");
    expect(resolveSafeNextPath(undefined)).toBe("/workspace");
  });
});

describe("buildAuthCallbackUrl", () => {
  it("builds the shared callback URL for email and OAuth login", () => {
    expect(buildAuthCallbackUrl("https://www.safeclaw.kr", "/settings/ai-connect")).toBe(
      "https://www.safeclaw.kr/auth/callback?next=%2Fsettings%2Fai-connect"
    );
  });

  it("binds the callback URL to the locally initiated auth transaction", () => {
    expect(buildAuthCallbackUrl("https://www.safeclaw.kr", "/workspace", "tx-demo")).toBe(
      "https://www.safeclaw.kr/auth/callback?next=%2Fworkspace&auth_tx=tx-demo"
    );
  });

  it("falls back to workspace for unsafe next values", () => {
    expect(buildAuthCallbackUrl("https://www.safeclaw.kr", "https://evil.example")).toBe(
      "https://www.safeclaw.kr/auth/callback?next=%2Fworkspace"
    );
  });
});

describe("auth callback transaction", () => {
  it("accepts a matching fresh transaction exactly once", () => {
    const transaction = createAuthTransaction(1_000, "tx-demo");
    const values = new Map([[AUTH_TRANSACTION_STORAGE_KEY, JSON.stringify(transaction)]]);
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => { values.delete(key); }
    };

    expect(consumeAuthTransaction(storage, "tx-demo", 2_000)).toBe(true);
    expect(consumeAuthTransaction(storage, "tx-demo", 2_000)).toBe(false);
  });

  it("rejects missing, mismatched, malformed, or expired transactions", () => {
    const check = (stored: string | null, received: string | null, now: number) => {
      const values = new Map<string, string>();
      if (stored !== null) values.set(AUTH_TRANSACTION_STORAGE_KEY, stored);
      return consumeAuthTransaction({
        getItem: (key: string) => values.get(key) ?? null,
        removeItem: (key: string) => { values.delete(key); }
      }, received, now);
    };

    expect(check(null, "tx-demo", 2_000)).toBe(false);
    expect(check(JSON.stringify(createAuthTransaction(1_000, "tx-demo")), "other", 2_000)).toBe(false);
    expect(check("not-json", "tx-demo", 2_000)).toBe(false);
    expect(check(JSON.stringify(createAuthTransaction(1_000, "tx-demo")), "tx-demo", 1_000 + 15 * 60_000 + 1)).toBe(false);
  });

  it("wires transaction validation before callback tokens and disables automatic URL session detection", () => {
    const root = process.cwd();
    const callbackSource = fs.readFileSync(path.join(root, "components", "AuthCallbackClient.tsx"), "utf8");
    const loginSource = fs.readFileSync(path.join(root, "components", "AdminLoginPanel.tsx"), "utf8");

    expect(callbackSource).toContain("detectSessionInUrl: false");
    expect(callbackSource.indexOf("consumeAuthTransaction(")).toBeLessThan(
      callbackSource.indexOf("parseAuthHashSession(window.location.hash)")
    );
    expect(loginSource.match(/createAuthTransaction\(\)/gu)).toHaveLength(2);
    expect(loginSource.match(/buildAuthCallbackUrl\(window\.location\.origin, nextPath, transaction\.state\)/gu)).toHaveLength(2);
  });

  it("clears persisted user content on explicit and auth-event logout paths", () => {
    const root = process.cwd();
    const loginSource = fs.readFileSync(path.join(root, "components", "AdminLoginPanel.tsx"), "utf8");
    const workspaceSource = fs.readFileSync(path.join(root, "components", "FieldOperationsWorkspace.tsx"), "utf8");

    for (const source of [loginSource, workspaceSource]) {
      expect(source).toContain('event === "SIGNED_OUT"');
      expect(source.match(/clearStoredSafeClawUserContent\(window\.localStorage\)/gu)?.length).toBeGreaterThanOrEqual(2);
    }
    expect(workspaceSource.match(/window\.location\.assign\("\/login"\)/gu)).toHaveLength(2);
  });
});
