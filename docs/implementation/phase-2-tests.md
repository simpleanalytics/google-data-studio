# Phase 2 Tests

This document defines done for Phase 2: expanding the field surface beyond the POC while keeping query planning limited to scorecards, date histograms, and single-dimension breakdowns.

## Goal

Phase 2 is done when the curated field list is exposed consistently and the first non-POC dimensions and metrics work end-to-end.

## Preconditions

- Phase 1 is complete
- the catalog includes at least these dimensions: `date`, `path`, `country_code`, `device_type`
- the catalog includes at least these metrics: `pageviews`, `unique_visitors`, `avg_duration`, `avg_scroll`

## Test 1 — Country breakdown

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
    "filters": [],
    "orderBy": [{ "field": "pageviews", "direction": "DESC" }],
    "limit": 10
  }' | jq
```

Expected output:

- HTTP `200`
- `.schema` equals:

```json
[
  { "name": "country_code", "type": "STRING" },
  { "name": "pageviews", "type": "NUMBER" }
]
```

- `.rows | length <= 10`
- every `country_code` is a string
- every `pageviews` is a number

## Test 2 — Device type with unique visitors

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "dimensions": ["device_type"],
    "metrics": ["unique_visitors"],
    "filters": [],
    "orderBy": [{ "field": "unique_visitors", "direction": "DESC" }],
    "limit": 10
  }' | jq
```

Expected output:

- HTTP `200`
- `.schema` equals:

```json
[
  { "name": "device_type", "type": "STRING" },
  { "name": "unique_visitors", "type": "NUMBER" }
]
```

- `.rows` is non-empty
- every `unique_visitors` is a number

## Test 3 — Date histogram with multiple metrics

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "dimensions": ["date"],
    "metrics": ["pageviews", "unique_visitors", "avg_duration"],
    "filters": [],
    "orderBy": [],
    "limit": 100
  }' | jq
```

Expected output:

- HTTP `200`
- `.schema` contains `date`, `pageviews`, `unique_visitors`, `avg_duration`
- each row has all four fields
- `date` matches `YYYYMMDD`
- all metric fields are numeric

## Test 4 — Scorecard with non-POC metric

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "dimensions": [],
    "metrics": ["avg_scroll"],
    "filters": [],
    "orderBy": [],
    "limit": 1
  }' | jq
```

Expected output:

- HTTP `200`
- `.schema == [{"name":"avg_scroll","type":"NUMBER"}]`
- `.rows | length == 1`
- `.rows[0].avg_scroll` is a number

## Test 5 — Unknown metric rejection

```bash
curl -i -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "dimensions": ["country_code"],
    "metrics": ["not_a_metric"],
    "filters": [],
    "orderBy": [],
    "limit": 10
  }'
```

Expected output:

- HTTP `400`
- body contains an `error` mentioning unknown metric or unsupported field

## Definition Of Done

Phase 2 is done when all five tests pass and the connector schema in Looker Studio shows the new dimensions as dimensions and the new metrics as metrics.
