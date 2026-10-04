import { type Request, type Response, Router } from "express";
import type { CorrelationEngine } from "../../engine/correlation.js";
import type { RingHistoryPoller } from "../../ring/poller.js";
import { normalizeWebhookPayload } from "../../ring/simulator.js";
import { verifyRingSignature } from "../../ring/verifier.js";
import type { StorageRepository } from "../../storage/repository.js";

export function createRingRouter(params: {
  engine: CorrelationEngine;
  storage: StorageRepository;
  poller: RingHistoryPoller;
  hmacKey: string;
}): Router {
  const router = Router();
  const { engine, storage, poller, hmacKey } = params;

  /**
   * Ring Webhook Receiver
   * Strict spec: Verify HMAC first, parse second!
   * F2 trap avoided: Uses HMAC-SHA256 with RING_HMAC_KEY, NOT a bearer token!
   */
  router.post("/webhook", async (req: Request, res: Response) => {
    const rawBody =
      (req as unknown as { rawBody?: Buffer }).rawBody || Buffer.from(JSON.stringify(req.body));
    const signature = req.headers["x-signature"] as string | undefined;

    // 1. Verify First
    const verifyResult = verifyRingSignature(rawBody, signature, hmacKey);
    if (!verifyResult.valid) {
      console.warn(`[ring:webhook] Verification failed: ${verifyResult.reason}`);
      res.status(401).json({
        error: "Unauthorized",
        message: verifyResult.reason,
      });
      return;
    }

    console.log("[ring:webhook] X-Signature verified successfully (HMAC-SHA256 match)");

    // 2. Parse Second
    try {
      const payload =
        typeof req.body === "object" && req.body !== null
          ? req.body
          : JSON.parse(rawBody.toString("utf8"));
      const normalizedEvent = normalizeWebhookPayload(payload);

      // Ingest into Correlation Engine
      const { session, isNewSession, isDuplicate } = engine.ingest(normalizedEvent);
      await storage.saveVisit(session);

      await storage.logAccess({
        id: `log_wh_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        timestamp: Date.now(),
        visitId: session.id,
        source: "webhook",
        action: "WEBHOOK_EVENT_INGESTED",
        details: {
          eventId: normalizedEvent.id,
          zone: normalizedEvent.zone,
          isDuplicate,
          isNewSession,
        },
      });

      // Ring requires 200 within 5 seconds
      res.status(200).json({
        status: "success",
        received: true,
        isDuplicate,
        visitId: session.id,
        state: session.state,
      });
    } catch (err) {
      console.error("[ring:webhook] Error processing payload:", err);
      res.status(400).json({
        error: "Bad Request",
        message: (err as Error).message,
      });
    }
  });

  /**
   * Trigger outbound Ring Event History poll
   */
  router.post("/poll", async (_req: Request, res: Response) => {
    try {
      const newEvents = await poller.pollOnce();
      for (const evt of newEvents) {
        const { session } = engine.ingest(evt);
        await storage.saveVisit(session);
      }

      await storage.logAccess({
        id: `log_poll_${Date.now()}`,
        timestamp: Date.now(),
        source: "poller",
        action: "MANUAL_POLL_COMPLETED",
        details: { newEventsCount: newEvents.length },
      });

      res.status(200).json({
        status: "success",
        polledCount: newEvents.length,
        events: newEvents,
      });
    } catch (err) {
      console.error("[ring:poll] Polling error:", err);
      res.status(500).json({
        error: "Polling failed",
        message: (err as Error).message,
      });
    }
  });

  /**
   * Get poller status and connectivity metrics
   */
  router.get("/status", (_req: Request, res: Response) => {
    res.status(200).json(poller.getStatus());
  });

  return router;
}
