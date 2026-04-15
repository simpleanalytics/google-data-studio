# Phase 4 Tests

This document defines done for Phase 4: multi-dimension support with composite aggregations.

## Goal

Phase 4 is done when two- and three-dimension grouped requests work, stay flat in the response, and respect sorting and limit guardrails.

## Preconditions

- Phase 3 is complete
- composite aggregation planning exists in elasticsearch-api
- at least `date`, `country_code`, `device_type`, and `path` are groupable
- interval-aware histograms already work from Phase 1

## Test 1 — Two dimensions: date + country

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "interval": "month",
    "dimensions": ["date", "country_code"],
    "metrics": ["pageviews"],
    "filters": [],
    "orderBy": [{ "field": "date", "direction": "ASC" }],
    "limit": 100
  }' | jq
```

Expected output:

- HTTP `200`
- `.schema` contains `date`, `country_code`, `pageviews`
- every row has all three fields
- `date` matches `YYYYMM` for `interval: month`
- `pageviews` is numeric

## Test 2 — Two dimensions: path + device type

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "dimensions": ["path", "device_type"],
    "metrics": ["pageviews"],
    "filters": [],
    "orderBy": [{ "field": "pageviews", "direction": "DESC" }],
    "limit": 50
  }' | jq
```

Expected output:

- HTTP `200`
- `.rows | length <= 50`
- each row contains `path`, `device_type`, `pageviews`

## Test 3 — Three dimensions

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "interval": "day",
    "dimensions": ["date", "country_code", "device_type"],
    "metrics": ["pageviews"],
    "filters": [],
    "orderBy": [{ "field": "pageviews", "direction": "DESC" }],
    "limit": 100
  }' | jq
```

Expected output:

- HTTP `200` if three dimensions are allowed
- `.rows | length <= 100`
- flat rows only, no nested bucket structure anywhere in the response

Useful check:

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{"hostname":"seed.com","timezone":"Etc/UTC","dateRange":{"start":"2026-01-10","end":"2026-02-17"},"interval":"day","dimensions":["date","country_code","device_type"],"metrics":["pageviews"],"filters":[],"orderBy":[{"field":"pageviews","direction":"DESC"}],"limit":100}' \
  | jq -e 'has("rows") and (.rows | type == "array") and (.. | objects | has("buckets") | not)'
```

## Test 4 — Guardrail on too many dimensions

```bash
curl -i -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "interval": "day",
    "dimensions": ["date", "country_code", "device_type", "path"],
    "metrics": ["pageviews"],
    "filters": [],
    "orderBy": [],
    "limit": 100
  }'
```

Expected output:

- HTTP `400`
- error mentions too many dimensions or unsupported combination

## Test 5 — Dashboard and ES API parity

```bash
BODY='{"hostname":"seed.com","timezone":"Etc/UTC","dateRange":{"start":"2026-01-10","end":"2026-02-17"},"interval":"month","dimensions":["date","country_code"],"metrics":["pageviews"],"filters":[],"orderBy":[{"field":"date","direction":"ASC"}],"limit":100}'

curl -s -X POST "http://localhost:3000/api/looker/query" -H "Content-Type: application/json" -H "Api-Key: YOUR_API_KEY" --data "$BODY" > /tmp/phase4-dashboard.json
curl -s -X POST "http://localhost:5602/api/looker/query" -H "Content-Type: application/json" --data "$BODY" > /tmp/phase4-es.json

diff -u <(jq '.schema, (.rows|length), .rows[0], .rows[-1]' /tmp/phase4-dashboard.json) <(jq '.schema, (.rows|length), .rows[0], .rows[-1]' /tmp/phase4-es.json)
```

Expected output: no diff.

## Definition Of Done

Phase 4 is done when all five tests pass and a Looker Studio table with two dimensions and one metric renders without connector-side special casing.
