---
name: clean-architecture-guard
description: Clean Architecture guardrails for GateStory (Ring event correlation engine, dual-ingest pipelines, MCP server tools, and household dashboard). Use this skill when planning, building, reviewing, or refactoring components in GateStory to ensure strict domain/engine separation, deterministic correlation rules, clean repository abstraction, uncoupled UI/MCP consumers, and robust type safety. Also trigger when reviewing code for anti-patterns, checking files exceeding 300 lines, refactoring stateful engines, adding new MCP tools or API routes, or performing pre-commit quality audits.
---

# Clean Architecture Guard (GateStory Edition)

Guardrails tailored specifically for **GateStory**: the privacy-first multi-camera visit storyline and temporal correlation platform for Ring devices and Amazon Hackathon 2026.

GateStory's core mission is ingesting multi-camera streams (`gate(0) → walkway(1) → door(2)`), sessionizing them within adaptive temporal windows ($W = 90\text{s}$), synthesizing deterministic/Nova narratives, and exposing them cleanly via REST APIs, MCP Server tools, and a household dashboard.

To prevent architectural decay, spaghetti pipelines, and tight coupling between ingestion, business logic, storage, and consumers, GateStory enforces this 4-Layer Clean Architecture model.

---

## 🏗 The 4-Layer Architecture for GateStory

Dependencies point inward toward the core domain and correlation engine. Consumers (API, MCP, UI) and infrastructure (DynamoDB, Ring poller, Bedrock Nova) depend on domain abstractions, never the reverse.

```
       [UI Dashboard / SSE]     [MCP Server Tools]      [REST API Handlers]
                 │                       │                       │
                 └───────────────────────┼───────────────────────┘
                                         ▼
                             [Application / Use Cases]
                        (Ingest Service, Query Handlers)
                                         │
                                         ▼
                        [Domain & Engine Core (Headless)]
                   - Correlation Engine (Session Windowing)
                   - Topological Hop Tracker (gate ➔ walk ➔ door)
                   - Narrative Generator (Deterministic & Nova)
                   - Value Objects & Zod Domain Models
                                         ▲
                                         │
                         [Infrastructure & Adapters]
                    - Ring Poller & HMAC-SHA256 Verifier
                    - DynamoDB / In-Memory Storage Repositories
                    - AWS Bedrock Runtime Client
```

| Layer | Responsibility & Components | Must NOT Contain |
|---|---|---|
| **1. Domain & Engine Core** (`src/engine/`, `src/types/`) | Pure business rules: `CorrelationEngine`, adaptive temporal windowing ($W = 90\text{s}$, $T_{close} = 8\text{m}$, $D_{thresh} = 25\text{s}$), hop topology, outcome classification, deterministic narrative synthesis. | Express `req`/`res`, AWS SDK instances, `@modelcontextprotocol/sdk`, raw network calls, DOM manipulation. |
| **2. Storage & Infrastructure Adapters** (`src/storage/`, `src/ring/`) | Inbound/outbound external boundaries: `StorageRepository` interface, `DynamoRepository`, `MemoryRepository`, Ring OAuth poller, HMAC-SHA256 constant-time verifier. | Core correlation state logic, narrative formatting, route orchestration. |
| **3. Application & Protocol Delivery** (`src/api/`, `src/mcp/`) | Express routes, middleware, webhook endpoint, MCP tool registrations (`get_visit_timeline`, `get_visit_story`, `search_visitors`, `get_snapshot`, `create_gate_rule`, `get_access_log`), SSE streams. | Duplicated session window math, direct DynamoDB low-level calls bypassing repository. |
| **4. Presentational UI** (`src/ui/public/`) | Vanilla JS dashboard, CSS tokens, timeline renderers, camera hop visualization. | Inlined business calculations (e.g. recalculating visit outcomes on the client). |

---

## 🎯 Pre-Build & Refactoring Checklist

Before implementing a new feature, route, MCP tool, or ingestion path, verify:

1. **Layer Separation**: Does the correlation engine remain 100% headless and unit-testable without mock Express servers, network sockets, or DynamoDB tables?
2. **Repository Abstraction**: Does new persistence code go through `StorageRepository` interface so both `MemoryRepository` and `DynamoRepository` remain in parity?
3. **Data Over Code**: Can new correlation rules, dwell boundaries, or camera zone mappings be configured as declarative data structures (`GateRule`, `CameraZone`) rather than nested imperative conditionals?
4. **Deterministic Narrative Fallback**: If Bedrock Nova or external LLM enrichment fails or is disabled (`NOVA_ENRICHMENT_FLAG=false`), does deterministic synthesis produce an accurate, complete story?
5. **Constant-Time Crypto**: Do all webhook authentications use constant-time comparison (`crypto.timingSafeEqual`) on the raw payload?
6. **Cancellation & Timers**: Are all background intervals/pollers (`setInterval`) strictly managed with explicit `.start()` and `.stop()` lifecycles?
7. **Size & Cohesion**: Does any file exceed ~300 lines? If so, decompose into cohesive sub-modules (e.g. splitting MCP tools or correlation sub-steps).

---

## 🛡 Architectural Guardrails & Rules

### 1. Headless & Deterministic Correlation Engine
- The engine (`CorrelationEngine`) must accept normalized events and emit updated sessions synchronously or via pure domain events.
- Never import Express, AWS SDKs, or MCP types inside `src/engine/`.
- State transitions must be covered by deterministic fixture tests (`fixtures/scenarios.ts` covering 12/12 scenarios).

### 2. Dual-Ingest Parity & Deduplication
- Both ingest channels—**Inbound Webhook** (`/api/ring/webhook`) and **Outbound Poller** (`src/ring/poller.ts`)—must normalize raw payloads into `NormalizedEvent` before feeding the engine.
- Event deduplication (`ingestedEventIds` / `idempotencyKey`) must occur before triggering session windowing.

### 3. Repository Pattern Integrity
- Any entity saved or queried must have a corresponding method on `StorageRepository` (`src/storage/repository.ts`).
- `MemoryRepository` is the source of truth for test speed and local dev; `DynamoRepository` must implement the exact same contract for AWS production deployments.

### 4. MCP Server Modularity
- Tools registered in `src/mcp/server.ts` must act as thin orchestration layers: validate arguments with Zod schemas, delegate to `engine` or `storage`, and format MCP response payloads.
- If `src/mcp/server.ts` exceeds 300 lines, extract individual tool definitions into `src/mcp/tools/*.ts`.

### 5. UI Design Tokens & Zero Framework Slop
- The household log in `src/ui/public/` relies on clean semantic CSS and CSS custom properties (`--bg-color`, `--card-bg`, etc.).
- Avoid inline duplicate style declarations. Parameterize camera status cards and timeline items.

### 6. Simplified Technical English (ASD-STE100) Specification
- All text written for users, UI elements, status badges, buttons, tool descriptions, and website messages MUST follow the **ASD-STE100 (Simplified Technical English)** standard.
- **Rule 1 (Simplicity & Clarity)**: Use short, direct, unambiguous sentences (keep sentences under 20 words for instructions and 25 words for descriptions).
- **Rule 2 (Voice & Tone)**: Write in active voice. Use imperative verbs for buttons and actions (e.g., "Poll Ring API", "Reset Log", "Send Signed Fixture", "Open Snapshot").
- **Rule 3 (One Word, One Meaning)**: Do not use slang, idioms, or colloquialisms (e.g., use "transient motion" or "recorded", not buzzwords).
- **Rule 4 (No Passive / Vague Phrasing)**: Replace passive or ambiguous phrasing with clear cause-and-effect statements.
- **Rule 5 (Clarity in UI Messages)**: All alerts, empty states, and status indicators must clearly explain what happened and what action to take.

### 7. Git & Build Hygiene
- `dist/`, `.env`, coverage reports, and test caches must never be committed.
- Biome check (`pnpm lint`) and TypeScript check (`pnpm typecheck`) must pass with zero errors.

---

## 🔍 Anti-Pattern Detection Guide

When reviewing GateStory code, check against `references/anti-patterns.md`:

| Anti-Pattern | Where It Hurts in GateStory | Fix |
|---|---|---|
| **God Correlation File** | `correlation.ts` approaching 400 lines mixing windowing, dwell heuristics, snapshot pairing, and rule evaluation. | Extract dwell and outcome classifiers to pure helper functions; keep session windowing focused. |
| **Bypassing Repository** | A route or MCP tool calling AWS DynamoDB directly. | Route all data access through `StorageRepository`. |
| **Leaky Webhook Payload** | Route handlers parsing raw Ring JSON inside business logic. | Normalize at the adapter boundary (`src/ring/verifier.ts` / `src/ring/poller.ts`). |
| **Zombie Pollers / Timers** | `setInterval` in background poller without cleanup or unhandled promise rejection handlers. | Encapsulate poller lifecycle with explicit `start()`/`stop()` methods and teardown hooks. |
| **Hardcoded Zones & Thresholds** | Magic numbers for 90s merge window or 25s dwell time scattered in multiple files. | Centralize in constants or configurable rule sets. |

---

## 📋 Review Output Format

When executing an architectural review, report using this structured format:

```
## Architectural Findings
- [Anti-Pattern / Violation Name] — file:line — Why it impacts GateStory

## Recommended Refactoring Plan
1. [Highest payoff / easiest win] — Expected benefit
2. [Structural decoupling] — Expected benefit

## Verification Command
- Run `pnpm test && pnpm lint && pnpm typecheck` to guarantee zero regressions.
```
