import type { NextRequest } from "next/server";

import { enforceRateLimit } from "@/lib/api-guard";
import {
  BrokerError,
} from "@/lib/engine-adapter";
import { createRateLimiter } from "@/lib/rate-limit";
import type {
  AuthenticateBrokerRequest,
  BrokerSiteOption,
  ListOwnedBrokerSites,
} from "@/lib/openclaw-broker-auth";

export type AgentContextRouteDependencies = {
  authenticate: AuthenticateBrokerRequest;
  listOwnedSites: ListOwnedBrokerSites;
  preAuthLimiter?: ReturnType<typeof createRateLimiter>;
};

function jsonError(error: BrokerError): Response {
  return new Response(JSON.stringify({ code: error.code, error: error.message }), {
    status: error.status,
    headers: { "Content-Type": "application/json" },
  });
}

export function createAgentContextGet(dependencies: AgentContextRouteDependencies) {
  const routePreAuthLimiter = dependencies.preAuthLimiter ?? createRateLimiter({ limit: 20, windowMs: 60_000 });
  return async function get(request: NextRequest): Promise<Response> {
    const coarseLimited = enforceRateLimit(request, routePreAuthLimiter);
    if (coarseLimited) return coarseLimited;

    let authentication;
    try {
      authentication = await dependencies.authenticate(request);
    } catch (error) {
      const brokerError = error instanceof BrokerError
        ? error
        : new BrokerError("AUTH_BACKEND_UNAVAILABLE", 503, error);
      return jsonError(brokerError);
    }

    try {
      const sites: BrokerSiteOption[] = await dependencies.listOwnedSites(authentication);
      return new Response(JSON.stringify({ sites }), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    } catch (error) {
      const brokerError = error instanceof BrokerError
        ? error
        : new BrokerError("SITE_BACKEND_UNAVAILABLE", 503, error);
      return jsonError(brokerError);
    }
  };
}
