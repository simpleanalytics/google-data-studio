# Events Implementation Plan

This document describes how to add event reporting to the `v2` Looker Studio connector without destabilizing the pageview work that already exists.

## Recommendation

Implement events as a separate planner inside the Looker query flow, with an explicit dataset switch in the contract.

Recommended request shape addition:

```json
{
  "dataset": "pageviews"
}
```

Supported values:

- `pageviews`
- `events`

Why this is the recommended approach:

- the connector can stay a single data source instead of needing separate auth/config flows
- the dashboard can keep one public Looker entrypoint while branching internally
- pageview validation and event validation can live in separate planner modules
- we avoid changing shared dashboard transport code again

Important rule:

- do not allow pageview and event fields in the same query initially

## What The Stack Already Supports Today

The current product stack already has real event support outside the Looker connector.

### Elasticsearch shape

Events are stored as custom datapoints.

- event name lives in `datapoint`
- event rows are identified with `custom_datapoint = true`
- non-robot event queries can use `hostname_non_robot_event`
- pageviews stay on the non-custom path and use `hostname_non_robot_pageview`

Relevant places:

- `../elasticsearch-api/server/dao/datapoints-dao.js`
- `../elasticsearch-api/server/rest/datapoints.js`
- `../elasticsearch-api/server/rest/export.js`

### Existing Elasticsearch API capabilities

The elasticsearch-api already exposes event-specific primitives:

- `/api/datapoints/stats`
  - counts event names
  - can filter to `custom_datapoint=true`
- `/api/datapoints/top`
  - groups by ordered event fields and metadata fields
  - uses recursive terms aggregations
- `/api/datapoints/metadata`
  - discovers available metadata keys and sample values
- `/api/datapoints/conversion`
  - handles ordered event funnels/goals
- `/api/export?type=events`
  - exports raw event rows

### Existing dashboard usage

The dashboard already uses event APIs in multiple places.

- `../dashboard/src/responders/api/dashboard.ts`
  - event list/stats via `/datapoints/stats`
  - goal funnels via `/datapoints/conversion`
- `../dashboard/src/responders/api/website.ts`
  - event counts via `/datapoints/stats`
- `../dashboard/src/responders/api/goals.ts`
  - goal creation and conversion reporting
- `../dashboard/src/lib/goals.ts`
  - converts goal event definitions and metadata filters into Elasticsearch keys

### Existing metadata model

Event metadata is already flattened and queryable.

- metadata keys are stored under `metadata_flattened.*`
- dashboard goal helpers already translate `metadata.*` keys to `metadata_flattened.*`
- url params are normalized through the `sa_p_` / `sa_urlparam_` convention

## What Makes Events Different From Pageviews

Events are not just another metric on top of the pageview dataset.

- pageviews use a fixed dimension catalog like `path`, `country_code`, `device_type`
- events use `datapoint` as the event name plus site-specific metadata keys
- event metadata is partially dynamic per website
- some event analysis is simple counting, but some is ordered funnel logic

Because of that, event support should not be bolted onto the current pageview field catalog.

## Recommended Scope Split

Split event work into two tracks:

1. event reporting for Looker tables/charts
2. funnel/conversion analysis for goals

For the connector, start with event reporting only.

Out of scope for the first event rollout:

- funnels
- ordered conversion chains
- mixed pageview + event queries
- arbitrary dynamic metadata exposure without guardrails

## Proposed Contract

Use the same dashboard endpoint with one new required logical selector:

```json
{
  "dataset": "events",
  "hostname": "example.com",
  "timezone": "Europe/Amsterdam",
  "dateRange": {
    "start": "2026-01-01",
    "end": "2026-01-31"
  },
  "interval": "day",
  "dimensions": ["date"],
  "metrics": ["events"],
  "filters": [],
  "orderBy": [
    {
      "field": "date",
      "direction": "ASC"
    }
  ],
  "limit": 100
}
```

Rules:

- `dataset=pageviews` uses the existing pageview planner
- `dataset=events` uses the new event planner
- a query may only use fields from one dataset
- `interval` is only valid when a date dimension is selected

## Field Strategy

Use separate catalogs for pageviews and events.

### Event fields to support first

Static dimensions:

- `date_hour`
- `date_day`
- `date_week`
- `date_month`
- `date_year`
- `event_name`

Static metrics:

- `events`
- `unique_visitors`

Recommended first-release behavior:

- `event_name` maps to Elasticsearch `datapoint`
- `events` maps to document count on `custom_datapoint=true`
- `unique_visitors` maps to cardinality on `meta.session_id`

### Dynamic metadata fields

Do not ship unrestricted dynamic metadata in the first event release.

Instead, add it in a second step with explicit guardrails.

Recommended model:

- discover keys from `/api/datapoints/metadata`
- expose only allowlisted metadata keys to the connector schema
- prefix them clearly, for example `event_meta.plan`, `event_meta.button_text`
- cap the number of exposed metadata dimensions per data source
- hide high-cardinality keys by default

## Implementation Phases

## Phase E1 - Static Event Reporting

Goal: support event scorecards, event time series, and top events.

### Connector

- add a dataset selector to the internal field catalog model
- add event fields:
  - `event_name`
  - `events`
  - `unique_visitors`
  - the same interval-specific date dimensions
- keep the connector thin
- when event fields are selected, send `dataset: "events"`
- reject mixed dataset queries early in Apps Script

### Dashboard

- extend the Looker endpoint validation to require all selected fields to belong to one dataset
- branch to an event planner when `dataset === "events"`
- keep pageview validation logic isolated from event validation logic
- do not touch shared request helpers unless strictly necessary

### Elasticsearch API

- add an event planner inside the Looker route
- filter on the event dataset using the existing event semantics:
  - `custom_datapoint=true`
  - `hostname_non_robot_event` when robots are excluded
- support query types:
  - scorecard: no dimensions
  - date histogram: `date`
  - terms: `event_name`

### Sort rules

- scorecard: no sort
- date histogram: only by `date`
- terms: by `event_name`, `events`, or `unique_visitors`

### Done means

- scorecard: `events`
- scorecard: `unique_visitors`
- time series: `date_day + events`
- time series: `date_day + unique_visitors`
- table/bar: `event_name + events`

## Phase E2 - Event Metadata Dimensions

Goal: support site-specific event metadata for grouping.

### Discovery

- use `/api/datapoints/metadata` to discover candidate keys
- add a dashboard-side metadata discovery helper for the connector if needed

### Connector

- build event metadata schema dynamically per hostname
- namespace event metadata fields clearly
- expose only approved metadata keys

### Dashboard

- validate metadata field ids against a derived allowlist
- map connector field ids to `metadata_flattened.*`
- reject unknown metadata keys cleanly

### Elasticsearch API

- reuse the existing metadata grouping behavior from `/api/datapoints/top`
- add flat row shaping for Looker responses

### Guardrails

- max exposed metadata dimensions per source
- max row limit remains `1000`
- block obviously high-cardinality metadata keys by default

### Done means

- a site can group events by at least one metadata key in Looker
- results stay flat and schema-safe

## Phase E3 - Event Filters Pushdown

Goal: support Looker filter controls for events.

### Fields to filter first

- `event_name`
- approved metadata fields

### Operators to support first

- `EQUALS`
- `IN`
- `NOT_EQUALS`

Optional later:

- `CONTAINS` only for carefully selected text metadata fields

### Reuse opportunity

- dashboard goal filter conversion already knows how to map metadata keys
- some of that normalization logic can be shared with the event Looker planner

### Done means

- Looker drop-down filters change event results server-side
- invalid metadata filters fail with `400`

## Phase E4 - Goal/Funnel Dataset For Looker (Optional)

Goal: expose goal-style event funnels if we decide Looker needs them.

This should be treated as a separate analytical mode, not part of the base event reporting dataset.

Why separate:

- funnels are ordered sequences, not simple grouped rows
- they likely need a different contract shape
- they are much closer to `/api/datapoints/conversion` than to standard chart aggregation

Recommendation:

- postpone this until normal event reporting is stable

## Query Mapping Notes

Recommended event dimension mapping:

- `event_name` -> `datapoint`
- event metadata field -> `metadata_flattened.<key>`
- date dimensions -> normalized `date + interval`

Recommended event metric mapping:

- `events` -> document count
- `unique_visitors` -> cardinality on `meta.session_id`

## Risks And Guardrails

### Dynamic schema risk

Event metadata varies per website, so connector schema can become unstable.

Mitigation:

- start with static event fields only
- add dynamic metadata later behind discovery + allowlisting

### High-cardinality risk

Some metadata keys can explode bucket counts.

Mitigation:

- cap metadata fields
- cap rows
- prefer explicit allowlists over automatic inclusion

### Cross-dataset confusion

Users may try to mix pageview dimensions like `path` with event fields.

Mitigation:

- make dataset ownership explicit in the catalog
- reject mixed queries in the connector and dashboard

## Suggested Test Plan

### E1 tests

- scorecard with `events`
- scorecard with `unique_visitors`
- histogram with `date_day + events`
- histogram with `date_month + unique_visitors`
- top events with `event_name + events`
- reject `path + events`

### E2 tests

- metadata discovery returns approved keys only
- metadata grouping works for one chosen key
- unknown metadata key returns `400`

### E3 tests

- filter on `event_name`
- filter on one metadata field
- invalid operator returns `400`

## Recommended Build Order

1. Add the event dataset selector and static event catalog.
2. Ship event counts, histograms, and top events.
3. Add guarded metadata discovery and metadata grouping.
4. Add event filter pushdown.
5. Revisit funnels only if Looker reporting needs them.

## Summary

The good news is that events are already first-class in the underlying product stack.

What is missing is not raw capability, but a Looker-oriented contract and a safe schema strategy.

The safest path is:

- keep pageviews and events as separate datasets
- start with static event fields
- layer metadata support on top later
- keep funnels separate from the first event reporting rollout
