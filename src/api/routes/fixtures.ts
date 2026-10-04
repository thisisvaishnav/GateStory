import { type Request, type Response, Router } from "express";
import { FIXTURE_SCENARIOS } from "../../../fixtures/scenarios.js";
import type { CorrelationEngine } from "../../engine/correlation.js";
import type { StorageRepository } from "../../storage/repository.js";

export function createFixturesRouter(
  engine: CorrelationEngine,
  storage: StorageRepository,
): Router {
  const router = Router();

  /**
   * List all 12 fixture scenarios
   */
  router.get("/", (_req: Request, res: Response) => {
    const list = FIXTURE_SCENARIOS.map((s, idx) => ({
      index: idx + 1,
      id: s.id,
      name: s.name,
      description: s.description,
      eventCount: s.events.length,
      expectedState: s.expectedState,
      expectedOutcome: s.expectedOutcome,
    }));
    res.status(200).json({ count: list.length, scenarios: list });
  });

  /**
   * Replay a scenario live through the correlation engine
   */
  router.post("/replay/:id", async (req: Request, res: Response) => {
    const scenario = FIXTURE_SCENARIOS.find((s) => s.id === req.params.id);
    if (!scenario) {
      res.status(404).json({ error: `Scenario '${req.params.id}' not found` });
      return;
    }

    // Ingest all events from the scenario
    for (const evt of scenario.events) {
      const { session } = engine.ingest(evt);
      await storage.saveVisit(session);
    }

    await storage.logAccess({
      id: `log_fixture_${Date.now()}`,
      timestamp: Date.now(),
      source: "simulator",
      action: "FIXTURE_SCENARIO_REPLAYED",
      details: {
        scenarioId: scenario.id,
        scenarioName: scenario.name,
        eventCount: scenario.events.length,
      },
    });

    const sessions = engine.getAllSessions();

    res.status(200).json({
      success: true,
      scenarioId: scenario.id,
      scenarioName: scenario.name,
      eventsIngested: scenario.events.length,
      currentSessionsCount: sessions.length,
      latestSession: sessions[0],
    });
  });

  /**
   * Reset engine state
   */
  router.post("/reset", (_req: Request, res: Response) => {
    engine.reset();
    res.status(200).json({ success: true, message: "Correlation engine state reset" });
  });

  return router;
}
