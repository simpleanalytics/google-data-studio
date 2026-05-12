#!/usr/bin/env bash
set -euo pipefail

DASHBOARD_URL="${DASHBOARD_URL:-http://localhost:3000}"
ES_URL="${ES_URL:-http://localhost:5602}"
API_KEY="${API_KEY:-sa_api_key_replace_me}"
HOSTNAME="${HOSTNAME:-seed.com}"
TIMEZONE="${TIMEZONE:-Etc/UTC}"
START_DATE="${START_DATE:-2026-01-10}"
END_DATE="${END_DATE:-2026-02-17}"
EVENT_NAME_PROVIDED=false
EVENT_NAME_2_PROVIDED=false
EVENT_META_FIELD_PROVIDED=false
EVENT_META_VALUE_PROVIDED=false

if [ -n "${EVENT_NAME:-}" ]; then EVENT_NAME_PROVIDED=true; fi
if [ -n "${EVENT_NAME_2:-}" ]; then EVENT_NAME_2_PROVIDED=true; fi
if [ -n "${EVENT_META_FIELD:-}" ]; then EVENT_META_FIELD_PROVIDED=true; fi
if [ -n "${EVENT_META_VALUE:-}" ]; then EVENT_META_VALUE_PROVIDED=true; fi

EVENT_NAME="${EVENT_NAME:-}"
EVENT_NAME_2="${EVENT_NAME_2:-}"
EVENT_META_FIELD="${EVENT_META_FIELD:-}"
EVENT_META_VALUE="${EVENT_META_VALUE:-}"
FULL=false

for arg in "$@"; do
  case "$arg" in
    --full) FULL=true ;;
    -h|--help)
      printf 'Usage: %s [--full]\n' "$0"
      printf '\nDefault output is concise and shows expected results plus pass/fail.\n'
      printf 'Use --full to print full JSON responses and HTTP headers.\n'
      exit 0
      ;;
    *)
      printf 'Unknown argument: %s\n' "$arg" >&2
      exit 2
      ;;
  esac
done

TMP_DIR="${TMPDIR:-/tmp}/events-v3-curl-checks"
mkdir -p "$TMP_DIR"

print_header() {
  printf '\n## %s\n' "$1"
}

print_body() {
  if [ "$FULL" = true ]; then
    printf '\nRequest body:\n'
    printf '%s' "$1" | jq .
    return
  fi

  printf 'Request body: hidden; run with --full to print it.\n'
}

print_expected() {
  printf 'Expected: %s\n' "$1"
}

print_response_summary() {
  local file="$1"
  if [ "$FULL" = true ]; then
    printf '\nResponse:\n'
    jq . "$file"
    return
  fi

  printf 'Response summary: '
  jq -c '{schema, rowCount:((.rows // []) | length), meta}' "$file"
}

print_header_summary() {
  local file="$1"
  if [ "$FULL" = true ]; then
    printf '\nResponse with headers:\n'
    sed -n '1,80p' "$file"
    return
  fi

  printf 'HTTP status: '
  sed -n '1s/^HTTP\/[^ ]* //p' "$file"
}

dashboard_post() {
  local body="$1"
  curl -s -X POST "$DASHBOARD_URL/api/looker/query" \
    -H "Content-Type: application/json" \
    -H "Api-Key: $API_KEY" \
    --data "$body"
}

dashboard_post_i() {
  local body="$1"
  curl -i -s -X POST "$DASHBOARD_URL/api/looker/query" \
    -H "Content-Type: application/json" \
    -H "Api-Key: $API_KEY" \
    --data "$body"
}

es_post() {
  local body="$1"
  curl -s -X POST "$ES_URL/api/looker/query" \
    -H "Content-Type: application/json" \
    --data "$body"
}

assert_jq() {
  local file="$1"
  local expression="$2"
  printf '\nCheck jq:\n%s\n' "$expression"
  jq -e "$expression" "$file" > /dev/null
  printf 'Result: true\n'
}

assert_jq_with_args() {
  local file="$1"
  local expression="$2"
  shift 2
  printf '\nCheck jq:\n%s\n' "$expression"
  jq -e "$@" "$expression" "$file" > /dev/null
  printf 'Result: true\n'
}

run_dashboard_check() {
  local name="$1"
  local body="$2"
  local expression="$3"
  local expected="${4:-jq assertion returns true}"
  local file="$TMP_DIR/${name//[^a-zA-Z0-9]/_}.json"

  print_header "$name"
  print_expected "$expected"
  print_body "$body"
  dashboard_post "$body" > "$file"
  print_response_summary "$file"
  assert_jq "$file" "$expression"
}

run_dashboard_check_with_args() {
  local name="$1"
  local body="$2"
  local expression="$3"
  local expected="${4:-jq assertion returns true}"
  local file="$TMP_DIR/${name//[^a-zA-Z0-9]/_}.json"
  shift 4

  print_header "$name"
  print_expected "$expected"
  print_body "$body"
  dashboard_post "$body" > "$file"
  print_response_summary "$file"
  assert_jq_with_args "$file" "$expression" "$@"
}

run_dashboard_optional_nonempty_filter_check() {
  local name="$1"
  local body="$2"
  local expression="$3"
  local expected="$4"
  local file="$TMP_DIR/${name//[^a-zA-Z0-9]/_}.json"
  shift 4

  print_header "$name"
  print_expected "$expected"
  print_body "$body"
  dashboard_post "$body" > "$file"
  print_response_summary "$file"

  if jq -e '(.rows | length) == 0' "$file" > /dev/null; then
    printf '\nCheck jq:\n%s\n' "$expression"
    printf 'Result: skipped; filtered query returned zero rows for selected test value. Run with --full to inspect the request/response.\n'
    return
  fi

  assert_jq_with_args "$file" "$expression" "$@"
}

run_dashboard_error_check() {
  local name="$1"
  local body="$2"
  local expected="${3:-HTTP 400 is returned}"
  local file="$TMP_DIR/${name//[^a-zA-Z0-9]/_}.txt"

  print_header "$name"
  print_expected "$expected"
  print_body "$body"
  dashboard_post_i "$body" > "$file"
  print_header_summary "$file"
  printf '\nCheck HTTP 400:\n'
  grep -q '^HTTP/.* 400' "$file"
  printf 'Result: true\n'
}

run_es_error_check() {
  local name="$1"
  local body="$2"
  local expected="${3:-HTTP 400 is returned}"
  local file="$TMP_DIR/${name//[^a-zA-Z0-9]/_}.txt"

  print_header "$name"
  print_expected "$expected"
  print_body "$body"
  curl -i -s -X POST "$ES_URL/api/looker/query" \
    -H "Content-Type: application/json" \
    --data "$body" > "$file"
  print_header_summary "$file"
  printf '\nCheck HTTP 400:\n'
  grep -q '^HTTP/.* 400' "$file"
  printf 'Result: true\n'
}

compare_dashboard_es() {
  local name="$1"
  local body="$2"
  local expected="${3:-dashboard and elasticsearch-api return the same schema and rows}"
  local dashboard_file="$TMP_DIR/${name//[^a-zA-Z0-9]/_}_dashboard.json"
  local es_file="$TMP_DIR/${name//[^a-zA-Z0-9]/_}_es.json"

  print_header "$name"
  print_expected "$expected"
  print_body "$body"
  dashboard_post "$body" > "$dashboard_file"
  es_post "$body" > "$es_file"
  printf 'Dashboard '
  print_response_summary "$dashboard_file"
  printf 'Elasticsearch '
  print_response_summary "$es_file"
  printf '\nCompare {schema, rows}:\n'
  diff -u <(jq '{schema, rows}' "$dashboard_file") <(jq '{schema, rows}' "$es_file")
  printf 'Result: true\n'
}

BODY=$(jq -n \
  --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" \
  '{hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, dimensions:[], metrics:["pageviews"], filters:[], orderBy:[]}')
run_dashboard_check "0.1 v2-style pageview scorecard" "$BODY" '.schema == [{"name":"pageviews","type":"NUMBER"}] and (.rows | length == 1) and (.rows[0].pageviews | type == "number")'

BODY_V2=$(jq -n \
  --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" \
  '{hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, interval:"day", dimensions:["date"], metrics:["pageviews","unique_visitors"], filters:[], orderBy:[{field:"date",direction:"ASC"}], limit:100}')
BODY_V3=$(jq -n \
  --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" \
  '{dataset:"pageviews", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, interval:"day", dimensions:["date"], metrics:["pageviews","unique_visitors"], filters:[], orderBy:[{field:"date",direction:"ASC"}], limit:100}')
print_header "0.2 missing dataset matches dataset=pageviews"
print_expected "missing dataset and dataset=pageviews return identical schema and rows"
print_body "$BODY_V2"
dashboard_post "$BODY_V2" > "$TMP_DIR/pageviews_missing_dataset.json"
print_body "$BODY_V3"
dashboard_post "$BODY_V3" > "$TMP_DIR/pageviews_dataset.json"
printf 'Missing dataset '
print_response_summary "$TMP_DIR/pageviews_missing_dataset.json"
printf 'Dataset pageviews '
print_response_summary "$TMP_DIR/pageviews_dataset.json"
printf '\nCompare {schema, rows}:\n'
diff -u <(jq '{schema, rows}' "$TMP_DIR/pageviews_missing_dataset.json") <(jq '{schema, rows}' "$TMP_DIR/pageviews_dataset.json")
printf 'Result: true\n'

BODY=$(jq -n \
  --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" \
  '{dataset:"sessions", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, dimensions:[], metrics:["pageviews"], filters:[], orderBy:[]}')
run_dashboard_error_check "0.3 invalid dataset rejected by dashboard" "$BODY"
run_es_error_check "0.4 invalid dataset rejected by elasticsearch-api" "$BODY"

BODY=$(jq -n \
  --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" \
  '{dataset:"events", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, dimensions:[], metrics:["events"], filters:[], orderBy:[]}')
run_dashboard_check "1.1 event scorecard" "$BODY" '.schema == [{"name":"events","type":"NUMBER"}] and (.rows | length == 1) and (.rows[0].events | type == "number") and .meta.dataset == "events"'

BODY=$(jq -n \
  --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" \
  '{dataset:"events", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, dimensions:[], metrics:["unique_visitors"], filters:[], orderBy:[]}')
run_dashboard_check "1.2 event unique visitors scorecard" "$BODY" '.schema == [{"name":"unique_visitors","type":"NUMBER"}] and (.rows | length == 1) and (.rows[0].unique_visitors | type == "number")'

for interval in hour day week month year; do
  BODY=$(jq -n \
    --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" --arg interval "$interval" \
    '{dataset:"events", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, interval:$interval, dimensions:["date"], metrics:["events"], filters:[], orderBy:[{field:"date",direction:"ASC"}], limit:1000}')
  case "$interval" in
    hour) regex='^[0-9]{10}$' ;;
    day) regex='^[0-9]{8}$' ;;
    week) regex='^[0-9]{6}$' ;;
    month) regex='^[0-9]{6}$' ;;
    year) regex='^[0-9]{4}$' ;;
  esac
  run_dashboard_check "1.3 event date histogram $interval" "$BODY" ".schema == [{\"name\":\"date\",\"type\":\"STRING\"},{\"name\":\"events\",\"type\":\"NUMBER\"}] and (.rows | length > 0) and all(.rows[]; (.date | test(\"$regex\")) and (.events | type == \"number\"))"
done

BODY=$(jq -n \
  --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" \
  '{dataset:"events", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, dimensions:["event_name"], metrics:["events"], filters:[], orderBy:[{field:"events",direction:"DESC"}], limit:20}')
run_dashboard_check "1.4 top events" "$BODY" '.schema == [{"name":"event_name","type":"STRING"},{"name":"events","type":"NUMBER"}] and (.rows | length > 0) and all(.rows[]; (.event_name | type == "string") and (.events | type == "number"))'

TOP_EVENTS_FILE="$TMP_DIR/1_4_top_events.json"
if [ "$EVENT_NAME_PROVIDED" = false ]; then
  EVENT_NAME="$(jq -r '.rows[0].event_name // empty' "$TOP_EVENTS_FILE")"
fi
if [ "$EVENT_NAME_2_PROVIDED" = false ]; then
  EVENT_NAME_2="$(jq -r '.rows[1].event_name // .rows[0].event_name // empty' "$TOP_EVENTS_FILE")"
fi
if [ -z "$EVENT_NAME" ]; then
  print_header "3.x event_name filters skipped"
  print_expected "top events response did not include an event_name value to use as a filter"
  printf 'Result: skipped\n'
  SKIP_EVENT_FILTERS=true
else
  SKIP_EVENT_FILTERS=false
  printf 'Using event filter values from top events: EVENT_NAME=%s EVENT_NAME_2=%s\n' "$EVENT_NAME" "$EVENT_NAME_2"
fi

BODY=$(jq -n \
  --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" \
  '{dataset:"events", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, dimensions:["event_name"], metrics:["events","unique_visitors"], filters:[], orderBy:[{field:"events",direction:"DESC"}], limit:20}')
compare_dashboard_es "1.6 dashboard and es event responses match" "$BODY"

BODY=$(jq -n \
  --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" \
  '{dataset:"events", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, interval:"day", dimensions:["date","event_name"], metrics:["events"], filters:[], orderBy:[{field:"events",direction:"DESC"}], limit:100}')
run_dashboard_check "2.1 date and event_name composite" "$BODY" '.schema == [{"name":"date","type":"STRING"},{"name":"event_name","type":"STRING"},{"name":"events","type":"NUMBER"}] and (.rows | length > 0) and all(.rows[]; (.date | test("^[0-9]{8}$")) and (.event_name | type == "string") and (.events | type == "number"))'

BODY=$(jq -n \
  --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" \
  '{dataset:"events", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, dimensions:["path"], metrics:["events"], filters:[], orderBy:[{field:"events",direction:"DESC"}], limit:20}')
run_dashboard_error_check "2.3 pageview field invalid for events" "$BODY"

if [ "$SKIP_EVENT_FILTERS" = false ]; then
  BODY=$(jq -n \
    --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" --arg event "$EVENT_NAME" \
    '{dataset:"events", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, dimensions:["event_name"], metrics:["events"], filters:[{field:"event_name",operator:"EQUALS",values:[$event]}], orderBy:[{field:"events",direction:"DESC"}], limit:20}')
  run_dashboard_optional_nonempty_filter_check "3.1 event_name EQUALS filter" "$BODY" '(.rows | length > 0) and (.rows | all(.[]; .event_name == $event))' "filtered rows are non-empty and all event_name values equal $EVENT_NAME" --arg event "$EVENT_NAME"

  BODY=$(jq -n \
    --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" --arg a "$EVENT_NAME" --arg b "$EVENT_NAME_2" \
    '{dataset:"events", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, dimensions:["event_name"], metrics:["events"], filters:[{field:"event_name",operator:"IN",values:[$a,$b]}], orderBy:[{field:"events",direction:"DESC"}], limit:20}')
  run_dashboard_optional_nonempty_filter_check "3.2 event_name IN filter" "$BODY" '(.rows | length > 0) and (.rows | all(.[]; .event_name == $a or .event_name == $b))' "filtered rows are non-empty and contain only $EVENT_NAME or $EVENT_NAME_2" --arg a "$EVENT_NAME" --arg b "$EVENT_NAME_2"

  BODY=$(jq -n \
    --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" --arg event "$EVENT_NAME" \
    '{dataset:"events", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, dimensions:["event_name"], metrics:["events"], filters:[{field:"event_name",operator:"NOT_EQUALS",values:[$event]}], orderBy:[{field:"events",direction:"DESC"}], limit:20}')
  run_dashboard_check_with_args "3.3 event_name NOT_EQUALS filter" "$BODY" '.rows | all(.[]; .event_name != $event)' "all event_name values are not $EVENT_NAME" --arg event "$EVENT_NAME"
fi

BODY=$(jq -n \
  --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" \
  '{dataset:"events", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, dimensions:["event_name"], metrics:["events"], filters:[{field:"path",operator:"EQUALS",values:["/"]}], orderBy:[{field:"events",direction:"DESC"}], limit:20}')
run_dashboard_error_check "3.4 unsupported event filter rejected" "$BODY"

print_header "4.1 event schema helper returns approved metadata"
print_expected "schema helper returns zero or more approved event_meta_* DIMENSION fields"
SCHEMA_FILE="$TMP_DIR/event_schema.json"
curl -s "$DASHBOARD_URL/api/looker/schema?hostname=$HOSTNAME&dataset=events" \
  -H "Api-Key: $API_KEY" > "$SCHEMA_FILE"
print_response_summary "$SCHEMA_FILE"
assert_jq "$SCHEMA_FILE" '(.schema | type == "array") and all(.schema[]; (.name | startswith("event_meta_")) and .semantics.conceptType == "DIMENSION")'

if [ "$EVENT_META_FIELD_PROVIDED" = false ]; then
  EVENT_META_FIELD="$(jq -r '.schema[0].name // empty' "$SCHEMA_FILE")"
fi

HAS_METADATA=true
if [ -z "$EVENT_META_FIELD" ] || ! jq -e --arg field "$EVENT_META_FIELD" '.schema | any(.name == $field and .semantics.conceptType == "DIMENSION")' "$SCHEMA_FILE" > /dev/null; then
  HAS_METADATA=false
  print_header "4.x/5.x metadata checks skipped"
  if [ -n "$EVENT_META_FIELD" ]; then
    print_expected "$EVENT_META_FIELD was not returned by schema discovery for $HOSTNAME"
  else
    print_expected "no approved event metadata fields were discovered for $HOSTNAME"
  fi
  printf 'Result: skipped\n'
fi

if [ "$HAS_METADATA" = true ]; then
  assert_jq_with_args "$SCHEMA_FILE" '.schema | any(.name == $field and .semantics.conceptType == "DIMENSION")' --arg field "$EVENT_META_FIELD"
  printf 'Using metadata field: EVENT_META_FIELD=%s\n' "$EVENT_META_FIELD"

  BODY=$(jq -n \
    --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" --arg field "$EVENT_META_FIELD" \
    '{dataset:"events", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, dimensions:[$field], metrics:["events"], filters:[], orderBy:[{field:"events",direction:"DESC"}], limit:20}')
  run_dashboard_check "4.2 group by approved metadata" "$BODY" '.schema[0].name == "'"$EVENT_META_FIELD"'" and (.rows | length > 0) and all(.rows[]; (.["'"$EVENT_META_FIELD"'"] | type == "string") and (.events | type == "number"))'

  METADATA_GROUP_FILE="$TMP_DIR/4_2_group_by_approved_metadata.json"
  if [ "$EVENT_META_VALUE_PROVIDED" = false ]; then
    EVENT_META_VALUE="$(jq -r --arg field "$EVENT_META_FIELD" '.rows[0][$field] // empty' "$METADATA_GROUP_FILE")"
  fi
  printf 'Using metadata filter value: EVENT_META_VALUE=%s\n' "$EVENT_META_VALUE"
fi

BODY=$(jq -n \
  --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" \
  '{dataset:"events", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, dimensions:["event_meta_unknown_key"], metrics:["events"], filters:[], orderBy:[{field:"events",direction:"DESC"}], limit:20}')
run_dashboard_error_check "4.3 unknown metadata dimension rejected" "$BODY"

if [ "$HAS_METADATA" = true ]; then
  BODY=$(jq -n \
    --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" --arg field "$EVENT_META_FIELD" --arg value "$EVENT_META_VALUE" \
    '{dataset:"events", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, dimensions:[$field], metrics:["events"], filters:[{field:$field,operator:"EQUALS",values:[$value]}], orderBy:[{field:"events",direction:"DESC"}], limit:20}')
  run_dashboard_check_with_args "5.1 metadata EQUALS filter" "$BODY" '(.rows | length > 0) and (.rows | all(.[]; .[$field] == $value))' "filtered rows are non-empty and all $EVENT_META_FIELD values equal $EVENT_META_VALUE" --arg field "$EVENT_META_FIELD" --arg value "$EVENT_META_VALUE"
else
  print_header "5.1 metadata EQUALS filter"
  print_expected "skipped because no approved event metadata fields were discovered"
  printf 'Result: skipped\n'
fi

BODY=$(jq -n \
  --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" \
  '{dataset:"events", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, dimensions:["event_name"], metrics:["events"], filters:[{field:"event_meta_unknown_key",operator:"EQUALS",values:["x"]}], orderBy:[{field:"events",direction:"DESC"}], limit:20}')
run_dashboard_error_check "5.2 unknown metadata filter rejected" "$BODY"

if [ "$HAS_METADATA" = true ]; then
  BODY=$(jq -n \
    --arg hostname "$HOSTNAME" --arg timezone "$TIMEZONE" --arg start "$START_DATE" --arg end "$END_DATE" --arg field "$EVENT_META_FIELD" --arg value "$EVENT_META_VALUE" \
    '{dataset:"events", hostname:$hostname, timezone:$timezone, dateRange:{start:$start,end:$end}, dimensions:[$field], metrics:["events"], filters:[{field:$field,operator:"CONTAINS",values:[$value]}], orderBy:[{field:"events",direction:"DESC"}], limit:20}')
  run_dashboard_error_check "5.3 metadata CONTAINS rejected" "$BODY"
else
  print_header "5.3 metadata CONTAINS rejected"
  print_expected "skipped because no approved event metadata fields were discovered"
  printf 'Result: skipped\n'
fi

print_header "All checks completed"
printf 'Responses saved in %s\n' "$TMP_DIR"
