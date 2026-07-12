import { createAgentContextGet } from "@/lib/openclaw-broker-context";
import {
  authenticateBrokerRequest,
  listOwnedBrokerSites,
} from "@/lib/openclaw-broker-auth";

export const dynamic = "force-dynamic";

export const GET = createAgentContextGet({
  authenticate: authenticateBrokerRequest,
  listOwnedSites: listOwnedBrokerSites,
});
