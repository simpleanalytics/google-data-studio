/**
 * Looker Studio Community Connector - POC
 * Connects to ES API /api/looker/query endpoint
 * Returns aggregated pageviews per day
 */

// Schema: only two fields for POC
const SCHEMA = [
  {
    name: 'date',
    label: 'Date',
    dataType: 'STRING',
    semantics: {
      conceptType: 'DIMENSION',
      semanticType: 'YEAR_MONTH_DAY'
    }
  },
  {
    name: 'pageviews',
    label: 'Pageviews',
    dataType: 'NUMBER',
    semantics: {
      conceptType: 'METRIC',
      semanticType: 'NUMBER',
      isReaggregatable: true
    }
  }
];

/**
 * Returns the authentication method required by the connector.
 * API key is passed via config, not OAuth.
 */
function getAuthType() {
  return { type: 'NONE' };
}

/**
 * Returns true - allows debug features in Looker Studio.
 */
function isAdminUser() {
  return true;
}

/**
 * Returns the user configuration form.
 */
function getConfig(request) {
  const cc = DataStudioApp.createCommunityConnector();
  const config = cc.getConfig();

  config.setDateRangeRequired(true);

  config
    .newTextInput()
    .setId('baseUrl')
    .setName('API Base URL')
    .setHelpText('Base URL of the ES API (e.g., https://api.example.com)')
    .setPlaceholder('https://api.example.com')
    .setAllowOverride(false);

  config
    .newTextInput()
    .setId('hostname')
    .setName('Website Hostname')
    .setHelpText('The hostname to query (e.g., example.com)')
    .setPlaceholder('example.com')
    .setAllowOverride(false);

  config
    .newTextInput()
    .setId('apiKey')
    .setName('API Key')
    .setHelpText('Your API key for authentication')
    .setPlaceholder('sa_api_key_xxx')
    .setAllowOverride(false);

  config
    .newSelectSingle()
    .setId('timezone')
    .setName('Timezone')
    .addOption(config.newOptionBuilder().setLabel('UTC').setValue('Etc/UTC'))
    .addOption(config.newOptionBuilder().setLabel('Europe/Amsterdam').setValue('Europe/Amsterdam'))
    .addOption(config.newOptionBuilder().setLabel('America/New_York').setValue('America/New_York'))
    .addOption(config.newOptionBuilder().setLabel('America/Los_Angeles').setValue('America/Los_Angeles'))
    .addOption(config.newOptionBuilder().setLabel('Asia/Tokyo').setValue('Asia/Tokyo'))
    .setAllowOverride(false);

  return config.build();
}

/**
 * Returns the schema for this connector.
 */
function getSchema(request) {
  return { schema: SCHEMA };
}

/**
 * Fetches data from the API and returns rows for Looker Studio.
 */
function getData(request) {
  const { baseUrl, hostname, apiKey, timezone } = request.configParams;
  const { startDate, endDate } = request.dateRange;

  // Build API URL
  const url = buildUrl(baseUrl, hostname, startDate, endDate, timezone || 'Etc/UTC');

  // Log for debugging
  Logger.log('Fetching URL: ' + url);
  Logger.log('Requested fields: ' + JSON.stringify(request.fields));

  // Fetch data
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();
  if (responseCode !== 200) {
    Logger.log('API Error: ' + response.getContentText());
    throwUserError('API returned status ' + responseCode + ': ' + response.getContentText());
  }

  const data = JSON.parse(response.getContentText());

  // Map requested fields
  const requestedFieldIds = request.fields.map(function(field) {
    return field.name;
  });

  // Build rows based on requested fields
  const rows = data.rows.map(function(row) {
    return {
      values: requestedFieldIds.map(function(fieldId) {
        return row[fieldId];
      })
    };
  });

  Logger.log('Returning ' + rows.length + ' rows');

  return {
    schema: request.fields.map(function(field) {
      return SCHEMA.find(function(s) { return s.name === field.name; });
    }),
    rows: rows
  };
}

/**
 * Builds the API URL with query parameters.
 */
function buildUrl(baseUrl, hostname, startDate, endDate, timezone) {
  // Remove trailing slash from baseUrl if present
  const base = baseUrl.replace(/\/+$/, '');
  
  const params = [
    'hostname=' + encodeURIComponent(hostname),
    'start=' + encodeURIComponent(startDate),
    'end=' + encodeURIComponent(endDate),
    'timezone=' + encodeURIComponent(timezone)
  ].join('&');

  return base + '/api/looker/query?' + params;
}

/**
 * Throws a user-facing error.
 */
function throwUserError(message) {
  DataStudioApp.createCommunityConnector()
    .newUserError()
    .setText(message)
    .throwException();
}
