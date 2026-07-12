import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { MCP_TOOL_NAMES } from "@/lib/mcp-auth";

describe("MCP route scope contract", () => {
  it("authorizes every registered tool before its handler performs work", () => {
    const route = readFileSync(join(process.cwd(), "app/api/mcp/[transport]/route.ts"), "utf8")
      .replace(/\r\n/g, "\n");
    const registrations = Array.from(
      route.matchAll(/server\.registerTool\(\s*"([^"]+)"/g),
      (match) => ({ name: match[1], index: match.index }),
    );

    expect(registrations.map(({ name }) => name)).toEqual([...MCP_TOOL_NAMES]);

    for (const [index, registration] of registrations.entries()) {
      const nextIndex = registrations[index + 1]?.index ?? route.length;
      const handlerBlock = route.slice(registration.index, nextIndex);
      expect(handlerBlock).toContain(
        `readAuthorizedToolContext(extra, "${registration.name}")`,
      );
    }
  });
});
