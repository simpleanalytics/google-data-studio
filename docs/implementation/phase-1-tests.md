# Phase 1 Tests

This document defines done for Phase 1: replacing the POC route with the real POST request contract while keeping support limited to scorecards, interval-aware date histograms, and single terms aggregations.

## Goal

Phase 1 is done when:

- the dashboard proxy accepts `POST /api/looker/query`
- the elasticsearch-api accepts `POST /api/looker/query`
- scorecard, date histogram, and single-dimension terms requests work
- date histograms support `hour`, `day`, `week`, `month`, and `year`
- dashboard and elasticsearch-api return the same payload shape for the same logical request
- invalid inputs fail with `400`

## Preconditions

- dashboard runs on `http://localhost:3000`
- elasticsearch-api runs on `http://localhost:5602`
- `seed.com` exists locally and has seeded data
- `YOUR_API_KEY` has access to `seed.com`

## Test 1 — Dashboard day histogram request

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "interval": "day",
    "dimensions": ["date"],
    "metrics": ["pageviews"],
    "filters": [],
    "orderBy": [],
    "limit": 100
  }' | jq
```

Expected output:

- HTTP `200`
- `.schema` is exactly:

```json
[
  { "name": "date", "type": "STRING" },
  { "name": "pageviews", "type": "NUMBER" }
]
```

- `.rows` is a non-empty array
- every row has:
  - `date` as `YYYYMMDD`
  - `pageviews` as a number

Useful check:

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{"hostname":"seed.com","timezone":"Etc/UTC","dateRange":{"start":"2026-01-10","end":"2026-02-17"},"interval":"day","dimensions":["date"],"metrics":["pageviews"],"filters":[],"orderBy":[],"limit":100}' \
  | jq -e '.rows | length > 0 and all(.[]; (.date | test("^[0-9]{8}$")) and (.pageviews | type == "number"))'
```

## Test 2 — Interval coverage for date histograms

Day:

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{"hostname":"seed.com","timezone":"Etc/UTC","dateRange":{"start":"2026-01-10","end":"2026-02-17"},"interval":"day","dimensions":["date"],"metrics":["pageviews"],"filters":[],"orderBy":[],"limit":100}' \
  | jq -e '.rows | length > 0 and all(.[]; .date | test("^[0-9]{8}$"))'
```

Week:

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{"hostname":"seed.com","timezone":"Etc/UTC","dateRange":{"start":"2026-01-10","end":"2026-02-17"},"interval":"week","dimensions":["date"],"metrics":["pageviews"],"filters":[],"orderBy":[],"limit":100}' \
  | jq -e '.rows | length > 0 and all(.[]; .date | test("^[0-9]{6}$"))'
```

Month:

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{"hostname":"seed.com","timezone":"Etc/UTC","dateRange":{"start":"2026-01-10","end":"2026-02-17"},"interval":"month","dimensions":["date"],"metrics":["pageviews"],"filters":[],"orderBy":[],"limit":100}' \
  | jq -e '.rows | length > 0 and all(.[]; .date | test("^[0-9]{6}$"))'
```

Year:

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{"hostname":"seed.com","timezone":"Etc/UTC","dateRange":{"start":"2026-01-10","end":"2026-02-17"},"interval":"year","dimensions":["date"],"metrics":["pageviews"],"filters":[],"orderBy":[],"limit":100}' \
  | jq -e '.rows | length > 0 and all(.[]; .date | test("^[0-9]{4}$"))'
```

Hour:

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{"hostname":"seed.com","timezone":"Etc/UTC","dateRange":{"start":"2026-02-17","end":"2026-02-17"},"interval":"hour","dimensions":["date"],"metrics":["pageviews"],"filters":[],"orderBy":[],"limit":100}' \
  | jq -e '.rows | length > 0 and all(.[]; .date | test("^[0-9]{10}$"))'
```

Expected output for all five:

- HTTP `200`
- schema stays `[ { "name": "date", "type": "STRING" }, { "name": "pageviews", "type": "NUMBER" } ]`
- the `date` format matches the requested interval:
  - hour -> `YYYYMMDDHH`
  - day -> `YYYYMMDD`
  - week -> `YYYYWW`
  - month -> `YYYYMM`
  - year -> `YYYY`

## Test 3 — Elasticsearch API day histogram request

```bash
curl -s -X POST "http://localhost:5602/api/looker/query" \
  -H "Content-Type: application/json" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "interval": "day",
    "dimensions": ["date"],
    "metrics": ["pageviews"],
    "filters": [],
    "orderBy": [],
    "limit": 100
  }' | jq
```

Expected output:

- HTTP `200`
- same schema as the dashboard response
- same number of rows as the dashboard response
- same first and last date buckets as the dashboard response

Useful comparison:

```bash
BODY='{"hostname":"seed.com","timezone":"Etc/UTC","dateRange":{"start":"2026-01-10","end":"2026-02-17"},"interval":"day","dimensions":["date"],"metrics":["pageviews"],"filters":[],"orderBy":[],"limit":100}'

curl -s -X POST "http://localhost:3000/api/looker/query" -H "Content-Type: application/json" -H "Api-Key: YOUR_API_KEY" --data "$BODY" > /tmp/looker-dashboard.json
curl -s -X POST "http://localhost:5602/api/looker/query" -H "Content-Type: application/json" --data "$BODY" > /tmp/looker-es.json

diff -u <(jq '.schema, (.rows|length), .rows[0], .rows[-1]' /tmp/looker-dashboard.json) <(jq '.schema, (.rows|length), .rows[0], .rows[-1]' /tmp/looker-es.json)
```

Expected output: no diff.

## Test 4 — Scorecard request

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "dimensions": [],
    "metrics": ["pageviews"],
    "filters": [],
    "orderBy": [],
    "limit": 1
  }' | jq
```

Expected output:

- HTTP `200`
- `.schema` equals `[ { "name": "pageviews", "type": "NUMBER" } ]`
- `.rows` has exactly one row
- `.rows[0].pageviews` is a number greater than or equal to `0`

## Test 5 — Single terms aggregation

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
    "filters": [],
    "orderBy": [{ "field": "pageviews", "direction": "DESC" }],
    "limit": 20
  }' | jq
```

Expected output:

- HTTP `200`
- `.schema` is exactly:

```json
[
  { "name": "path", "type": "STRING" },
  { "name": "pageviews", "type": "NUMBER" }
]
```

- `.rows | length <= 20`
- every row has `path` string and `pageviews` number
- rows are sorted by `pageviews` descending

## Test 6 — Invalid request handling

Invalid field:

```bash
curl -i -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "dimensions": ["not_a_field"],
    "metrics": ["pageviews"],
    "filters": [],
    "orderBy": [],
    "limit": 20
  }'
```

Expected output:

- HTTP `400`
- body contains `{ "error": "..." }`

Invalid timezone:

```bash
curl -i -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Nope/Zone",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "interval": "day",
    "dimensions": ["date"],
    "metrics": ["pageviews"],
    "filters": [],
    "orderBy": [],
    "limit": 20
  }'
```

Expected output:

- HTTP `400`
- body contains an `error` mentioning invalid timezone

Invalid interval:

```bash
curl -i -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "interval": "quarter",
    "dimensions": ["date"],
    "metrics": ["pageviews"],
    "filters": [],
    "orderBy": [],
    "limit": 20
  }'
```

Expected output:

- HTTP `400`
- body contains an `error` mentioning invalid interval

## Test 7 — Default interval is day

```bash
curl -s -X POST "http://localhost:3000/api/looker/query" \
  -H "Content-Type: application/json" \
  -H "Api-Key: YOUR_API_KEY" \
  --data '{
    "hostname": "seed.com",
    "timezone": "Etc/UTC",
    "dateRange": { "start": "2026-01-10", "end": "2026-02-17" },
    "dimensions": ["date"],
    "metrics": ["pageviews"],
    "filters": [],
    "orderBy": [],
    "limit": 100
  }' | jq -e '.rows | length > 0 and all(.[]; .date | test("^[0-9]{8}$"))'
```

Expected output:

- HTTP `200`
- omitted `interval` behaves the same as `interval: day`
- every returned `date` matches `YYYYMMDD`

## Definition Of Done

Phase 1 is done when all seven tests pass on both local services, all five supported intervals work for date histograms, omitted `interval` defaults to `day`, and the dashboard response matches the elasticsearch-api response for the same request body.
