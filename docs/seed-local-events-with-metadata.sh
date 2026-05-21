#!/usr/bin/env bash
set -euo pipefail

QUEUE_URL="${QUEUE_URL:-http://localhost:8001}"
HOSTNAME="${HOSTNAME:-seed.com}"
DATASTREAM="${DATASTREAM:-test-datapoints-free}"
TIMEZONE="${TIMEZONE:-Etc/UTC}"
START_DATE="${START_DATE:-2026-01-10}"
EVENT_COUNT="${EVENT_COUNT:-60}"

USER_AGENT="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"

uuid() {
  uuidgen | tr '[:upper:]' '[:lower:]'
}

event_name_for_index() {
  case $(( $1 % 6 )) in
    0) printf 'signup' ;;
    1) printf 'checkout' ;;
    2) printf 'demo_request' ;;
    3) printf 'pricing_click' ;;
    4) printf 'docs_outbound' ;;
    *) printf 'upgrade_click' ;;
  esac
}

plan_for_index() {
  case $(( $1 % 3 )) in
    0) printf 'free' ;;
    1) printf 'pro' ;;
    *) printf 'enterprise' ;;
  esac
}

theme_for_index() {
  if [ $(( $1 % 2 )) -eq 0 ]; then printf 'dark'; else printf 'light'; fi
}

currency_for_index() {
  if [ $(( $1 % 2 )) -eq 0 ]; then printf 'eur'; else printf 'usd'; fi
}

timestamp_for_index() {
  local index="$1"
  local day_offset=$(( index % 30 ))
  local hour=$(( index % 24 ))

  if date -u -j -f '%Y-%m-%d' "$START_DATE" "+%Y-%m-%dT$(printf '%02d' "$hour"):00:00.000Z" >/dev/null 2>&1; then
    date -u -j -v+"${day_offset}"d -f '%Y-%m-%d' "$START_DATE" "+%Y-%m-%dT$(printf '%02d' "$hour"):00:00.000Z"
    return
  fi

  date -u -d "$START_DATE + ${day_offset} days" "+%Y-%m-%dT$(printf '%02d' "$hour"):00:00.000Z"
}

post_event() {
  local index="$1"
  local event_name
  local plan
  local theme
  local currency
  local timestamp

  event_name="$(event_name_for_index "$index")"
  plan="$(plan_for_index "$index")"
  theme="$(theme_for_index "$index")"
  currency="$(currency_for_index "$index")"
  timestamp="$(timestamp_for_index "$index")"

  local body
  body=$(jq -n \
    --arg hostname "$HOSTNAME" \
    --arg event "$event_name" \
    --arg timestamp "$timestamp" \
    --arg page_id "$(uuid)" \
    --arg session_id "$(uuid)" \
    --arg id "$(uuid)" \
    --arg timezone "$TIMEZONE" \
    --arg datastream "$DATASTREAM" \
    --arg ua "$USER_AGENT" \
    --arg url "https://$HOSTNAME/local-event-test/$event_name" \
    --arg path "/local-event-test/$event_name" \
    --arg plan "$plan" \
    --arg theme "$theme" \
    --arg currency "$currency" \
    --argjson is_public "$([ $(( index % 2 )) -eq 0 ] && printf true || printf false)" \
    --argjson status "$(( 200 + (index % 5) ))" \
    '{
      type: "event",
      test: true,
      hostname: $hostname,
      event: $event,
      timestamp: $timestamp,
      page_id: $page_id,
      session_id: $session_id,
      id: $id,
      timezone: $timezone,
      datastream: $datastream,
      ua: $ua,
      url: $url,
      path: $path,
      metadata: {
        plan: $plan,
        theme: $theme,
        currency: $currency,
        is_public: $is_public,
        status: $status,
        source: "local_seed",
        button: "primary"
      }
    }')

  printf 'Posting %s at %s with plan=%s theme=%s\n' "$event_name" "$timestamp" "$plan" "$theme"
  curl -s -X POST "$QUEUE_URL/events" \
    -H 'Content-Type: application/json' \
    --data "$body" | jq -c .
}

printf 'Seeding %s events into %s for hostname=%s datastream=%s starting=%s\n' "$EVENT_COUNT" "$QUEUE_URL" "$HOSTNAME" "$DATASTREAM" "$START_DATE"

for index in $(seq 0 $(( EVENT_COUNT - 1 ))); do
  post_event "$index"
done

cat <<EOF

Seed requests completed.

The queue writes through RabbitMQ/worker, so wait a few seconds before querying Elasticsearch/dashboard.

Important: local queue must run with IS_LOADTESTING=true so the datastream payload is accepted:

cd ../queue
IS_LOADTESTING=true QUEUE_ROLES="server,worker" npm run dev

Suggested local checks:

1. Confirm event rows through elasticsearch-api Looker endpoint:

curl -s -X POST "http://localhost:5602/api/looker/query" \\
  -H "Content-Type: application/json" \\
  --data '{
    "dataset": "events",
    "hostname": "$HOSTNAME",
    "timezone": "$TIMEZONE",
    "dateRange": { "start": "$START_DATE", "end": "2026-02-17" },
    "dimensions": ["event_name"],
    "metrics": ["events"],
    "filters": [],
    "orderBy": [{ "field": "events", "direction": "DESC" }],
    "limit": 20
  }' | jq

2. Confirm metadata through dashboard schema helper, if dashboard has a local API key/view for $HOSTNAME:

curl -s "http://localhost:3000/api/looker/schema?hostname=$HOSTNAME&dataset=events&start=$START_DATE&end=2026-02-17&timezone=$TIMEZONE" \\
  -H "Api-Key: YOUR_LOCAL_API_KEY" | jq

3. Run the Looker curl suite:

DASHBOARD_URL="http://localhost:3000" \\
ES_URL="http://localhost:5602" \\
API_KEY="YOUR_LOCAL_API_KEY" \\
HOSTNAME="$HOSTNAME" \\
START_DATE="$START_DATE" \\
END_DATE="2026-02-17" \\
./docs/run-events-v3-curl-checks.sh
EOF
