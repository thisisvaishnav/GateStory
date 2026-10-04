# GateStory 🚪📜

> **Multi-Camera Visit Storylines for Ring**  
> *Amazon "Build, Ship, Shape" Hackathon 2026 — Track 4: Ring (+ AWS Builder mini)*

---

## 🎯 The Problem & Vision

Traditional smart home camera feeds dump isolated, disconnected clips on homeowners:
- 10:14 AM: Motion at Front Gate
- 10:15 AM: Motion on Walkway
- 10:16 AM: Doorbell Motion

**GateStory turns Ring multi-camera events into a cohesive visit storyline.**

Instead of scrolling through dozens of disconnected clips, GateStory correlates spatial camera sequences (`gate(0) → walkway(1) → door(2)`) into complete visit sessions, calculating dwell times and trajectory outcomes:
- *"Visitor approached gate, lingered 45 seconds on walkway, reached front door, and departed after package delivery."*

### Privacy First: Visit, Not Identity
GateStory tracks **temporal and spatial visits**, not people:
- ❌ No facial recognition
- ❌ No watchlists or biometric profiling
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

## 🔌 Model Context Protocol (MCP) Tools

GateStory exposes a full MCP toolset via `@modelcontextprotocol/sdk` (stateless Streamable HTTP):
1. `get_visit_timeline`: Chronological event breakdown of visit sessions.
2. `get_visit_story`: Cohesive narrative synthesis of camera trajectories.
3. `search_visitors`: Query visits by outcome, dwell duration, or camera chain.
4. `get_snapshot`: Retrieve camera snapshots associated with key moments.
5. `create_gate_rule`: Establish alert boundaries or dwell thresholds.
6. `get_access_log`: Audit trail of all camera triggers and correlations.

---

## 🚀 Getting Started

### Prerequisites
- Node.js >= 22
- pnpm >= 10
- AWS CLI configured with valid credentials

### Setup
```bash
# 1. Copy environment template
cp .env.example .env.local

# 2. Install dependencies
pnpm install

# 3. Run test suite (12/12 fixture scenarios)
pnpm test
```

---

## 📜 License
Apache-2.0
