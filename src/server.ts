import "dotenv/config";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { AgentServer } from "@wardenprotocol/agent-kit";
import { handler } from "./agent.js";
import { getPaymentConfig, createPaymentApp } from "./payments.js";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "localhost";
const BASE_URL = `http://${HOST}:${PORT}`;
const AGENT_URL = process.env.RENDER_EXTERNAL_URL || BASE_URL;

const agentCard = JSON.parse(
  readFileSync(new URL("../public/.well-known/agent-card.json", import.meta.url), "utf-8"),
);

const PUBLIC_DIR = new URL("../public", import.meta.url).pathname;

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".css": "text/css",
  ".js": "text/javascript",
  ".txt": "text/plain",
};

function serveStatic(req: IncomingMessage, res: ServerResponse): boolean {
  if (req.method !== "GET") return false;
  const reqUrl = req.url?.split("?")[0] || "/";
  const filePath = reqUrl === "/" ? "/index.html" : reqUrl;
  const safePath = path.normalize(decodeURIComponent(filePath));
  const fullPath = path.join(PUBLIC_DIR, safePath);
  if (!fullPath.startsWith(PUBLIC_DIR)) return false;
  try {
    const data = readFileSync(fullPath);
    const ext = path.extname(fullPath).toLowerCase();
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

function authenticateRequest(req: IncomingMessage, res: ServerResponse): boolean {
  const apiKey = process.env.AGENT_API_KEY;
  if (!apiKey || req.method !== "POST") return false;

  const auth = req.headers.authorization;
  if (auth === `Bearer ${apiKey}`) return false;

  res.writeHead(401, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "Unauthorized", message: "Valid API key required. Set Authorization: Bearer <key> header." }));
  return true;
}

if (agentCard.url && agentCard.url !== AGENT_URL) {
  console.warn(`Warning: agent card "url" is "${agentCard.url}" but server is "${AGENT_URL}".`);
  console.warn(`Update public/.well-known/agent-card.json to match your deployment URL.`);
  console.warn();
}

const server = new AgentServer({ agentCard, handler });

const paymentConfig = process.env.X402 === "false" ? null : getPaymentConfig();

if (paymentConfig) {
  const app = createPaymentApp(
    paymentConfig,
    "A helpful AI agent named general-test",
    server.getA2AServer().getHandler(),
    server.getLangGraphServer().getHandler(),
    process.env.AGENT_API_KEY,
  );

  app.listen(PORT, () => {
    const hasApiKey = !!process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  console.log(`Model: ${model}`);
  console.log(`API Key: ${hasApiKey ? "configured" : "NOT SET"}`);
    console.log(`general-test (Dual Protocol + x402 Payments)`);
    if (process.env.AGENT_API_KEY) {
      console.log("API Key: protected (Bearer auth bypasses payment)");
    } else {
      console.log("API Key: not set (all requests require payment)");
    }
    console.log(`Server: ${AGENT_URL}`);
    console.log(`Frontend: ${AGENT_URL}/`);
    console.log();
    console.log("x402 Payments:");
    console.log(`  Facilitator: ${paymentConfig.facilitatorUrl}`);
    if (paymentConfig.isPayAI) {
      console.log(`  API Key:     ${process.env.PAYAI_API_KEY_ID ? "configured" : "not set (using free tier)"}`);
    }
    for (const a of paymentConfig.accepts) {
      console.log(`  ${a.network}: ${a.price} USDC -> ${a.payTo.slice(0, 8)}...`);
    }
    console.log();
    console.log("A2A Protocol:");
    console.log(`  Agent Card: ${AGENT_URL}/.well-known/agent-card.json`);
    console.log(`  JSON-RPC:   POST ${AGENT_URL}/`);
    console.log();
    console.log("LangGraph Protocol:");
    console.log(`  Info:       ${AGENT_URL}/info`);
    console.log(`  Assistants: ${AGENT_URL}/assistants`);
    console.log(`  Threads:    ${AGENT_URL}/threads`);
    console.log(`  Runs:       ${AGENT_URL}/runs`);
  });
} else {
  const a2aHandler = server.getA2AServer().getHandler();
const langGraphHandler = server.getLangGraphServer().getHandler();

const httpServer = createServer((req, res) => {
  if (serveStatic(req, res)) return;
  if (authenticateRequest(req, res)) return;
  const url = req.url || "/";
  const isLangGraph = url.startsWith("/info") || url.startsWith("/ok")
    || url.startsWith("/assistants") || url.startsWith("/threads")
    || url.startsWith("/runs") || url.startsWith("/store");
  const handler = isLangGraph ? langGraphHandler : a2aHandler;
  handler(req, res);
});

httpServer.listen(PORT, () => {
  const hasApiKey = !!process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  console.log(`Model: ${model}`);
  console.log(`API Key: ${hasApiKey ? "configured" : "NOT SET"}`);
  console.log(`general-test (Dual Protocol)`);
  if (process.env.X402 === "false") {
    console.log("x402 payments disabled (X402=false)");
  }
  if (process.env.AGENT_API_KEY) {
    console.log("API Key: protected (Bearer auth required)");
  } else {
    console.log("API Key: not set (endpoints are unprotected)");
  }
  console.log(`Server: ${AGENT_URL}`);
  console.log(`Frontend: ${AGENT_URL}/`);
  console.log();
  console.log("A2A Protocol:");
  console.log(`  Agent Card: ${AGENT_URL}/.well-known/agent-card.json`);
  console.log(`  JSON-RPC:   POST ${AGENT_URL}/`);
  console.log();
  console.log("LangGraph Protocol:");
  console.log(`  Info:       ${AGENT_URL}/info`);
  console.log(`  Assistants: ${AGENT_URL}/assistants`);
  console.log(`  Threads:    ${AGENT_URL}/threads`);
  console.log(`  Runs:       ${AGENT_URL}/runs`);
});
}
