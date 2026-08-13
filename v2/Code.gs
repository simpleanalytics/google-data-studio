/**
 * Google Data Studio Community Connector
 * Connects to the dashboard proxy endpoint.
 * Supports grouped scorecards, histograms, breakdowns, filter pushdown, and
 * multi-dimension tables for a curated field catalog.
 */

const DATA_STUDIO_ENDPOINT = 'https://simpleanalytics.com/api/looker/query';
const DATA_STUDIO_SCHEMA_ENDPOINT = 'https://simpleanalytics.com/api/looker/schema';
const DATA_STUDIO_AUTH_ENDPOINT = 'https://simpleanalytics.com/api/looker/auth';
const API_KEY_PROPERTY = 'dscc.key';
const DEFAULT_TIMEZONE = 'Etc/UTC';
const MAX_METRICS = 10;
const MAX_DIMENSIONS = 5;

const DATASETS = {
  PAGEVIEWS: 'pageviews',
  EVENTS: 'events'
};

const METADATA_FIELD_PREFIX = 'meta_';

const QUERY_TYPES = {
  SCORECARD: 'scorecard',
  DATE_HISTOGRAM: 'date_histogram',
  TERMS: 'terms',
  COMPOSITE: 'composite'
};

const FILTER_OPERATORS = {
  EQUALS: 'EQUALS',
  IN: 'IN',
  CONTAINS: 'CONTAINS',
  NOT_EQUALS: 'NOT_EQUALS'
};

const METADATA_FILTER_OPERATORS = [
  FILTER_OPERATORS.EQUALS,
  FILTER_OPERATORS.IN,
  FILTER_OPERATORS.NOT_EQUALS
];

const FIELD_FILTER_RULES = {
  path: [FILTER_OPERATORS.EQUALS, FILTER_OPERATORS.IN, FILTER_OPERATORS.CONTAINS, FILTER_OPERATORS.NOT_EQUALS],
  referrer_hostname: [FILTER_OPERATORS.EQUALS, FILTER_OPERATORS.IN, FILTER_OPERATORS.CONTAINS, FILTER_OPERATORS.NOT_EQUALS],
  country_code: [FILTER_OPERATORS.EQUALS, FILTER_OPERATORS.IN, FILTER_OPERATORS.NOT_EQUALS],
  device_type: [FILTER_OPERATORS.EQUALS, FILTER_OPERATORS.IN, FILTER_OPERATORS.NOT_EQUALS],
  browser_name: [FILTER_OPERATORS.EQUALS, FILTER_OPERATORS.IN, FILTER_OPERATORS.NOT_EQUALS],
  os_name: [FILTER_OPERATORS.EQUALS, FILTER_OPERATORS.IN, FILTER_OPERATORS.NOT_EQUALS],
  utm_source: [FILTER_OPERATORS.EQUALS, FILTER_OPERATORS.IN, FILTER_OPERATORS.CONTAINS, FILTER_OPERATORS.NOT_EQUALS],
  utm_medium: [FILTER_OPERATORS.EQUALS, FILTER_OPERATORS.IN, FILTER_OPERATORS.CONTAINS, FILTER_OPERATORS.NOT_EQUALS],
  utm_campaign: [FILTER_OPERATORS.EQUALS, FILTER_OPERATORS.IN, FILTER_OPERATORS.CONTAINS, FILTER_OPERATORS.NOT_EQUALS]
};

const EVENT_FIELD_FILTER_RULES = {
  event_name: [FILTER_OPERATORS.EQUALS, FILTER_OPERATORS.IN, FILTER_OPERATORS.NOT_EQUALS]
};

const FIELD_CATALOG = [
  createDateField('date_hour', 'Date Hour', 'YEAR_MONTH_DAY_HOUR', 'hour', '^\\d{10}$'),
  createDateField('date_day', 'Date Day', 'YEAR_MONTH_DAY', 'day', '^\\d{8}$'),
  createDateField('date_week', 'Date Week', 'YEAR_WEEK', 'week', '^\\d{6}$'),
  createDateField('date_month', 'Date Month', 'YEAR_MONTH', 'month', '^\\d{6}$'),
  createDateField('date_year', 'Date Year', 'YEAR', 'year', '^\\d{4}$'),
  createDimensionField('path', 'Path'),
  createDimensionField('referrer_hostname', 'Referrer Hostname'),
  createDimensionField('country_code', 'Country Code'),
  createDimensionField('device_type', 'Device Type'),
  createDimensionField('browser_name', 'Browser Name'),
  createDimensionField('os_name', 'OS Name'),
  createDimensionField('utm_source', 'UTM Source'),
  createDimensionField('utm_medium', 'UTM Medium'),
  createDimensionField('utm_campaign', 'UTM Campaign'),
  createMetricField('pageviews', 'Pageviews', true),
  createMetricField('unique_visitors', 'Unique Visitors'),
  createMetricField('avg_duration', 'Avg Duration'),
  createMetricField('avg_scroll', 'Avg Scroll')
];

const EVENT_FIELD_CATALOG = [
  createDateField('date_hour', 'Date Hour', 'YEAR_MONTH_DAY_HOUR', 'hour', '^\\d{10}$'),
  createDateField('date_day', 'Date Day', 'YEAR_MONTH_DAY', 'day', '^\\d{8}$'),
  createDateField('date_week', 'Date Week', 'YEAR_WEEK', 'week', '^\\d{6}$'),
  createDateField('date_month', 'Date Month', 'YEAR_MONTH', 'month', '^\\d{6}$'),
  createDateField('date_year', 'Date Year', 'YEAR', 'year', '^\\d{4}$'),
  createDimensionField('event_name', 'Event Name'),
  createMetricField('events', 'Events', true),
  createMetricField('unique_visitors', 'Unique Visitors')
];

const FIELD_CATALOG_BY_ID = FIELD_CATALOG.reduce(function(catalog, field) {
  catalog[field.name] = field;
  return catalog;
}, {});

const FIELD_CATALOG_BY_ALIAS = FIELD_CATALOG.reduce(function(catalog, field) {
  getFieldAliases(field).forEach(function(alias) {
    catalog[alias] = field.name;
  });
  return catalog;
}, {});

function getFieldAliases(field) {
  return [field.name, field.apiName, field.label]
    .filter(function(value) {
      return Boolean(value);
    })
    .map(normalizeFieldKey);
}

function normalizeFieldKey(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

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

function createDimensionField(name, label) {
  return {
    name: name,
    apiName: name,
    label: label,
    dataType: 'STRING',
    validator: '^.*$',
    semantics: {
      conceptType: 'DIMENSION',
      semanticType: 'TEXT'
    }
  };
}

function createMetricField(name, label, isReaggregatable) {
  const semantics = {
    conceptType: 'METRIC',
    semanticType: 'NUMBER'
  };

  if (isReaggregatable) {
    semantics.isReaggregatable = true;
  }

  return {
    name: name,
    apiName: name,
    label: label,
    dataType: 'NUMBER',
    semantics: semantics
  };
}

function getAuthType() {
  const cc = DataStudioApp.createCommunityConnector();

  return cc
    .newAuthTypeResponse()
    .setAuthType(cc.AuthType.KEY)
    .setHelpUrl('https://docs.simpleanalytics.com/google-data-studio')
    .build();
}

function setCredentials(request) {
  const apiKey = normalizeText(request && request.key);

  if (!isValidApiKey(apiKey)) {
    return { errorCode: 'INVALID_CREDENTIALS' };
  }

  PropertiesService.getUserProperties().setProperty(API_KEY_PROPERTY, apiKey);
  return { errorCode: 'NONE' };
}

function resetAuth() {
  PropertiesService.getUserProperties().deleteProperty(API_KEY_PROPERTY);
}

function isAuthValid() {
  return isValidApiKey(getStoredApiKey());
}

function getStoredApiKey() {
  return normalizeText(
    PropertiesService.getUserProperties().getProperty(API_KEY_PROPERTY)
  );
}

function getRequiredApiKey() {
  const apiKey = getStoredApiKey();

  if (!apiKey) {
    throwUserError('Your Simple Analytics API key is missing. Reconnect this data source to authenticate again.');
  }

  return apiKey;
}

function isValidApiKey(apiKey) {
  if (!/^sa_api_key_[a-z0-9_-]+$/i.test(apiKey)) {
    return false;
  }

  try {
    const response = UrlFetchApp.fetch(DATA_STUDIO_AUTH_ENDPOINT, {
      method: 'get',
      headers: {
        'Api-Key': apiKey
      },
      muteHttpExceptions: true
    });

    if (response.getResponseCode() !== 200) {
      return false;
    }

    const payload = JSON.parse(response.getContentText());
    return Boolean(payload && payload.valid === true);
  } catch (error) {
    return false;
  }
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
    .newSelectSingle()
    .setId('dataset')
    .setName('Dataset')
    .setHelpText('Choose which dataset this Google Data Studio data source exposes')
    .addOption(config.newOptionBuilder().setLabel('Pageviews').setValue(DATASETS.PAGEVIEWS))
    .addOption(config.newOptionBuilder().setLabel('Events').setValue(DATASETS.EVENTS))
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

function getSchema(request) {
  return { schema: getFieldCatalog(request).map(toSchemaField) };
}

function getFieldCatalog(request, includeMetadata) {
  const dataset = getConfiguredDataset(request);
  const staticCatalog = dataset === DATASETS.PAGEVIEWS
    ? FIELD_CATALOG
    : EVENT_FIELD_CATALOG;

  return includeMetadata === false
    ? staticCatalog
    : staticCatalog.concat(getMetadataCatalog(request, dataset));
}

function getMetadataCatalog(request, dataset) {
  const configParams = request && request.configParams ? request.configParams : {};
  const hostname = normalizeHostname(configParams.hostname);
  const apiKey = getStoredApiKey();
  const timezone = normalizeText(configParams.timezone) || DEFAULT_TIMEZONE;

  if (!hostname || !apiKey) {
    return [];
  }

  try {
    const response = UrlFetchApp.fetch(
      DATA_STUDIO_SCHEMA_ENDPOINT +
        '?hostname=' + encodeURIComponent(hostname) +
        '&dataset=' + encodeURIComponent(dataset) +
        '&timezone=' + encodeURIComponent(timezone),
      {
        method: 'get',
        headers: {
          'Api-Key': apiKey
        },
        muteHttpExceptions: true
      }
    );

    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
      return [];
    }

    const data = JSON.parse(response.getContentText());
    const schema = Array.isArray(data.schema) ? data.schema : [];

    return schema.filter(function(field) {
      return field && isMetadataFieldId(field.name);
    });
  } catch (error) {
    return [];
  }
}

function isMetadataFieldId(fieldId) {
  return Boolean(
    typeof fieldId === 'string' &&
    fieldId.indexOf(METADATA_FIELD_PREFIX) === 0
  );
}

function requestUsesMetadataFields(request) {
  const fields = request && Array.isArray(request.fields) ? request.fields : [];
  const rawFilters = request && (request.dimensionsFilters || request.dimensionFilters)
    ? (request.dimensionsFilters || request.dimensionFilters)
    : [];
  let fieldReferences = fields.map(function(field) {
    return field && field.name;
  });

  if (Array.isArray(rawFilters)) {
    rawFilters.forEach(function(rawFilter) {
      expandRawFilterParts(rawFilter).forEach(function(filterPart) {
        const filterFieldIds = getFilterFieldIds(filterPart);
        if (Array.isArray(filterFieldIds)) {
          fieldReferences = fieldReferences.concat(filterFieldIds);
        }
      });
    });
  }

  return fieldReferences.some(function(fieldReference) {
    return fieldReference && (
      isMetadataFieldId(fieldReference) ||
      isMetadataFieldId(normalizeFieldKey(fieldReference))
    );
  });
}

function getData(request) {
  const config = getValidatedConfig(request);
  const fieldCatalog = getFieldCatalog(
    request,
    requestUsesMetadataFields(request)
  );
  const fieldCatalogById = buildFieldCatalogById(fieldCatalog);
  const fieldCatalogByAlias = buildFieldCatalogByAlias(fieldCatalog);
  const requestedFieldIds = getRequestedFieldIds(request, fieldCatalogById);
  const dateRange = getValidatedDateRange(request);
  const queryPlan = buildQueryPlan(requestedFieldIds, request, fieldCatalogById, fieldCatalogByAlias, config.dataset);
  const payload = buildRequestPayload(config, dateRange, queryPlan);

  const data = fetchJson(payload, config.apiKey);
  validateResponseRows(data, queryPlan);

  const rows = data.rows.map(function(row) {
    return {
      values: requestedFieldIds.map(function(fieldId) {
        return serializeValue(getFieldValue(fieldId, row, fieldCatalogById));
      })
    };
  });

  return {
    schema: requestedFieldIds.map(function(fieldId) {
      return toSchemaField(fieldCatalogById[fieldId]);
    }),
    rows: rows
  };
}

function getRequestedFieldIds(request, fieldCatalogById) {
  const fields = request && request.fields ? request.fields : [];
  const requestedFieldIds = fields.map(function(field) {
    return field.name;
  });

  if (!requestedFieldIds.length) {
    throwUserError('Google Data Studio did not request any fields.');
  }

  const invalidFields = requestedFieldIds.filter(function(fieldId) {
    return !fieldCatalogById[fieldId];
  });

  if (invalidFields.length) {
    throwUserError('Unsupported fields requested: ' + invalidFields.join(', '));
  }

  return requestedFieldIds;
}

function buildFieldCatalogById(fieldCatalog) {
  return fieldCatalog.reduce(function(catalog, field) {
    catalog[field.name] = field;
    return catalog;
  }, {});
}

function buildFieldCatalogByAlias(fieldCatalog) {
  return fieldCatalog.reduce(function(catalog, field) {
    getFieldAliases(field).forEach(function(alias) {
      catalog[alias] = field.name;
    });
    return catalog;
  }, {});
}

function getValidatedConfig(request) {
  const configParams = request && request.configParams ? request.configParams : {};
  const hostname = normalizeHostname(configParams.hostname);
  const apiKey = getRequiredApiKey();
  const timezone = normalizeText(configParams.timezone) || DEFAULT_TIMEZONE;
  const dataset = getConfiguredDataset(request);

  if (!hostname) {
    throwUserError('Please enter a valid website hostname.');
  }

  return {
    hostname: hostname,
    apiKey: apiKey,
    timezone: timezone,
    dataset: dataset
  };
}

function getConfiguredDataset(request) {
  const configParams = request && request.configParams ? request.configParams : {};
  const dataset = normalizeText(configParams.dataset);

  if (!dataset) {
    throwUserError('Please choose a dataset.');
  }

  if (dataset !== DATASETS.PAGEVIEWS && dataset !== DATASETS.EVENTS) {
    throwUserError('Unsupported dataset: ' + dataset);
  }

  return dataset;
}

function getValidatedDateRange(request) {
  const dateRange = request && request.dateRange ? request.dateRange : {};
  const startDate = normalizeText(dateRange.startDate);
  const endDate = normalizeText(dateRange.endDate);

  if (!startDate || !endDate) {
    throwUserError('Google Data Studio did not provide a valid date range.');
  }

  return {
    startDate: startDate,
    endDate: endDate
  };
}

function buildQueryPlan(requestedFieldIds, request, fieldCatalogById, fieldCatalogByAlias, dataset) {
  const requestedFields = requestedFieldIds.map(function(fieldId) {
    return fieldCatalogById[fieldId];
  });
  const dimensions = requestedFields.filter(function(field) {
    return field.semantics.conceptType === 'DIMENSION';
  });
  const metrics = requestedFields.filter(function(field) {
    return field.semantics.conceptType === 'METRIC';
  });

  if (!metrics.length) {
    throwUserError('Select at least one metric.');
  }

  if (metrics.length > MAX_METRICS) {
    throwUserError('This connector supports at most ' + MAX_METRICS + ' metrics.');
  }

  if (dimensions.length > MAX_DIMENSIONS) {
    throwUserError('This connector supports at most ' + MAX_DIMENSIONS + ' dimensions.');
  }

  const dateDimensions = dimensions.filter(function(field) {
    return field.apiName === 'date';
  });
  if (dateDimensions.length > 1) {
    throwUserError('Select at most one date dimension.');
  }

  const filters = normalizeFilters(request, dataset, fieldCatalogById, fieldCatalogByAlias);
  const dateDimension = dateDimensions[0] || null;

  const queryType = !dimensions.length
    ? QUERY_TYPES.SCORECARD
    : dimensions.length === 1 && dimensions[0].apiName === 'date'
      ? QUERY_TYPES.DATE_HISTOGRAM
    : dimensions.length === 1
        ? QUERY_TYPES.TERMS
        : QUERY_TYPES.COMPOSITE;

  const orderBy = buildOrderBy(request, dimensions, metrics, queryType);
  const limit = buildLimit(request);

  return {
    queryType: queryType,
    dimensions: dimensions,
    dateDimensions: dateDimensions,
    metricFields: metrics,
    metrics: metrics.map(function(field) {
      return field.apiName;
    }),
    filters: filters,
    orderBy: orderBy,
    limit: limit,
    interval: dateDimension && dateDimension.interval ? dateDimension.interval : null
  };
}

function buildOrderBy(request, dimensions, metrics, queryType) {
  const orderBys = request && request.orderBys ? request.orderBys : [];
  if (!orderBys.length) {
    if (queryType === QUERY_TYPES.DATE_HISTOGRAM) {
      return [{ field: 'date', direction: 'ASC' }];
    }
    if (queryType === QUERY_TYPES.TERMS || queryType === QUERY_TYPES.COMPOSITE) {
      return [{ field: metrics[0].apiName, direction: 'DESC' }];
    }
    return [];
  }

  if (orderBys.length > 1) {
    throwUserError('Select at most one sort field.');
  }

  const firstOrderBy = orderBys[0];
  const fieldId = getOrderByFieldId(firstOrderBy);
  const direction = getOrderByDirection(firstOrderBy);
  const dimension = dimensions[0] || null;

  if (queryType === QUERY_TYPES.DATE_HISTOGRAM) {
    if (!dimension || fieldId !== dimension.name) {
      throwUserError('Date charts can only be sorted by the selected date dimension.');
    }
    return [{ field: 'date', direction: direction }];
  }

  if (queryType === QUERY_TYPES.TERMS || queryType === QUERY_TYPES.COMPOSITE) {
    var matchedDimension = dimensions.find(function(selectedDimension) {
      return selectedDimension.name === fieldId;
    });

    if (matchedDimension) {
      return [{ field: matchedDimension.apiName, direction: direction }];
    }

    const metricField = metrics.find(function(metric) {
      return metric.name === fieldId;
    });
    if (!metricField) {
      throwUserError('Grouped charts can only be sorted by the selected dimensions or selected metrics.');
    }

    return [{ field: metricField.apiName, direction: direction }];
  }

  if (fieldId) {
    throwUserError('Scorecards do not support sorting.');
  }

  return [];
}

function buildLimit(request) {
  const rawLimit = request && request.rowLimit ? Number(request.rowLimit) : null;

  if (rawLimit === null || rawLimit === 0 || Number.isNaN(rawLimit)) {
    return null;
  }

  if (rawLimit < 1) {
    throwUserError('Row limit must be greater than zero.');
  }

  return rawLimit;
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
    dataset: config.dataset,
    hostname: config.hostname,
    timezone: config.timezone,
    dateRange: {
      start: dateRange.startDate,
      end: dateRange.endDate
    },
    interval: queryPlan.interval || undefined,
    dimensions: getApiDimensions(queryPlan),
    metrics: queryPlan.metrics,
    filters: queryPlan.filters,
    orderBy: queryPlan.orderBy,
    limit: queryPlan.limit
  });
}

function getApiDimensions(queryPlan) {
  if (queryPlan.queryType === QUERY_TYPES.SCORECARD) {
    return [];
  }

  return queryPlan.dimensions.map(function(field) {
    return field.apiName;
  });
}

function normalizeFilters(request, dataset, fieldCatalogById, fieldCatalogByAlias) {
  const rawFilters = request && (request.dimensionsFilters || request.dimensionFilters)
    ? (request.dimensionsFilters || request.dimensionFilters)
    : [];

  if (!Array.isArray(rawFilters) || !rawFilters.length) {
    return [];
  }

  return rawFilters.reduce(function(filters, rawFilter) {
    return filters.concat(normalizeSingleFilter(rawFilter, dataset, fieldCatalogById, fieldCatalogByAlias));
  }, []);
}

function normalizeSingleFilter(rawFilter, dataset, fieldCatalogById, fieldCatalogByAlias) {
  const filterParts = expandRawFilterParts(rawFilter);
  const filterRules = dataset === DATASETS.EVENTS ? EVENT_FIELD_FILTER_RULES : FIELD_FILTER_RULES;

  return filterParts.reduce(function(filters, filterPart) {
    const fieldId = resolveFilterFieldId(filterPart, fieldCatalogById, fieldCatalogByAlias);
    const operator = normalizeFilterOperator(filterPart);
    const values = normalizeFilterValues(filterPart);

    if (!fieldId || !fieldCatalogById[fieldId]) {
      return filters;
    }

    const allowedOperators = filterRules[fieldId] || (
      isMetadataFieldId(fieldId) ? METADATA_FILTER_OPERATORS : null
    );

    if (!allowedOperators) {
      throwUserError('Filtering is not supported for ' + fieldId + '.');
    }

    if (!allowedOperators.includes(operator)) {
      throwUserError('Unsupported filter operator for ' + fieldId + '.');
    }

    if (!values.length) {
      throwUserError('Filters must include at least one value.');
    }

    if (operator !== FILTER_OPERATORS.IN && values.length !== 1) {
      throwUserError(operator + ' filters require exactly one value.');
    }

    filters.push({
      field: fieldCatalogById[fieldId].apiName,
      operator: operator,
      values: values
    });

    return filters;
  }, []);
}

function expandRawFilterParts(rawFilter) {
  if (!rawFilter || typeof rawFilter !== 'object') {
    return [];
  }

  if (Array.isArray(rawFilter.clauses) && rawFilter.clauses.length) {
    return rawFilter.clauses;
  }

  const fieldIds = getFilterFieldIds(rawFilter);
  if (fieldIds.length <= 1) {
    return [rawFilter];
  }

  const values = normalizeFilterValues(rawFilter);

  return fieldIds.map(function(fieldId, index) {
    const value = values[index];

    return cleanObject({
      fieldName: fieldId,
      operator: rawFilter.operator,
      operatorType: rawFilter.operatorType,
      type: rawFilter.type,
      conditionType: rawFilter.conditionType,
      operatorName: rawFilter.operatorName,
      filterType: rawFilter.filterType,
      condition: rawFilter.condition,
      values: typeof value !== 'undefined' ? [value] : values
    });
  });
}

function getFilterFieldId(filter) {
  const fieldIds = getFilterFieldIds(filter);
  return fieldIds.length ? fieldIds[0] : '';
}

function getFilterFieldIds(filter) {
  if (!filter || typeof filter !== 'object') return '';

  const possibleValues = [];

  pushFilterFieldValues(possibleValues, filter.fieldId);
  pushFilterFieldValues(possibleValues, filter.id);
  pushFilterFieldValues(possibleValues, filter.column);
  pushFilterFieldValues(possibleValues, filter.dimensionId);
  pushFilterFieldValues(possibleValues, filter.fieldName);
  pushFilterFieldValues(possibleValues, filter.name);
  pushFilterFieldValues(possibleValues, filter.fieldNames);
  pushFilterFieldValues(possibleValues, filter.columns);
  pushFilterFieldValues(possibleValues, filter.dimensionNames);
  pushFilterFieldValues(possibleValues, filter.fields);
  pushFilterFieldValues(possibleValues, filter.dimensions);
  pushFilterFieldValues(possibleValues, filter.field && filter.field.id);
  pushFilterFieldValues(possibleValues, filter.field && filter.field.name);
  pushFilterFieldValues(possibleValues, filter.field && filter.field.label);
  pushFilterFieldValues(possibleValues, filter.dimension && filter.dimension.id);
  pushFilterFieldValues(possibleValues, filter.dimension && filter.dimension.name);
  pushFilterFieldValues(possibleValues, filter.dimension && filter.dimension.label);
  pushFilterFieldValues(possibleValues, filter.condition && filter.condition.fieldName);
  pushFilterFieldValues(possibleValues, filter.condition && filter.condition.fieldNames);

  return possibleValues.filter(function(value, index) {
    return value && possibleValues.indexOf(value) === index;
  });
}

function pushFilterFieldValues(values, candidate) {
  if (Array.isArray(candidate)) {
    candidate.forEach(function(item) {
      pushFilterFieldValues(values, item);
    });
    return;
  }

  if (candidate && typeof candidate === 'object') {
    pushFilterFieldValues(values, candidate.id);
    pushFilterFieldValues(values, candidate.name);
    pushFilterFieldValues(values, candidate.label);
    return;
  }

  if (typeof candidate !== 'undefined' && candidate !== null && String(candidate).trim()) {
    values.push(String(candidate));
  }
}

function resolveFilterFieldId(filter, fieldCatalogById, fieldCatalogByAlias) {
  var rawFieldId = getFilterFieldId(filter);

  if (!rawFieldId) {
    return '';
  }

  if (fieldCatalogById[rawFieldId]) {
    return rawFieldId;
  }

  return fieldCatalogByAlias[normalizeFieldKey(rawFieldId)] || '';
}

function normalizeFilterOperator(filter) {
  const valueCount = normalizeFilterValues(filter).length;
  const rawOperator = normalizeText(
    filter && (
      filter.operator ||
      filter.operatorType ||
      filter.type ||
      filter.conditionType ||
      filter.operatorName ||
      filter.filterType ||
      (filter.condition && filter.condition.type)
    )
  ).toUpperCase();

  if (!rawOperator) {
    return valueCount > 1 ? FILTER_OPERATORS.IN : FILTER_OPERATORS.EQUALS;
  }

  if (rawOperator === FILTER_OPERATORS.EQUALS) return FILTER_OPERATORS.EQUALS;
  if (rawOperator === FILTER_OPERATORS.IN || rawOperator === 'IN_LIST') return FILTER_OPERATORS.IN;
  if (rawOperator === 'INCLUDE') return valueCount > 1 ? FILTER_OPERATORS.IN : FILTER_OPERATORS.EQUALS;
  if (rawOperator === 'EXCLUDE') return FILTER_OPERATORS.NOT_EQUALS;
  if (rawOperator === 'SELECTED' || rawOperator === 'SELECT') {
    return valueCount > 1 ? FILTER_OPERATORS.IN : FILTER_OPERATORS.EQUALS;
  }
  if (rawOperator === 'IS' || rawOperator === 'EXACT' || rawOperator === '=') {
    return valueCount > 1 ? FILTER_OPERATORS.IN : FILTER_OPERATORS.EQUALS;
  }
  if (rawOperator === 'NOT_IN' || rawOperator === 'IS_NOT' || rawOperator === '!=') {
    return FILTER_OPERATORS.NOT_EQUALS;
  }
  if (rawOperator === FILTER_OPERATORS.NOT_EQUALS) return FILTER_OPERATORS.NOT_EQUALS;
  if (rawOperator === FILTER_OPERATORS.CONTAINS || rawOperator === 'TEXT_CONTAINS') return FILTER_OPERATORS.CONTAINS;
  if (rawOperator.indexOf('NOT') !== -1 && rawOperator.indexOf('EQUAL') !== -1) return FILTER_OPERATORS.NOT_EQUALS;
  if (rawOperator.indexOf('SELECT') !== -1) return valueCount > 1 ? FILTER_OPERATORS.IN : FILTER_OPERATORS.EQUALS;
  if (rawOperator.indexOf('IN') !== -1) return FILTER_OPERATORS.IN;
  if (rawOperator.indexOf('CONTAIN') !== -1) return FILTER_OPERATORS.CONTAINS;
  if (rawOperator.indexOf('EQUAL') !== -1) return FILTER_OPERATORS.EQUALS;

  Logger.log(JSON.stringify({
    message: 'Unsupported filter operator shape',
    operator: rawOperator,
    field: getFilterFieldId(filter),
    keys: Object.keys(filter || {})
  }));

  throwUserError('Unsupported filter operator requested.');
}

function normalizeFilterValues(filter) {
  var rawValues = [];

  if (filter && Array.isArray(filter.values)) {
    rawValues = filter.values;
  } else if (filter && Array.isArray(filter.selectedValues)) {
    rawValues = filter.selectedValues;
  } else if (filter && Array.isArray(filter.includedValues)) {
    rawValues = filter.includedValues;
  } else if (filter && Array.isArray(filter.items)) {
    rawValues = filter.items;
  } else if (filter && Array.isArray(filter.expressions)) {
    rawValues = filter.expressions;
  } else if (filter && Array.isArray(filter.clauses)) {
    rawValues = filter.clauses.reduce(function(values, clause) {
      if (Array.isArray(clause.values)) {
        return values.concat(clause.values);
      }
      if (Array.isArray(clause.expressions)) {
        return values.concat(clause.expressions);
      }
      if (typeof clause.value !== 'undefined') {
        values.push(clause.value);
      }
      return values;
    }, []);
  } else if (filter && typeof filter.value !== 'undefined') {
    rawValues = [filter.value];
  } else if (filter && filter.condition && typeof filter.condition.value !== 'undefined') {
    rawValues = [filter.condition.value];
  }

  return rawValues
    .map(function(value) {
      if (value && typeof value === 'object') {
        if (typeof value.value !== 'undefined') return value.value;
        if (typeof value.name !== 'undefined') return value.name;
      }
      return value;
    })
    .map(function(value) {
      return String(value);
    })
    .map(function(value) {
      return normalizeText(value);
    })
    .filter(function(value) {
      return value !== '';
    });
}

function summarizeFilters(filters) {
  return filters.map(function(filter) {
    return {
      field: filter.field,
      operator: filter.operator,
      valueCount: filter.values.length
    };
  });
}

function buildQueryFingerprint(queryPlan, payload) {
  return JSON.stringify({
    dataset: payload.dataset || null,
    queryType: queryPlan.queryType || null,
    dimensions: payload.dimensions || [],
    metrics: payload.metrics || [],
    filters: summarizeFilters(payload.filters || []),
    interval: payload.interval || null,
    limit: payload.limit || null
  });
}

function fetchJson(payload, apiKey) {
  var response;

  try {
    response = UrlFetchApp.fetch(DATA_STUDIO_ENDPOINT, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(payload),
      headers: {
        'Api-Key': apiKey,
        'Content-Type': 'application/json'
      },
      muteHttpExceptions: true
    });
  } catch (error) {
    throwUserError('The API request failed before a response was returned.');
  }

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
    if (data.rows.length !== 1 || !hasValidMetricValues(data.rows[0], queryPlan.metricFields)) {
      throwUserError('The scorecard response format was not valid.');
    }
    return;
  }

  const invalidRow = data.rows.find(function(row) {
    if (!row || typeof row !== 'object' || !hasValidMetricValues(row, queryPlan.metricFields)) {
      return true;
    }

    if (queryPlan.queryType === QUERY_TYPES.DATE_HISTOGRAM) {
      return !hasValidDimensionValue(row, queryPlan.dimensions[0]);
    }

    return queryPlan.dimensions.some(function(dimension) {
      return !hasValidDimensionValue(row, dimension);
    });
  });

  if (invalidRow) {
    throwUserError('The API response format was not valid for this chart.');
  }
}

function hasValidDimensionValue(row, dimension) {
  var value = row[dimension.apiName];

  if (dimension.apiName === 'date') {
    return hasValidDateResponseValue(value, dimension.validator);
  }

  return typeof value === 'string' || value === null;
}

function hasValidDateResponseValue(value, validator) {
  return new RegExp(validator).test(String(value || ''));
}

function hasValidMetricValues(row, metricFields) {
  return metricFields.every(function(metricField) {
    return typeof row[metricField.apiName] === 'number';
  });
}

function getFieldValue(fieldId, row, fieldCatalogById) {
  const field = fieldCatalogById[fieldId];
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
