# Looker Connector POC - Testing & Setup

## Phase 1: API Endpoint Verification

### 1.1 Test endpoint directly

```bash
# Replace with your actual values
LOOKER_ENDPOINT="https://simpleanalytics.com/api/looker/query"
API_KEY="sa_api_key_xxx"
HOSTNAME="example.com"

curl "${LOOKER_ENDPOINT}?hostname=${HOSTNAME}&start=2024-01-01&end=2024-01-31&timezone=Etc/UTC" \
  -H "Api-Key: ${API_KEY}"
```

**Expected response:**

```json
{
  "schema": [
    { "name": "date", "type": "STRING" },
    { "name": "pageviews", "type": "NUMBER" }
  ],
  "rows": [
    { "date": "20240101", "pageviews": 142 },
    { "date": "20240102", "pageviews": 89 }
  ]
}
```

**Verify:**

- [ ] Status 200
- [ ] Date format is `YYYYMMDD`
- [ ] Pageviews are integers
- [ ] Row count matches date range

---

## Phase 2: Connector Deployment

### 2.1 Create Apps Script project

1. Go to https://script.google.com
2. Create new project, name it "ES API Connector POC"
3. Replace `Code.gs` contents with `v2/Code.gs`
4. Create `appsscript.json` (View > Show manifest file) with `v2/appscript.json`

### 2.2 Deploy connector

1. Deploy > Test deployments
2. Select "Head (Development mode)"
3. Copy the Deployment ID

### 2.3 Verify deployment

1. Go to https://lookerstudio.google.com

2. Create > Data source
3. Search for your connector by Deployment ID
4. Should see "ES API Connector (POC)"

---

## Phase 3: Looker Studio Integration

### 3.1 Create data source

1. Select connector
2. Fill config:
   - **Website Hostname**: `example.com`
   - **API Key**: `sa_api_key_xxx`
   - **Timezone**: Select appropriate timezone
3. Click Connect

The connector endpoint should be hardcoded to the dashboard proxy and not entered by the user.

**Verify:**

- [ ] Connection succeeds
- [ ] Schema shows: `date` (dimension), `pageviews` (metric)

### 3.2 Create test report

1. Create report from data source
2. Add Date Range control
3. Add Time Series chart:
   - Dimension: `date`
   - Metric: `pageviews`

**Verify:**

- [ ] Chart renders with data
- [ ] Changing date range updates chart
- [ ] No timeout errors

### 3.3 Test edge cases

- [ ] 7-day range loads < 3s
- [ ] 30-day range loads < 5s
- [ ] 90-day range loads < 10s
- [ ] Empty date range shows empty chart (not error)

---

## Phase 4: Debugging

### Check Apps Script logs

1. In Apps Script editor: View > Executions
2. Look for `getData` executions
3. Check logged URL and row count

### Common issues

| Issue                     | Cause            | Fix                            |
| ------------------------- | ---------------- | ------------------------------ |
| "API returned status 401" | Invalid API key  | Check apiKey config            |
| "API returned status 400" | Missing params   | Check hostname/dates           |
| Empty chart               | No data in range | Verify date range has data     |
| Timeout                   | Large date range | Reduce range or check API perf |

---

## Next Steps: Full Looker Studio Implementation

After POC validation, proceed with:

### 1. Add second chart type (Top Paths)

- Add `GET /api/looker/top-paths` endpoint
- Extend connector schema with `path` dimension
- Detect requested fields in `getData()` to route to correct endpoint

### 2. Expand to generic query contract

- Implement `POST /api/looker/query` with:
  - `dimensions[]` and `metrics[]` arrays
  - Filter support
  - Sorting and limits
- Update connector to build POST payload from Looker request

### 3. Add a `v2` field catalog and more dimensions/metrics

- Define one `v2` catalog for schema metadata, request field ids, ES aggregation strategy, and serializers
- Dimensions: `path`, `referrer_hostname`, `country_code`, `device_type`, `browser_name`, `os_name`, `utm_source`, `utm_medium`, `utm_campaign`
- Metrics: `unique_visitors` (cardinality), `avg_duration`, `avg_scroll`

### 4. Add filters support

- Parse `request.dimensionsFilters` in connector
- Translate to API filter payload
- Support: `EQUALS`, `IN`, `CONTAINS`

### 5. Production hardening

- Rate limiting per API key
- Request logging with timing
- Error monitoring
- Deployment versioning
