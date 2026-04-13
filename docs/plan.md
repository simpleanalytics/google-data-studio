# Looker Studio Connector Setup & Testing Plan

This guide walks you through setting up the new POC connector (`google-looker-studio-connector/`) in Looker Studio and testing it according to the implementation plan.

---

## Prerequisites

Before starting, ensure you have:
- [ ] Access to Google Apps Script (script.google.com)
- [ ] A Google account with Looker Studio access
- [ ] Your Node API running and accessible (either deployed or via tunnel)
- [ ] API key for authentication
- [ ] A hostname with data in Elasticsearch

---

## Part 1: Deploy the Connector to Apps Script

### Step 1: Create a New Apps Script Project

1. Go to https://script.google.com
2. Click **New project**
3. Rename the project (click "Untitled project" at top-left) to: `ES API Connector (POC)`

### Step 2: Copy the Connector Code

1. In the Apps Script editor, you'll see a default `Code.gs` file
2. **Delete all existing content** in `Code.gs`
3. **Copy the entire contents** of `google-looker-studio-connector/Code.gs` and paste it into the editor

### Step 3: Configure the Manifest (appsscript.json)

1. In Apps Script, go to **Project Settings** (gear icon on left sidebar)
2. Check the box: **"Show 'appsscript.json' manifest file in editor"**
3. Go back to the Editor
4. Click on `appsscript.json` in the file list
5. **Replace the entire content** with the contents of `google-looker-studio-connector/appsscript.json`:

```json
{
  "timeZone": "Europe/Amsterdam",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "dataStudio": {
    "name": "ES API Connector (POC)",
    "logoUrl": "https://www.gstatic.com/images/branding/product/1x/data_studio_48dp.png",
    "company": "Simple Analytics",
    "companyUrl": "https://simpleanalytics.com",
    "addonUrl": "https://simpleanalytics.com",
    "supportUrl": "https://simpleanalytics.com/contact",
    "description": "POC connector for ES API - returns pageviews per day"
  }
}
```

### Step 4: Deploy as a Looker Studio Connector

1. Click **Deploy** > **New deployment**
2. Click the gear icon next to "Select type" and choose **Add-on** > **Looker Studio**
3. Fill in:
   - **Description**: `POC v1` (or similar)
4. Click **Deploy**
5. **Copy the Deployment ID** - you'll need this to connect in Looker Studio

### Step 5: Get the Connector URL

After deployment, note down:
- **Deployment ID**: (something like `AKfycbw...`)
- **Head Deployment URL**: `https://datastudio.google.com/datasources/create?connectorId=YOUR_DEPLOYMENT_ID`

---

## Part 2: Set Up Local Development (Optional but Recommended)

If your Node API is running locally, you need to expose it via a tunnel.

### Option A: Using ngrok

```bash
# Install ngrok if you haven't
brew install ngrok

# Start your Node API (assuming it runs on port 3000)
npm run dev

# In another terminal, expose it
ngrok http 3000
```

Note the HTTPS URL (e.g., `https://abc123.ngrok.io`)

### Option B: Using Cloudflare Tunnel

```bash
# Install cloudflared
brew install cloudflared

# Expose your local server
cloudflared tunnel --url http://localhost:3000
```

Note the HTTPS URL provided.

---

## Part 3: Connect to Looker Studio

### Step 1: Create a Data Source

1. Go to https://lookerstudio.google.com
2. Click **Create** > **Data source**
3. Search for your connector name or use the deployment URL:
   ```
   https://datastudio.google.com/datasources/create?connectorId=YOUR_DEPLOYMENT_ID
   ```
4. Click on your connector: **ES API Connector (POC)**

### Step 2: Configure the Connector

Fill in the configuration fields:

| Field | Value | Notes |
|-------|-------|-------|
| **API Base URL** | `https://your-api.com` or `https://abc123.ngrok.io` | Your Node API URL (no trailing slash) |
| **Website Hostname** | `example.com` | The hostname to query data for |
| **API Key** | `sa_api_key_xxx` | Your API key for authentication |
| **Timezone** | Select appropriate timezone | e.g., `Europe/Amsterdam` |

### Step 3: Authorize and Connect

1. Click **Connect** (top-right)
2. If prompted, authorize the connector to run
3. You should see the schema with two fields:
   - `date` (Dimension, YEAR_MONTH_DAY)
   - `pageviews` (Metric, NUMBER)
4. Click **Create Report** or **Explore** to test

---

## Part 4: Testing the Connector

### Test 1: Node Endpoint Correctness (Before Looker)

**Goal**: Verify the API returns correct data before testing in Looker Studio.

```bash
# Test the /api/looker/query endpoint directly
curl -X GET "https://your-api.com/api/looker/query?hostname=example.com&start=2026-01-01&end=2026-01-31&timezone=Europe/Amsterdam" \
  -H "Api-Key: sa_api_key_xxx" \
  -H "Content-Type: application/json"
```

**Expected response**:
```json
{
  "rows": [
    { "date": "20260101", "pageviews": 1234 },
    { "date": "20260102", "pageviews": 5678 },
    ...
  ]
}
```

**Verify**:
- [ ] Dates are in `YYYYMMDD` format
- [ ] Pageviews are numbers
- [ ] Date range matches your query
- [ ] Response time is acceptable (< 5 seconds)

### Test 2: Connector Returns Rows (Apps Script Logs)

**Goal**: Verify the connector can call the API and return data.

1. In Looker Studio, create a simple **Scorecard** with:
   - Metric: `pageviews`
2. Or create a **Time Series** chart with:
   - Dimension: `date`
   - Metric: `pageviews`

3. **Check Apps Script Logs**:
   - Go to your Apps Script project
   - Click **Executions** in the left sidebar
   - Look for recent executions of `getData`
   - Click on an execution to see logs

**Verify in logs**:
- [ ] `Fetching URL: ...` shows correct URL
- [ ] `Requested fields: ...` shows the fields Looker requested
- [ ] `Returning X rows` shows data was returned
- [ ] No error messages

### Test 3: Charts Render in Looker Studio

**Goal**: Verify charts display correctly with different date ranges.

#### Create a Test Dashboard

1. In Looker Studio, create a new **Blank Report**
2. Add your data source (the POC connector)
3. Add these components:

**Component 1: Date Range Control**
- Insert > Date range control
- Position at top of report

**Component 2: Scorecard (Total Pageviews)**
- Insert > Scorecard
- Metric: `pageviews`

**Component 3: Time Series Chart**
- Insert > Time series chart
- Dimension: `date`
- Metric: `pageviews`

#### Run Tests

| Test | Action | Expected Result |
|------|--------|-----------------|
| Default load | Open report | Charts render with default date range (last 28 days) |
| 7-day range | Set date range to last 7 days | Charts update, show 7 data points |
| 90-day range | Set date range to last 90 days | Charts update, show 90 data points |
| Reload (cache) | Refresh the page | Charts reload quickly (cached) |
| Incognito | Open report in incognito window | Charts still render (no session issues) |

**Verify**:
- [ ] Time series shows one bar/point per day
- [ ] Scorecard shows total pageviews sum
- [ ] No timeouts or errors
- [ ] Changing date range updates both charts
- [ ] Performance is acceptable (< 10s load time)

---

## Part 5: Debugging Common Issues

### Issue: "API returned status 4XX"

**Check**:
- Is the API URL correct? (no trailing slash)
- Is the API key valid?
- Is the hostname correct?
- Is the API running and accessible?

**Debug**:
```bash
# Test API directly
curl -v "https://your-api.com/api/looker/query?hostname=example.com&start=2026-01-01&end=2026-01-31&timezone=UTC" \
  -H "Api-Key: your-key"
```

### Issue: "Script timed out"

**Possible causes**:
- API is too slow (> 30 seconds)
- Response payload is too large

**Fix**:
- Add caching to Node API
- Reduce date range
- Check ES query performance

### Issue: "No data" or empty charts

**Check**:
- Does the hostname have data in ES for the date range?
- Is the timezone correct?
- Check Apps Script logs for actual row count

### Issue: Date format mismatch

**Symptom**: Time series chart doesn't recognize dates

**Check**:
- API must return dates as `YYYYMMDD` (e.g., `20260115`)
- Schema defines `semanticType: 'YEAR_MONTH_DAY'`

---

## Part 6: Comparison with Old Connector

The old connector (root `Code.gs`) uses CSV export:
- Fetches raw rows from `/api/export/visits`
- Parses CSV in Apps Script
- Returns all raw event data

The new POC connector:
- Fetches aggregated data from `/api/looker/query`
- Returns pre-computed pageviews per day
- Much faster and smaller payload

### Performance Comparison Test

| Metric | Old Connector | New Connector | Target |
|--------|---------------|---------------|--------|
| Response size | Large (MB) | Small (KB) | < 100KB |
| Load time (7d) | Slow | Fast | < 3s |
| Load time (90d) | Very slow / timeout | Fast | < 5s |
| Apps Script parsing | Heavy | Minimal | - |

---

## Part 7: Next Steps After POC

Once the POC is validated, proceed with the implementation plan milestones:

1. **Milestone 1**: Replace POC endpoints with generic `/looker/query`
2. **Milestone 2**: Expand schema with more dimensions/metrics
3. **Milestone 3**: Add filter support
4. **Milestone 4**: Support multiple dimensions (composite aggs)
5. **Milestone 5**: Add caching and performance hardening
6. **Milestone 6**: Production security and monitoring

---

## Quick Reference: URLs and IDs

| Item | Value |
|------|-------|
| Apps Script Project | https://script.google.com/d/YOUR_PROJECT_ID |
| Deployment ID | `AKfycbw...` |
| Connector URL | `https://datastudio.google.com/datasources/create?connectorId=YOUR_DEPLOYMENT_ID` |
| API Base URL | `https://your-api.com` |
| Test Hostname | `example.com` |

---

## Checklist Summary

### Deployment
- [ ] Created Apps Script project
- [ ] Copied Code.gs content
- [ ] Updated appsscript.json manifest
- [ ] Deployed as Looker Studio connector
- [ ] Noted Deployment ID

### Configuration
- [ ] API is accessible (deployed or via tunnel)
- [ ] Created data source in Looker Studio
- [ ] Configured: API URL, hostname, API key, timezone

### Testing
- [ ] API endpoint returns correct data (curl test)
- [ ] Connector logs show successful requests
- [ ] Scorecard renders with pageview count
- [ ] Time series renders with daily data
- [ ] Date range changes work correctly
- [ ] Performance is acceptable

### Validation
- [ ] Data matches direct ES/Kibana query
- [ ] No Apps Script timeouts
- [ ] Works in incognito (no session dependency)
