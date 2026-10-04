import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { config } from "../config/env.js";
import { CorrelationEngine } from "../engine/correlation.js";
import { MemoryRepository } from "../storage/memory.js";
import { createGateStoryMcpServer } from "./server.js";

async function runMcpCli() {
  const engine = new CorrelationEngine();
  const storage = new MemoryRepository();
  const server = createGateStoryMcpServer({
    engine,
    storage,
    enableNova: config.NOVA_ENRICHMENT_FLAG,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp] GateStory MCP server running on stdio");
}

runMcpCli().catch((err) => {
  console.error("[mcp] Fatal error:", err);
  process.exit(1);
});
