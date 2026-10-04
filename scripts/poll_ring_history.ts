/**
 * GateStory — Outbound Ring Event History Poller
 *
 * Demonstrates the Stage-1 "Ring API called at runtime" outbound proof.
 * Uses Ring's documented "API polling alternative":
 * GET /v1/history/devices/{id}/events
 *
 * Reference: https://developer.amazon.com/docs/ring/api-documentation.html#api-polling-alternative
 */

import { config } from "../src/config/env.js";
import { RingHistoryPoller } from "../src/ring/poller.js";

async function main() {
  console.log("🚪 GateStory — Outbound Ring API Poller Proof");
  console.log("Reference: Ring Developer Docs -> Event History (#api-polling-alternative)\n");

  if (!config.RING_PLAYGROUND_TOKEN || !config.RING_DEVICE_ID) {
    console.error("[error] RING_PLAYGROUND_TOKEN or RING_DEVICE_ID is missing in .env");
    console.error("To get a 30-min playground token:");
    console.error("1. Go to developer.amazon.com/ring/console/apps");
    console.error("2. Open Private Apps -> Select your app -> Generate Playground Token");
    process.exit(1);
  }

  const poller = new RingHistoryPoller({
    token: config.RING_PLAYGROUND_TOKEN,
    deviceId: config.RING_DEVICE_ID,
    logger: console.log,
  });

  console.log(`[ring] Querying Ring Event History for device: ${config.RING_DEVICE_ID}`);
  try {
    const events = await poller.pollOnce();
    console.log(
      `\n[proof] Polling successful! Received ${events.length} events from api.amazonvision.com`,
    );

    events.forEach((evt, idx) => {
      console.log(`\n--- Event ${idx + 1} ---`);
      console.log(`ID:        ${evt.id}`);
      console.log(`Type:      ${evt.eventType}`);
      console.log(`Zone:      ${evt.zone}`);
      console.log(`Timestamp: ${new Date(evt.timestamp).toISOString()} (${evt.timestamp})`);
      console.log(`Duration:  ${evt.durationMs}ms`);
    });

    console.log("\n[status] Poller status metrics:");
    console.log(JSON.stringify(poller.getStatus(), null, 2));
  } catch (err) {
    console.error("[error] Outbound poll failed:", (err as Error).message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("[fatal] Script failure:", err);
  process.exit(1);
});
