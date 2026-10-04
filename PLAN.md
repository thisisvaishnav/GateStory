# GateStory — Implementation Plan

**Amazon "Build, Ship, Shape" Hackathon 2026 — Track 4: Ring (+ AWS Builder mini)**
Plan date: 2026-09-28 · Deadline: **2026-10-23 12:00pm PDT** · Build style: **solo + parallel AI agent lanes**
Source research: 16 research agents; `hackathon/research/amazon-hackathon-research-report.html` (copy to `docs/research/` at G0 — `/tmp` is volatile).

---

## 1. Product concept (locked)

**"Who came to the gate, in what order, did they actually reach the door?"**

GateStory turns Ring multi-camera events into a **visit storyline** — not a clip dump. Events from gate → walkway → door cameras are correlated into visit sessions with dwell time and outcome:

- Correlation: event-time session windows, merging gap **W = 90s** (adaptive per pair), door-close window 8 min
- Topology: `gate(0) → walkway(1) → door(2)`
- State machine: `OPEN → CONFIRMED → DWELLING → REACHED_DOOR → CLOSED / ABANDONED / NOISE`
- **Entity = visit, not identity.** No facial recognition, no watchlists, no persisted biometrics.
- Narrative: deterministic templates first; Bedrock Nova enrichment behind a feature flag.
- Validation: **12 fixture scenarios must pass 12/12** before any UI work is considered done.

Targets three creative bullets: multi-camera correlation + access-control interpretation + event-triggered story.

## 2. Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Demo strategy | **Plan (d) "Poll-first, HMAC-ready"** | Works with **zero Ring hardware**; outbound poll = strongest Stage-1 runtime proof |
| Fallback (b) | Dormant — real webhooks only if someone confirms US doorbell + Protect trial | Flip cost ~10 min if hardware appears |
| Mini-track | **AWS Builder primary**; OSS PR = stretch | AWS Builder is native to our stack; one mini only can win |
| Fire TV strip | **Cut** (decided 2026-09-28) | Disk (14Gi free) + thin reuse; Ring/MCP depth wins prizes |
| Team | **Solo** — AI agent lanes S1–S9, human = gate reviewer | Collab invites still required Oct 22 (all 7 testers) |
| Stack | **TypeScript everywhere — pnpm monorepo + AWS SAM** | One language = fastest parallel lanes |

## 3. Stack & architecture

**Stack:** TypeScript, pnpm workspaces, AWS SAM, `@modelcontextprotocol/sdk@1.30.1` (spec 2025-11-25; stateless Streamable HTTP, `sessionIdGenerator: undefined`), Express 5, zod 4, vitest, Biome. Fork `AmazonAppDev/ring-api-helloworld` for auth + event-history patterns only (its webhook auth is **wrong** — see §7/F2).

| Piece | Choice |
|---|---|
| Ring ingest | Event History **polling** (live spine) + HMAC webhook receiver for the fixture path |
| Compute | ~5–6 Lambdas; EventBridge rules (windowing is Lambda logic — EventBridge has no native correlation) |
| Data | DynamoDB single-table + S3 snapshots + CloudFront |
| API | API Gateway HTTP API + Cognito |
| MCP | Same gateway; 6 tools + MCP Apps heatmap iframe; **<500ms round-trip** |
| LLM | Bedrock Nova Lite/Micro, flex tier, behind flag (deterministic templates are default) |
| IaC / cost | SAM; est. **~$1.30–4.40/mo** |

**MCP tools:** `get_visit_timeline`, `get_visit_story`, `search_visitors`, `get_snapshot`, `create_gate_rule`, `get_access_log`

**Rejected:** Python `mcp` runner-up; dark "ops console" UI (calibration tell) — see §4.

## 4. Scoring map (Stage 2 = 4 EQUAL pillars; tech = tie-breaker)

| Pillar | Evidence each slice must ship |
|---|---|
| Quality of Idea | README "why visit-not-identity"; correlation vs clip-dump framing |
| Tech Implementation | Runtime proof: poller 200 on camera, HMAC verify log, 12/12 fixtures, MCP round-trip <500ms (tie-breaker weight) |
| Design | Warm **"household log"** aesthetic; `DESIGN_VARIANCE: 6`, `MOTION_INTENSITY: 4`, `VISUAL_DENSITY: 4`. Load design skills from `~/.agents/skills/<name>/SKILL.md` (69 symlinks in `~/.config/opencode/skills` are dangling) |
| Potential Impact | Safety/operations narrative + privacy plan (P0/P1/P2 controls) |
| Friction log | `FRICTION_LOG.md` entries → up to **+10%** |

**Rules essentials:** Stage 1 = pass/fail, required tech must be **imported and actually called at runtime** (README mentions don't count). Demo video **≤3 min**, public YouTube/Vimeo, English. Submit **≥3h early**. Prize cap: one track prize + one mini prize. AWS credits form: first-come-first-served — **submit Sep 28**, Oct 21 = cutoff only; pitch must literally say **"Ring"**.

## 5. Slices → agent lanes → gates

| Slice | Lane | Gate / done-when |
|---|---|---|
| S0 bootstrap: monorepo, CI, lint, fixture harness, first commit | infra | **G1** green CI |
| S1 Ring ingest: poller + webhook receiver + HMAC verifier + dedupe | ring-lane | **G2** poll 200 on camera + signed fixture → 200 |
| S2 correlation engine (pure, fixture-driven) | core-lane | **G3** 12/12 fixtures |
| S3 narrative templates (+ optional Nova flag) | core-lane | deterministic story from fixture |
| S4 data layer (DynamoDB single-table, S3) | data-lane | access patterns tested |
| S5 API endpoints (zod, <500ms) | api-lane | contract tests |
| S6 UI: gate log, storyline, heatmap | web-lane | local E2E: fixture → story renders |
| S7 MCP server + transport tests | mcp-lane | round-trip <500ms, tools return real data |
| S8 SAM IaC + deploy | infra | **G5** staging URL live |
| S9 video + README runtime proof + submissions | human | **G6** video ≤3min recorded · **G7** submitted ≥3h early |

**Critical path:** S1 + S2 start immediately after G1, in parallel. Everything else queues behind G3.
**Gates:** G0 pre-flight (§8) → G1 green CI → G2 Ring proof → G3 fixtures → G4 local E2E (fixture → story → UI) → G5 deployed staging → G6 video freeze → G7 submission.

## 6. Timeline — Sep 28 → Oct 23, 2026

| When | What |
|---|---|
| **Sep 28 (today)** | G0 checklist (§8); AWS credits form submitted |
| Sep 29–30 | G1 bootstrap; start Ring identity verification (minutes) → private app → **HMAC key CSV downloaded** |
| Oct 1–7 | **G2 + G3** (critical path); fixtures green by Oct 7 |
| Oct 8–14 | Local E2E → **G5** deployed staging; security P0/P1 controls |
| Oct 15–21 | UI polish, MCP depth, video production · **Oct 21** = credits cutoff + internal submission buffer |
| Oct 22 | Collab invites to all 7 testers (7-day expiry — must be accepted same day): testing@devpost.com, chris-trag, knmeiss, giolaq, anishamalde, mosesroth, emersonsklar |
| **Oct 23** | Freeze 09:00 PDT · submit by 09:00 (3h margin) · deadline **12:00pm PDT** |

Post-deadline: judging Nov 9–20; winners ~Dec 3.

## 7. Ring demo runbook (plan d — primary)

**Live spine:** Event History polling — `GET /v1/history/devices/{id}/events`.
- ⚠️ **No `start`/`end` query params** (only `event_types`, `page[key]`) → poll page 1, dedupe on `data[].id`, filter client-side by `attributes.start`.
- Polling is Ring's documented **"API polling alternative"** — cite it in README; this is the Stage-1 "Ring API called at runtime" proof (outbound call visible on camera beats a passive receiver).

**Webhook path:** `X-Signature: sha256=<hex(HMAC_SHA256(key, raw_body))>` → constant-time compare (`timingSafeEqual`) → **verify first, parse second** → idempotent on `meta.request_id` → 200 within 5s.
- Exercised by `scripts/send_signed_fixture.ts` signing with the app's **real HMAC key**, POSTed to the **real deployed endpoint**. Docstring: *"local fixture replay — NOT a Ring delivery."*
- **F2 trap:** helloworld's `RING_WEBHOOK_SECRET` Bearer check contradicts Ring's spec — setting it 401s real webhooks → ≥10 consecutive 4xx/24h → Ring **disables the endpoint**. Do not port that check.
- Playground token: **30 min, manual refresh** — regenerate immediately before recording.
- Hasting key shown **once** at app creation → `Download CSV` immediately; loss = full app re-create.
- Account-linking nonces use URL-safe Base64 **without padding** — different encoding from webhook hex; don't mix.

**Honesty rules for the video (≤3 min):**
1. 0:00–0:30 Playground token → dev server → live Ring simulator stream
2. 0:30–1:15 terminal: poller log `[ring] GET /v1/history/... 200 (n events)`
3. 1:15–2:15 `send_signed_fixture` → HTTP 200 + `X-Signature verified` log
4. 2:15–3:00 architecture + verbatim line: *polling is Ring's documented API-polling alternative; the webhook leg is our production ingest path, exercised here with a locally signed fixture so the demo is deterministic.*

Never claim a fixture event "just came from Ring's servers."

**Stage-1 runtime proof checklist (README, with file:line):** auth import called per request · poller fetch to `api.amazonvision.com` · live JSON with device IDs on camera · `[ring] GET ... 200` log line mid-video · HMAC verify log.

## 8. G0 — pre-flight checklist (do today, Sep 28)

1. [ ] **AWS credits form** — `https://forms.gle/5hyhr1u6x3fuV2aW7` (first-come-first-served; pitch contains "Ring"; $150/individual)
2. [ ] **Disk triage** — reclaim ~30GB (Docker VM 16GB, `~/Library/Caches/go-build` 5.4GB, `~/.npm/_cacache` 5.5GB, `~/.npm/_npx` 3.6GB); currently 14Gi free
3. [ ] **Fix AWS credentials** — currently `InvalidClientTokenId`; only blocker for G5
4. [ ] **First commit** — `.gitignore`, `LICENSE` (Apache-2.0), `FRICTION_LOG.md`, `PRODUCT_FEEDBACK.md`, README skeleton, `docs/research/` copy of the report
5. [ ] **Tooling** — install `sam`, `cloudflared` (or ngrok), full `ffmpeg` (current build has **0 drawtext/subtitles filters**); start Docker daemon
6. [ ] **Enable MCP servers** — context7, playwright, github (config currently has **0** active)
7. [ ] **Ring portal** — identity verification (ID, minutes) → private app (scopes: Motion Events, Doorbell press, Livestream) → HMAC key CSV
8. [ ] **Confirm no Ring hardware** (answered: none/unsure → plan d stands)

Repo state at G0: `.git` only, zero commits, remote `github.com/thisisvaishnav/GateStory`.

## 9. Cut ladder & risks

**Cut order when time runs out:** Fire TV (already cut) → OSS PR (`strands-agents/samples#308` fast-lane; `tools#380` deprecated Sep 15) → AgentCore → Bedrock Nova enrichment → heatmap/snapshot polish → secondary MCP tools.
**Never cut:** Ring runtime proof · 12 fixtures · storyline UI · core MCP tools · demo video · submissions + friction log.

| Risk | Mitigation |
|---|---|
| AWS creds invalid | G0 #3; nothing else blocked until G5 |
| No Ring hardware | Plan d designed for exactly this; polling blessed by Ring docs |
| 30-min Playground token | Regenerate right before recording |
| Webhook URL exact-match vs tunnel churn | Deploy one stable HTTPS host **before** portal config |
| Solo bandwidth | AI lanes + hard gates; cut ladder pre-agreed |
| Stage-1 ambiguity (poll vs webhook) | Outbound poll is literally "called at runtime"; cite docs |
| Video slips | Record skeleton by Oct 18; polish until Oct 21 |
| ffmpeg slim build | Install full ffmpeg before any burn-in captions |

## 10. Friction-log seeds (collect more in `FRICTION_LOG.md`)

**F1 — Event History has no time-range params**
- Steps: `GET /v1/history/devices/{id}/events?start=…&end=…` · Expected: time filter · Actual: only `event_types` + `page[key]`; `start`/`end` exist only as response attributes · **Severity: High** · Workaround: poll page 1, dedupe `data[].id`, filter client-side · Docs: `developer.amazon.com/docs/ring/api-documentation.html#event-history` (2026-09-28)

**F2 — Sample's webhook auth contradicts Ring's spec**
- Steps: set `RING_WEBHOOK_SECRET` per helloworld README, receive real webhook · Expected: `X-Signature` HMAC · Actual: Bearer check, no HMAC in repo → real posts 401 → ≥10 consecutive 4xx/24h disables endpoint · **Severity: Critical** · Workaround: our own HMAC verifier; leave the env var unset · Docs: `api-documentation.html#notifications` (2026-09-28)

**F3 — Sample docs link 404s + false "no polling API" comment**
- Steps: click helloworld README webhook link; read `app/api/ring/events/route.ts:8` · Expected: live docs + accurate comment · Actual: 404; comment contradicts Event History API and the repo's own `scripts/event_history.py` · **Severity: Medium** · Workaround: fix link/comment in our fork, note in PR as upstream-facing fix · Docs: `api-documentation.html` (2026-09-28)

**F4 — Webhook URL "required" vs "optional"; 4 exact-match HTTPS URLs gate Connect**
- Steps: configure Account Linking before deploying · Expected: point webhook anywhere · Actual: Account Link + Token Exchange + Webhook + App Homepage, all HTTPS exact-match, separate Staging/Production tabs; tunnel domains may break on redeploy · **Severity: High** · Workaround: deploy stable host first; save Webhook URL only once receiver + HMAC verifier is live · Docs: `api-documentation.html#4-endpoint-configuration`, `configure.html#account-linking` (2026-09-28)

---

### Appendix — key references

- Ring API docs: `https://developer.amazon.com/docs/ring/api-documentation.html` (incl. `#api-polling-alternative`, `#notifications`, `#event-history`)
- Ring portal: `developer.amazon.com/ring/console/apps` → Private Apps
- MCP spec: `@modelcontextprotocol/sdk@1.30.1`, Streamable HTTP stateless
- Hackathon report: `/Users/bombermac/hackathon/research/amazon-hackathon-research-report.html`
- ECC constraints: `~/.claude/rules/{agents,coding-style,git-workflow,performance,security,testing}.md`
