import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CorrelationEngine } from "../engine/correlation.js";
import { enrichStoryWithNova } from "../engine/narrative.js";
import type { StorageRepository } from "../storage/repository.js";
import type { CameraZone, GateRule } from "../types/visit.js";

export interface CreateMcpServerOptions {
  engine: CorrelationEngine;
  storage: StorageRepository;
  enableNova?: boolean;
}

export function createGateStoryMcpServer(options: CreateMcpServerOptions): McpServer {
  const { engine, storage, enableNova } = options;

  const server = new McpServer({
    name: "GateStory-Ring-MCP",
    version: "1.0.0",
  });

  // Tool 1: get_visit_timeline
  server.tool(
    "get_visit_timeline",
    "Retrieve chronological event timeline and camera hops for a visit session",
    {
      visitId: z.string().describe("The ID of the visit session to retrieve"),
    },
    async ({ visitId }) => {
      const startTime = Date.now();
      const visit = engine.getSessionById(visitId) || (await storage.getVisitById(visitId));

      if (!visit) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ error: `Visit session '${visitId}' not found.` }),
            },
          ],
        };
      }

      const timeline = visit.events.map((e) => ({
        eventId: e.id,
        zone: e.zone,
        deviceId: e.deviceId,
        eventType: e.eventType,
        timestamp: new Date(e.timestamp).toISOString(),
        relativeSec: Math.round((e.timestamp - visit.startTime) / 1000),
        durationSec: Math.round((e.durationMs || 0) / 1000),
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                visitId: visit.id,
                state: visit.state,
                outcome: visit.outcome,
                totalDurationSec: Math.round(visit.durationMs / 1000),
                dwellByZoneSec: {
                  gate: Math.round(visit.dwellTimeByZone.gate / 1000),
                  walkway: Math.round(visit.dwellTimeByZone.walkway / 1000),
                  door: Math.round(visit.dwellTimeByZone.door / 1000),
                },
                timeline,
                roundTripMs: Date.now() - startTime,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Tool 2: get_visit_story
  server.tool(
    "get_visit_story",
    "Retrieve cohesive synthesized visit storyline (deterministic or enriched)",
    {
      visitId: z.string().describe("The ID of the visit session"),
      enriched: z
        .boolean()
        .optional()
        .describe("Whether to request Nova LLM enrichment if enabled"),
    },
    async ({ visitId, enriched }) => {
      const startTime = Date.now();
      const visit = engine.getSessionById(visitId) || (await storage.getVisitById(visitId));

      if (!visit) {
        return {
          content: [{ type: "text", text: `Visit '${visitId}' not found.` }],
        };
      }

      let story = visit.story;
      if (enriched && enableNova) {
        story = await enrichStoryWithNova(visit);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                visitId: visit.id,
                state: visit.state,
                outcome: visit.outcome,
                doorbellPressed: visit.doorbellPressed,
                story,
                roundTripMs: Date.now() - startTime,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Tool 3: search_visitors
  server.tool(
    "search_visitors",
    "Query visit storylines by outcome, dwell duration, or door arrival",
    {
      outcome: z
        .string()
        .optional()
        .describe(
          "Filter by outcome (reached_door_completed, turned_back, loitering, driveby_noise, direct_door_visit)",
        ),
      minDwellSeconds: z.number().optional().describe("Minimum total dwell time in seconds"),
      maxDwellSeconds: z.number().optional().describe("Maximum total dwell time in seconds"),
      reachedDoor: z.boolean().optional().describe("Filter visits that reached the front door"),
      limit: z.number().optional().default(10).describe("Max results to return"),
    },
    async ({ outcome, minDwellSeconds, maxDwellSeconds, reachedDoor, limit }) => {
      const startTime = Date.now();
      const allVisits = engine.getAllSessions();

      let filtered = allVisits;
      if (outcome) {
        filtered = filtered.filter((v) => v.outcome === outcome);
      }
      if (minDwellSeconds !== undefined) {
        filtered = filtered.filter((v) => v.durationMs >= minDwellSeconds * 1000);
      }
      if (maxDwellSeconds !== undefined) {
        filtered = filtered.filter((v) => v.durationMs <= maxDwellSeconds * 1000);
      }
      if (reachedDoor !== undefined) {
        filtered = filtered.filter((v) => {
          const reached = v.cameraChain.some((h) => h.zone === "door") || v.doorbellPressed;
          return reached === reachedDoor;
        });
      }

      const results = filtered.slice(0, limit).map((v) => ({
        id: v.id,
        state: v.state,
        outcome: v.outcome,
        startTime: new Date(v.startTime).toISOString(),
        durationSec: Math.round(v.durationMs / 1000),
        doorbellPressed: v.doorbellPressed,
        story: v.story,
      }));

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: results.length,
                totalMatches: filtered.length,
                results,
                roundTripMs: Date.now() - startTime,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Tool 4: get_snapshot
  server.tool(
    "get_snapshot",
    "Retrieve camera snapshot image URL and metadata for key visit hops",
    {
      visitId: z.string().describe("The ID of the visit session"),
      zone: z
        .enum(["gate", "walkway", "door"])
        .optional()
        .describe("Camera zone snapshot requested"),
    },
    async ({ visitId, zone }) => {
      const visit = engine.getSessionById(visitId) || (await storage.getVisitById(visitId));
      if (!visit) {
        return {
          content: [{ type: "text", text: `Visit '${visitId}' not found.` }],
        };
      }

      let snaps = visit.snapshots;
      if (zone) {
        snaps = snaps.filter((s) => s.zone === zone);
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                visitId: visit.id,
                snapshots: snaps,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Tool 5: create_gate_rule
  server.tool(
    "create_gate_rule",
    "Establish alert boundaries or dwell thresholds for security monitoring",
    {
      name: z.string().describe("Rule descriptive name"),
      zone: z.enum(["gate", "walkway", "door"]).describe("Camera zone to monitor"),
      maxDwellSeconds: z.number().describe("Max allowed dwell in seconds before alerting"),
      alertOnAbandon: z
        .boolean()
        .optional()
        .default(false)
        .describe("Alert if visitor turns back after entering"),
    },
    async ({ name, zone, maxDwellSeconds, alertOnAbandon }) => {
      const rule: GateRule = {
        id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        name,
        zone: zone as CameraZone,
        maxDwellSeconds,
        alertOnAbandon: alertOnAbandon ?? false,
        enabled: true,
        createdAt: Date.now(),
      };

      await storage.createRule(rule);
      await storage.logAccess({
        id: `log_${Date.now()}`,
        timestamp: Date.now(),
        source: "rule_engine",
        action: "RULE_CREATED",
        details: { ruleId: rule.id, name: rule.name, zone: rule.zone },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                success: true,
                message: `Gate rule '${rule.name}' created successfully.`,
                rule,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  // Tool 6: get_access_log
  server.tool(
    "get_access_log",
    "Audit trail of all camera triggers, webhook deliveries, and correlations",
    {
      limit: z.number().optional().default(20).describe("Max log entries to return"),
      source: z
        .enum(["webhook", "poller", "simulator", "rule_engine"])
        .optional()
        .describe("Filter logs by source"),
    },
    async ({ limit, source }) => {
      const logs = await storage.listAccessLogs({ limit, source });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                count: logs.length,
                logs,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  return server;
}
