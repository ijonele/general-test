import { resolve } from "node:path";
import express from "express";
import type { Express, RequestHandler } from "express";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { HTTPFacilitatorClient } from "@x402/core/server";
import { createFacilitatorConfig } from "@payai/facilitator";
import type { Network } from "@x402/core/types";
import { registerExactEvmScheme } from "@x402/evm/exact/server";

export interface PaymentAccept {
  scheme: "exact";
  network: Network;
  payTo: string;
  price: string;
}

export interface PaymentConfig {
  facilitatorUrl: string;
  isPayAI: boolean;
  accepts: PaymentAccept[];
}

const x402Networks: { prefix: string; network: string; envPrefix: string }[] = [
  { prefix: "BASE_SEPOLIA", network: "eip155:84532", envPrefix: "X402_BASE_SEPOLIA" },
  { prefix: "BASE", network: "eip155:8453", envPrefix: "X402_BASE" },
];

export function getPaymentConfig(): PaymentConfig | null {
  const enabledNetworks = x402Networks.filter(
    (n) => process.env[`${n.envPrefix}_PAY_TO`],
  );

  const accepts = enabledNetworks.map((n) => ({
    scheme: "exact" as const,
    network: (process.env[`${n.envPrefix}_NETWORK`] || n.network) as Network,
    payTo: process.env[`${n.envPrefix}_PAY_TO`]!,
    price: process.env[`${n.envPrefix}_PRICE`] || "0.01",
  }));

  if (accepts.length === 0) return null;

  const facilitatorUrl =
    process.env.X402_FACILITATOR_URL || "https://x402.org/facilitator";

  return {
    facilitatorUrl,
    isPayAI: facilitatorUrl.includes("payai.network"),
    accepts,
  };
}

export function createPaymentApp(
  config: PaymentConfig,
  description: string,
  a2aHandler: RequestHandler,
  langGraphHandler: RequestHandler,
  apiKey?: string,
): Express {
  const facilitatorClient = new HTTPFacilitatorClient({
    ...(config.isPayAI ? createFacilitatorConfig() : {}),
    url: config.facilitatorUrl,
  });
  const resourceServer = new x402ResourceServer(facilitatorClient);

  const hasEvm = config.accepts.some((a) => a.network.startsWith("eip155:"));
  if (hasEvm) registerExactEvmScheme(resourceServer);

  const app = express();

  // Serve static files from public/ (before CORS/payment middleware)
  app.use(express.static(resolve(import.meta.dirname, "../public")));

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, PAYMENT-SIGNATURE, X-PAYMENT, Access-Control-Expose-Headers");
    res.setHeader("Access-Control-Expose-Headers", "PAYMENT-REQUIRED, PAYMENT-RESPONSE, X-PAYMENT-RESPONSE");
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  const payment = paymentMiddleware(
    {
      "POST /": {
        accepts: config.accepts,
        description,
        mimeType: "application/json",
      },
    },
    resourceServer,
  );

  if (apiKey) {
    app.use((req, res, next) => {
      if (req.method === "POST" && req.headers.authorization === `Bearer ${apiKey}`) {
        return next();
      }
      payment(req, res, next);
    });
  } else {
    app.use(payment);
  }

  app.all("*", (req, res, next) => {
    const url = req.url || "/";
    const isLangGraph =
      url.startsWith("/info") ||
      url.startsWith("/ok") ||
      url.startsWith("/assistants") ||
      url.startsWith("/threads") ||
      url.startsWith("/runs") ||
      url.startsWith("/store");
    const routeHandler = isLangGraph ? langGraphHandler : a2aHandler;
    routeHandler(req, res, next);
  });

  return app;
}
