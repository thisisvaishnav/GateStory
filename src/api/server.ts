import path from "node:path";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import cors from "cors";
import express, { type Express, type Request, type Response } from "express";
import { CorrelationEngine } from "../engine/correlation.js";
import { createGateStoryMcpServer } from "../mcp/server.js";
import { RingHistoryPoller } from "../ring/poller.js";
import { MemoryRepository } from "../storage/memory.js";
import type { StorageRepository } from "../storage/repository.js";
import { createFixturesRouter } from "./routes/fixtures.js";
import { createHeatmapRouter } from "./routes/heatmap.js";
import { createRingRouter } from "./routes/ring.js";
import { createAccessLogRouter, createRulesRouter } from "./routes/rules.js";
import { createSnapshotsRouter } from "./routes/snapshots.js";
import { createVisitsRouter } from "./routes/visits.js";

export interface AppOptions {
  engine?: CorrelationEngine;
  storage?: StorageRepository;
  poller?: RingHistoryPoller;
  hmacKey?: string;
  enableNova?: boolean;
}

export function createApp(options: AppOptions = {}): {
  app: Express;
  engine: CorrelationEngine;
  storage: StorageRepository;
  poller: RingHistoryPoller;
} {
  const app = express();
  const engine = options.engine || new CorrelationEngine();
  const storage = options.storage || new MemoryRepository();
  const hmacKey = options.hmacKey || process.env.RING_HMAC_KEY || "default_test_hmac_key";

  const poller =
    options.poller ||
    new RingHistoryPoller({
      token: process.env.RING_PLAYGROUND_TOKEN || "",
      deviceId: process.env.RING_DEVICE_ID || "",
      onNewEvents: async (events) => {
        for (const evt of events) {
          const { session } = engine.ingest(evt);
          await storage.saveVisit(session);
        }
      },
    });

  // Middleware: CORS
  app.use(cors());

  // Middleware: JSON with Raw Body Capture (strictly required for HMAC verification)
  app.use(
    express.json({
      verify: (req: Request, _res, buf) => {
        (req as unknown as { rawBody: Buffer }).rawBody = buf;
      },
    }),
  );

  // Serve static UI assets
  const publicDir = path.resolve(process.cwd(), "src", "ui", "public");
  app.use(express.static(publicDir));

  // Health check endpoint
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "healthy",
      uptime: process.uptime(),
      pollerStatus: poller.getStatus(),
      activeVisitsCount: engine.getAllSessions().length,
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API routers
  app.use("/api/ring", createRingRouter({ engine, storage, poller, hmacKey }));
  app.use("/api/visits", createVisitsRouter(engine, storage));
  app.use("/api/heatmap", createHeatmapRouter(engine));
  app.use("/api/rules", createRulesRouter(storage));
  app.use("/api/access-log", createAccessLogRouter(storage));
  app.use("/api/fixtures", createFixturesRouter(engine, storage));
  app.use("/api/snapshots", createSnapshotsRouter(engine));

  // MCP SSE Transport Integration
  const mcpServer = createGateStoryMcpServer({
    engine,
    storage,
    enableNova: options.enableNova ?? process.env.NOVA_ENRICHMENT_FLAG === "true",
  });

  let sseTransport: SSEServerTransport | null = null;

  app.get("/mcp/sse", async (_req: Request, res: Response) => {
    console.log("[mcp] Establishing new SSE transport stream");
    sseTransport = new SSEServerTransport("/mcp/messages", res);
    await mcpServer.connect(sseTransport);
  });

  app.post("/mcp/messages", async (req: Request, res: Response) => {
    if (!sseTransport) {
      res.status(400).json({ error: "SSE connection not established yet" });
      return;
    }
    await sseTransport.handlePostMessage(req, res);
  });

  return { app, engine, storage, poller };
}
