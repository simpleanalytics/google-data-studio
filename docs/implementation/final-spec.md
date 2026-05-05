# Final Connector Spec

This document describes the current intended connector behavior without the earlier phase-based rollout language.

## Contract

- endpoint: `POST /api/looker/query`
- dashboard proxy remains the connector-facing entrypoint
- elasticsearch-api remains the upstream query executor
- all requests and responses use JSON

## Supported Query Shapes

- scorecards with one or more metrics
- date histograms with one date dimension
- grouped breakdowns with one non-date dimension
- grouped tables with up to five dimensions total

## Supported Limits

- max metrics: `10`
- max dimensions: `5`
- no hard request row limit
- no hard terms limit
- no max response-bytes guardrail

Notes:

- `limit` is optional
- when `limit` is provided it must be a positive integer
- when `limit` is omitted, grouped queries return all collected rows

## Supported Metrics

- `pageviews`
- `unique_visitors`
- `avg_duration`
- `avg_scroll`

## Supported Dimensions

- `date_hour`
- `date_day`
- `date_week`
- `date_month`
- `date_year`
- `path`
- `referrer_hostname`
- `country_code`
- `device_type`
- `browser_name`
- `os_name`
- `utm_source`
- `utm_medium`
- `utm_campaign`

## Filter Support

Supported operators:

- `EQUALS`
- `IN`
- `CONTAINS`
- `NOT_EQUALS`

`CONTAINS` is only supported for:

- `path`
- `referrer_hostname`
- `utm_source`
- `utm_medium`
- `utm_campaign`

## Sorting

- scorecards do not support sorting
- date histograms can only sort by `date`
- grouped queries can sort by selected dimensions or selected metrics
- at most one sort clause is supported

## Response Shape

```json
{
  "schema": [
    { "name": "date", "type": "STRING" },
    { "name": "country_code", "type": "STRING" },
    { "name": "pageviews", "type": "NUMBER" }
  ],
  "rows": [
    {
      "date": "202601",
      "country_code": "NL",
      "pageviews": 123
    }
  ],
  "meta": {
    "queryType": "composite",
    "rowCount": 1,
    "truncated": false
  }
}
```

## Observability

Dashboard and elasticsearch-api logs should include:

- query fingerprint
- query type
- dimension count
- metric count
- filter count
- sort count
- row count
- duration
- sanitized filter summaries
