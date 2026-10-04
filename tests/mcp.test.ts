import { beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_SCENARIOS } from "../fixtures/scenarios.js";
import { CorrelationEngine } from "../src/engine/correlation.js";
import { createGateStoryMcpServer } from "../src/mcp/server.js";
import { MemoryRepository } from "../src/storage/memory.js";

describe("Model Context Protocol (MCP) Server — 6 Tools & Sub-500ms Performance", () => {
  let engine: CorrelationEngine;
  let storage: MemoryRepository;
  let mcpServer: ReturnType<typeof createGateStoryMcpServer>;
  let seededVisitId: string;

  beforeEach(async () => {
    engine = new CorrelationEngine();
    storage = new MemoryRepository();
    mcpServer = createGateStoryMcpServer({ engine, storage });

    // Seed a normal delivery visit
    const scenario = FIXTURE_SCENARIOS[0]; // 01-normal-delivery
    for (const evt of scenario.events) {
      const { session } = engine.ingest(evt);
      await storage.saveVisit(session);
    }
    const sessions = engine.getAllSessions();
    seededVisitId = sessions[0].id;
  });

  function getTool(name: string) {
    const tool = (
      mcpServer as unknown as {
        _registeredTools: Record<
          string,
          {
            handler: (args: unknown) => Promise<{ content: Array<{ type: string; text: string }> }>;
          }
        >;
      }
    )._registeredTools[name];
    if (!tool) throw new Error(`MCP tool '${name}' is not registered`);
    return tool;
  }

  it("Tool 1: get_visit_timeline returns chronological breakdown within 500ms", async () => {
    const t0 = performance.now();
    const tool = getTool("get_visit_timeline");
    const result = await tool.handler({ visitId: seededVisitId });
    const latency = performance.now() - t0;

    expect(latency).toBeLessThan(500);
    expect(result.content).toHaveLength(1);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.visitId).toBe(seededVisitId);
    expect(parsed.timeline.length).toBeGreaterThan(0);
    expect(parsed.dwellByZoneSec).toBeDefined();
  });

  it("Tool 2: get_visit_story returns narrative storyline within 500ms", async () => {
    const t0 = performance.now();
    const tool = getTool("get_visit_story");
    const result = await tool.handler({ visitId: seededVisitId, enriched: false });
    const latency = performance.now() - t0;

    expect(latency).toBeLessThan(500);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.visitId).toBe(seededVisitId);
    expect(parsed.story).toContain("Front Gate");
    expect(parsed.outcome).toBe("reached_door_completed");
  });

  it("Tool 3: search_visitors filters visits by outcome within 500ms", async () => {
    const t0 = performance.now();
    const tool = getTool("search_visitors");
    const result = await tool.handler({ outcome: "reached_door_completed" });
    const latency = performance.now() - t0;

    expect(latency).toBeLessThan(500);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.count).toBeGreaterThan(0);
    expect(parsed.results[0].outcome).toBe("reached_door_completed");
  });

  it("Tool 4: get_snapshot returns snapshot references within 500ms", async () => {
    const t0 = performance.now();
    const tool = getTool("get_snapshot");
    const result = await tool.handler({ visitId: seededVisitId, zone: "door" });
    const latency = performance.now() - t0;

    expect(latency).toBeLessThan(500);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.visitId).toBe(seededVisitId);
    expect(parsed.snapshots.length).toBeGreaterThan(0);
    expect(parsed.snapshots[0].url).toContain("/api/snapshots/");
  });

  it("Tool 5: create_gate_rule adds security boundary rule within 500ms", async () => {
    const t0 = performance.now();
    const tool = getTool("create_gate_rule");
    const result = await tool.handler({
      name: "Night Gate Alert",
      zone: "gate",
      maxDwellSeconds: 30,
      alertOnAbandon: true,
    });
    const latency = performance.now() - t0;

    expect(latency).toBeLessThan(500);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.success).toBe(true);
    expect(parsed.rule.name).toBe("Night Gate Alert");

    // Verify stored
    const rules = await storage.listRules();
    expect(rules.some((r) => r.name === "Night Gate Alert")).toBe(true);
  });

  it("Tool 6: get_access_log returns audit trail within 500ms", async () => {
    await storage.logAccess({
      id: "log_mcp_test_01",
      timestamp: Date.now(),
      source: "rule_engine",
      action: "SYSTEM_STARTUP",
      details: { test: true },
    });

    const t0 = performance.now();
    const tool = getTool("get_access_log");
    const result = await tool.handler({ limit: 10 });
    const latency = performance.now() - t0;

    expect(latency).toBeLessThan(500);
    const parsed = JSON.parse(result.content[0].text);
    expect(parsed.count).toBeGreaterThan(0);
  });
});
