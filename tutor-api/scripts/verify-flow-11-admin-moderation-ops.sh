#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_PREFIX="${API_PREFIX:-api/v1}"
API="$API_BASE_URL/$API_PREFIX"
PSQL_URL="${PSQL_URL:-postgresql://postgres:postgres@db:5432/tutor}"
TUTOR_PHONE="${TUTOR_PHONE:-0917$(date +%H%M%S)}"
PARENT_PHONE="${PARENT_PHONE:-0918$(date +%H%M%S)}"
ADMIN_PHONE="${ADMIN_PHONE:-0919$(date +%H%M%S)}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

json_get() {
  file="$1"
  path="$2"
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); const path=process.argv[2].split('.'); let cur=data; for (const key of path) cur=cur?.[key]; if (cur === undefined) process.exit(2); if (cur === null) { process.stdout.write('null'); process.exit(0); } process.stdout.write(String(cur));" "$file" "$path"
}

json_array_contains_id() {
  file="$1"
  path="$2"
  id="$3"
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); const path=process.argv[2].split('.'); let cur=data; for (const key of path) cur=cur?.[key]; if (!Array.isArray(cur)) process.exit(2); process.exit(cur.some((item) => item?.id === process.argv[3]) ? 0 : 3);" "$file" "$path" "$id"
}

require_code() {
  actual="$1"
  expected="$2"
  label="$3"
  file="$4"
  [ "$actual" = "$expected" ] || {
    echo "--- response ---" >&2
    [ -f "$file" ] && cat "$file" >&2
    fail "$label expected HTTP $expected, got $actual"
  }
}

require_json_value() {
  file="$1"
  path="$2"
  expected="$3"
  actual="$(json_get "$file" "$path")"
  [ "$actual" = "$expected" ] || fail "$path expected $expected, got $actual"
}

echo "== Flow 11 setup: paid single unlock + pending tutor moderation via Flow 8 =="
TUTOR_PHONE="$TUTOR_PHONE" PARENT_PHONE="$PARENT_PHONE" sh /app/tutor-api/scripts/verify-flow-08-single-unlock-profile.sh
TUTOR_PROFILE_ID="$(json_get /tmp/flow02-profile.json id)"
PAYMENT_ID="$(json_get /tmp/flow08-checkout.json payment_id)"

echo "== Flow 11 setup: login active admin candidate and grant admin role =="
PHONE="$ADMIN_PHONE" sh /app/tutor-api/scripts/verify-flow-01-auth-consent.sh
ADMIN_TOKEN="$(json_get /tmp/flow01-otp-verify.json access_token)"
ADMIN_USER_ID="$(json_get /tmp/flow01-otp-verify.json user.id)"
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -c "update users set roles = ARRAY['admin'] where id = '$ADMIN_USER_ID';"
ADMIN_AUTH="Authorization: Bearer $ADMIN_TOKEN"

echo "== Flow 11 Step 1: admin views moderation queue =="
queue_http="$(curl -sS -o /tmp/flow11-moderation-queue.json -w "%{http_code}" \
  -H "$ADMIN_AUTH" \
  "$API/admin/moderation/queue")"
cat /tmp/flow11-moderation-queue.json
echo
require_code "$queue_http" "200" "Moderation queue" /tmp/flow11-moderation-queue.json
json_array_contains_id /tmp/flow11-moderation-queue.json tutors "$TUTOR_PROFILE_ID" || fail "Moderation queue did not include tutor_profile_id $TUTOR_PROFILE_ID"

echo "== Flow 11 Step 2: admin sets tutor status published =="
status_http="$(curl -sS -o /tmp/flow11-tutor-status.json -w "%{http_code}" \
  -X POST "$API/admin/tutors/$TUTOR_PROFILE_ID/status" \
  -H "Content-Type: application/json" \
  -H "$ADMIN_AUTH" \
  --data '{
    "status": "published"
  }')"
cat /tmp/flow11-tutor-status.json
echo
require_code "$status_http" "201" "Admin set tutor status" /tmp/flow11-tutor-status.json
require_json_value /tmp/flow11-tutor-status.json id "$TUTOR_PROFILE_ID"
require_json_value /tmp/flow11-tutor-status.json status published
require_json_value /tmp/flow11-tutor-status.json moderation_status approved

echo "== Flow 11 Step 3: admin lists paid single unlock payments =="
payments_http="$(curl -sS -o /tmp/flow11-admin-payments.json -w "%{http_code}" \
  -H "$ADMIN_AUTH" \
  "$API/admin/payments?status=paid&product_type=single_unlock&limit=20")"
cat /tmp/flow11-admin-payments.json
echo
require_code "$payments_http" "200" "Admin payments" /tmp/flow11-admin-payments.json
json_array_contains_id /tmp/flow11-admin-payments.json items "$PAYMENT_ID" || fail "Admin payments did not include payment_id $PAYMENT_ID"

echo "== Flow 11 Step 4: admin views tutor status audit log =="
audit_http="$(curl -sS -o /tmp/flow11-audit-logs.json -w "%{http_code}" \
  -H "$ADMIN_AUTH" \
  "$API/admin/audit-logs?action=admin.tutor_status&entity_type=tutor_profile&entity_id=$TUTOR_PROFILE_ID")"
cat /tmp/flow11-audit-logs.json
echo
require_code "$audit_http" "200" "Admin audit logs" /tmp/flow11-audit-logs.json
json_array_contains_id /tmp/flow11-audit-logs.json items "$(json_get /tmp/flow11-audit-logs.json items.0.id)" || fail "Admin audit logs are empty"
require_json_value /tmp/flow11-audit-logs.json items.0.actor_user_id "$ADMIN_USER_ID"
require_json_value /tmp/flow11-audit-logs.json items.0.action admin.tutor_status
require_json_value /tmp/flow11-audit-logs.json items.0.entity_type tutor_profile
require_json_value /tmp/flow11-audit-logs.json items.0.entity_id "$TUTOR_PROFILE_ID"

echo "OK: Flow 11 Admin moderation + ops verified end-to-end for tutor_profile_id $TUTOR_PROFILE_ID payment_id $PAYMENT_ID"
