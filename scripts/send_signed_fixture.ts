/**
 * GateStory — Signed Fixture Replay Utility
 *
 * Notice: This script signs a fixture scenario with the app's real HMAC key
 * and POSTs it to the real deployed webhook receiver endpoint.
 *
 * Docstring: "local fixture replay — NOT a Ring delivery."
 */

import { config } from "../src/config/env.js";
import { createSyntheticWebhook } from "../src/ring/simulator.js";
import { signPayload } from "../src/ring/verifier.js";

async function main() {
  const targetUrl = process.env.WEBHOOK_URL || `http://localhost:${config.PORT}/api/ring/webhook`;
  const hmacKey = config.RING_HMAC_KEY;

  if (!hmacKey) {
    console.error("[error] RING_HMAC_KEY is missing in .env");
    process.exit(1);
  }

  console.log(`[replay] Target URL: ${targetUrl}`);
  console.log(`[replay] Signing with configured RING_HMAC_KEY (${hmacKey.length} chars)`);
  console.log("--- local fixture replay — NOT a Ring delivery. ---");

  // Multi-step delivery walk simulation
  const hops: Array<{ deviceId: string; eventType: "motion" | "ding" }> = [
    { deviceId: "device-gate-01", eventType: "motion" },
    { deviceId: "device-walkway-01", eventType: "motion" },
    { deviceId: "device-door-01", eventType: "ding" },
    { deviceId: "device-walkway-01", eventType: "motion" },
  ];

  for (let i = 0; i < hops.length; i++) {
    const hop = hops[i];
    const payload = createSyntheticWebhook({
      deviceId: hop.deviceId,
      eventType: hop.eventType,
      timestamp: Date.now() + i * 2000,
    });

    const rawBody = JSON.stringify(payload);
    const signature = signPayload(rawBody, hmacKey);

    console.log(
      `\n[replay] Sending hop ${i + 1}/${hops.length}: ${hop.deviceId} (${hop.eventType})...`,
    );
    console.log(`[replay] X-Signature: ${signature.slice(0, 20)}...`);

    const res = await fetch(targetUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Signature": signature,
        "User-Agent": "GateStory-FixtureReplayer/1.0",
      },
      body: rawBody,
    });

    const resBody = await res.text();
    console.log(`[replay] Response HTTP ${res.status}: ${resBody}`);

    if (i < hops.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
  }

  console.log("\n[replay] Completed sending signed fixture sequence!");
}

main().catch((err) => {
  console.error("[fatal] Script error:", err);
  process.exit(1);
});
