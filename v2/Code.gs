/**
 * Looker Studio Community Connector - POC
 * Connects to the dashboard proxy endpoint.
 * Supports pageviews per day and top paths by pageviews.
 */

const LOOKER_ENDPOINT = 'https://simpleanalytics.com/api/looker/query';
const DEFAULT_TIMEZONE = 'Etc/UTC';
const DEFAULT_TOP_PATHS_LIMIT = 20;
const QUERY_SHAPES = {
  TIMESERIES: 'timeseries',
  TOP_PATHS: 'top_paths'
};

const FIELD_CATALOG = [
  {
    name: 'date',
    label: 'Date',
    dataType: 'STRING',
    semantics: {
      conceptType: 'DIMENSION',
      semanticType: 'YEAR_MONTH_DAY'
    },
    supportedShapes: [QUERY_SHAPES.TIMESERIES]
  },
  {
    name: 'path',
    label: 'Path',
    dataType: 'STRING',
    semantics: {
      conceptType: 'DIMENSION',
      semanticType: 'TEXT'
    },
    supportedShapes: [QUERY_SHAPES.TOP_PATHS]
  },
  {
    name: 'pageviews',
    label: 'Pageviews',
    dataType: 'NUMBER',
    semantics: {
      conceptType: 'METRIC',
      semanticType: 'NUMBER',
      isReaggregatable: true
    },
    supportedShapes: [QUERY_SHAPES.TIMESERIES, QUERY_SHAPES.TOP_PATHS]
  }
];

const FIELD_CATALOG_BY_ID = FIELD_CATALOG.reduce(function(catalog, field) {
  catalog[field.name] = field;
  return catalog;
}, {});

function getAuthType() {
  return { type: 'NONE' };
}

function isAdminUser() {
  return true;
}

function getConfig() {
  const cc = DataStudioApp.createCommunityConnector();
  const config = cc.getConfig();

  config.setDateRangeRequired(true);

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

function getSchema() {
  return { schema: FIELD_CATALOG.map(toSchemaField) };
}

function getData(request) {
  const requestedFieldIds = getRequestedFieldIds(request);
  const queryPlan = buildQueryPlan(requestedFieldIds);
  const config = getValidatedConfig(request);
  const dateRange = getValidatedDateRange(request);
  const url = buildUrl({
    hostname: config.hostname,
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    timezone: config.timezone,
    shape: queryPlan.shape,
    limit: queryPlan.limit
  });

  Logger.log(
    JSON.stringify({
      message: 'Fetching Looker data',
      endpoint: LOOKER_ENDPOINT,
      shape: queryPlan.shape,
      requestedFieldIds: requestedFieldIds,
      dateRange: dateRange,
      hostname: config.hostname
    })
  );

  const data = fetchJson(url, config.apiKey);
  validateResponseRows(data, queryPlan.shape);

  const rows = data.rows.map(function(row) {
    return {
      values: requestedFieldIds.map(function(fieldId) {
        return serializeValue(row[fieldId]);
      })
    };
  });

  Logger.log(
    JSON.stringify({
      message: 'Returning Looker data',
      shape: queryPlan.shape,
      rowCount: rows.length
    })
  );

  return {
    schema: requestedFieldIds.map(function(fieldId) {
      return toSchemaField(FIELD_CATALOG_BY_ID[fieldId]);
    }),
    rows: rows
  };
}

function getRequestedFieldIds(request) {
  const fields = request && request.fields ? request.fields : [];
  const requestedFieldIds = fields.map(function(field) {
    return field.name;
  });

  if (!requestedFieldIds.length) {
    throwUserError('Looker Studio did not request any fields.');
  }

  const invalidFields = requestedFieldIds.filter(function(fieldId) {
    return !FIELD_CATALOG_BY_ID[fieldId];
  });

  if (invalidFields.length) {
    throwUserError('Unsupported fields requested: ' + invalidFields.join(', '));
  }

  return requestedFieldIds;
}

function buildQueryPlan(requestedFieldIds) {
  const dimensionIds = requestedFieldIds.filter(function(fieldId) {
    return FIELD_CATALOG_BY_ID[fieldId].semantics.conceptType === 'DIMENSION';
  });

  if (dimensionIds.length > 1) {
    throwUserError('This POC supports only one dimension at a time.');
  }

  const selectedDimension = dimensionIds[0] || null;
  const shape = selectedDimension === 'path'
    ? QUERY_SHAPES.TOP_PATHS
    : QUERY_SHAPES.TIMESERIES;

  const unsupportedFields = requestedFieldIds.filter(function(fieldId) {
    return FIELD_CATALOG_BY_ID[fieldId].supportedShapes.indexOf(shape) === -1;
  });

  if (unsupportedFields.length) {
    throwUserError(
      'This POC does not support the selected field combination: ' +
        unsupportedFields.join(', ')
    );
  }

  return {
    shape: shape,
    limit: shape === QUERY_SHAPES.TOP_PATHS ? DEFAULT_TOP_PATHS_LIMIT : null
  };
}

function getValidatedConfig(request) {
  const configParams = request && request.configParams ? request.configParams : {};
  const hostname = normalizeHostname(configParams.hostname);
  const apiKey = normalizeText(configParams.apiKey);
  const timezone = normalizeText(configParams.timezone) || DEFAULT_TIMEZONE;

  if (!hostname) {
    throwUserError('Please enter a valid website hostname.');
  }

  if (!apiKey) {
    throwUserError('Please enter a valid API key.');
  }

  return {
    hostname: hostname,
    apiKey: apiKey,
    timezone: timezone
  };
}

function getValidatedDateRange(request) {
  const dateRange = request && request.dateRange ? request.dateRange : {};
  const startDate = normalizeText(dateRange.startDate);
  const endDate = normalizeText(dateRange.endDate);

  if (!startDate || !endDate) {
    throwUserError('Looker Studio did not provide a valid date range.');
  }

  return {
    startDate: startDate,
    endDate: endDate
  };
}

function buildUrl(options) {
  const params = [
    'hostname=' + encodeURIComponent(options.hostname),
    'start=' + encodeURIComponent(options.startDate),
    'end=' + encodeURIComponent(options.endDate),
    'timezone=' + encodeURIComponent(options.timezone),
    'shape=' + encodeURIComponent(options.shape)
  ];

  if (options.limit) {
    params.push('limit=' + encodeURIComponent(String(options.limit)));
  }

  return LOOKER_ENDPOINT + '?' + params.join('&');
}

function fetchJson(url, apiKey) {
  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'Api-Key': apiKey,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  });

  const responseCode = response.getResponseCode();
  const responseText = response.getContentText();
  let parsedResponse = null;

  if (responseText) {
    try {
      parsedResponse = JSON.parse(responseText);
    } catch (error) {
      if (responseCode === 200) {
        throwUserError('The API returned an invalid JSON response.');
      }
    }
  }

  if (responseCode !== 200) {
    const errorMessage = parsedResponse && parsedResponse.error
      ? parsedResponse.error
      : 'API returned status ' + responseCode + '.';
    throwUserError(errorMessage);
  }

  if (!parsedResponse || typeof parsedResponse !== 'object') {
    throwUserError('The API returned an empty response.');
  }

  return parsedResponse;
}

function validateResponseRows(data, shape) {
  if (!data || !Array.isArray(data.rows)) {
    throwUserError('The API response did not include a valid rows array.');
  }

  const invalidRow = data.rows.find(function(row) {
    if (!row || typeof row !== 'object') {
      return true;
    }

    if (typeof row.pageviews !== 'number') {
      return true;
    }

    if (shape === QUERY_SHAPES.TIMESERIES) {
      return !/^\d{8}$/.test(String(row.date || ''));
    }

    return typeof row.path !== 'string' && row.path !== null;
  });

  if (invalidRow) {
    throwUserError('The API response format was not valid for this chart.');
  }
}

function serializeValue(value) {
  if (value === null || typeof value === 'undefined') {
    return '';
  }

  return value;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeHostname(hostname) {
  const normalized = normalizeText(hostname)
    .replace(/^https?:\/\/((m|l|w{2,3}([0-9]+)?)\.)?([^?#]+)(.*)$/, '$4')
    .replace(/^([^/]+)(.*)$/, '$1');

  return normalized;
}

function toSchemaField(field) {
  return {
    name: field.name,
    label: field.label,
    dataType: field.dataType,
    semantics: field.semantics
  };
}

function throwUserError(message) {
  DataStudioApp.createCommunityConnector()
    .newUserError()
    .setText(message)
    .throwException();
}
