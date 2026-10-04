/**
 * Model Context Protocol (MCP) Tool Definitions for GateStory
 */

export interface GetVisitTimelineInput {
  visitId: string;
}

export interface GetVisitStoryInput {
  visitId: string;
  enriched?: boolean;
}

export interface SearchVisitorsInput {
  outcome?: string;
  minDwellSeconds?: number;
  maxDwellSeconds?: number;
  reachedDoor?: boolean;
  limit?: number;
}

export interface GetSnapshotInput {
  visitId: string;
  zone?: "gate" | "walkway" | "door";
}

export interface CreateGateRuleInput {
  name: string;
  zone: "gate" | "walkway" | "door";
  maxDwellSeconds: number;
  alertOnAbandon?: boolean;
}

export interface GetAccessLogInput {
  limit?: number;
  source?: "webhook" | "poller" | "simulator" | "rule_engine";
}
