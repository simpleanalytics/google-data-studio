# V3 Events Phase Summary

## Phase 0 - V3 Foundation

- Create `v3/Code.gs` from `v2/Code.gs` without changing v2.
- Add required v3 connector `dataset` config: `pageviews` or `events`.
- Add `dataset` to connector payloads, logs, and fingerprints.
- Make dashboard and elasticsearch-api accept optional `dataset`, defaulting to `pageviews` for v2 compatibility.
- Split validation/catalog structure by dataset, while preserving current pageview behavior.
- Reject unknown datasets with `400`.

## Phase 1 - Static Event Reporting MVP

- Add static event fields: date granularities, `event_name`, `events`, `unique_visitors`.
- Support event scorecards, date histograms, and top-event grouped charts.
- Use `hostname_non_robot_event` as the event base query field.
- Map `event_name` to `datapoint`.
- Map `events` to document count and `unique_visitors` to cardinality on `meta.session_id`.
- Reject event filters until Phase 3.

## Phase 2 - Multi-Dimension Event Tables

- Support event composite queries with multiple dimensions.
- Allow shapes like `date + event_name + events` and `event_name + events + unique_visitors`.
- Reuse pageview composite pagination, sorting, limits, and row shaping patterns.
- Ensure sort fields belong to selected event dimensions or metrics.

## Phase 3 - Event Filter Controls

- Add event filter support for `event_name`.
- Support `EQUALS`, `IN`, and `NOT_EQUALS`.
- Map filters to `datapoint` term, terms, and `must_not` queries.
- Reject unsupported event filter fields/operators before querying Elasticsearch.

## Phase 4 - Guarded Event Metadata Dimensions

- Add a dashboard-owned schema helper for approved event metadata fields.
- Expose approved metadata as event-only dimensions with `event_meta_` field ids.
- Map metadata dimensions to `metadata_flattened.*` in elasticsearch-api.
- Enforce allowlists, caps, and identifier guardrails.
- Reject unknown metadata field ids with `400`.

## Phase 5 - Metadata Filters

- Add filters for approved metadata dimensions.
- Support `EQUALS`, `IN`, and `NOT_EQUALS`.
- Map metadata filters to `metadata_flattened.*` term, terms, and `must_not` queries.
- Keep `CONTAINS` rejected unless explicitly added later.

## Phase 6 - Hardening And Release

- Add regression tests for v2 requests without `dataset`.
- Add dashboard and elasticsearch-api tests for pageview and event datasets.
- Add connector/manual tests for v3 pageviews and events.
- Update final documentation after implementation.
- Deploy dashboard and elasticsearch-api first, then publish v3 connector.
- Confirm v2 pageviews, v3 pageviews, and v3 events all work independently.
