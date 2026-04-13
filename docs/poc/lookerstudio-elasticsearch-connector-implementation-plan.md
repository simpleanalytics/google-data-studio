# Looker Studio ↔ Node API ↔ Elasticsearch: Full Implementation Plan (with staged testing)

**Context (current state)**  
- You have **Elasticsearch** storing analytics logs.
- A **Node.js API** is the mandatory access layer (used by other consumers too).
- The current Looker Studio Community Connector pulls data via an **export endpoint** (CSV), parsing rows in Apps Script.
- This is slow because Looker Studio re-requests data often (per chart, per interaction), and exporting raw rows is the worst-case pattern.

**Target outcome**  
Enable users to build their own Looker Studio charts/dashboards while keeping performance acceptable by:
- **Pushing down aggregation + filtering** into Elasticsearch (via your Node API),
- Returning **small, already-aggregated tabular results** to Looker Studio,
- Adding **caching + guardrails** to prevent expensive “accidental” queries.

---

## 0) Guiding principles

1. **Return aggregates, not event rows**  
   Dashboards mostly need buckets/counts, not raw logs.

2. **Connector stays thin** (Apps Script is slow & limited)  
   Apps Script should:
   - Validate the request
   - Translate Looker request → Node API payload
   - Return rows (minimal transformation)

3. **Node API owns complexity**  
   Node should:
   - Translate generic query → ES DSL
   - Apply caching, limits, protections
   - Flatten ES buckets → table rows

4. **Observability-first**  
   Log and measure from day 1. You’ll debug 10x faster.

---

## 1) System overview

### 1.1 Current architecture (export-based)

```mermaid
flowchart LR
  LS[Looker Studio Report] --> CC[Community Connector (Apps Script)]
  CC -->|GET export CSV| API[Node API /export]
  API --> ES[(Elasticsearch)]
  API --> CC
  CC -->|parse CSV to rows| LS
```

**Why it’s slow**
- Over-fetches raw rows.
- Apps Script parses large CSV.
- Looker triggers many refreshes (per chart / filters / date range).

---

### 1.2 Target architecture (aggregation pushdown)

```mermaid
flowchart LR
  LS[Looker Studio Report] --> CC[Community Connector (Apps Script)]
  CC -->|POST /looker/query| API[Node API]
  API -->|ES aggregations| ES[(Elasticsearch)]
  API -->|flat rows + schema| CC
  CC -->|return rows| LS
```

**Key changes**
- Connector requests *aggregated* results.
- ES does grouping/histograms.
- Payloads become small and fast.

---

## 2) Workstreams and components

### A) Elasticsearch
- Confirm mappings for:
  - timestamp field (canonical event time)
  - keyword fields for group-by (e.g., `path.keyword`, `country_code.keyword`)
  - numeric fields for metrics (duration, scroll)
- Confirm unique visitor key strategy (e.g., session_id / visitor_id).

### B) Node API
- Add a generic endpoint (recommended): `POST /looker/query`
- Translate payload → ES query DSL
- Return flat table
- Add caching, rate limiting, and guardrails

### C) Looker Studio Community Connector (Apps Script)
- Expose a schema with **Dimensions** and **Metrics**
- Map Looker `getData(request)` → Node API query
- Return rows

### D) Looker Studio report(s) for testing
- A dedicated internal “Connector Test Dashboard” to exercise query shapes.

### E) Tooling for local dev + replay tests
- Tunnel (ngrok/Cloudflare Tunnel) so Apps Script can reach local Node.
- Capture real Looker requests and replay them against Node.

---

## 3) Proof of Concept first (hardcoded 1–2 charts)

### Goal
Prove the **aggregate flow** works end-to-end:
Looker → Connector → Node → ES → Node → Connector → Looker  
…without immediately solving every combination of dimensions/metrics.

### POC scope
Support **2 hardcoded query shapes** (enough to validate the architecture):

1) **Time series (date histogram)**  
- Example chart: *Pageviews per day (last 28 days)*  
- Dimension: `date`  
- Metric: `pageviews` (count)

2) **Top-N breakdown (terms agg)**  
- Example chart: *Top 20 paths by pageviews*  
- Dimension: `path`  
- Metric: `pageviews` (count)  
- Sort: pageviews desc  
- Limit: 20

### Implementation approach (POC)
- Add two Node endpoints (temporary):
  - `GET /looker/poc/pageviews_timeseries?hostname=...&start=...&end=...&tz=...`
  - `GET /looker/poc/top_paths?hostname=...&start=...&end=...&limit=20`
- Connector:
  - Expose only the minimal fields needed for the 2 charts (POC schema).
  - In `getData()`, detect the requested field combination and call the matching endpoint.

> Why hardcode first: You eliminate ambiguity. If the POC is slow/incorrect, you know the issue is infra/limits/caching, not generic query logic.

---

### POC testing plan (do not proceed until these pass)

#### POC Test 1 — Node endpoint correctness (no Looker involved yet)
**How**
- Use Postman/curl to call each POC endpoint with known date ranges.
- Compare results with a reference query directly in ES (Kibana/Dev Tools) or an internal admin endpoint.

**What to verify**
- Returned dates/buckets align to timezone and start/end boundaries.
- Counts match ES.
- Response is already flat and small (tens/hundreds of rows).
- Response time is acceptable (target: sub-second to a few seconds depending on ES size).

**Exit criteria**
- Each endpoint returns correct results for at least:
  - a small site (few thousand events)
  - a medium site (hundreds of thousands+)

---

#### POC Test 2 — Connector can consume endpoint and return rows
**How**
- Point connector config to the POC endpoints (via base URL).
- In Apps Script logs, print:
  - requested fields
  - dateRange
  - final URL called
  - number of rows returned

**What to verify**
- Data types match schema:
  - date formatted the way Looker expects (e.g., `YYYYMMDD` for `YEAR_MONTH_DAY`)
  - numeric metrics are numbers
- Row count is reasonable and stable.
- No Apps Script timeouts.

**Exit criteria**
- `getData()` returns rows successfully under typical date ranges (7/28/90 days).

---

#### POC Test 3 — Looker Studio charts render and respond to date changes
**How**
- Create a Looker Studio report with only:
  - a Date Range control
  - Chart A: time series (pageviews/day)
  - Chart B: bar/table (top paths)
- Change date range (7 days → 28 → 90)
- Reload report multiple times (incognito)

**What to verify**
- Charts render within acceptable time.
- Correctness visually matches expectations.
- Request volume is understood (how many times `getData()` is called per load).
- If you add cache, confirm repeated reload is faster.

**Exit criteria**
- Both charts load consistently with no errors.
- Performance feels “dashboard-like” rather than “export-like”.

---

## 4) Milestone plan (from POC → fully generic)

### Milestone 1 — Introduce the generic query endpoint contract (Node)

#### Deliverables
- `POST /looker/query` that supports:
  - date range filter
  - hostname filter (tenant)
  - **0 dimensions** (scorecard)
  - **1 dimension** (terms agg)
  - **date histogram** (special dimension = date)
  - basic ordering + limit
- Response format:
  - flat `rows` array
  - stable `schema` list (or connector uses requested fields order)

#### Key design decisions
- Define a **field catalog** mapping connector field IDs → ES fields:
  - dimension fields (keyword)
  - metric fields (aggregation definitions)
- Decide unique visitor key (for future metrics).

#### Testing before moving on
**Test 1: Contract tests (Node only)**
- Create fixtures:
  - scorecard request
  - date histogram request
  - top N request
- For each fixture:
  - call `/looker/query`
  - validate response shape
  - validate row counts and types

**Test 2: ES query translation unit tests**
- Given a request payload, assert the generated ES DSL matches expectations:
  - filters in `bool.filter`
  - `date_histogram` uses correct interval and time zone
  - `terms` uses `.keyword` field
  - `size` respects limit guardrails

**Exit criteria**
- `/looker/query` can replicate POC results for the two charts.
- You can add one more metric (e.g., uniques) without changing connector code (only schema/catalog).

---

### Milestone 2 — Upgrade connector schema: real Dimensions + Metrics

#### Deliverables
- Connector `getSchema()`:
  - Use `.newDimension()` for dimensions
  - Use `.newMetric()` for metrics
- Introduce a minimal “field set” that is safe and useful:
  - Dimensions: date, path, referrer_hostname, country_code, device_type, browser_name, os_name, utm_source, utm_medium, utm_campaign
  - Metrics: pageviews (count), unique_visitors (cardinality), avg_duration (avg), avg_scroll (avg), unique_pageviews (sum over is_unique if reliable)

> You can still keep the export connector version available as a fallback, but the new connector should default to the aggregated path.

#### Testing before moving on
**Test 1: Schema validation in Looker**
- Create a data source from the connector.
- Confirm metrics appear as metrics (aggregation UI behaves normally).
- Confirm date dimension is recognized as a date (can be used in time series).

**Test 2: Simple self-serve chart creation**
- In Looker Studio, build:
  - scorecard (pageviews)
  - time series (date + pageviews)
  - top N paths (path + pageviews)
- Verify no special “supported chart” constraints: users can pick fields freely.

**Exit criteria**
- Users can create at least 5 common chart types without connector changes.

---

### Milestone 3 — Filters pushdown (controls + chart filters)

#### Deliverables
Implement filter support end-to-end:
- Connector parses filter clauses from `request` (you will log the real request structure and then implement only what appears).
- Node translates filters to ES `bool.filter` clauses.

Minimum filter operators to support initially:
- `EQUALS`
- `IN` (list)
- `CONTAINS` (for path/referrer)
- `NOT_EQUALS` (optional)

Guardrails:
- Limit “contains/regex” to whitelisted fields (path, referrer, utm_*).
- Reject regex if too expensive (optional).

#### Testing before moving on
**Test 1: Filter fixtures (Node only)**
- Add fixtures for each operator.
- Validate ES DSL and response.

**Test 2: Looker filter controls**
- Add controls:
  - country dropdown
  - device type dropdown
  - path contains filter
- Confirm filters change results and performance stays acceptable.

**Exit criteria**
- Filters are applied server-side (confirmed by logs and by comparing results).

---

### Milestone 4 — Multiple dimensions & tables (composite aggregation)

#### Deliverables
Support requests with 2+ dimensions:
- Use ES `composite` aggregation for stable pagination/ordering.
- Flatten buckets → rows with multiple dimension columns + metric columns.

Notes:
- Many BI tools want “tables with multiple group-bys”. Composite aggs are the practical ES approach.

Guardrails:
- Hard max on:
  - number of dimensions (e.g., ≤ 3)
  - bucket count (e.g., ≤ 10k)
  - request execution time (timeout/circuit breaker)

#### Testing before moving on
**Test 1: Multi-dimension fixtures**
- date + country_code → pageviews
- path + device_type → pageviews
- Verify correctness and row limit enforcement.

**Test 2: Looker table tests**
- Create a table with 2 dimensions + 1 metric.
- Sort by metric descending.
- Add filters.
- Confirm no timeouts.

**Exit criteria**
- Multi-dim tables load reliably for typical date ranges.

---

### Milestone 5 — Performance hardening: caching, concurrency, quotas

#### Deliverables
**Caching (Node)**
- Cache key based on normalized request payload:
  - hostname, dateRange, dims, metrics, filters, order, limit, timezone
- TTL suggestions:
  - 10–60 seconds for interactive dashboards
  - optionally longer for historical ranges
- Cache storage:
  - in-memory LRU for single instance
  - Redis for multi-instance (optional)

**Concurrency protection**
- Rate-limit per API key / hostname.
- Debounce duplicate in-flight identical queries (request coalescing).

**Payload size controls**
- Strict maximum rows returned.
- Strict maximum response body size.

#### Testing before moving on
**Test 1: Cache effectiveness**
- Open the Looker report in incognito.
- Reload rapidly.
- Confirm cache hit rate via logs and lowered ES query volume.

**Test 2: Load simulation**
- Replay captured Looker query fixtures in parallel (k6/artillery or a simple script).
- Measure:
  - p50/p95 latency
  - ES query count per report load
  - error rates

**Exit criteria**
- Demonstrable reduction in ES load and improved p95 latency vs export approach.

---

### Milestone 6 — Production readiness: security, versioning, monitoring

#### Deliverables
**Security**
- Authenticate connector → API:
  - keep `Api-Key` header
  - optionally add signed requests or short-lived tokens if needed
- Validate and sanitize all fields/filters:
  - allowlist fields only
  - reject unknown dimensions/metrics
- Prevent tenant leakage:
  - hostname required and validated per API key

**Versioning**
- Version the query API:
  - `/looker/query?v=1` or `/v1/looker/query`
- Connector includes a version constant.

**Monitoring**
- Metrics:
  - request rate
  - cache hit rate
  - ES query time
  - response time
  - error counts by type
- Logging:
  - request id
  - normalized query key
  - duration breakdown (cache vs ES)
  - row count returned

#### Testing before launch
- Security tests:
  - invalid API key
  - cross-hostname access attempts
  - injection-like filter attempts
- Regression suite:
  - replay saved fixtures and compare responses for stability
- “Real world” report test:
  - run the internal test report + one customer-like report

**Exit criteria**
- You can roll out safely with observability and rollback plan.

---

## 5) Recommended testing toolkit & workflow

### 5.1 Local dev workflow (fast + realistic)
1. Run Node API locally.
2. Expose Node via tunnel (ngrok/Cloudflare Tunnel).
3. Connector config includes `baseUrl` (dev vs prod).
4. Push connector code to Apps Script.
5. Test in Looker Studio “Connector Test Dashboard”.

### 5.2 Capture & replay: the secret weapon
- In connector `getData()`, log a sanitized version of the request:
  - requested fields
  - dateRange
  - filters
  - config params (non-secret)
- In Node, store received `/looker/query` payloads (sanitized) as fixtures.
- Build a replay command:
  - replays fixtures locally
  - asserts schema + types + non-empty results
  - prints latency

This turns “debugging Looker” into repeatable tests.

---

## 6) Detailed acceptance checklist by stage

### POC acceptance
- [ ] Two charts render in Looker using aggregated endpoints
- [ ] Apps Script never parses large CSV
- [ ] Under typical date ranges, no timeouts
- [ ] Correctness verified against ES

### Generic endpoint acceptance
- [ ] Scorecard + time series + top N work via `/looker/query`
- [ ] Field allowlist prevents arbitrary ES field access
- [ ] Basic filters work

### Self-serve acceptance
- [ ] Users can add their own charts using exposed fields
- [ ] Date controls + filters work predictably
- [ ] Connector schema uses metrics properly

### Production acceptance
- [ ] Caching improves repeat loads measurably
- [ ] Guardrails prevent runaway bucket queries
- [ ] Monitoring dashboards exist for API + ES performance

---

## 7) Risks & mitigations

1) **Looker request structure differences**
- Mitigation: log real request payloads early; implement only what appears.

2) **High-cardinality group-bys (url, user_agent, uuid)**
- Mitigation: either do not expose them, or expose with strict limits and warnings.

3) **Multi-dim group-by complexity**
- Mitigation: composite aggs + max dimensions + max rows.

4) **Apps Script quotas/timeouts**
- Mitigation: keep connector thin; push work to Node; keep payloads small.

5) **Timezone correctness**
- Mitigation: define one canonical timestamp; apply time zone in ES aggregations; write edge-case tests around day boundaries.

---

## 8) POC “hardcoded charts” blueprint (quick reference)

### Chart A: Pageviews per day
- Looker:
  - Dimension: date (day)
  - Metric: pageviews
- Node ES query:
  - filter by hostname + date range
  - `date_histogram` on timestamp with timezone
  - `value_count` or implicit doc_count as pageviews
- Output rows:
  - `[YYYYMMDD, pageviews]`

### Chart B: Top 20 paths
- Looker:
  - Dimension: path
  - Metric: pageviews
- Node ES query:
  - filter by hostname + date range
  - `terms` agg on `path.keyword` size=20
- Output rows:
  - `[path, pageviews]`

---

## 9) Next actions (practical sequence)

1. **Decide canonical fields**
   - timestamp field
   - visitor unique key
   - keyword fields for group-by

2. **Build POC Node endpoints**
   - time series + top paths

3. **Create POC connector schema + routing**
   - only the fields needed for the two charts

4. **Create Looker “Connector Test Dashboard”**
   - date range control + 2 charts

5. **Verify performance + correctness**
   - then move to generic `/looker/query`

---

## Appendix: What to log (recommended)

### Connector logs (sanitized)
- requestedFieldIds
- dateRange
- filter summary (field/op/value length only)
- response row count
- connector execution time

### Node logs (sanitized)
- queryKey (hash)
- cache hit/miss
- ES request time
- total time
- row count returned
- bucket counts (for guardrail tuning)

---

*This plan intentionally starts with a hardcoded POC to prove the architecture and performance characteristics, then expands to a generic query contract that enables user-created charts without needing endpoint-per-chart support.*