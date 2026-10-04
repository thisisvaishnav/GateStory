import type {
  CameraHop,
  CameraZone,
  NormalizedEvent,
  VisitSession,
  VisitSnapshot,
} from "../types/visit.js";
import { generateDeterministicStory } from "./narrative.js";

export const W_MERGE_GAP_MS = 90_000; // 90 seconds adaptive merging gap
export const DOOR_CLOSE_WINDOW_MS = 8 * 60_000; // 8 minutes door-close window
export const DWELL_THRESHOLD_MS = 25_000; // 25s threshold to flag as DWELLING
export const NOISE_MAX_DURATION_MS = 15_000; // <= 15s single-zone gate motion = NOISE

export class CorrelationEngine {
  private activeSession: VisitSession | null = null;
  private completedSessions: VisitSession[] = [];
  private ingestedEventIds = new Set<string>();

  constructor(initialSessions: VisitSession[] = []) {
    this.completedSessions = [...initialSessions];
  }

  public getActiveSession(): VisitSession | null {
    return this.activeSession ? { ...this.activeSession } : null;
  }

  public getAllSessions(): VisitSession[] {
    const list = [...this.completedSessions];
    if (this.activeSession) {
      list.unshift({ ...this.activeSession });
    }
    return list.sort((a, b) => b.startTime - a.startTime);
  }

  public getSessionById(id: string): VisitSession | undefined {
    if (this.activeSession && this.activeSession.id === id) {
      return { ...this.activeSession };
    }
    return this.completedSessions.find((s) => s.id === id);
  }

  /**
   * Clears engine memory (useful between test scenarios)
   */
  public reset(): void {
    this.activeSession = null;
    this.completedSessions = [];
    this.ingestedEventIds.clear();
  }

  /**
   * Ingests a single normalized Ring event.
   * Performs deduplication, adaptive window correlation, state updates, and story generation.
   */
  public ingest(event: NormalizedEvent): {
    session: VisitSession;
    isNewSession: boolean;
    isDuplicate: boolean;
  } {
    // 1. Deduplication (idempotent)
    if (this.ingestedEventIds.has(event.id)) {
      const existing = this.findSessionForEvent(event.id);
      return {
        session: existing || this.activeSession || this.createInitialSession(event),
        isNewSession: false,
        isDuplicate: true,
      };
    }
    this.ingestedEventIds.add(event.id);

    // 2. Check if event belongs to active session
    let isNewSession = false;

    if (this.activeSession) {
      const lastEvent = this.activeSession.events[this.activeSession.events.length - 1];
      const gap = event.timestamp - lastEvent.timestamp;

      // Adaptive window:
      // - New gate arrival after W_MERGE_GAP_MS (90s) is a new visitor visit
      // - Max door close window is 8 minutes
      let shouldSplit = false;

      if (gap > DOOR_CLOSE_WINDOW_MS || gap < -DOOR_CLOSE_WINDOW_MS) {
        shouldSplit = true;
      } else if (event.zone === "gate" && gap > W_MERGE_GAP_MS) {
        // Gate trigger after 90s gap represents a separate visit
        shouldSplit = true;
      } else if (
        gap > W_MERGE_GAP_MS &&
        !this.activeSession.cameraChain.some((h) => h.zone === "door")
      ) {
        shouldSplit = true;
      }

      if (shouldSplit) {
        this.finalizeSession(this.activeSession);
        this.activeSession = this.createInitialSession(event);
        isNewSession = true;
      } else {
        this.activeSession.events.push(event);
      }
    } else {
      this.activeSession = this.createInitialSession(event);
      isNewSession = true;
    }

    // 3. Re-correlate active session with all its events
    this.recomputeSession(this.activeSession, false);

    return {
      session: { ...this.activeSession },
      isNewSession,
      isDuplicate: false,
    };
  }

  /**
   * Ingest a batch of events (e.g. from fixture replay or history polling)
   */
  public ingestBatch(events: NormalizedEvent[]): VisitSession[] {
    for (const evt of events) {
      this.ingest(evt);
    }
    if (this.activeSession) {
      this.finalizeSession(this.activeSession);
    }
    return this.getAllSessions();
  }

  /**
   * Explicitly closes and finalizes the active session
   */
  public finalizeActiveSession(): VisitSession | null {
    if (!this.activeSession) return null;
    const finalized = this.finalizeSession(this.activeSession);
    this.activeSession = null;
    return finalized;
  }

  private createInitialSession(initialEvent: NormalizedEvent): VisitSession {
    const isDirectDoor = initialEvent.zone === "door";
    const initialSession: VisitSession = {
      id: `visit_${initialEvent.timestamp}_${Math.random().toString(36).slice(2, 7)}`,
      state: isDirectDoor ? "CONFIRMED" : "OPEN",
      outcome: isDirectDoor ? "direct_door_visit" : "in_progress",
      startTime: initialEvent.timestamp,
      endTime: initialEvent.timestamp + (initialEvent.durationMs || 0),
      durationMs: initialEvent.durationMs || 0,
      events: [initialEvent],
      cameraChain: [
        {
          zone: initialEvent.zone,
          deviceId: initialEvent.deviceId,
          timestamp: initialEvent.timestamp,
          eventType: initialEvent.eventType,
        },
      ],
      dwellTimeByZone: {
        gate: initialEvent.zone === "gate" ? initialEvent.durationMs || 5000 : 0,
        walkway: initialEvent.zone === "walkway" ? initialEvent.durationMs || 5000 : 0,
        door: initialEvent.zone === "door" ? initialEvent.durationMs || 5000 : 0,
      },
      doorbellPressed:
        initialEvent.eventType === "ding" || initialEvent.eventType === "button_press",
      story: "",
      snapshots: [],
      updatedAt: Date.now(),
    };

    initialSession.story = generateDeterministicStory(initialSession);
    return initialSession;
  }

  private recomputeSession(session: VisitSession, isFinalizing = false): void {
    // Sort events chronologically to handle out-of-order network arrival
    session.events.sort((a, b) => a.timestamp - b.timestamp);

    session.startTime = session.events[0].timestamp;
    const lastEvt = session.events[session.events.length - 1];
    session.endTime = Math.max(
      lastEvt.timestamp + (lastEvt.durationMs || 0),
      session.events[session.events.length - 1].timestamp,
    );
    session.durationMs = Math.max(0, session.endTime - session.startTime);

    // Compute Camera Chain & Dwell Times
    const chain: CameraHop[] = [];
    const dwell: Record<CameraZone, number> = { gate: 0, walkway: 0, door: 0 };
    let hasDing = false;

    for (let i = 0; i < session.events.length; i++) {
      const e = session.events[i];
      if (e.eventType === "ding" || e.eventType === "button_press") {
        hasDing = true;
      }

      // Add to camera chain if zone changes
      const prevHop = chain[chain.length - 1];
      if (!prevHop || prevHop.zone !== e.zone) {
        chain.push({
          zone: e.zone,
          deviceId: e.deviceId,
          timestamp: e.timestamp,
          eventType: e.eventType,
        });
      }

      // Calculate dwell time in zone
      const nextEvtInSameZone = session.events.slice(i + 1).find((ne) => ne.zone === e.zone);
      if (nextEvtInSameZone) {
        dwell[e.zone] += Math.max(1000, nextEvtInSameZone.timestamp - e.timestamp);
      } else {
        dwell[e.zone] += Math.max(5000, e.durationMs || 5000);
      }
    }

    session.cameraChain = chain;
    session.dwellTimeByZone = dwell;
    session.doorbellPressed = hasDing;

    // Evaluate State Machine and Outcome
    this.evaluateStateAndOutcome(session, isFinalizing);

    // Generate story
    session.story = generateDeterministicStory(session);

    // Generate Snapshots
    session.snapshots = this.generateSnapshots(session);
    session.updatedAt = Date.now();
  }

  private evaluateStateAndOutcome(session: VisitSession, isFinalizing: boolean): void {
    const zonesVisited = session.cameraChain.map((c) => c.zone);
    const reachedDoor = zonesVisited.includes("door") || session.doorbellPressed;
    const reachedWalkway = zonesVisited.includes("walkway");
    const startedAtGate = zonesVisited[0] === "gate";
    const totalDuration = session.durationMs;

    // Single transient gate event handling
    if (startedAtGate && !reachedWalkway && !reachedDoor && session.events.length === 1) {
      if (isFinalizing || totalDuration <= NOISE_MAX_DURATION_MS) {
        session.state = "NOISE";
        session.outcome = "driveby_noise";
      } else {
        session.state = "OPEN";
        session.outcome = "in_progress";
      }
      return;
    }

    // Gate loitering
    if (startedAtGate && !reachedWalkway && !reachedDoor) {
      if (
        totalDuration >= DWELL_THRESHOLD_MS ||
        session.dwellTimeByZone.gate >= DWELL_THRESHOLD_MS
      ) {
        session.state = isFinalizing ? "ABANDONED" : "DWELLING";
        session.outcome = "loitering";
        return;
      }
      session.state = "OPEN";
      session.outcome = "in_progress";
      return;
    }

    // Direct door approach (skipped gate/walkway)
    if (!startedAtGate && zonesVisited[0] === "door") {
      if (session.doorbellPressed) {
        session.state = "REACHED_DOOR";
      } else {
        session.state = "CONFIRMED";
      }
      session.outcome = "direct_door_visit";
      return;
    }

    // Reached door
    if (reachedDoor) {
      // Check if visitor departed (walkway or gate detected AFTER reaching door)
      const doorIndex = zonesVisited.lastIndexOf("door");
      const hasExitHop = zonesVisited
        .slice(doorIndex + 1)
        .some((z) => z === "walkway" || z === "gate");

      if (hasExitHop) {
        session.state = "CLOSED";
        session.outcome = "reached_door_completed";
        return;
      }

      // If doorbell was pressed, state is REACHED_DOOR
      if (session.doorbellPressed) {
        session.state = "REACHED_DOOR";
        session.outcome = "reached_door_dwelling";
        return;
      }

      if (session.dwellTimeByZone.door >= DWELL_THRESHOLD_MS) {
        session.state = "DWELLING";
        session.outcome = "reached_door_dwelling";
      } else {
        session.state = "REACHED_DOOR";
        session.outcome = "reached_door_dwelling";
      }
      return;
    }

    // Entered gate and walkway, but turned back without reaching door
    if (startedAtGate && reachedWalkway && !reachedDoor) {
      const lastZone = zonesVisited[zonesVisited.length - 1];
      if (lastZone === "gate" && zonesVisited.length >= 3) {
        session.state = "ABANDONED";
        session.outcome = "turned_back";
        return;
      }

      session.state = "CONFIRMED";
      session.outcome = "in_progress";
      return;
    }

    // Default progression
    if (reachedWalkway) {
      session.state = "CONFIRMED";
      session.outcome = "in_progress";
    } else {
      session.state = "OPEN";
      session.outcome = "in_progress";
    }
  }

  private finalizeSession(session: VisitSession): VisitSession {
    this.recomputeSession(session, true);

    // If still in_progress at finalization, determine terminal state
    if (session.outcome === "in_progress") {
      const zonesVisited = session.cameraChain.map((c) => c.zone);
      if (zonesVisited.includes("door") || session.doorbellPressed) {
        session.state = "CLOSED";
        session.outcome = "reached_door_completed";
      } else if (zonesVisited.includes("walkway")) {
        session.state = "ABANDONED";
        session.outcome = "turned_back";
      } else {
        session.state = "NOISE";
        session.outcome = "driveby_noise";
      }
    } else if (session.state === "REACHED_DOOR" || session.state === "DWELLING") {
      if (session.outcome === "reached_door_dwelling") {
        session.state = "CLOSED";
        session.outcome = "reached_door_completed";
      } else if (session.outcome === "loitering") {
        session.state = "ABANDONED";
      }
    }

    session.story = generateDeterministicStory(session);
    session.updatedAt = Date.now();

    this.completedSessions.unshift({ ...session });
    this.activeSession = null;
    return session;
  }

  private generateSnapshots(session: VisitSession): VisitSnapshot[] {
    const snapshots: VisitSnapshot[] = [];
    const seenZones = new Set<CameraZone>();

    for (const hop of session.cameraChain) {
      if (!seenZones.has(hop.zone)) {
        seenZones.add(hop.zone);
        snapshots.push({
          id: `snap_${session.id}_${hop.zone}`,
          zone: hop.zone,
          timestamp: hop.timestamp,
          label: `${hop.zone.toUpperCase()} Camera Snapshot`,
          url: `/api/snapshots/${session.id}/${hop.zone}`,
        });
      }
    }
    return snapshots;
  }

  private findSessionForEvent(eventId: string): VisitSession | undefined {
    if (this.activeSession?.events.some((e) => e.id === eventId)) {
      return this.activeSession;
    }
    return this.completedSessions.find((s) => s.events.some((e) => e.id === eventId));
  }
}
