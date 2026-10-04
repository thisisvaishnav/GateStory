import { describe, expect, it } from "vitest";
import { FIXTURE_SCENARIOS } from "../fixtures/scenarios.js";
import { CorrelationEngine } from "../src/engine/correlation.js";

describe("Correlation Engine — 12 Fixture Scenarios (G3 Gate)", () => {
  it("should have exactly 12 defined scenarios", () => {
    expect(FIXTURE_SCENARIOS.length).toBe(12);
  });

  FIXTURE_SCENARIOS.forEach((scenario, index) => {
    it(`Scenario ${index + 1}: ${scenario.name} (${scenario.id})`, () => {
      const engine = new CorrelationEngine();

      for (const event of scenario.events) {
        engine.ingest(event);
      }

      const sessions = engine.getAllSessions();

      expect(sessions.length).toBe(scenario.expectedSessionCount);

      const primarySession = sessions[0];
      expect(primarySession.state).toBe(scenario.expectedState);
      expect(primarySession.outcome).toBe(scenario.expectedOutcome);
      expect(primarySession.story).toBeTruthy();

      if (scenario.validate) {
        scenario.validate(sessions);
      }
    });
  });
});
