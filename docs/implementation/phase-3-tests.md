# Phase 3 Tests

This document defines done for Phase 3: filter pushdown.

## Goal

Phase 3 is done when dashboard and elasticsearch-api both accept normalized filters, apply them server-side, and reject unsupported operators cleanly.

## Preconditions

- Phase 2 is complete
- fields under test are allowlisted for filtering
- local seed data includes multiple countries, device types, and paths

## Test 1 — EQUALS filter

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "dimensions": ["country_code"],
    "metrics": ["pageviews"],
    "filters": [
      { "field": "country_code", "operator": "EQUALS", "values": ["NL"] }
    ],
    "orderBy": [{ "field": "pageviews", "direction": "DESC" }],
    "limit": 20
  }' | jq
```

Expected output:

- HTTP `200`
- every row has `country_code == "NL"`

Useful check:

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{"hostname":"seed.com","timezone":"Etc/UTC","dateRange":{"start":"2026-01-10","end":"2026-02-17"},"dimensions":["country_code"],"metrics":["pageviews"],"filters":[{"field":"country_code","operator":"EQUALS","values":["NL"]}],"orderBy":[{"field":"pageviews","direction":"DESC"}],"limit":20}' \
  | jq -e '.rows | all(.[]; .country_code == "NL")'
```

## Test 2 — IN filter

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "dimensions": ["device_type"],
    "metrics": ["pageviews"],
    "filters": [
      { "field": "device_type", "operator": "IN", "values": ["desktop", "mobile"] }
    ],
    "orderBy": [{ "field": "pageviews", "direction": "DESC" }],
    "limit": 20
  }' | jq
```

Expected output:

- HTTP `200`
- every row has `device_type` equal to `desktop` or `mobile`

## Test 3 — CONTAINS filter

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "dimensions": ["path"],
    "metrics": ["pageviews"],
    "filters": [
      { "field": "path", "operator": "CONTAINS", "values": ["blog"] }
    ],
    "orderBy": [{ "field": "pageviews", "direction": "DESC" }],
    "limit": 20
  }' | jq
```

Expected output:

- HTTP `200`
- every row `path` contains `blog`

## Test 4 — Combined filters

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "dimensions": ["path"],
    "metrics": ["pageviews"],
    "filters": [
      { "field": "device_type", "operator": "IN", "values": ["desktop"] },
      { "field": "path", "operator": "CONTAINS", "values": ["pricing"] }
    ],
    "orderBy": [{ "field": "pageviews", "direction": "DESC" }],
    "limit": 20
  }' | jq
```

Expected output:

- HTTP `200`
- every row `path` contains `pricing`
- total row count is less than or equal to the unfiltered top-paths result for the same date range

## Test 5 — Unsupported filter rejection

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
    "filters": [
      { "field": "path", "operator": "REGEX", "values": [".*"] }
    ],
    "orderBy": [],
    "limit": 20
  }'
```

Expected output:

- HTTP `400`
- body contains `{ "error": "..." }`

## Definition Of Done

Phase 3 is done when all five tests pass and the filtered dashboard response matches the filtered elasticsearch-api response for the same request body.
