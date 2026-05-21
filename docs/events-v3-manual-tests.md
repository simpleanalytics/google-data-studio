# V3 Events Manual Tests

Run after the curl tests in `docs/events-v3-curl-tests-by-phase.txt` pass.

API checks can be run with:

```bash
DASHBOARD_URL="http://localhost:3000" \
ES_URL="http://localhost:5602" \
API_KEY="sa_api_key_MT6i5VuHebBzqJRlVWUolPqwlCryxqbjvMcO" \
HOSTNAME="seed.com" \
./docs/run-events-v3-curl-checks.sh
```

Default output prints expected results, assertions, and concise response summaries. Add `--full` to print request bodies, full JSON responses, and HTTP headers.

## Data Sources

- Existing v2 connector: pageviews.
- New v3 connector with Dataset = Pageviews.
- New v3 connector with Dataset = Events.

## Pageview Regression

- Compare v2 and v3 pageview scorecards for `pageviews` and `unique_visitors`.
- Compare v2 and v3 daily pageview time series.
- Compare v2 and v3 top paths tables with the same date range, filters, sort, and row limit.

## Event MVP

- Event scorecards: `events`, `unique_visitors`.
- Event time series: hour, day, week, month, year.
- Top events table/bar: `event_name` with `events` and `unique_visitors`.
- Event composite table: `date_day`, `event_name`, `events`, `unique_visitors`.

## Event Controls

- Filter event charts by `event_name` using equals, in-list, and not-equals.
- Confirm pageview-only fields are unavailable in the event data source.
- Confirm event-only fields are unavailable in the pageview data source.

## Metadata

- Confirm approved `event_meta_*` fields appear in the v3 events data source.
- Group events by an approved metadata field returned by schema discovery.
- Filter events by an approved metadata field using equals, in-list, and not-equals.
- Confirm unknown `event_meta_*` fields are unavailable/rejected.
