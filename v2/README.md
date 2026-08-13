# Simple Analytics Google Data Studio connector

This connector lets users query data from [Simple Analytics](https://simpleanalytics.com/).

1. Go to https://datastudio.google.com/u/0/datasources/create
1. Search for `Simple Analytics`
1. Click "Simple Analytics"
1. Enter the API key from https://dashboard.simpleanalytics.com/account#api when prompted
1. Enter your website hostname and select a dataset and timezone
1. Click "Connect"

An account with API access is required. [Create an account](https://www.simpleanalytics.com/signup) or review the [current plans](https://www.simpleanalytics.com/pricing).

When using this connector you are subject to our [general terms and conditions](https://www.simpleanalytics.com/general-terms-and-conditions) and [privacy policy](https://www.simpleanalytics.com/privacy-policy).

## Metadata fields

The connector discovers recent metadata fields for the configured pageviews or events dataset. Metadata appears as `Meta: ...` dimensions in both datasets.

Google Data Studio caches data-source fields. Refresh the data-source fields when newly collected metadata should become available in an existing report.

Metadata discovery is limited to 100 safe text dimensions from the last 365 days. URL-parameter metadata is excluded. Metadata dimensions support exact, list, and not-equal filters; contains filters are not supported.
