import type { RingWebhookPayload } from "../types/ring.js";
import type { CameraZone, NormalizedEvent } from "../types/visit.js";

export interface DeviceZoneMap {
  [deviceId: string]: CameraZone;
}

export const DEFAULT_DEVICE_MAP: DeviceZoneMap = {
  "device-gate-01": "gate",
  "device-walkway-01": "walkway",
  "device-door-01": "door",
};

/**
 * Normalizes an incoming Ring webhook payload into a GateStory NormalizedEvent.
 * Supports standard Ring webhook JSON, nested attributes, and flat test formats.
 */
export function normalizeWebhookPayload(
  payload: RingWebhookPayload,
  deviceMap: DeviceZoneMap = DEFAULT_DEVICE_MAP,
): NormalizedEvent {
  const data = payload.data;
  const attributes = data?.attributes;

  const rawDeviceId = attributes?.device_id || payload.device_id || "device-door-01";
  const rawEventType = attributes?.event_type || payload.event_type || payload.action || "motion";

  // Determine event ID
  const eventId =
    data?.id ||
    payload.id ||
    payload.meta?.request_id ||
    `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // Determine timestamp
  let timestamp = Date.now();
  if (attributes?.start) {
    timestamp = attributes.start;
  } else if (attributes?.created_at) {
    timestamp =
      typeof attributes.created_at === "number"
        ? attributes.created_at
        : new Date(attributes.created_at).getTime();
  } else if (payload.timestamp) {
    timestamp =
      typeof payload.timestamp === "number"
        ? payload.timestamp
        : new Date(payload.timestamp).getTime();
  }

  // Determine zone from deviceId or explicit hint
  let zone: CameraZone = deviceMap[rawDeviceId] || "door";
  const lowerDev = rawDeviceId.toLowerCase();
  if (lowerDev.includes("gate")) {
    zone = "gate";
  } else if (lowerDev.includes("walkway") || lowerDev.includes("path")) {
    zone = "walkway";
  } else if (lowerDev.includes("door") || lowerDev.includes("porch")) {
    zone = "door";
  }

  return {
    id: eventId,
    deviceId: rawDeviceId,
    zone,
    eventType: rawEventType,
    timestamp,
    durationMs: attributes?.end && attributes.start ? attributes.end - attributes.start : 0,
    raw: payload as unknown as Record<string, unknown>,
  };
}

/**
 * Creates a synthetic Ring webhook payload for tests and simulation.
 */
export function createSyntheticWebhook(params: {
  id?: string;
  deviceId: string;
  eventType: "motion" | "ding" | "button_press" | "on_demand";
  timestamp?: number;
  locationId?: string;
}): RingWebhookPayload {
  const ts = params.timestamp || Date.now();
  const eventId = params.id || `ring_evt_${ts}_${Math.random().toString(36).slice(2, 6)}`;
  return {
    meta: {
      request_id: `req_${Math.random().toString(36).slice(2, 10)}`,
      timestamp: ts,
      version: "1.0",
    },
    data: {
      type: "event",
      id: eventId,
      attributes: {
        event_type: params.eventType,
        device_id: params.deviceId,
        location_id: params.locationId || "loc_front_residence_01",
        created_at: new Date(ts).toISOString(),
        start: ts,
        end: ts + 15000,
      },
    },
  };
}
