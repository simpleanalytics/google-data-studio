# V3 Events Cleanup Review

## Bugs

- Clicking on device type equals mobile creates an issue with the system. It doesn't show any time series data in the time series graph whenever we filter by device type equals mobile.

## Cleanup

- Remove `debug=true` support from `GET /api/looker/schema`.
- Remove debug response fields: `datastreams`, `discoveredKeyCount`, `discoveredKeys`, and range echoing if only used for debugging.
- Remove the dual metadata discovery flow in dashboard.
- Keep only the working metadata path:
  - dashboard `GET /api/looker/schema`
  - dashboard validates access
  - dashboard calls elasticsearch-api `GET /api/datapoints/metadata`
  - dashboard converts discovered keys into Looker field ids
- Rename dashboard helper functions to reflect the final flow, for example `getLookerEventMetadataFields`.
- Remove fallback-specific types and branches from `src/utils/looker-metadata.ts`.

## Security

- Keep dashboard access validation before any metadata discovery call.
- Ensure schema helper never forwards user API keys to elasticsearch-api.
- Keep metadata field ids constrained to safe ASCII ids.
- Change the max metadata field cap to 100, currently `25`.
- Make sure error responses do not expose raw Elasticsearch errors or stack traces in production.
- Verify bad API key returns `403` for `/api/looker/schema`.
- Verify an API key for another hostname cannot fetch metadata schema for `simpleanalytics.com`.

## Code Quality

- Share one metadata mapping contract between dashboard and elasticsearch-api:
  - `fieldId`
  - `key`
  - `esField`
  - optional `type`
- Build dashboard schema fields directly from `/api/datapoints/metadata` results.
- In elasticsearch-api, reuse the same metadata discovery map for validation and query execution.
- Avoid re-discovering metadata multiple times per query if possible.
- Rename `getApprovedEventMetadataFields`; it is misleading if no approval/allowlist exists.
- Remove stale docs mentioning hardcoded `event_meta_plan`.
- Update `docs/events-v3-curl-tests-by-phase.txt` now that all phases are complete.
- Update `docs/run-events-v3-curl-checks.sh` to assume dynamic metadata instead of `event_meta_plan`.

## Behavior

- Decide whether schema discovery date range should be 180 or 365 days and document it.
  - Make it 365 days
- Consider passing `start`, `end`, and `timezone` from connector schema calls if available; otherwise use the dashboard default.
- Confirm Looker field refresh is required when new metadata fields appear.
- Decide if non-text metadata (`bool`, `int`) should remain `STRING` dimensions or get type-aware Looker semantics.
  - this is not working flawlessly currently
- Question - what happens if more metadata types are added after the connector is there - dont implement anything, just answer the question

## Tests

- Add dashboard tests for schema helper access denial.
- Add dashboard tests for dynamic metadata schema fields.
- Add dashboard tests for empty metadata schema.
- Add dashboard tests for unknown metadata dimension rejection.
- Add dashboard tests for unknown metadata filter rejection.
- Add elasticsearch-api tests for metadata grouping mapping, for example `event_meta_plan -> metadata_flattened.plan_text`.
- Add elasticsearch-api tests for metadata filters using raw typed fields.
- Add elasticsearch-api tests for metadata composite tables.

## Recommended Order

1. Remove schema debug mode.
2. Keep dashboard schema discovery on `/api/datapoints/metadata` only.
3. Rename dashboard metadata helper functions for clarity.
4. Keep access checks in dashboard before metadata discovery.
5. Update docs and scripts to match the final flow.
6. Add targeted tests for dynamic metadata mapping.
