import { describe, expect, it } from "vitest";

import { parseAuthHashSession, resolveSafeNextPath } from "@/lib/auth-callback";

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
