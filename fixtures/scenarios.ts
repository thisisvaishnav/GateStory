import type {
  NormalizedEvent,
  VisitOutcome,
  VisitSession,
  VisitState,
} from "../src/types/visit.js";

export interface FixtureScenario {
  id: string;
  name: string;
  description: string;
  events: NormalizedEvent[];
  expectedSessionCount: number;
  expectedState: VisitState;
  expectedOutcome: VisitOutcome;
  validate?: (sessions: VisitSession[]) => void;
}

const BASE_TIME = 1791100000000; // Reference timestamp

export const FIXTURE_SCENARIOS: FixtureScenario[] = [
  // 1. Normal Delivery Visitor: Gate -> Walkway -> Door (ding) -> Walkway -> Gate -> Closed
  {
    id: "01-normal-delivery",
    name: "Normal Package Delivery Flow",
    description: "Visitor enters gate, walks walkway, rings doorbell, and departs via walkway",
    events: [
      {
        id: "evt-01-gate",
        deviceId: "device-gate-01",
        zone: "gate",
        eventType: "motion",
        timestamp: BASE_TIME,
        durationMs: 8000,
      },
      {
        id: "evt-01-walkway-in",
        deviceId: "device-walkway-01",
        zone: "walkway",
        eventType: "motion",
        timestamp: BASE_TIME + 15000,
        durationMs: 12000,
      },
      {
        id: "evt-01-door-ding",
        deviceId: "device-door-01",
        zone: "door",
        eventType: "ding",
        timestamp: BASE_TIME + 35000,
        durationMs: 5000,
      },
      {
        id: "evt-01-walkway-out",
        deviceId: "device-walkway-01",
        zone: "walkway",
        eventType: "motion",
        timestamp: BASE_TIME + 55000,
        durationMs: 10000,
      },
    ],
    expectedSessionCount: 1,
    expectedState: "CLOSED",
    expectedOutcome: "reached_door_completed",
    validate: (sessions) => {
      if (!sessions[0].doorbellPressed) throw new Error("Expected doorbellPressed to be true");
      if (!sessions[0].story.includes("Front Gate"))
        throw new Error("Expected story to mention Front Gate");
    },
  },

  // 2. Drive-by / Noise at Gate
  {
    id: "02-gate-noise-driveby",
    name: "Perimeter Noise / Drive-by",
    description: "Isolated transient motion at gate with zero subsequent progression",
    events: [
      {
        id: "evt-02-gate-noise",
        deviceId: "device-gate-01",
        zone: "gate",
        eventType: "motion",
        timestamp: BASE_TIME,
        durationMs: 4000,
      },
    ],
    expectedSessionCount: 1,
    expectedState: "NOISE",
    expectedOutcome: "driveby_noise",
    validate: (sessions) => {
      if (sessions[0].cameraChain.length !== 1) throw new Error("Expected 1 hop only");
    },
  },

  // 3. Lingering / Loitering at Gate
  {
    id: "03-gate-loitering",
    name: "Loitering at Front Gate",
    description: "Repeated motion at gate over 45s, never advancing to walkway",
    events: [
      {
        id: "evt-03-gate-1",
        deviceId: "device-gate-01",
        zone: "gate",
        eventType: "motion",
        timestamp: BASE_TIME,
        durationMs: 15000,
      },
      {
        id: "evt-03-gate-2",
        deviceId: "device-gate-01",
        zone: "gate",
        eventType: "motion",
        timestamp: BASE_TIME + 25000,
        durationMs: 20000,
      },
    ],
    expectedSessionCount: 1,
    expectedState: "DWELLING",
    expectedOutcome: "loitering",
    validate: (sessions) => {
      if (sessions[0].dwellTimeByZone.gate < 25000) throw new Error("Expected gate dwell >= 25s");
    },
  },

  // 4. Walkway Turnback
  {
    id: "04-walkway-turnback",
    name: "Walkway Approach Turnback",
    description: "Visitor enters gate, walks partway on walkway, then returns back to gate",
    events: [
      {
        id: "evt-04-gate-1",
        deviceId: "device-gate-01",
        zone: "gate",
        eventType: "motion",
        timestamp: BASE_TIME,
        durationMs: 6000,
      },
      {
        id: "evt-04-walkway",
        deviceId: "device-walkway-01",
        zone: "walkway",
        eventType: "motion",
        timestamp: BASE_TIME + 12000,
        durationMs: 8000,
      },
      {
        id: "evt-04-gate-2",
        deviceId: "device-gate-01",
        zone: "gate",
        eventType: "motion",
        timestamp: BASE_TIME + 25000,
        durationMs: 5000,
      },
    ],
    expectedSessionCount: 1,
    expectedState: "ABANDONED",
    expectedOutcome: "turned_back",
  },

  // 5. Direct Door Approach (missed gate sensor or side entrance)
  {
    id: "05-direct-door-approach",
    name: "Direct Front Door Approach",
    description: "Activity begins directly at the door camera without gate trigger",
    events: [
      {
        id: "evt-05-door",
        deviceId: "device-door-01",
        zone: "door",
        eventType: "motion",
        timestamp: BASE_TIME,
        durationMs: 10000,
      },
    ],
    expectedSessionCount: 1,
    expectedState: "CONFIRMED",
    expectedOutcome: "direct_door_visit",
  },

  // 6. Rapid Courier Run
  {
    id: "06-rapid-courier-run",
    name: "Rapid Courier Delivery",
    description: "High-speed progression from gate to door to exit in under 20 seconds",
    events: [
      {
        id: "evt-06-gate-in",
        deviceId: "device-gate-01",
        zone: "gate",
        eventType: "motion",
        timestamp: BASE_TIME,
        durationMs: 3000,
      },
      {
        id: "evt-06-walkway-in",
        deviceId: "device-walkway-01",
        zone: "walkway",
        eventType: "motion",
        timestamp: BASE_TIME + 5000,
        durationMs: 4000,
      },
      {
        id: "evt-06-door",
        deviceId: "device-door-01",
        zone: "door",
        eventType: "motion",
        timestamp: BASE_TIME + 10000,
        durationMs: 3000,
      },
      {
        id: "evt-06-gate-out",
        deviceId: "device-gate-01",
        zone: "gate",
        eventType: "motion",
        timestamp: BASE_TIME + 16000,
        durationMs: 2000,
      },
    ],
    expectedSessionCount: 1,
    expectedState: "CLOSED",
    expectedOutcome: "reached_door_completed",
  },

  // 7. Multi-Visitor Session Split
  {
    id: "07-multi-visitor-split",
    name: "Multi-Visitor Temporal Split",
    description:
      "Visitor A arrives at t=0, departs; Visitor B arrives at t=150s (> 90s W_GAP) creating 2 sessions",
    events: [
      {
        id: "evt-07-a-gate",
        deviceId: "device-gate-01",
        zone: "gate",
        eventType: "motion",
        timestamp: BASE_TIME,
        durationMs: 5000,
      },
      {
        id: "evt-07-a-door",
        deviceId: "device-door-01",
        zone: "door",
        eventType: "ding",
        timestamp: BASE_TIME + 20000,
        durationMs: 5000,
      },
      // Gap of 180s > 90s
      {
        id: "evt-07-b-gate",
        deviceId: "device-gate-01",
        zone: "gate",
        eventType: "motion",
        timestamp: BASE_TIME + 200000,
        durationMs: 5000,
      },
      {
        id: "evt-07-b-walkway",
        deviceId: "device-walkway-01",
        zone: "walkway",
        eventType: "motion",
        timestamp: BASE_TIME + 215000,
        durationMs: 6000,
      },
    ],
    expectedSessionCount: 2,
    expectedState: "CONFIRMED", // state of the latest session
    expectedOutcome: "in_progress", // outcome of the latest session
    validate: (sessions) => {
      if (sessions.length !== 2) throw new Error(`Expected 2 sessions, got ${sessions.length}`);
      const olderSession = sessions[1];
      if (olderSession.outcome !== "reached_door_completed") {
        throw new Error(
          `Expected older session to be reached_door_completed, got ${olderSession.outcome}`,
        );
      }
    },
  },

  // 8. Out-of-Order Events Arrival
  {
    id: "08-out-of-order-arrival",
    name: "Out-of-Order Event Arrival Handling",
    description: "Door event at t=30s arrives before walkway event at t=15s due to network jitter",
    events: [
      {
        id: "evt-08-gate",
        deviceId: "device-gate-01",
        zone: "gate",
        eventType: "motion",
        timestamp: BASE_TIME,
        durationMs: 5000,
      },
      {
        id: "evt-08-door",
        deviceId: "device-door-01",
        zone: "door",
        eventType: "ding",
        timestamp: BASE_TIME + 30000,
        durationMs: 5000,
      },
      {
        id: "evt-08-walkway-jitter",
        deviceId: "device-walkway-01",
        zone: "walkway",
        eventType: "motion",
        timestamp: BASE_TIME + 15000, // Arrives late but occurred earlier!
        durationMs: 8000,
      },
    ],
    expectedSessionCount: 1,
    expectedState: "REACHED_DOOR",
    expectedOutcome: "reached_door_dwelling",
    validate: (sessions) => {
      const hops = sessions[0].cameraChain;
      if (hops[0].zone !== "gate" || hops[1].zone !== "walkway" || hops[2].zone !== "door") {
        throw new Error(
          `Expected sorted order gate->walkway->door, got ${hops.map((h) => h.zone).join("->")}`,
        );
      }
    },
  },

  // 9. Repeated Doorbell Pressing
  {
    id: "09-repeated-doorbell-press",
    name: "Repeated Doorbell Press Chimes",
    description: "Visitor reaches door and rings chime multiple times without duplicate visits",
    events: [
      {
        id: "evt-09-gate",
        deviceId: "device-gate-01",
        zone: "gate",
        eventType: "motion",
        timestamp: BASE_TIME,
        durationMs: 5000,
      },
      {
        id: "evt-09-door-ding1",
        deviceId: "device-door-01",
        zone: "door",
        eventType: "ding",
        timestamp: BASE_TIME + 25000,
        durationMs: 3000,
      },
      {
        id: "evt-09-door-ding2",
        deviceId: "device-door-01",
        zone: "door",
        eventType: "ding",
        timestamp: BASE_TIME + 45000,
        durationMs: 3000,
      },
    ],
    expectedSessionCount: 1,
    expectedState: "REACHED_DOOR",
    expectedOutcome: "reached_door_dwelling",
    validate: (sessions) => {
      if (!sessions[0].doorbellPressed) throw new Error("Expected doorbellPressed to be true");
      if (sessions[0].events.length !== 3) throw new Error("Expected all 3 events recorded");
    },
  },

  // 10. Long Dwell Conversation at Door
  {
    id: "10-long-dwell-conversation",
    name: "Long Dwell Conversation at Door",
    description: "Visitor reaches door and stays 5 minutes (< 8 min DOOR_CLOSE_WINDOW)",
    events: [
      {
        id: "evt-10-gate",
        deviceId: "device-gate-01",
        zone: "gate",
        eventType: "motion",
        timestamp: BASE_TIME,
        durationMs: 5000,
      },
      {
        id: "evt-10-door-start",
        deviceId: "device-door-01",
        zone: "door",
        eventType: "motion",
        timestamp: BASE_TIME + 20000,
        durationMs: 30000,
      },
      {
        id: "evt-10-door-active",
        deviceId: "device-door-01",
        zone: "door",
        eventType: "motion",
        timestamp: BASE_TIME + 250000, // 4 mins later
        durationMs: 30000,
      },
    ],
    expectedSessionCount: 1,
    expectedState: "DWELLING",
    expectedOutcome: "reached_door_dwelling",
    validate: (sessions) => {
      if (sessions[0].durationMs < 200000) throw new Error("Expected duration > 200s");
    },
  },

  // 11. Door Close Window Expiry (Timeout)
  {
    id: "11-door-window-timeout",
    name: "Door Window Timeout Auto-Split",
    description:
      "New event arrives 10 minutes later (> 8 min window), forcing completion of old visit",
    events: [
      {
        id: "evt-11-visit1-gate",
        deviceId: "device-gate-01",
        zone: "gate",
        eventType: "motion",
        timestamp: BASE_TIME,
        durationMs: 5000,
      },
      {
        id: "evt-11-visit1-door",
        deviceId: "device-door-01",
        zone: "door",
        eventType: "ding",
        timestamp: BASE_TIME + 20000,
        durationMs: 5000,
      },
      // 10 minutes later = 600_000ms
      {
        id: "evt-11-visit2-gate",
        deviceId: "device-gate-01",
        zone: "gate",
        eventType: "motion",
        timestamp: BASE_TIME + 650000,
        durationMs: 5000,
      },
      {
        id: "evt-11-visit2-walkway",
        deviceId: "device-walkway-01",
        zone: "walkway",
        eventType: "motion",
        timestamp: BASE_TIME + 665000,
        durationMs: 8000,
      },
    ],
    expectedSessionCount: 2,
    expectedState: "CONFIRMED", // latest session
    expectedOutcome: "in_progress", // latest session
    validate: (sessions) => {
      if (sessions[1].state !== "CLOSED")
        throw new Error(`Expected previous session to be CLOSED, got ${sessions[1].state}`);
    },
  },

  // 12. Duplicate Webhook Replay Idempotency
  {
    id: "12-duplicate-webhook-replay",
    name: "Duplicate Event Replay Idempotency",
    description:
      "Same event ID delivered twice by network/webhook replay without duplicating state",
    events: [
      {
        id: "evt-12-unique-gate",
        deviceId: "device-gate-01",
        zone: "gate",
        eventType: "motion",
        timestamp: BASE_TIME,
        durationMs: 5000,
      },
      {
        id: "evt-12-unique-gate", // EXACT SAME ID
        deviceId: "device-gate-01",
        zone: "gate",
        eventType: "motion",
        timestamp: BASE_TIME,
        durationMs: 5000,
      },
    ],
    expectedSessionCount: 1,
    expectedState: "NOISE",
    expectedOutcome: "driveby_noise",
    validate: (sessions) => {
      if (sessions[0].events.length !== 1) {
        throw new Error(
          `Expected duplicate to be ignored (1 event), found ${sessions[0].events.length}`,
        );
      }
    },
  },
];
