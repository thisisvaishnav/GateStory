import { type Request, type Response, Router } from "express";
import type { CorrelationEngine } from "../../engine/correlation.js";
import type { StorageRepository } from "../../storage/repository.js";

export function createVisitsRouter(engine: CorrelationEngine, _storage: StorageRepository): Router {
  const router = Router();

  /**
   * List all visits
   */
  router.get("/", (req: Request, res: Response) => {
    const outcome = req.query.outcome as string | undefined;
    const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : undefined;

    let visits = engine.getAllSessions();
    if (outcome) {
      visits = visits.filter((v) => v.outcome === outcome);
    }
    if (limit) {
      visits = visits.slice(0, limit);
    }

    res.status(200).json({
      count: visits.length,
      visits,
    });
  });

  /**
   * Get single visit by ID
   */
  router.get("/:id", (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const visit = engine.getSessionById(id);
    if (!visit) {
      res.status(404).json({ error: `Visit '${id}' not found` });
      return;
    }
    res.status(200).json(visit);
  });

  /**
   * Get visit timeline
   */
  router.get("/:id/timeline", (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const visit = engine.getSessionById(id);
    if (!visit) {
      res.status(404).json({ error: `Visit '${id}' not found` });
      return;
    }

    const timeline = visit.events.map((e) => ({
      eventId: e.id,
      zone: e.zone,
      deviceId: e.deviceId,
      eventType: e.eventType,
      timestamp: new Date(e.timestamp).toISOString(),
      relativeSec: Math.round((e.timestamp - visit.startTime) / 1000),
      durationSec: Math.round((e.durationMs || 0) / 1000),
    }));

    res.status(200).json({
      visitId: visit.id,
      state: visit.state,
      outcome: visit.outcome,
      timeline,
    });
  });

  /**
   * Get visit storyline
   */
  router.get("/:id/storyline", (req: Request, res: Response) => {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const visit = engine.getSessionById(id);
    if (!visit) {
      res.status(404).json({ error: `Visit '${id}' not found` });
      return;
    }

    res.status(200).json({
      visitId: visit.id,
      state: visit.state,
      outcome: visit.outcome,
      story: visit.story,
    });
  });

  return router;
}
