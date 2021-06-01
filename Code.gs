const delimiter = ',';

const booleanSerializer = (value = "") => {
  if (value === 'true' || value === 'false') return value;
  return null;
}

const FIELDS = [
  {
    slug: "added_iso",
    name: "ISO 8601 timestamp",
    description: "Page view added at this time",
    type: "YEAR_MONTH_DAY_SECOND",
    group: "DATETIME",
    serializer: (value = "") => {
      // Convert 2021-03-30T04:10:02.001Z into 20210330041002
      return value.replace(/[-:TZ]/gi, "").slice(0, 14);
    },
  },
  {
    slug: "added_unix",
    name: "UNIX timestamp",
    description: "Page view added at this time",
    type: "YEAR_MONTH_DAY_SECOND",
    group: "DATETIME",
    serializer: (value = "0") => {
      // Convert 2021-03-30T04:10:02.001Z into 20210330041002
      return new Date(value)
        .toISOString()
        .replace(/[-:TZ]/gi, "")
        .slice(0, 14);
    },
  },
  {
    slug: "hostname",
    name: "Hostname",
    description: "Domain of your website",
    type: "TEXT",
    group: "URL",
  },
  {
    slug: "url",
    name: "Full URL",
    description: "Full URL of page view",
    type: "TEXT",
    group: "URL",
  },
  {
    slug: "path",
    name: "Path",
    description: "Path of the page view starting with /",
    type: "TEXT",
    group: "URL",
  },
  {
    slug: "is_unique",
    name: "Unique",
    description: "Is page view unique",
    type: "BOOLEAN",
    group: "VISITOR",
    serializer: booleanSerializer,
  },
  {
    slug: "document_referrer",
    name: "Referrer",
    description: "Referrer of the page",
    type: "TEXT",
    group: "SOURCE",
  },
  {
    slug: "utm_source",
    name: "UTM source",
    description: "UTM source of the page view",
    type: "TEXT",
    group: "SOURCE",
  },
  {
    slug: "utm_medium",
    name: "UTM medium",
    description: "UTM medium of the page view",
    type: "TEXT",
    group: "SOURCE",
  },
  {
    slug: "utm_campaign",
    name: "UTM campaign",
    description: "UTM campaign of the page view",
    type: "TEXT",
    group: "SOURCE",
  },
  {
    slug: "utm_content",
    name: "UTM content",
    description: "UTM content of the page view",
    type: "TEXT",
    group: "SOURCE",
  },
  {
    slug: "utm_term",
    name: "UTM term",
    description: "UTM term of the page view",
    type: "TEXT",
    group: "SOURCE",
  },
  {
    slug: "scrolled_percentage",
    name: "Scrolled",
    description: "Percentage scrolled on page",
    type: "PERCENT",
    group: "VISITOR",
    serializer: (value = "") => {
      if (!value.trim()) return;
      return parseInt(value.trim(), 10) / 100;
    },
  },
  {
    slug: "duration_seconds",
    name: "Time on page",
    description: "Time on page in seconds",
    type: "DURATION",
    group: "VISITOR",
  },
  {
    name: "Viewport width",
    category: "DIMENSIONS",
    description: "Viewport width of the browser window",
    slug: "viewport_width",
    type: "NUMBER",
  },
  {
    name: "Viewport height",
    category: "DIMENSIONS",
    description: "Viewport height of the browser window",
    slug: "viewport_height",
    type: "NUMBER",
  },
  {
    name: "Screen width",
    category: "DIMENSIONS",
    description: "Screen width of the device",
    slug: "screen_width",
    type: "NUMBER",
  },
  {
    name: "Screen height",
    category: "DIMENSIONS",
    description: "Screen height of the device",
    slug: "screen_height",
    type: "NUMBER",
  },
  {
    name: "ID",
    category: "META",
    description: "ID of page view (not always unique)",
    slug: "uuid",
    type: "TEXT",
  },
  {
    name: "Original hostname",
    category: "URL",
    description: "Original hostname (only useful when overwrite domain is used)",
    slug: "hostname_original",
    type: "TEXT",
  },
  {
    name: "Robot",
    category: "META",
    description: "Visited by robot",
    slug: "is_robot",
    type: "BOOLEAN",
    serializer: booleanSerializer,
  },
  {
    name: "Country code",
    category: "VISITOR",
    description: "2 letter country code (NL)",
    slug: "country_code",
    type: "TEXT",
  },
  {
    name: "Browser name",
    category: "DEVICE",
    description: "Browser name",
    slug: "browser_name",
    type: "TEXT",
  },
  {
    name: "Browser version",
    category: "DEVICE",
    description: "Browser version (as a string: eg. 2.1.3)",
    slug: "browser_version",
    type: "TEXT",
  },
  {
    name: "OS name",
    category: "DEVICE",
    description: "Operating system name",
    slug: "os_name",
    type: "TEXT",
  },
  {
    name: "OS version",
    category: "DEVICE",
    description: "Operating system version (as a string: eg. 2.1.3)",
    slug: "os_version",
    type: "TEXT",
  },
  {
    name: "User Agent",
    category: "DEVICE",
    description: "User Agent of the device (OS and Browser values are more accurate)",
    slug: "user_agent",
    type: "TEXT",
  },
  {
    name: "Device type",
    category: "DEVICE",
    description: "Device type (desktop, mobile, tablet, tv, ...)",
    slug: "device_type",
    type: "TEXT",
  },
  {
    name: "Language country code",
    category: "VISITOR",
    description: "2 letter language region code (uk from en-UK)",
    slug: "lang_region",
    type: "TEXT",
  },
  {
    name: "Language code",
    category: "VISITOR",
    description: "2 letter language code (en from en-UK)",
    slug: "lang_language",
    type: "TEXT",
  }
];

function sendUserError(message) {
  var cc = DataStudioApp.createCommunityConnector();
  cc.newUserError()
    .setText(message)
    .throwException();
}

// https://stackoverflow.com/a/14991797/747044
function parseCSVRow(row) {
  let arr = [];
  let quote = false;  // 'true' means we're inside a quoted field

  // Iterate over each character, keep track of current row and column (of the returned array)
  for (var row = 0, col = 0, c = 0; c < row.length; c++) {
    let cc = row[c], nc = row[c+1];        // Current character, next character
    arr[row] = arr[row] || [];             // Create a new row if necessary
    arr[row][col] = arr[row][col] || '';   // Create a new column (start with empty string) if necessary

    // If the current character is a quotation mark, and we're inside a
    // quoted field, and the next character is also a quotation mark,
    // add a quotation mark to the current column and skip the next character
    if (cc == '"' && quote && nc == '"') { arr[row][col] += cc; ++c; continue; }

    // If it's just one quotation mark, begin/end quoted field
    if (cc == '"') { quote = !quote; continue; }

    // If it's a comma and we're not in a quoted field, move on to the next column
    if (cc == ',' && !quote) { ++col; continue; }

    // If it's a newline (CRLF) and we're not in a quoted field, skip the next character
    // and move on to the next row and move to column 0 of that new row
    if (cc == '\r' && nc == '\n' && !quote) { ++row; col = 0; ++c; continue; }

    // If it's a newline (LF or CR) and we're not in a quoted field,
    // move on to the next row and move to column 0 of that new row
    if (cc == '\n' && !quote) { ++row; col = 0; continue; }
    if (cc == '\r' && !quote) { ++row; col = 0; continue; }

    // Otherwise, append the current character to the current column
    arr[row][col] += cc;
  }

  return arr;
}

const isAdminUser = () => true;

const getAuthType = () => ({ type: 'NONE' });

function getConfig(request) {
  var communityConnector = DataStudioApp.createCommunityConnector();
  var connectorConfig = communityConnector.getConfig();

  connectorConfig.setDateRangeRequired(true);

  connectorConfig
    .newTextInput()
    .setId('hostname')
    .setName('Enter the hostname of your website')
    .setHelpText('e.g. "example.com"')
    .setPlaceholder('example.com')
    .setAllowOverride(false)

  connectorConfig
    .newTextInput()
    .setId('apiKey')
    .setName('Enter the API key of Simple Analytics')
    .setHelpText('copy it from simpleanalytics.com/account#api')
    .setPlaceholder('sa_api_key_xxxxxxxxxxxxxxxxxxxxxx')
    .setAllowOverride(false)

  connectorConfig
    .newSelectSingle()
    .setId('timezone')
    .setName('Select time zone you want to use in your exports')
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-12:00) International Date Line West").setValue("Etc/GMT+12"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-11:00) Midway Island, Samoa").setValue("Pacific/Midway"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-10:00) Hawaii").setValue("Pacific/Honolulu"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-09:00) Alaska").setValue("US/Alaska"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-08:00) Pacific Time (US & Canada)").setValue("America/Los_Angeles"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-08:00) Tijuana, Baja California").setValue("America/Tijuana"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-07:00) Arizona").setValue("US/Arizona"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-07:00) Chihuahua, La Paz, Mazatlan").setValue("America/Chihuahua"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-07:00) Mountain Time (US & Canada)").setValue("US/Mountain"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-06:00) Central America").setValue("America/Managua"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-06:00) Central Time (US & Canada)").setValue("US/Central"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-06:00) Guadalajara, Mexico City, Monterrey").setValue("America/Mexico_City"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-06:00) Saskatchewan").setValue("Canada/Saskatchewan"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-05:00) Bogota, Lima, Quito, Rio Branco").setValue("America/Bogota"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-05:00) Eastern Time (US & Canada)").setValue("US/Eastern"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-05:00) Indiana (East)").setValue("US/East-Indiana"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-04:00) Atlantic Time (Canada)").setValue("Canada/Atlantic"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-04:00) Caracas, La Paz").setValue("America/Caracas"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-04:00) Manaus").setValue("America/Manaus"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-04:00) Santiago").setValue("America/Santiago"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-03:30) Newfoundland").setValue("Canada/Newfoundland"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-03:00) Brasilia").setValue("America/Sao_Paulo"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-03:00) Buenos Aires, Georgetown").setValue("America/Argentina/Buenos_Aires"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-03:00) Greenland").setValue("America/Godthab"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-03:00) Montevideo").setValue("America/Montevideo"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-02:00) Mid-Atlantic").setValue("America/Noronha"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-01:00) Cape Verde Is.").setValue("Atlantic/Cape_Verde"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT-01:00) Azores").setValue("Atlantic/Azores"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+00:00) Casablanca, Monrovia, Reykjavik").setValue("Africa/Casablanca"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+00:00) Greenwich Mean Time : Dublin, Edinburgh, Lisbon, London").setValue("Etc/Greenwich"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+01:00) Amsterdam, Berlin, Bern, Rome, Stockholm, Vienna").setValue("Europe/Amsterdam"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+01:00) Belgrade, Bratislava, Budapest, Ljubljana, Prague").setValue("Europe/Belgrade"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+01:00) Brussels, Copenhagen, Madrid, Paris").setValue("Europe/Brussels"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+01:00) Sarajevo, Skopje, Warsaw, Zagreb").setValue("Europe/Sarajevo"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+01:00) West Central Africa").setValue("Africa/Lagos"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+02:00) Amman").setValue("Asia/Amman"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+02:00) Athens, Bucharest, Istanbul").setValue("Europe/Athens"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+02:00) Beirut").setValue("Asia/Beirut"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+02:00) Cairo").setValue("Africa/Cairo"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+02:00) Harare, Pretoria").setValue("Africa/Harare"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+02:00) Helsinki, Kyiv, Riga, Sofia, Tallinn, Vilnius").setValue("Europe/Helsinki"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+02:00) Jerusalem").setValue("Asia/Jerusalem"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+02:00) Minsk").setValue("Europe/Minsk"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+02:00) Windhoek").setValue("Africa/Windhoek"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+03:00) Kuwait, Riyadh, Baghdad").setValue("Asia/Kuwait"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+03:00) Moscow, St. Petersburg, Volgograd").setValue("Europe/Moscow"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+03:00) Nairobi").setValue("Africa/Nairobi"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+03:00) Tbilisi").setValue("Asia/Tbilisi"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+03:30) Tehran").setValue("Asia/Tehran"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+04:00) Abu Dhabi, Muscat").setValue("Asia/Muscat"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+04:00) Baku").setValue("Asia/Baku"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+04:00) Yerevan").setValue("Asia/Yerevan"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+04:30) Kabul").setValue("Asia/Kabul"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+05:00) Yekaterinburg").setValue("Asia/Yekaterinburg"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+05:00) Islamabad, Karachi, Tashkent").setValue("Asia/Karachi"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+05:30) Chennai, Kolkata, Mumbai, New Delhi").setValue("Asia/Calcutta"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+05:30) Sri Jayawardenapura").setValue("Asia/Calcutta"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+05:45) Kathmandu").setValue("Asia/Katmandu"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+06:00) Almaty, Novosibirsk").setValue("Asia/Almaty"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+06:00) Astana, Dhaka").setValue("Asia/Dhaka"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+06:30) Yangon (Rangoon)").setValue("Asia/Rangoon"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+07:00) Bangkok, Hanoi, Jakarta").setValue("Asia/Bangkok"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+07:00) Krasnoyarsk").setValue("Asia/Krasnoyarsk"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+08:00) Beijing, Chongqing, Hong Kong, Urumqi").setValue("Asia/Hong_Kong"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+08:00) Kuala Lumpur, Singapore").setValue("Asia/Kuala_Lumpur"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+08:00) Irkutsk, Ulaan Bataar").setValue("Asia/Irkutsk"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+08:00) Perth").setValue("Australia/Perth"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+08:00) Taipei").setValue("Asia/Taipei"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+09:00) Osaka, Sapporo, Tokyo").setValue("Asia/Tokyo"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+09:00) Seoul").setValue("Asia/Seoul"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+09:00) Yakutsk").setValue("Asia/Yakutsk"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+09:30) Adelaide").setValue("Australia/Adelaide"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+09:30) Darwin").setValue("Australia/Darwin"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+10:00) Brisbane").setValue("Australia/Brisbane"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+10:00) Canberra, Melbourne, Sydney").setValue("Australia/Canberra"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+10:00) Hobart").setValue("Australia/Hobart"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+10:00) Guam, Port Moresby").setValue("Pacific/Guam"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+10:00) Vladivostok").setValue("Asia/Vladivostok"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+11:00) Magadan, Solomon Is., New Caledonia").setValue("Asia/Magadan"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+12:00) Auckland, Wellington").setValue("Pacific/Auckland"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+12:00) Fiji, Kamchatka, Marshall Is.").setValue("Pacific/Fiji"))
    .addOption(connectorConfig.newOptionBuilder().setLabel("(GMT+13:00) Nuku'alofa").setValue("Pacific/Tongatapu"))
    .setAllowOverride(false)

  return connectorConfig.build();
}

function fetchData(request, url) {
  if (!url || !url.match(/^https?:\/\/.+$/g)) {
    sendUserError('"' + url + '" is not a valid url.');
  }

  const options = {
    'method': 'get',
    'contentType': 'application/json',
    'headers': {
      'Api-Key': request.configParams.apiKey.replace(/[^a-z0-9_-]/gi, ''),
      'Content-Type': 'text/csv'
    }
  };

  var response = UrlFetchApp.fetch(url, options);
  var content = response.getContentText();
  if (!content) {
    sendUserError('"' + url + '" returned no content.');
  }
  return content;
}

function getFields(include = []) {
  const communityConnector = DataStudioApp.createCommunityConnector();
  const fields = communityConnector.getFields();
  const types = communityConnector.FieldType;

  const includedFields = include.length === 0
    ? [...FIELDS] 
    : [...FIELDS]
      .filter((field) => include.includes(field.slug))
      .sort(({ slug: left }, { slug: right }) => include.indexOf(left) - include.indexOf(right))

  for (const field of includedFields) {
    fields
      .newDimension()
      .setId(field.slug)
      .setName(field.name)
      .setDescription(field.description)
      .setType(types[field.type])
      .setGroup(field.group || 'OTHER')
  }

  return fields;
}

// https://developers.google.com/datastudio/connector/reference#getschema
function getSchema(request) {
  return { schema: getFields().build() };
}

// Convert https://www.example.com/path?asdf#12 into example.com
function getHostname(hostname) {
  return hostname.replace(/^https?:\/\/((m|l|w{2,3}([0-9]+)?)\.)?([^?#]+)(.*)$/, "$4").replace(/^([^/]+)(.*)$/, "$1");
}

// Get export URL from Simple Analytics
function getExportUrl({ hostname, fields = [], timezone, start = "", end = "" } = {}) {
  const base = `https://simpleanalytics.com/api/export/visits`;
  const query = `version=2&fields=${fields.join(',')}&hostname=${getHostname(hostname)}&start=${start}&end=${end}&timezone=${timezone}&app=googledatastudio`
  return `${base}?${query}`;
}

function getData(request) {
  const requestedFieldSlugs = request.fields.map((field) => field.name);
  const invalidFields = requestedFieldSlugs.filter((slug) => !FIELDS.find(field => field.slug === slug))
  if (invalidFields.length) {
    const error = `These fields: ${invalidFields.join(', ')} are invalid. Try without them.`;
    Logger.log({ error, hostname: request.configParams.hostname });
    sendUserError(error);
    return;
  }

  const url = getExportUrl({
    hostname: request.configParams.hostname,
    fields: requestedFieldSlugs,
    timezone: request.configParams.timezone || 'UTC',
    start: request.dateRange.startDate,
    end: request.dateRange.endDate,
  });
  
  const cc = DataStudioApp.createCommunityConnector();
  const DataResponse = cc.newGetDataResponse().setFields(getFields(requestedFieldSlugs))
  const content = fetchData(request, url);

  // requestedFieldSlugs = [added_iso, hostname, path]
  // requestedFieldsIndex = [0.0, 1.0, 2.0]
  // fields = com.google.apps.maestro.server.beans.datastudio.impl.FieldsDataImpl$FieldsImpl@c2699db3
  // requestedFields = com.google.apps.maestro.server.beans.datastudio.impl.FieldsDataImpl$FieldsImpl@83c4c3cf
  // Logger.log({ request, requestedFieldSlugs, requestedFieldsIndex })

  const contentRows = content.split('\n');

  const rows = contentRows
    .filter((contentRow) => contentRow.trim() !== '')
    .map((contentRow, idx) => {
      // Remove starting and trailing double quotes
      // and parse whole line into separate cells
      const allValues = parseCSVRow(contentRow);

      // Create an object with all serializers in it:
      // { added_iso: [Function: serializer], ... }
      const serializers = Object.fromEntries(FIELDS
        .filter(({serializer}) => typeof serializer === 'function')
        .map(({slug, serializer}) => [slug, serializer]))

      const serializedValues = allValues.map((value, index) => {
        const fieldSlug = requestedFieldSlugs[index];
        if (serializers[fieldSlug]) return serializers[fieldSlug](value)
        return !value && typeof value !== 'boolean' ? undefined : value;
      });

      return serializedValues;
    })
    // Remove header row
    .slice(1);

  return DataResponse.addAllRows(rows).build();
}
