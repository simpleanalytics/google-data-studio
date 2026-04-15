# Phase 5 Tests

This document defines done for Phase 5: guardrails and production hardening.

## Goal

Phase 5 is done when invalid, oversized, or unauthorized requests are rejected cleanly and common report requests continue to work with stable latency and observability.

## Preconditions

- Phase 4 is complete
- monitoring/logging is in place for dashboard and elasticsearch-api
- hard limits for dimensions, metrics, row count, and response size are implemented

## Test 1 — Unauthorized hostname access

```bash
curl -i -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: API_KEY_WITHOUT_ACCESS" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "dimensions": ["date"],
    "metrics": ["pageviews"],
    "filters": [],
    "orderBy": [],
    "limit": 20
  }'
```

Expected output:

- HTTP `403`
- body contains `{ "error": "..." }`

## Test 2 — Row limit guardrail

```bash
curl -i -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "dimensions": ["path"],
    "metrics": ["pageviews"],
    "filters": [],
    "orderBy": [{ "field": "pageviews", "direction": "DESC" }],
    "limit": 50000
  }'
```

Expected output:

- either HTTP `400` rejecting the request
- or HTTP `200` with `meta.truncated == true` and rows clipped to the documented maximum

One behavior must be chosen and documented. Silent unlimited success is not acceptable.

## Test 3 — Unsupported high-cardinality field rejection

```bash
curl -i -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "dimensions": ["full_user_agent"],
    "metrics": ["pageviews"],
    "filters": [],
    "orderBy": [],
    "limit": 20
  }'
```

Expected output:

- HTTP `400`
- error mentions unsupported field or disallowed dimension

## Test 4 — Standard request still succeeds

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "interval": "week",
    "dimensions": ["date"],
    "metrics": ["pageviews", "unique_visitors"],
    "filters": [
      { "field": "country_code", "operator": "EQUALS", "values": ["NL"] }
    ],
    "orderBy": [],
    "limit": 100
  }' | jq
```

Expected output:

- HTTP `200`
- `.rows` is non-empty
- every `date` matches `YYYYWW`
- both metrics are numeric on every row

## Test 5 — Replay and latency sanity check

Run one representative scorecard, one timeseries, one filtered breakdown, and one multi-dimension table request 20 times each.

Example loop:

```bash
for i in $(seq 1 20); do
  curl -s -o /dev/null -w "%{http_code} %{time_total}\n" -X POST "http://localhost:3000/api/looker/query" \
    -H "Content-Type: application/json" \
    -H "Api-Key: YOUR_API_KEY" \
    --data '{"hostname":"seed.com","timezone":"Etc/UTC","dateRange":{"start":"2026-01-10","end":"2026-02-17"},"interval":"day","dimensions":["date"],"metrics":["pageviews"],"filters":[],"orderBy":[],"limit":100}'
done
```

Expected output:

- every line starts with `200`
- no intermittent `500`
- latency stays in an acceptable local-dev range for the seeded dataset
- logs include enough context to identify failures by request shape

## Definition Of Done

Phase 5 is done when all five tests pass, the chosen guardrail behavior is documented, and standard report requests still succeed after the hardening work.
