import { createApp } from "./api/server.js";
import { config } from "./config/env.js";
import { DynamoRepository } from "./storage/dynamo.js";
import { MemoryRepository } from "./storage/memory.js";
import type { StorageRepository } from "./storage/repository.js";

async function bootstrap() {
  console.log("🚪📜 Initializing GateStory Server...");
  console.log(
    `[env] Port: ${config.PORT} | Node Env: ${config.NODE_ENV} | AWS Region: ${config.AWS_REGION}`,
  );

  // Storage selection: use DynamoDB if configured and not test, otherwise MemoryRepository
  let storage: StorageRepository;
  if (config.AWS_ACCESS_KEY_ID && config.NODE_ENV === "production") {
    try {
      console.log(
        `[storage] Initializing DynamoDB repository on table '${config.DYNAMODB_TABLE_NAME}'`,
      );
      storage = new DynamoRepository({
        tableName: config.DYNAMODB_TABLE_NAME,
        region: config.AWS_REGION,
      });
    } catch (err) {
      console.warn(
        "[storage] DynamoDB init failed, falling back to in-memory storage:",
        (err as Error).message,
      );
      storage = new MemoryRepository();
    }
  } else {
    console.log("[storage] Using in-memory repository (high-performance local mode)");
    storage = new MemoryRepository();
  }

  const { app, poller } = createApp({
    storage,
    hmacKey: config.RING_HMAC_KEY,
    enableNova: config.NOVA_ENRICHMENT_FLAG,
  });

  const server = app.listen(config.PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚪 GateStory Server running at http://localhost:${config.PORT}`);
    console.log(`📡 Ingest Webhook:  POST http://localhost:${config.PORT}/api/ring/webhook`);
    console.log(`🔄 History Poller:  POST http://localhost:${config.PORT}/api/ring/poll`);
    console.log(`🔌 MCP SSE URL:     GET  http://localhost:${config.PORT}/mcp/sse`);
    console.log(`📋 Household Log:   GET  http://localhost:${config.PORT}/`);
    console.log(`======================================================\n`);

    // Start Ring Event History Poller if credentials present
    if (config.RING_PLAYGROUND_TOKEN && config.RING_DEVICE_ID) {
      console.log("[ring] Playground token detected, starting background history poller...");
      poller.start();
    } else {
      console.log(
        "[ring] No playground token/device set; poller dormant. Webhook receiver active.",
      );
    }
  });

  const shutdown = () => {
    console.log("\n[server] Shutting down gracefully...");
    poller.stop();
    server.close(() => {
      console.log("[server] GateStory stopped.");
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

bootstrap().catch((err) => {
  console.error("[fatal] Boot failed:", err);
  process.exit(1);
});
