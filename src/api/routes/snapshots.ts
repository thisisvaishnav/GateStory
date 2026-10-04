import { type Request, type Response, Router } from "express";
import type { CorrelationEngine } from "../../engine/correlation.js";

export function createSnapshotsRouter(engine: CorrelationEngine): Router {
  const router = Router();

  /**
   * Returns a dynamic SVG camera frame snapshot with HUD overlay
   */
  router.get("/:visitId/:zone", (req: Request, res: Response) => {
    const visitId = Array.isArray(req.params.visitId) ? req.params.visitId[0] : req.params.visitId;
    const zone = Array.isArray(req.params.zone) ? req.params.zone[0] : req.params.zone;
    const visit = engine.getSessionById(visitId);

    const title = `${zone.toUpperCase()} CAMERA FEED`;
    const timeStr = visit ? new Date(visit.startTime).toISOString() : new Date().toISOString();
    const outcome = visit ? visit.outcome : "live";
    const state = visit ? visit.state : "MONITORING";

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#1E232A" />
            <stop offset="100%" stop-color="#0F1115" />
          </linearGradient>
          <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#2D3748" stroke-width="0.5" stroke-opacity="0.3"/>
          </pattern>
        </defs>

        <!-- Background -->
        <rect width="640" height="360" fill="url(#bg)" />
        <rect width="640" height="360" fill="url(#grid)" />

        <!-- Camera Framing Reticle -->
        <path d="M 30 50 L 30 30 L 50 30" fill="none" stroke="#60A5FA" stroke-width="2" />
        <path d="M 610 50 L 610 30 L 590 30" fill="none" stroke="#60A5FA" stroke-width="2" />
        <path d="M 30 310 L 30 330 L 50 330" fill="none" stroke="#60A5FA" stroke-width="2" />
        <path d="M 610 310 L 610 330 L 590 330" fill="none" stroke="#60A5FA" stroke-width="2" />

        <!-- Camera Center Crosshair -->
        <circle cx="320" cy="180" r="18" fill="none" stroke="#60A5FA" stroke-width="1" stroke-dasharray="4,4" />
        <line x1="320" y1="150" x2="320" y2="210" stroke="#60A5FA" stroke-width="1" stroke-opacity="0.5" />
        <line x1="290" y1="180" x2="350" y2="180" stroke="#60A5FA" stroke-width="1" stroke-opacity="0.5" />

        <!-- HUD Header -->
        <circle cx="45" cy="45" r="5" fill="#EF4444" />
        <text x="58" y="49" font-family="monospace" font-size="12" fill="#F87171" font-weight="bold">REC · RING PROTECT</text>
        <text x="320" y="49" font-family="monospace" font-size="13" fill="#E2E8F0" text-anchor="middle" font-weight="600">${title}</text>
        <text x="595" y="49" font-family="monospace" font-size="11" fill="#94A3B8" text-anchor="end">1080p HD</text>

        <!-- Motion Activity Box Simulation -->
        <rect x="240" y="100" width="160" height="150" fill="none" stroke="#38BDF8" stroke-width="1.5" stroke-dasharray="6,3" rx="4" />
        <rect x="240" y="80" width="85" height="18" fill="#0284C7" rx="2" />
        <text x="245" y="93" font-family="sans-serif" font-size="10" fill="#FFFFFF" font-weight="bold">HUMAN DETECTED</text>

        <!-- HUD Footer Information -->
        <rect x="20" y="300" width="600" height="40" fill="#090D14" fill-opacity="0.85" rx="6" stroke="#334155" stroke-width="0.8" />
        <text x="35" y="325" font-family="monospace" font-size="12" fill="#38BDF8">${timeStr}</text>
        <text x="320" y="325" font-family="monospace" font-size="12" fill="#E2E8F0" text-anchor="middle">STATE: <tspan fill="#F59E0B">${state}</tspan></text>
        <text x="605" y="325" font-family="monospace" font-size="12" fill="#A7F3D0" text-anchor="end">OUTCOME: ${outcome.toUpperCase()}</text>
      </svg>
    `;

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.status(200).send(svg.trim());
  });

  return router;
}
