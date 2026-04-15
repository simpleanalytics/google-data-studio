# Phase 0 Tests

This document covers the current POC smoke tests before the full POST-based implementation starts.

Current limitation: Phase 0 only supports the day-level timeseries shape. Explicit interval support for `hour`, `week`, `month`, and `year` starts in the later implementation phases.

## Goal

Phase 0 is done when:

- the dashboard proxy responds locally
- the elasticsearch-api responds locally
- the current timeseries and top-paths POC shapes both work
- basic invalid input handling works

## Preconditions

- dashboard runs on `http://localhost:3000`
- elasticsearch-api runs on `http://localhost:5602`
- `seed.com` exists locally and has seeded data
- `YOUR_API_KEY` has access to `seed.com`

## Test 1 — Dashboard timeseries

```bash
curl -s "http://localhost:3000/api/looker/query?hostname=seed.com&start=2026-01-10&end=2026-02-17&timezone=Etc/UTC&shape=timeseries" \
  -H "Api-Key: YOUR_API_KEY" | jq
```

Expected output:

- HTTP `200`
- `.schema == [{"name":"date","type":"STRING"},{"name":"pageviews","type":"NUMBER"}]`
- `.rows` is non-empty
- every row looks like `{ "date": "20260210", "pageviews": 123 }`

## Test 2 — Dashboard top paths

```bash
curl -s "http://localhost:3000/api/looker/query?hostname=seed.com&start=2026-01-10&end=2026-02-17&timezone=Etc/UTC&shape=top_paths&limit=20" \
  -H "Api-Key: YOUR_API_KEY" | jq
```

Expected output:

- HTTP `200`
- `.schema == [{"name":"path","type":"STRING"},{"name":"pageviews","type":"NUMBER"}]`
- `.rows | length <= 20`
- every row looks like `{ "path": "/pricing", "pageviews": 123 }`

## Test 3 — Elasticsearch API timeseries

```bash
curl -s "http://localhost:5602/api/looker/query?hostname=seed.com&start=2026-01-10&end=2026-02-17&timezone=Etc/UTC&shape=timeseries" | jq
```

Expected output:

- HTTP `200`
- same schema as the dashboard timeseries response
- same first and last row as the dashboard response for the same request

## Test 4 — Elasticsearch API top paths

```bash
curl -s "http://localhost:5602/api/looker/query?hostname=seed.com&start=2026-01-10&end=2026-02-17&timezone=Etc/UTC&shape=top_paths&limit=20" | jq
```

Expected output:

- HTTP `200`
- same schema as the dashboard top-paths response
- same number of rows as the dashboard response for the same request

## Test 5 — Invalid shape

```bash
curl -i -s "http://localhost:5602/api/looker/query?hostname=seed.com&start=2026-01-10&end=2026-02-17&shape=nope"
```

Expected output:

- HTTP `400`
- body contains `{ "error": "..." }`

## Test 6 — Invalid timezone

```bash
curl -i -s "http://localhost:3000/api/looker/query?hostname=seed.com&start=2026-01-10&end=2026-02-17&timezone=Nope/Zone&shape=timeseries" \
  -H "Api-Key: YOUR_API_KEY"
```

Expected output:

- HTTP `400`
- body contains an `error` mentioning invalid timezone

## Test 7 — Invalid limit

```bash
curl -i -s "http://localhost:5602/api/looker/query?hostname=seed.com&start=2026-01-10&end=2026-02-17&shape=top_paths&limit=9999"
```

Expected output:

- HTTP `400`
- body contains an `error` mentioning invalid limit

## Definition Of Done

Phase 0 is done when all seven tests pass and the dashboard proxy matches the elasticsearch-api for both current POC query shapes.
