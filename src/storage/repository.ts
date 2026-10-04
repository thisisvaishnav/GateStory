import type { AccessLogEntry, GateRule, VisitSession } from "../types/visit.js";

export interface StorageRepository {
  // Visits
  saveVisit(visit: VisitSession): Promise<void>;
  getVisitById(id: string): Promise<VisitSession | null>;
  listVisits(options?: { outcome?: string; limit?: number }): Promise<VisitSession[]>;

  // Rules
  createRule(rule: GateRule): Promise<void>;
  listRules(): Promise<GateRule[]>;

  // Access Logs
  logAccess(entry: AccessLogEntry): Promise<void>;
  listAccessLogs(options?: { limit?: number; source?: string }): Promise<AccessLogEntry[]>;
}
