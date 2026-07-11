import type { NextRequest } from "next/server";

import {
  BrokerError,
  publicBrokerError,
} from "@/lib/engine-adapter";
import type {
  AuthenticateBrokerRequest,
  BrokerSiteOption,
  ListOwnedBrokerSites,
} from "@/lib/openclaw-broker-auth";

export type AgentContextRouteDependencies = {
  authenticate: AuthenticateBrokerRequest;
  listOwnedSites: ListOwnedBrokerSites;
};

function jsonError(error: BrokerError): Response {
  return new Response(JSON.stringify({ code: error.code, error: error.message }), {
    status: error.status,
    headers: { "Content-Type": "application/json" },
  });
}

export function createAgentContextGet(dependencies: AgentContextRouteDependencies) {
  return async function get(request: NextRequest): Promise<Response> {
    try {
      const authentication = await dependencies.authenticate(request);
      const sites: BrokerSiteOption[] = await dependencies.listOwnedSites(authentication);
      return new Response(JSON.stringify({ sites }), {
        headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
      });
    } catch (error) {
      return jsonError(error instanceof BrokerError ? error : publicBrokerError(error));
    }
  };
}
