import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

import { BrokerError, type BrokerRequestContext } from "@/lib/engine-adapter";
import {
  createSupabaseAdminClient,
  type WorkspaceDatabase,
  type WorkspaceUser,
} from "@/lib/supabase-admin";

export type ResolveBrokerContext = ((
  request: NextRequest,
  requestedSiteId: string | null,
) => Promise<BrokerRequestContext>) & {
  authenticate: AuthenticateBrokerRequest;
  resolveOwnedSite: ResolveOwnedBrokerSite;
};

export type BrokerAuthenticatedRequest<TClient = unknown> = {
  client: TClient;
  user: WorkspaceUser;
};

export type AuthenticateBrokerRequest = (
  request: NextRequest,
) => Promise<BrokerAuthenticatedRequest>;

export type ResolveOwnedBrokerSite = (
  authentication: BrokerAuthenticatedRequest,
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

export type BrokerAuthorization<TClient> = {
  authenticate: (request: NextRequest) => Promise<BrokerAuthenticatedRequest<TClient>>;
  resolveOwnedSite: (
    authentication: BrokerAuthenticatedRequest<TClient>,
    requestedSiteId: string | null,
  ) => Promise<BrokerRequestContext>;
};

function readBearerToken(headers: Headers): string | null {
  const match = /^Bearer\s+(\S+)$/i.exec(headers.get("authorization")?.trim() ?? "");
  return match?.[1] ?? null;
}

function hasBearerToken(headers: Headers): boolean {
  return readBearerToken(headers) !== null;
}

function isInvalidCredentialError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const status = "status" in error ? (error as { status?: unknown }).status : undefined;
  return status === 400 || status === 401 || status === 403 || status === 422;
}

export type BrokerAuthLookupClient = {
  auth: {
    getUser: (token: string) => Promise<{
      data: { user: { id: string; email?: string | null } | null };
      error: unknown;
    }>;
  };
};

export async function authenticateBrokerWorkspaceUser(
  client: BrokerAuthLookupClient,
  headers: Headers,
): Promise<WorkspaceUser | null> {
  const token = readBearerToken(headers);
  if (!token) return null;
  const { data, error } = await client.auth.getUser(token);
  if (error) {
    if (isInvalidCredentialError(error)) return null;
    throw error;
  }
  if (!data.user) return null;
  return { id: data.user.id, email: data.user.email ?? null };
}

export function createBrokerAuthorization<TClient>(
  dependencies: BrokerContextResolverDependencies<TClient>,
): BrokerAuthorization<TClient> {
  return {
    authenticate: async (request) => {
      if (!hasBearerToken(request.headers)) throw new BrokerError("AUTH_REQUIRED", 401);
      let client: TClient | null;
      try {
        client = dependencies.createClient();
      } catch (error) {
        throw new BrokerError("AUTH_BACKEND_UNAVAILABLE", 503, error);
      }
      if (!client) throw new BrokerError("AUTH_BACKEND_UNAVAILABLE", 503);
      let user: WorkspaceUser | null;
      try {
        user = await dependencies.authenticate(client, request.headers);
      } catch (error) {
        if (error instanceof BrokerError) throw error;
        throw new BrokerError("AUTH_BACKEND_UNAVAILABLE", 503, error);
      }
      if (!user) throw new BrokerError("AUTH_INVALID", 401);
      return { client, user };
    },
    resolveOwnedSite: async (authentication, requestedSiteId) => {
      if (!requestedSiteId?.trim()) throw new BrokerError("SITE_CONTEXT_REQUIRED", 400);
      let context: BrokerRequestContext | null;
      try {
        context = await dependencies.findOwnedSite(
          authentication.client,
          authentication.user,
          requestedSiteId.trim(),
        );
      } catch (error) {
        if (error instanceof BrokerError) throw error;
        throw new BrokerError("SITE_BACKEND_UNAVAILABLE", 503, error);
      }
      if (!context) throw new BrokerError("SITE_FORBIDDEN", 403);
      return context;
    },
  };
}

export function createBrokerContextResolver<TClient>(
  dependencies: BrokerContextResolverDependencies<TClient>,
): ResolveBrokerContext {
  const authorization = createBrokerAuthorization(dependencies);
  const resolve = async (request: NextRequest, requestedSiteId: string | null): Promise<BrokerRequestContext> => {
    const authentication = await authorization.authenticate(request);
    return authorization.resolveOwnedSite(authentication, requestedSiteId);
  };
  return Object.assign(resolve, {
    authenticate: authorization.authenticate as AuthenticateBrokerRequest,
    resolveOwnedSite: authorization.resolveOwnedSite as ResolveOwnedBrokerSite,
  });
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

async function findOwnedSites(
  client: SupabaseClient<WorkspaceDatabase>,
  user: WorkspaceUser,
): Promise<BrokerSiteOption[]> {
  const { data: organizations, error: organizationError } = await client
    .from("organizations")
    .select("id")
    .eq("owner_id", user.id)
    .order("created_at", { ascending: true });
  if (organizationError) throw organizationError;
  const organizationIds = (organizations ?? []).map((organization) => organization.id);
  if (organizationIds.length === 0) return [];

  const { data: sites, error: siteError } = await client
    .from("sites")
    .select("id,name,organization_id")
    .in("organization_id", organizationIds)
    .order("created_at", { ascending: true });
  if (siteError) throw siteError;
  return (sites ?? []).map((site) => ({
    id: site.id,
    name: site.name,
    organizationId: site.organization_id,
  }));
}

export type BrokerSiteOption = { id: string; name: string; organizationId: string };

export type ListOwnedBrokerSites = (
  authentication: BrokerAuthenticatedRequest,
) => Promise<BrokerSiteOption[]>;

const brokerAuthorization = createBrokerAuthorization({
  createClient: createSupabaseAdminClient,
  authenticate: authenticateBrokerWorkspaceUser,
  findOwnedSite,
});

export const authenticateBrokerRequest: AuthenticateBrokerRequest = brokerAuthorization.authenticate;

export const resolveOwnedBrokerSite: ResolveOwnedBrokerSite = brokerAuthorization.resolveOwnedSite as ResolveOwnedBrokerSite;

const resolveBrokerRequestContextBase = async (request: NextRequest, requestedSiteId: string | null): Promise<BrokerRequestContext> => {
  const authentication = await authenticateBrokerRequest(request);
  return resolveOwnedBrokerSite(authentication, requestedSiteId);
};

export const resolveBrokerRequestContext: ResolveBrokerContext = Object.assign(resolveBrokerRequestContextBase, {
  authenticate: authenticateBrokerRequest,
  resolveOwnedSite: resolveOwnedBrokerSite,
});

export const listOwnedBrokerSites: ListOwnedBrokerSites = async (authentication) => {
  try {
    return await findOwnedSites(
      authentication.client as SupabaseClient<WorkspaceDatabase>,
      authentication.user,
    );
  } catch (error) {
    if (error instanceof BrokerError) throw error;
    throw new BrokerError("SITE_BACKEND_UNAVAILABLE", 503, error);
  }
};
