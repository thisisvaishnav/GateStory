import https from "node:https";
import type { RingHistoryResponse, RingPollerStatus } from "../types/ring.js";
import type { CameraZone, NormalizedEvent } from "../types/visit.js";

export interface RingPollerOptions {
  token: string;
  deviceId: string;
  pollIntervalMs?: number;
  baseUrl?: string;
  zone?: CameraZone;
  onNewEvents?: (events: NormalizedEvent[]) => void;
  logger?: (msg: string) => void;
}

export class RingHistoryPoller {
  private token: string;
  private deviceId: string;
  private baseUrl: string;
  private pollIntervalMs: number;
  private zone: CameraZone;
  private onNewEvents?: (events: NormalizedEvent[]) => void;
  private logger: (msg: string) => void;

  private pollTimer: NodeJS.Timeout | null = null;
  private seenEventIds = new Set<string>();
  private status: RingPollerStatus;

  constructor(options: RingPollerOptions) {
    this.token = options.token;
    this.deviceId = options.deviceId;
    this.baseUrl = options.baseUrl || "https://api.amazonvision.com";
    this.pollIntervalMs = options.pollIntervalMs || 10000;
    this.zone = options.zone || "door";
    this.onNewEvents = options.onNewEvents;
    this.logger = options.logger || console.log;

    this.status = {
      lastPollTimestamp: null,
      lastSuccessTimestamp: null,
      lastHttpStatus: null,
      lastEventCount: 0,
      deviceId: this.deviceId,
      pollingActive: false,
      error: null,
    };
  }

  public updateCredentials(token: string, deviceId: string): void {
    this.token = token;
    this.deviceId = deviceId;
    this.status.deviceId = deviceId;
  }

  public getStatus(): RingPollerStatus {
    return { ...this.status };
  }

  public start(): void {
    if (this.pollTimer || this.status.pollingActive) return;
    this.status.pollingActive = true;
    this.logger(
      `[ring] Starting Event History poller for device ${this.deviceId} every ${this.pollIntervalMs}ms`,
    );

    // Immediate initial poll
    this.pollOnce().catch((err) => {
      this.logger(`[ring] Initial poll error: ${err.message}`);
    });

    this.pollTimer = setInterval(() => {
      this.pollOnce().catch((err) => {
        this.logger(`[ring] Polling loop error: ${err.message}`);
      });
    }, this.pollIntervalMs);
  }

  public stop(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
    this.status.pollingActive = false;
    this.logger(`[ring] Stopped Event History poller for device ${this.deviceId}`);
  }

  /**
   * Performs a single GET request to /v1/history/devices/{id}/events
   * Note (F1): Ring Event History API does not take start/end query parameters.
   * We poll page 1, dedupe by id, and filter client-side.
   */
  public async pollOnce(sinceTimestamp?: number): Promise<NormalizedEvent[]> {
    this.status.lastPollTimestamp = Date.now();
    if (!this.token || !this.deviceId) {
      this.status.error = "Missing Ring token or deviceId";
      return [];
    }

    const path = `/v1/history/devices/${encodeURIComponent(this.deviceId)}/events`;
    const fullUrl = `${this.baseUrl}${path}`;

    return new Promise<NormalizedEvent[]>((resolve, reject) => {
      const urlObj = new URL(fullUrl);
      const req = https.get(
        {
          protocol: urlObj.protocol,
          hostname: urlObj.hostname,
          port: urlObj.port || (urlObj.protocol === "https:" ? 443 : 80),
          path: `${urlObj.pathname}${urlObj.search}`,
          headers: {
            Authorization: `Bearer ${this.token}`,
            Accept: "application/json",
            "User-Agent": "GateStory/1.0.0 (Amazon-Hackathon-2026)",
          },
        },
        (res) => {
          this.status.lastHttpStatus = res.statusCode || null;
          let body = "";
          res.on("data", (chunk) => {
            body += chunk;
          });
          res.on("end", () => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
              try {
                const responseData = JSON.parse(body) as RingHistoryResponse;
                const rawEvents = responseData.data || [];
                this.status.lastSuccessTimestamp = Date.now();
                this.status.lastEventCount = rawEvents.length;
                this.status.error = null;

                // Stage-1 Runtime Proof exact log format
                this.logger(
                  `[ring] GET /v1/history/devices/${this.deviceId}/events 200 (${rawEvents.length} events)`,
                );

                const newEvents: NormalizedEvent[] = [];
                for (const item of rawEvents) {
                  const eventId = item.id;
                  const startMs = item.attributes?.start || Date.now();

                  // Filter by timestamp if specified
                  if (sinceTimestamp && startMs < sinceTimestamp) {
                    continue;
                  }

                  // Deduplicate against seen IDs
                  if (!this.seenEventIds.has(eventId)) {
                    this.seenEventIds.add(eventId);

                    const normalized: NormalizedEvent = {
                      id: eventId,
                      deviceId: this.deviceId,
                      zone: this.zone,
                      eventType: item.attributes?.event_type || "motion",
                      timestamp: startMs,
                      durationMs: item.attributes?.end ? item.attributes.end - startMs : 0,
                      raw: item as unknown as Record<string, unknown>,
                    };
                    newEvents.push(normalized);
                  }
                }

                if (newEvents.length > 0 && this.onNewEvents) {
                  this.onNewEvents(newEvents);
                }

                resolve(newEvents);
              } catch (parseErr) {
                this.status.error = `JSON parse error: ${(parseErr as Error).message}`;
                reject(parseErr);
              }
            } else {
              this.status.error = `HTTP ${res.statusCode}: ${body.slice(0, 100)}`;
              this.logger(
                `[ring] GET /v1/history/... returned ${res.statusCode}: ${body.slice(0, 100)}`,
              );
              resolve([]);
            }
          });
        },
      );

      req.on("error", (err) => {
        this.status.error = err.message;
        reject(err);
      });

      req.setTimeout(5000, () => {
        req.destroy(new Error("Ring API poll timeout after 5000ms"));
      });
    });
  }
}
