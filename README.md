# GateStory 🚪📜

> **Multi-Camera Visit Storylines for Ring**  
> *Amazon "Build, Ship, Shape" Hackathon 2026 — Track 4: Ring (+ AWS Builder mini-challenge)*

---

## 🎯 The Problem & Vision

Traditional smart home camera feeds dump isolated, disconnected clips on homeowners:
- 10:14 AM: Motion at Front Gate
- 10:15 AM: Motion on Walkway
- 10:16 AM: Doorbell Motion

**GateStory turns Ring multi-camera events into a cohesive visit storyline.**

Instead of scrolling through dozens of disconnected clips, GateStory correlates spatial camera sequences (`gate(0) → walkway(1) → door(2)`) into complete visit sessions, calculating dwell times and trajectory outcomes:
- *"At 02:29:27 PM, visitor arrived at the Front Gate, proceeded along the walkway (21s), reached the front door (15s dwell), rang the doorbell, and departed back down the walkway. Total visit duration: 23s."*

### 🔒 Privacy First: Visit, Not Identity
GateStory tracks **temporal and spatial visits**, not people:
- ❌ **No facial recognition**
- ❌ **No watchlists or biometric profiling**
- ✅ Pure event-time session windowing, topological flow tracking, and dwell analysis.

---

## 🏗 Architecture & Dual Ingest Paths

```text
[Ring Cameras / Simulator]
           │
           ├──▶ Outbound Event History Polling (api.amazonvision.com) [Runtime Proof]
           │
           └──▶ Inbound Signed Webhook Receiver (HMAC-SHA256 Verified)
                        │
                        ▼
            [GateStory Ingest & Deduplication]
                        │
                        ▼
         [Temporal Correlation Engine (W = 90s)]
           gate(0) ➔ walkway(1) ➔ door(2)
                        │
                        ▼
          [Narrative Synthesis (Deterministic / Nova)]
                        │
       ┌────────────────┴────────────────┐
       ▼                                 ▼
[Household Log UI]               [MCP Server Engine]
(Storyline & Timeline)           (6 Tools for AI Assistants)
```

---

## ⚡ Stage-1 Runtime Proof Checklist

Per hackathon rules, required technology is **imported and executed at runtime**:

| Requirement | Code Anchor | Runtime Proof Command / Evidence |
|---|---|---|
| **Ring API Outbound Poller** | [`src/ring/poller.ts#L74-L108`](src/ring/poller.ts) | Run `pnpm poll` → logs `[ring] GET /v1/history/devices/{id}/events 200 (1 events)` from `api.amazonvision.com` |
| **Ring Authorization Header** | [`src/ring/poller.ts#L86-L92`](src/ring/poller.ts) | Bearer Playground / OAuth token passed on outbound HTTPS connection |
| **Ring HMAC-SHA256 Verifier** | [`src/ring/verifier.ts#L36-L77`](src/ring/verifier.ts) | `crypto.timingSafeEqual` constant-time verification over raw webhook body |
| **Signed Fixture Replay** | [`scripts/send_signed_fixture.ts`](scripts/send_signed_fixture.ts) | Signs with real `RING_HMAC_KEY`, POSTs to `/api/ring/webhook` → returns HTTP 200 |
| **12/12 Fixture Scenarios** | [`fixtures/scenarios.ts`](fixtures/scenarios.ts) & [`tests/correlation.test.ts`](tests/correlation.test.ts) | `pnpm test` executes all 12 scenarios (100% passing) |
| **Model Context Protocol (MCP)** | [`src/mcp/server.ts`](src/mcp/server.ts) & [`tests/mcp.test.ts`](tests/mcp.test.ts) | 6 MCP tools via `@modelcontextprotocol/sdk` with <500ms round-trip latency |

---

## 🔌 Model Context Protocol (MCP) Tools

GateStory exposes a full MCP toolset via `@modelcontextprotocol/sdk` (stateless Streamable HTTP and Stdio):

1. **`get_visit_timeline`**: Chronological event breakdown of visit sessions with relative second offsets.
2. **`get_visit_story`**: Cohesive narrative synthesis of camera trajectories (deterministic or Bedrock Nova enriched).
3. **`search_visitors`**: Query visits by outcome (`reached_door_completed`, `turned_back`, `loitering`, etc.) or dwell duration.
4. **`get_snapshot`**: Retrieve camera snapshots and HUD framing associated with key hops.
5. **`create_gate_rule`**: Establish alert boundaries or dwell thresholds (e.g. loitering > 45s).
6. **`get_access_log`**: Audit trail of all camera triggers, correlations, and rule activations.

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 22
- pnpm >= 10
- AWS CLI configured with active credentials

### Installation
```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment file (credentials loaded in .env)
cp .env.example .env
```

### Running Commands
```bash
# Run all unit, integration, and 12 fixture tests
pnpm test

# Run outbound Ring Event History API polling proof
pnpm poll

# Start the GateStory server & Household Log dashboard
pnpm dev

# In another terminal: Replay a signed fixture sequence against the server
pnpm send-fixture

# Run MCP server on stdio for Claude Desktop / AI Agents
pnpm tsx src/mcp/cli.ts
```

Open `http://localhost:3000` to view the warm **Household Log UI**, test all 12 fixture scenarios with one click, and inspect the spatial dwell heatmap!

---

## 📜 License
Apache-2.0
