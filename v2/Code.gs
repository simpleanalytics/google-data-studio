/**
 * Looker Studio Community Connector - Phase 1
 * Connects to the dashboard proxy endpoint.
 * Supports pageviews scorecards, interval-aware date histograms, and top paths.
 */

const LOOKER_ENDPOINT = 'https://simpleanalytics.com/api/looker/query';
const DEFAULT_TIMEZONE = 'Etc/UTC';
const DEFAULT_ROW_LIMIT = 1000;
const DEFAULT_TERMS_LIMIT = 20;

const QUERY_TYPES = {
  SCORECARD: 'scorecard',
  DATE_HISTOGRAM: 'date_histogram',
  TERMS: 'terms'
};

const FIELD_CATALOG = [
  createDateField('date_hour', 'Date Hour', 'YEAR_MONTH_DAY_HOUR', 'hour', '^\\d{10}$'),
  createDateField('date_day', 'Date Day', 'YEAR_MONTH_DAY', 'day', '^\\d{8}$'),
  createDateField('date_week', 'Date Week', 'YEAR_WEEK', 'week', '^\\d{6}$'),
  createDateField('date_month', 'Date Month', 'YEAR_MONTH', 'month', '^\\d{6}$'),
  createDateField('date_year', 'Date Year', 'YEAR', 'year', '^\\d{4}$'),
  {
    name: 'path',
    apiName: 'path',
    label: 'Path',
    dataType: 'STRING',
    validator: '^.*$',
    semantics: {
      conceptType: 'DIMENSION',
      semanticType: 'TEXT'
    }
  },
  {
    name: 'pageviews',
    apiName: 'pageviews',
    label: 'Pageviews',
    dataType: 'NUMBER',
    semantics: {
      conceptType: 'METRIC',
      semanticType: 'NUMBER',
      isReaggregatable: true
    }
  }
];

const FIELD_CATALOG_BY_ID = FIELD_CATALOG.reduce(function(catalog, field) {
  catalog[field.name] = field;
  return catalog;
}, {});

function createDateField(name, label, semanticType, interval, validator) {
  return {
    name: name,
    apiName: 'date',
    label: label,
    interval: interval,
    validator: validator,
    dataType: 'STRING',
    semantics: {
      conceptType: 'DIMENSION',
      semanticType: semanticType
    }
  };
}

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
  const config = getValidatedConfig(request);
  const dateRange = getValidatedDateRange(request);
  const queryPlan = buildQueryPlan(requestedFieldIds, request);
  const payload = buildRequestPayload(config, dateRange, queryPlan);

  Logger.log(
    JSON.stringify({
      message: 'Fetching Looker data',
      endpoint: LOOKER_ENDPOINT,
      queryType: queryPlan.queryType,
      dimensions: payload.dimensions,
      metrics: payload.metrics,
      interval: payload.interval || null,
      hostname: config.hostname
    })
  );

  const data = fetchJson(payload, config.apiKey);
  validateResponseRows(data, queryPlan);

  const rows = data.rows.map(function(row) {
    return {
      values: requestedFieldIds.map(function(fieldId) {
        return serializeValue(getFieldValue(fieldId, row));
      })
    };
  });

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

function buildQueryPlan(requestedFieldIds, request) {
  const requestedFields = requestedFieldIds.map(function(fieldId) {
    return FIELD_CATALOG_BY_ID[fieldId];
  });
  const dimensions = requestedFields.filter(function(field) {
    return field.semantics.conceptType === 'DIMENSION';
  });
  const metrics = requestedFields.filter(function(field) {
    return field.semantics.conceptType === 'METRIC';
  });

  if (metrics.length !== 1 || metrics[0].name !== 'pageviews') {
    throwUserError('Phase 1 supports exactly one metric: pageviews.');
  }

  if (dimensions.length > 1) {
    throwUserError('Phase 1 supports at most one dimension.');
  }

  const filters = request && request.dimensionsFilters ? request.dimensionsFilters : [];
  if (filters.length) {
    throwUserError('Filters are not supported yet in the connector.');
  }

  const dimension = dimensions[0] || null;
  const queryType = !dimension
    ? QUERY_TYPES.SCORECARD
    : dimension.apiName === 'date'
      ? QUERY_TYPES.DATE_HISTOGRAM
      : QUERY_TYPES.TERMS;

  const orderBy = buildOrderBy(request, dimension, queryType);
  const limit = buildLimit(request, queryType);

  return {
    queryType: queryType,
    dimension: dimension,
    metrics: ['pageviews'],
    orderBy: orderBy,
    limit: limit,
    interval: dimension && dimension.interval ? dimension.interval : null
  };
}

function buildOrderBy(request, dimension, queryType) {
  const orderBys = request && request.orderBys ? request.orderBys : [];
  if (!orderBys.length) {
    if (queryType === QUERY_TYPES.DATE_HISTOGRAM) {
      return [{ field: 'date', direction: 'ASC' }];
    }
    if (queryType === QUERY_TYPES.TERMS) {
      return [{ field: 'pageviews', direction: 'DESC' }];
    }
    return [];
  }

  const firstOrderBy = orderBys[0];
  const fieldId = getOrderByFieldId(firstOrderBy);
  const direction = getOrderByDirection(firstOrderBy);

  if (queryType === QUERY_TYPES.DATE_HISTOGRAM) {
    if (!dimension || fieldId !== dimension.name) {
      throwUserError('Date charts can only be sorted by the selected date dimension in phase 1.');
    }
    return [{ field: 'date', direction: direction }];
  }

  if (queryType === QUERY_TYPES.TERMS) {
    if (fieldId !== 'pageviews' || direction !== 'DESC') {
      throwUserError('Top path charts can only be sorted by pageviews descending in phase 1.');
    }
    return [{ field: 'pageviews', direction: 'DESC' }];
  }

  if (fieldId) {
    throwUserError('Scorecards do not support sorting in phase 1.');
  }

  return [];
}

function buildLimit(request, queryType) {
  const rawLimit = request && request.rowLimit ? Number(request.rowLimit) : null;
  const defaultLimit = queryType === QUERY_TYPES.TERMS ? DEFAULT_TERMS_LIMIT : DEFAULT_ROW_LIMIT;
  const limit = rawLimit && rawLimit > 0 ? rawLimit : defaultLimit;

  return Math.min(limit, DEFAULT_ROW_LIMIT);
}

function getOrderByFieldId(orderBy) {
  if (!orderBy) return '';
  if (orderBy.field && orderBy.field.name) return orderBy.field.name;
  if (orderBy.fieldName) return orderBy.fieldName;
  if (orderBy.name) return orderBy.name;
  return '';
}

function getOrderByDirection(orderBy) {
  const rawDirection = orderBy && (orderBy.sortOrder || orderBy.direction || orderBy.orderType);
  const normalized = normalizeText(rawDirection).toUpperCase();

  if (normalized === 'DESCENDING' || normalized === 'DESC') return 'DESC';
  return 'ASC';
}

function buildRequestPayload(config, dateRange, queryPlan) {
  return cleanObject({
    hostname: config.hostname,
    timezone: config.timezone,
    dateRange: {
      start: dateRange.startDate,
      end: dateRange.endDate
    },
    interval: queryPlan.interval || undefined,
    dimensions: queryPlan.dimension ? [queryPlan.dimension.apiName] : [],
    metrics: queryPlan.metrics,
    filters: [],
    orderBy: queryPlan.orderBy,
    limit: queryPlan.limit
  });
}

function fetchJson(payload, apiKey) {
  const response = UrlFetchApp.fetch(LOOKER_ENDPOINT, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
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

function validateResponseRows(data, queryPlan) {
  if (!data || !Array.isArray(data.rows)) {
    throwUserError('The API response did not include a valid rows array.');
  }

  if (queryPlan.queryType === QUERY_TYPES.SCORECARD) {
    if (data.rows.length !== 1 || typeof data.rows[0].pageviews !== 'number') {
      throwUserError('The scorecard response format was not valid.');
    }
    return;
  }

  const invalidRow = data.rows.find(function(row) {
    if (!row || typeof row !== 'object' || typeof row.pageviews !== 'number') {
      return true;
    }

    if (queryPlan.queryType === QUERY_TYPES.DATE_HISTOGRAM) {
      return !new RegExp(queryPlan.dimension.validator).test(String(row.date || ''));
    }

    return typeof row.path !== 'string' && row.path !== null;
  });

  if (invalidRow) {
    throwUserError('The API response format was not valid for this chart.');
  }
}

function getFieldValue(fieldId, row) {
  const field = FIELD_CATALOG_BY_ID[fieldId];
  return row[field.apiName];
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

function cleanObject(object) {
  Object.keys(object).forEach(function(key) {
    if (object[key] === undefined || object[key] === null || object[key] === '') {
      delete object[key];
    }
  });
  return object;
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
