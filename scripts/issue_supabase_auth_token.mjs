import path from "node:path";
import { pathToFileURL } from "node:url";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { emitCredential, prepareCredentialOutput } from "./lib/credential-output.mjs";

const COMMAND_USAGE = "Usage: node scripts/issue_supabase_auth_token.mjs";

export async function issueSupabaseAuthToken({ env, createClient = createSupabaseClient }) {
  const supabaseUrl = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = env.SAFEGUARD_AUTH_EMAIL;
  const password = env.SAFEGUARD_AUTH_PASSWORD;

  if (!supabaseUrl) throw new Error("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.");
  if (!supabaseAnonKey) throw new Error("Missing SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  if (!email) throw new Error("Missing SAFEGUARD_AUTH_EMAIL.");
  if (!password) throw new Error("Missing SAFEGUARD_AUTH_PASSWORD.");

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Supabase password login failed: ${error.message}`);
  if (!data.session?.access_token) {
    throw new Error("Supabase login succeeded but no access_token was returned.");
  }
  return { accessToken: data.session.access_token, email };
}

async function main() {
  try {
    const output = await prepareCredentialOutput({
      argv: process.argv,
      startIndex: 2,
      commandUsage: COMMAND_USAGE,
    });
    const issued = await issueSupabaseAuthToken({ env: process.env });
    console.error(`Issued Supabase access token for ${JSON.stringify(issued.email)}.`);
    await emitCredential({ secret: issued.accessToken, output });
  } catch (error) {
    console.error(error instanceof Error ? error.message : `Supabase token issuance failed. ${COMMAND_USAGE}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  await main();
}
