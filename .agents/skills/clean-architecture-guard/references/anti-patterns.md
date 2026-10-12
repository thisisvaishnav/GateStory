# Anti-Pattern Catalog: GateStory Edition

This catalog documents common architectural anti-patterns in event correlation engines, smart-home multi-camera pipelines, and MCP server integrations.

---

## 1. The God Correlation Engine
- **Symptom:** `src/engine/correlation.ts` grows beyond 350-400 lines, conflating event windowing, dwell calculations, spatial topology validation, narrative generation, and snapshot extraction in a single class.
- **Why It Hurts:** Any change to a dwelling threshold breaks unrelated snapshot logic or narrative outputs. Unit tests become monolithic and brittle.
- **Fix:** Decompose into specialized pure functions:
  1. `TemporalWindowResolver`: calculates whether an incoming event merges into an existing session ($W = 90\text{s}$) or closes one ($T_{close} = 8\text{m}$).
  2. `OutcomeClassifier`: analyzes camera hops (`gate(0) → walkway(1) → door(2)`) and produces outcomes (`reached_door_completed`, `turned_back`, `loitering`).
  3. `NarrativeSynthesizer`: handles story building.

---

## 2. Ingest Leakage into Domain
- **Symptom:** Raw Ring webhook JSON (e.g. nested Amazon Vision payload formats, device IDs, raw signature headers) passed directly into `CorrelationEngine.ingest()`.
- **Why It Hurts:** Ties the core algorithm to Ring's proprietary schema. If Ring updates payload shapes or a new camera provider (e.g. Blink, Nest) is added, the correlation engine breaks.
- **Fix:** Keep a strict boundary. Inbound webhooks (`src/api/routes/ring.ts`) and pollers (`src/ring/poller.ts`) must map inputs into a clean `NormalizedEvent` before calling `engine.ingest()`.

---

## 3. Storage Repository Bypass
- **Symptom:** An API route or MCP tool initializes an AWS DynamoDB client directly or runs arbitrary DynamoDB queries bypassing the `StorageRepository` interface.
- **Why It Hurts:** Breaks the high-performance in-memory local development mode (`MemoryRepository`) and makes integration testing dependent on live AWS credentials or local DynamoDB Docker containers.
- **Fix:** All entity persistence and queries (visits, rules, access logs) must be defined on the `StorageRepository` interface in `src/storage/repository.ts` and implemented in both `MemoryRepository` and `DynamoRepository`.

---

## 4. Giant Monolithic MCP Server
- **Symptom:** `src/mcp/server.ts` accumulates all tool definitions, JSON-schema parameter parsing, error formatting, and business logic, exceeding 300+ lines.
- **Why It Hurts:** Adding new MCP tools creates merge conflicts; error handling patterns diverge across tools.
- **Fix:** Extract each MCP tool into its own file under `src/mcp/tools/` (e.g., `timelineTool.ts`, `storyTool.ts`, `searchTool.ts`). Have `src/mcp/server.ts` simply register them.

---

## 5. Zombie Pollers & Unguarded Timers
- **Symptom:** Background polling (`src/ring/poller.ts`) uses unmanaged `setInterval` loops that continue executing after tests finish or fail silently without handling rejected promises.
- **Why It Hurts:** Memory leaks, hanging test runners, and unhandled promise rejections crashing production processes.
- **Fix:** Maintain strict lifecycle methods (`start()`, `stop()`), store interval timer handles, handle errors gracefully within the polling tick, and wire into server shutdown signals (`SIGINT`, `SIGTERM`).

---

## 6. Non-Constant-Time Webhook Verification
- **Symptom:** Verifying Ring webhook HMAC signatures using standard string comparison (`===`).
- **Why It Hurts:** Susceptible to timing attacks where attackers guess cryptographic signatures byte-by-byte.
- **Fix:** Always verify signatures using `crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computed))`.

---

## 7. Hardcoded Magic Numbers
- **Symptom:** Dwell thresholds (`25000`), merge gaps (`90000`), or noise filters (`15000`) hardcoded directly inside business logic.
- **Why It Hurts:** Inconsistent thresholds across narrative generation, rule checking, and UI rendering.
- **Fix:** Centralize in named exported domain constants or configurable rule sets (`src/config/` and `src/engine/`).
