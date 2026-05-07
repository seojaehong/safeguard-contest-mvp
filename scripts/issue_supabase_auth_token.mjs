import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const email = process.env.SAFEGUARD_AUTH_EMAIL;
const password = process.env.SAFEGUARD_AUTH_PASSWORD;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!supabaseUrl) fail("Missing SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL.");
if (!supabaseAnonKey) fail("Missing SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY.");
if (!email) fail("Missing SAFEGUARD_AUTH_EMAIL.");
if (!password) fail("Missing SAFEGUARD_AUTH_PASSWORD.");

const client = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

const { data, error } = await client.auth.signInWithPassword({ email, password });

if (error) {
  fail(`Supabase password login failed: ${error.message}`);
}

if (!data.session?.access_token) {
  fail("Supabase login succeeded but no access_token was returned.");
}

console.log(data.session.access_token);
