/**
 * GateStory Visit Correlation & State Machine Types
 * Topology: gate(0) -> walkway(1) -> door(2)
 * Entity = visit, not identity. No facial recognition, no watchlists.
 */

export type CameraZone = "gate" | "walkway" | "door";

export const ZONE_LEVELS: Record<CameraZone, number> = {
  gate: 0,
  walkway: 1,
  door: 2,
};

export type VisitState =
  | "OPEN"
  | "CONFIRMED"
  | "DWELLING"
  | "REACHED_DOOR"
  | "CLOSED"
  | "ABANDONED"
  | "NOISE";

export type VisitOutcome =
  | "reached_door_completed"
  | "reached_door_dwelling"
  | "turned_back"
  | "loitering"
  | "driveby_noise"
  | "direct_door_visit"
  | "in_progress"
  | "timed_out";

export interface NormalizedEvent {
  id: string;
  deviceId: string;
  zone: CameraZone;
  eventType: "motion" | "ding" | "button_press" | "on_demand" | "livestream" | string;
  timestamp: number; // Unix epoch ms
  durationMs?: number;
  raw?: Record<string, unknown>;
}

export interface CameraHop {
  zone: CameraZone;
  deviceId: string;
  timestamp: number;
  eventType: string;
}

export interface VisitSnapshot {
  id: string;
  zone: CameraZone;
  timestamp: number;
  label: string;
  url: string;
}

export interface VisitSession {
  id: string;
  state: VisitState;
  outcome: VisitOutcome;
  startTime: number;
  endTime: number;
  durationMs: number;
  events: NormalizedEvent[];
  cameraChain: CameraHop[];
  dwellTimeByZone: Record<CameraZone, number>;
  doorbellPressed: boolean;
  story: string;
  novaEnrichedStory?: string;
  snapshots: VisitSnapshot[];
  updatedAt: number;
}

export interface GateRule {
  id: string;
  name: string;
  zone: CameraZone;
  maxDwellSeconds: number;
  alertOnAbandon: boolean;
  enabled: boolean;
  createdAt: number;
}

export interface AccessLogEntry {
  id: string;
  timestamp: number;
  visitId?: string;
  source: "webhook" | "poller" | "simulator" | "rule_engine";
  action: string;
  details: Record<string, unknown>;
}
