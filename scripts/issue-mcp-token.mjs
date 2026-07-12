// SafeClaw MCP 테넌트 토큰 발급 스크립트.
//
// 랜덤 Bearer 토큰을 생성해 sha256 해시만 Supabase mcp_tokens에 저장하고,
// 평문 토큰은 stdout에 딱 한 번 출력한다(평문은 DB·로그·파일 어디에도 남기지 않는다).
// 서비스 롤 키가 필요하다(mcp_tokens는 RLS로 service_role 전용).
//
// 사용법:
//   node scripts/issue-mcp-token.mjs "<label>" ["<site name>"]
//   예) node scripts/issue-mcp-token.mjs "부평 파일럿 - 안전관리자" "부평공장"
//   - <site name> 생략 시 사이트 미귀속(조직/사이트 null) 토큰이 발급된다.
//
// 환경변수(.env.local 자동 로드): SUPABASE_URL(또는 NEXT_PUBLIC_SUPABASE_URL),
//   SUPABASE_SERVICE_ROLE_KEY.

import { createHash, randomBytes } from "node:crypto";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { MCP_TOOL_SCOPES } from "../lib/mcp-tool-contract.mjs";

try {
  process.loadEnvFile(path.join(process.cwd(), ".env.local"));
} catch {
  // .env.local이 없어도 환경변수가 이미 있으면 진행한다.
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const label = process.argv[2];
const siteName = process.argv[3];

if (!supabaseUrl) fail("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.");
if (!serviceRoleKey) fail("Missing SUPABASE_SERVICE_ROLE_KEY (service role required for mcp_tokens).");
if (!label) fail('Usage: node scripts/issue-mcp-token.mjs "<label>" ["<site name>"]');

const client = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// 사이트 지정 시 site_id + organization_id 해석.
let siteId = null;
let orgId = null;
if (siteName) {
  const { data: sites, error } = await client
    .from("sites")
    .select("id, name, organization_id")
    .eq("name", siteName);
  if (error) fail(`Site lookup failed: ${error.message}`);
  if (!sites || sites.length === 0) fail(`Site not found: "${siteName}"`);
  if (sites.length > 1) fail(`Multiple sites named "${siteName}" — disambiguate manually.`);
  siteId = sites[0].id;
  orgId = sites[0].organization_id;
}

// 랜덤 토큰(평문). base64url 32바이트 + 접두사. 해시만 저장한다.
const token = `sclaw_${randomBytes(32).toString("base64url")}`;
const tokenHash = createHash("sha256").update(token.trim(), "utf8").digest("hex");

const { data, error } = await client
  .from("mcp_tokens")
  .insert({
    token_hash: tokenHash,
    label,
    site_id: siteId,
    org_id: orgId,
    scopes: [...MCP_TOOL_SCOPES],
  })
  .select("id")
  .single();

if (error) fail(`Token insert failed: ${error.message}`);

// 안내는 stderr, 평문 토큰은 stdout에 단 한 번만.
console.error(
  `Issued MCP token id=${data.id} label=${JSON.stringify(label)} site=${
    siteName ? JSON.stringify(siteName) : "(none)"
  }`
);
console.error("Plaintext token below — copy it now, it is NOT recoverable:");
console.log(token);
