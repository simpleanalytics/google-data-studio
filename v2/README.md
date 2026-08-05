# Simple Analytics Google data studio connector

This connector lets users query data from [Simple Analytics](https://simpleanalytics.com/).

1. Go to https://datastudio.google.com/u/0/datasources/create
1. Search for `Simple Analytics`
1. Click "Simple Analytics"
1. Enter `hostname`, `api_key`, and your `timezone`
1. Click "Connect"

When using this connector you are subjected to our [general terms and conditions](https://simpleanalytics.com/general-terms-and-conditions) and [privacy policy](https://simpleanalytics.com/privacy).

## Metadata fields

The connector discovers recent metadata fields for the configured pageviews or events dataset. Metadata appears as `Meta: ...` dimensions in both datasets.

Looker Studio caches data-source fields. Refresh the data-source fields when newly collected metadata should become available in an existing report.

Metadata discovery is limited to 100 safe text dimensions from the last 365 days. URL-parameter metadata is excluded. Metadata dimensions support exact, list, and not-equal filters; contains filters are not supported.
