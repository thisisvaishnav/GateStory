import { type Request, type Response, Router } from "express";
import type { StorageRepository } from "../../storage/repository.js";
import type { CameraZone, GateRule } from "../../types/visit.js";

export function createRulesRouter(storage: StorageRepository): Router {
  const router = Router();

  router.get("/", async (_req: Request, res: Response) => {
    const rules = await storage.listRules();
    res.status(200).json({ rules });
  });

  router.post("/", async (req: Request, res: Response) => {
    const { name, zone, maxDwellSeconds, alertOnAbandon } = req.body;
    if (!name || !zone || typeof maxDwellSeconds !== "number") {
      res.status(400).json({ error: "Missing required fields: name, zone, maxDwellSeconds" });
      return;
    }

    const rule: GateRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name,
      zone: zone as CameraZone,
      maxDwellSeconds,
      alertOnAbandon: Boolean(alertOnAbandon),
      enabled: true,
      createdAt: Date.now(),
    };

    await storage.createRule(rule);
    res.status(201).json({ success: true, rule });
  });

  return router;
}

export function createAccessLogRouter(storage: StorageRepository): Router {
  const router = Router();

  router.get("/", async (req: Request, res: Response) => {
    const limit = req.query.limit ? Number.parseInt(req.query.limit as string, 10) : 50;
    const source = req.query.source as string | undefined;

    const logs = await storage.listAccessLogs({ limit, source });
    res.status(200).json({ count: logs.length, logs });
  });

  return router;
}
