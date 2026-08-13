// SafeClaw MCP tenant token issuance CLI.
//
// Generates a random Bearer token, stores only its sha256 hash in mcp_tokens,
// and prints the plaintext token once. A service-role key is required.
// Usage: node scripts/issue-mcp-token.mjs "<label>" "<site name>"

import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { MCP_DEFAULT_SCOPES } from "../lib/mcp-tool-contract.mjs";

const REQUIRED_SITE_USAGE = 'Usage: node scripts/issue-mcp-token.mjs "<label>" "<site name>"';

function readArguments(argv) {
  const label = argv[2]?.trim();
  const siteName = argv[3]?.trim();
  if (!label || !siteName) throw new Error(REQUIRED_SITE_USAGE);
  return { label, siteName };
}

export async function issueMcpToken({
  argv,
  env,
  createClient = createSupabaseClient,
  createToken = () => `sclaw_${randomBytes(32).toString("base64url")}`,
}) {
  const { label, siteName } = readArguments(argv);
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.");
  if (!serviceRoleKey) {
    throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY (service role required for mcp_tokens).");
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: sites, error: siteError } = await client
    .from("sites")
    .select("id, name, organization_id")
    .eq("name", siteName);
  if (siteError) throw new Error(`Site lookup failed: ${siteError.message}`);
  if (!sites || sites.length === 0) throw new Error(`Site not found: "${siteName}"`);
  if (sites.length > 1) {
    throw new Error(`Multiple sites named "${siteName}" - disambiguate manually.`);
  }
  const siteId = sites[0].id;
  const orgId = sites[0].organization_id;

  const token = createToken();
  const tokenHash = createHash("sha256").update(token.trim(), "utf8").digest("hex");
  const { data, error } = await client
    .from("mcp_tokens")
    .insert({
      token_hash: tokenHash,
      label,
      site_id: siteId,
      org_id: orgId,
      scopes: [...MCP_DEFAULT_SCOPES],
    })
    .select("id")
    .single();
  if (error) throw new Error(`Token insert failed: ${error.message}`);

  return { id: data.id, label, siteName, token };
}

function loadLocalEnv() {
  try {
    process.loadEnvFile(path.join(process.cwd(), ".env.local"));
  } catch {
    // Existing environment variables are sufficient when .env.local is absent.
  }
}

async function main() {
  loadLocalEnv();
  try {
    const issued = await issueMcpToken({ argv: process.argv, env: process.env });
    console.error(
      `Issued MCP token id=${issued.id} label=${JSON.stringify(issued.label)} site=${JSON.stringify(issued.siteName)}`,
    );
    console.error("Plaintext token below - copy it now, it is NOT recoverable:");
    console.log(issued.token);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "MCP token issuance failed.");
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
