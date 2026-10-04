# Friction Log — Ring API & Developer Experience

> Tracking developer ergonomics, API surprises, and documentation gaps during the Amazon "Build, Ship, Shape" Hackathon 2026.

---

### F1 — Event History API Has No Time-Range Query Parameters
- **Context:** Fetching historical events between specific timestamps: `GET /v1/history/devices/{id}/events?start=...&end=...`
- **Expected:** Filtering events server-side by `start` and `end` timestamps.
- **Actual:** Only `event_types` and `page[key]` are accepted query parameters. Event start/end timestamps only exist in response body attributes (`data[].attributes.start`).
- **Severity:** High (forces fetching redundant pages and client-side filtering).
- **Workaround:** Poll page 1, maintain an in-memory / cache deduplication set on `data[].id`, and filter timestamps client-side.
- **Reference:** [Ring Event History Docs](https://developer.amazon.com/docs/ring/api-documentation.html#event-history)

---

### F2 — Official Sample Webhook Auth Contradicts Ring Signature Spec
- **Context:** Setting up webhooks based on the `AmazonAppDev/ring-api-helloworld` sample repository.
- **Expected:** The sample implements HMAC signature verification matching Ring's production `X-Signature` header.
- **Actual:** The sample checks an arbitrary `RING_WEBHOOK_SECRET` Bearer token instead of computing HMAC-SHA256 over the raw body using the app's HMAC signing key.
- **Severity:** Critical (real Ring webhooks will return 401; Ring automatically disables endpoints with ≥10 consecutive 4xx responses in 24h).
- **Workaround:** Built a dedicated raw-body constant-time HMAC-SHA256 verifier (`crypto.timingSafeEqual`) and left `RING_WEBHOOK_SECRET` unset.
- **Reference:** [Ring Notifications Spec](https://developer.amazon.com/docs/ring/api-documentation.html#notifications)

---

### F3 — Sample Documentation Link 404s & Conflicting "No Polling API" Comment
- **Context:** Reading `app/api/ring/events/route.ts:8` in the sample repo.
- **Expected:** Valid links to active developer documentation.
- **Actual:** Webhook doc link returns HTTP 404. Furthermore, comments claim Ring has no polling API, contradicting both the documented Event History API and the repo's own `scripts/event_history.py`.
- **Severity:** Medium (causes developer confusion during onboarding).
- **Workaround:** Documented the dual-path architecture (polling spine + webhook receiver) directly in project architecture.

---

### F4 — Exact-Match HTTPS URLs Gate App Account Linking
- **Context:** Configuring Account Linking in Ring Developer Console.
- **Expected:** Flexible or wildcard redirect/webhook endpoints during local development.
- **Actual:** Four distinct HTTPS URLs (Account Linking, Token Exchange, Webhook, App Homepage) require exact-match hostnames, split across Staging and Production tabs. Tunnel domain churn (e.g. restarting ngrok/cloudflared) breaks console setup.
- **Severity:** High (slows local iteration).
- **Workaround:** Deploy a stable API Gateway / CloudFront staging domain before locking portal URLs.
