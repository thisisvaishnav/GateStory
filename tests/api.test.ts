import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../src/api/server.js";
import { CorrelationEngine } from "../src/engine/correlation.js";
import { createSyntheticWebhook } from "../src/ring/simulator.js";
import { signPayload } from "../src/ring/verifier.js";
import { MemoryRepository } from "../src/storage/memory.js";

describe("GateStory API Endpoints & Webhook Receiver", () => {
  const TEST_HMAC_KEY = "unit_test_hmac_secret_key_123";
  let app: ReturnType<typeof createApp>["app"];
  let engine: CorrelationEngine;
  let storage: MemoryRepository;

  beforeEach(() => {
    engine = new CorrelationEngine();
    storage = new MemoryRepository();
    const result = createApp({
      engine,
      storage,
      hmacKey: TEST_HMAC_KEY,
    });
    app = result.app;
  });

  it("GET /health returns healthy status", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("healthy");
    expect(typeof res.body.uptime).toBe("number");
  });

  it("POST /api/ring/webhook rejects missing X-Signature with 401", async () => {
    const payload = createSyntheticWebhook({
      deviceId: "device-gate-01",
      eventType: "motion",
    });

    const res = await request(app).post("/api/ring/webhook").send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("POST /api/ring/webhook rejects invalid X-Signature with 401", async () => {
    const payload = createSyntheticWebhook({
      deviceId: "device-gate-01",
      eventType: "motion",
    });

    const res = await request(app)
      .post("/api/ring/webhook")
      .set("X-Signature", "sha256=0000000000000000000000000000000000000000000000000000000000000000")
      .send(payload);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Unauthorized");
  });

  it("POST /api/ring/webhook accepts valid HMAC signature and updates correlation engine", async () => {
    const payload = createSyntheticWebhook({
      deviceId: "device-gate-01",
      eventType: "motion",
    });
    const rawBody = JSON.stringify(payload);
    const signature = signPayload(rawBody, TEST_HMAC_KEY);

    const res = await request(app)
      .post("/api/ring/webhook")
      .set("Content-Type", "application/json")
      .set("X-Signature", signature)
      .send(rawBody);

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("success");
    expect(res.body.received).toBe(true);
    expect(res.body.visitId).toBeTruthy();

    // Verify visit was recorded
    const visits = engine.getAllSessions();
    expect(visits.length).toBe(1);
    expect(visits[0].cameraChain[0].zone).toBe("gate");
  });

  it("GET /api/visits returns list of visits", async () => {
    // Seed visit via fixture replay
    await request(app).post("/api/fixtures/replay/01-normal-delivery");

    const res = await request(app).get("/api/visits");
    expect(res.status).toBe(200);
    expect(res.body.count).toBeGreaterThan(0);
    expect(res.body.visits[0].outcome).toBe("reached_door_completed");
  });

  it("GET /api/heatmap returns spatial dwell statistics", async () => {
    await request(app).post("/api/fixtures/replay/01-normal-delivery");

    const res = await request(app).get("/api/heatmap");
    expect(res.status).toBe(200);
    expect(res.body.zoneCounts.gate).toBeGreaterThan(0);
    expect(res.body.zoneCounts.walkway).toBeGreaterThan(0);
    expect(res.body.zoneCounts.door).toBeGreaterThan(0);
  });

  it("GET /api/fixtures returns all 12 scenarios", async () => {
    const res = await request(app).get("/api/fixtures");
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(12);
  });

  it("GET /api/snapshots/:id/:zone returns valid SVG image", async () => {
    const replayRes = await request(app).post("/api/fixtures/replay/01-normal-delivery");
    const visitId = replayRes.body.latestSession.id;

    const res = await request(app).get(`/api/snapshots/${visitId}/door`);
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    const text =
      res.text || (Buffer.isBuffer(res.body) ? res.body.toString("utf8") : String(res.body || ""));
    expect(text).toContain("<svg");
    expect(text).toContain("DOOR CAMERA FEED");
  });
});
