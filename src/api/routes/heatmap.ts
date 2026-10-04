import { type Request, type Response, Router } from "express";
import type { CorrelationEngine } from "../../engine/correlation.js";

export function createHeatmapRouter(engine: CorrelationEngine): Router {
  const router = Router();

  /**
   * Get spatial dwell heatmap aggregated across all visits
   */
  router.get("/", (_req: Request, res: Response) => {
    const visits = engine.getAllSessions();
    const zoneTotals = { gate: 0, walkway: 0, door: 0 };
    const zoneCounts = { gate: 0, walkway: 0, door: 0 };

    for (const v of visits) {
      if (v.dwellTimeByZone.gate) {
        zoneTotals.gate += v.dwellTimeByZone.gate;
        zoneCounts.gate++;
      }
      if (v.dwellTimeByZone.walkway) {
        zoneTotals.walkway += v.dwellTimeByZone.walkway;
        zoneCounts.walkway++;
      }
      if (v.dwellTimeByZone.door) {
        zoneTotals.door += v.dwellTimeByZone.door;
        zoneCounts.door++;
      }
    }

    const avgDwellSec = {
      gate: zoneCounts.gate > 0 ? Math.round(zoneTotals.gate / zoneCounts.gate / 1000) : 0,
      walkway:
        zoneCounts.walkway > 0 ? Math.round(zoneTotals.walkway / zoneCounts.walkway / 1000) : 0,
      door: zoneCounts.door > 0 ? Math.round(zoneTotals.door / zoneCounts.door / 1000) : 0,
    };

    res.status(200).json({
      totalVisits: visits.length,
      zoneCounts,
      totalDwellSec: {
        gate: Math.round(zoneTotals.gate / 1000),
        walkway: Math.round(zoneTotals.walkway / 1000),
        door: Math.round(zoneTotals.door / 1000),
      },
      avgDwellSec,
    });
  });

  return router;
}
