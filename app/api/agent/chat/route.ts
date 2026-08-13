import { createAgentChatPost, createProductionEngineAdapter } from "@/lib/openclaw-broker-route";
import { resolveBrokerRequestContext } from "@/lib/openclaw-broker-auth";
import { isProductionTrustedKoshaReference } from "@/lib/production-kosha-trust";
import { createConfiguredRemoteHermesHttpsTransport } from "@/lib/remote-hermes-https-transport";
import { createConfiguredRemoteHermesAttemptLedger } from "@/lib/remote-hermes-upstash-ledger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = createAgentChatPost({
  resolveContext: resolveBrokerRequestContext,
  engine: createProductionEngineAdapter(process.env, {
    openClawHermes: {
      trustedKoshaReference: isProductionTrustedKoshaReference,
    },
    remoteHermes: {
      trustedKoshaReference: isProductionTrustedKoshaReference,
      trustedTransport: createConfiguredRemoteHermesHttpsTransport(process.env),
      attemptLedger: createConfiguredRemoteHermesAttemptLedger({ environment: process.env }),
    },
  }),
});
