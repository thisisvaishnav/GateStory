import type { AccessLogEntry, GateRule, VisitSession } from "../types/visit.js";
import type { StorageRepository } from "./repository.js";

export class MemoryRepository implements StorageRepository {
  private visits = new Map<string, VisitSession>();
  private rules = new Map<string, GateRule>();
  private accessLogs: AccessLogEntry[] = [];

  constructor() {
    // Seed standard rules
    const defaultRule: GateRule = {
      id: "rule_default_dwell",
      name: "Walkway Lingering Alert",
      zone: "walkway",
      maxDwellSeconds: 45,
      alertOnAbandon: true,
      enabled: true,
      createdAt: Date.now(),
    };
    this.rules.set(defaultRule.id, defaultRule);
  }

  public async saveVisit(visit: VisitSession): Promise<void> {
    this.visits.set(visit.id, { ...visit });
  }

  public async getVisitById(id: string): Promise<VisitSession | null> {
    const found = this.visits.get(id);
    return found ? { ...found } : null;
  }

  public async listVisits(options?: { outcome?: string; limit?: number }): Promise<VisitSession[]> {
    let list = Array.from(this.visits.values()).sort((a, b) => b.startTime - a.startTime);
    if (options?.outcome) {
      list = list.filter((v) => v.outcome === options.outcome);
    }
    if (options?.limit) {
      list = list.slice(0, options.limit);
    }
    return list;
  }

  public async createRule(rule: GateRule): Promise<void> {
    this.rules.set(rule.id, { ...rule });
  }

  public async listRules(): Promise<GateRule[]> {
    return Array.from(this.rules.values());
  }

  public async logAccess(entry: AccessLogEntry): Promise<void> {
    this.accessLogs.unshift({ ...entry });
    if (this.accessLogs.length > 500) {
      this.accessLogs.pop();
    }
  }

  public async listAccessLogs(options?: {
    limit?: number;
    source?: string;
  }): Promise<AccessLogEntry[]> {
    let list = [...this.accessLogs];
    if (options?.source) {
      list = list.filter((l) => l.source === options.source);
    }
    if (options?.limit) {
      list = list.slice(0, options.limit);
    }
    return list;
  }
}
