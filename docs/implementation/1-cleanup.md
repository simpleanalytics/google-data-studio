# Cleanup Status

This document tracks the cleanup work that was needed before moving from the POC into the full `v2` implementation.

## Scope

- All active connector work happens in `v2`.
- `v1` stays untouched and remains historical reference only.
- The connector talks to the dashboard proxy at `https://simpleanalytics.com/api/looker/query`.
- The dashboard proxy forwards supported requests to `../elasticsearch-api`.
- Caching remains out of scope for now.

## What Was Cleaned Up

### 1. The POC now covers two real query shapes

The original POC only proved the time-series path. That cleanup item is now complete.

Implemented:

- `timeseries` for `date + pageviews`
- `top_paths` for `path + pageviews`

Result:

- the POC now proves both histogram and top-N style aggregation behavior
- the route name `query` is acceptable for the current POC because it no longer maps to only one shape

### 2. `v2` now has a field catalog foundation

The original `v2` schema was too ad hoc. That cleanup item is now partially complete.

Implemented:

- `v2/Code.gs` now uses a small field catalog instead of a one-off schema array
- current catalog covers:
  - `date`
  - `path`
  - `pageviews`

Still to do:

- expand the catalog to the full production field set
- align connector, dashboard, and elasticsearch-api around the same logical field definitions
- attach filter, sort, and aggregation metadata to each field

### 3. The dashboard proxy and upstream endpoint now follow cleaner API behavior

This cleanup item is largely complete for the POC.

Implemented:

- `../dashboard/src/responders/api/looker/query.ts` validates request shape more explicitly
- the dashboard makes it clear that it is the public connector-facing endpoint
- `../elasticsearch-api/server/rest/looker.js` now validates query input more explicitly
- invalid shape, timezone, and limit cases return `400`
- proxy and upstream both return clean `{ error }` payloads

Still to do:

- move from the current POC contract to the final POST-based contract
- standardize the full production request and response contract across both layers
- add the full allowlist-based validation for dimensions, metrics, filters, sort, and limits

### 4. `v2` connector request handling is now hardened for the POC

This cleanup item is complete for the current POC scope.

Implemented:

- removed `baseUrl` from connector config
- hardcoded the production dashboard proxy endpoint
- validated `hostname`, `apiKey`, requested fields, and date range in `v2/Code.gs`
- avoided logging secrets
- added explicit malformed JSON handling
- centralized query-shape selection and URL building inside the connector

Result:

- connector setup is simpler
- the connector matches the real production architecture
- the current POC is a much better base for adding the full request translator

## Current State After Cleanup

- `v2/Code.gs` is still a POC connector, but it now supports both current hardcoded chart shapes.
- `../dashboard/src/responders/api/looker/query.ts` is the public endpoint the connector should use.
- `../elasticsearch-api/server/rest/looker.js` supports the two current POC aggregation paths with basic guardrails.
- docs now reflect the dashboard-proxy architecture instead of a direct connector-to-elasticsearch-api flow.

## Remaining Follow-Ups Before Full Delivery

The cleanup phase is done. The remaining work is the full implementation tracked in `docs/implementation/2-full-implementation.md`.

That next phase includes:

- replacing the GET POC contract with the real POST contract
- expanding the field catalog to the full supported dimension and metric set
- adding interval-aware date histogram support for `hour`, `day`, `week`, `month`, and `year`
- implementing filter pushdown
- implementing scorecards and additional metrics
- implementing multi-dimension tables via composite aggregations
- finalizing production guardrails and regression coverage

## Recommended Next Step

Follow `docs/implementation/2-full-implementation.md` and the phase test docs in `docs/implementation/phase-1-tests.md` through `docs/implementation/phase-5-tests.md`.
