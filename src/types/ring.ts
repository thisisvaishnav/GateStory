/**
 * Ring API & Webhook Type Definitions
 */

export type RingEventType = "motion" | "ding" | "button_press" | "on_demand" | "livestream";

export interface RingWebhookPayload {
  meta?: {
    request_id?: string;
    timestamp?: number | string;
    version?: string;
  };
  data?: {
    type?: string;
    id: string;
    attributes?: {
      event_type?: RingEventType | string;
      device_id?: string;
      location_id?: string;
      created_at?: string | number;
      kind?: string;
      state?: string;
      start?: number;
      end?: number;
      [key: string]: unknown;
    };
    relationships?: Record<string, unknown>;
  };
  // Flat format supported for local simulators & alternate payload formats
  action?: string;
  event_type?: RingEventType | string;
  device_id?: string;
  timestamp?: number | string;
  id?: string;
}

export interface RingHistoryEventAttributes {
  event_type: RingEventType | string;
  start: number;
  end: number;
  is_third_party_reviewed?: boolean;
  [key: string]: unknown;
}

export interface RingHistoryEvent {
  type: string;
  id: string;
  attributes: RingHistoryEventAttributes;
  relationships?: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface RingHistoryResponse {
  data: RingHistoryEvent[];
  meta?: {
    pagination?: {
      next_page_key?: string;
    };
  };
}

export interface RingPollerStatus {
  lastPollTimestamp: number | null;
  lastSuccessTimestamp: number | null;
  lastHttpStatus: number | null;
  lastEventCount: number;
  deviceId: string;
  pollingActive: boolean;
  error?: string | null;
}
