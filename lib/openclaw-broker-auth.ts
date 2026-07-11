import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { BrokerError, type BrokerRequestContext } from "@/lib/engine-adapter";
import {
  createSupabaseAdminClient,
  getWorkspaceUser,
  type WorkspaceDatabase,
  type WorkspaceUser,
} from "@/lib/supabase-admin";

export type ResolveBrokerContext = (
  request: NextRequest,
  requestedSiteId: string | null,
) => Promise<BrokerRequestContext>;

export type BrokerContextResolverDependencies<TClient> = {
  createClient: () => TClient | null;
  authenticate: (client: TClient, headers: Headers) => Promise<WorkspaceUser | null>;
  findOwnedSite: (
    client: TClient,
    user: WorkspaceUser,
    siteId: string,
  ) => Promise<BrokerRequestContext | null>;
};

function hasBearerToken(headers: Headers): boolean {
  return /^Bearer\s+\S+$/i.test(headers.get("authorization")?.trim() ?? "");
}

export function createBrokerContextResolver<TClient>(
  dependencies: BrokerContextResolverDependencies<TClient>,
): ResolveBrokerContext {
  return async (request, requestedSiteId) => {
    if (!hasBearerToken(request.headers)) throw new BrokerError("AUTH_REQUIRED", 401);
    const client = dependencies.createClient();
    if (!client) throw new BrokerError("AUTH_BACKEND_UNAVAILABLE", 503);
    const user = await dependencies.authenticate(client, request.headers);
    if (!user) throw new BrokerError("AUTH_INVALID", 401);
    if (!requestedSiteId?.trim()) throw new BrokerError("SITE_CONTEXT_REQUIRED", 400);
    const context = await dependencies.findOwnedSite(client, user, requestedSiteId.trim());
    if (!context) throw new BrokerError("SITE_FORBIDDEN", 403);
    return context;
  };
}

async function findOwnedSite(
  client: SupabaseClient<WorkspaceDatabase>,
  user: WorkspaceUser,
  siteId: string,
): Promise<BrokerRequestContext | null> {
  const { data: site, error: siteError } = await client
    .from("sites")
    .select("id,organization_id,name,region,briefing_question")
    .eq("id", siteId)
    .maybeSingle();
  if (siteError) throw siteError;
  if (!site) return null;

  const { data: organization, error: organizationError } = await client
    .from("organizations")
    .select("id")
    .eq("id", site.organization_id)
    .eq("owner_id", user.id)
    .maybeSingle();
  if (organizationError) throw organizationError;
  if (!organization) return null;

  return {
    userId: user.id,
    organizationId: organization.id,
    siteId: site.id,
    site: {
      siteName: site.name,
      region: site.region,
      briefingQuestion: site.briefing_question,
    },
  };
}

export const resolveBrokerRequestContext = createBrokerContextResolver({
  createClient: createSupabaseAdminClient,
  authenticate: getWorkspaceUser,
  findOwnedSite,
});
