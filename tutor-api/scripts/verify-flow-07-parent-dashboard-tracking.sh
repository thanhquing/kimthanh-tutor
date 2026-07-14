#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_PREFIX="${API_PREFIX:-api/v1}"
API="$API_BASE_URL/$API_PREFIX"
TUTOR_PHONE="${TUTOR_PHONE:-097$(date +%H%M%S)}"
PARENT_PHONE="${PARENT_PHONE:-098$(date +%H%M%S)}"
TRACKING_AMOUNT="${TRACKING_AMOUNT:-69000}"

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

echo "== Flow 7 setup: active class + lesson log via Flow 6 =="
TUTOR_PHONE="$TUTOR_PHONE" PARENT_PHONE="$PARENT_PHONE" sh /app/tutor-api/scripts/verify-flow-06-tutor-inbox-lesson-log.sh
PARENT_TOKEN="$(json_get /tmp/flow01-otp-verify.json access_token)"
PARENT_AUTH="Authorization: Bearer $PARENT_TOKEN"
STUDENT_ID="$(json_get /tmp/flow05-student.json id)"
CLASS_ID="$(json_get /tmp/flow06-transition-active.json id)"
LESSON_LOG_ID="$(json_get /tmp/flow06-lesson-log-patch.json id)"

echo "== Flow 7 Step 1: parent views student overview =="
overview_http="$(curl -sS -o /tmp/flow07-overview.json -w "%{http_code}" \
  -H "$PARENT_AUTH" \
  "$API/dashboard/students/$STUDENT_ID/overview")"
cat /tmp/flow07-overview.json
echo
require_code "$overview_http" "200" "Student overview" /tmp/flow07-overview.json
require_json_value /tmp/flow07-overview.json student.id "$STUDENT_ID"
require_json_value /tmp/flow07-overview.json classes.0.id "$CLASS_ID"
require_json_value /tmp/flow07-overview.json latest_lesson.subject math
require_json_value /tmp/flow07-overview.json latest_lesson.absorption_level good

echo "== Flow 7 Step 2: detail is locked before tracking subscription =="
locked_http="$(curl -sS -o /tmp/flow07-detail-locked.json -w "%{http_code}" \
  -H "$PARENT_AUTH" \
  "$API/dashboard/students/$STUDENT_ID/detail")"
cat /tmp/flow07-detail-locked.json
echo
require_code "$locked_http" "402" "Locked dashboard detail" /tmp/flow07-detail-locked.json
require_json_value /tmp/flow07-detail-locked.json code PAYMENT_REQUIRED

echo "== Flow 7 Step 3: checkout parent tracking subscription =="
checkout_http="$(curl -sS -o /tmp/flow07-checkout.json -w "%{http_code}" \
  -X POST "$API/billing/checkout" \
  -H "Content-Type: application/json" \
  -H "$PARENT_AUTH" \
  -H "Idempotency-Key: tracking-$STUDENT_ID-202607" \
  --data "{
    \"product_type\": \"parent_tracking\",
    \"target_ref_id\": \"$STUDENT_ID\"
  }")"
cat /tmp/flow07-checkout.json
echo
require_code "$checkout_http" "201" "Checkout parent tracking" /tmp/flow07-checkout.json
require_json_value /tmp/flow07-checkout.json product_type parent_tracking
require_json_value /tmp/flow07-checkout.json target_ref_id "$STUDENT_ID"
require_json_value /tmp/flow07-checkout.json amount "$TRACKING_AMOUNT"
require_json_value /tmp/flow07-checkout.json status pending
require_json_value /tmp/flow07-checkout.json entitlement.type parent_tracking
require_json_value /tmp/flow07-checkout.json entitlement.status pending_payment
PAYMENT_ID="$(json_get /tmp/flow07-checkout.json payment_id)"
PROVIDER_REFERENCE="$(json_get /tmp/flow07-checkout.json provider_reference)"

echo "== Flow 7 Step 4: poll payment status =="
payment_http="$(curl -sS -o /tmp/flow07-payment-pending.json -w "%{http_code}" \
  -H "$PARENT_AUTH" \
  "$API/billing/payments/$PAYMENT_ID")"
cat /tmp/flow07-payment-pending.json
echo
require_code "$payment_http" "200" "Poll pending payment" /tmp/flow07-payment-pending.json
require_json_value /tmp/flow07-payment-pending.json payment_id "$PAYMENT_ID"
require_json_value /tmp/flow07-payment-pending.json status pending

echo "== Flow 7 Step 5: simulate SePay webhook paid =="
webhook_http="$(curl -sS -o /tmp/flow07-webhook.json -w "%{http_code}" \
  -X POST "$API/billing/webhook/sepay" \
  -H "Content-Type: application/json" \
  -H "x-sepay-api-key: docker-dev-sepay-key" \
  --data "{
    \"id\": \"txn-flow07-$PAYMENT_ID\",
    \"reference\": \"$PROVIDER_REFERENCE\",
    \"amount\": $TRACKING_AMOUNT,
    \"content\": \"Thanh toan $PROVIDER_REFERENCE\"
  }")"
cat /tmp/flow07-webhook.json
echo
require_code "$webhook_http" "201" "SePay webhook" /tmp/flow07-webhook.json
require_json_value /tmp/flow07-webhook.json received true
require_json_value /tmp/flow07-webhook.json payment_id "$PAYMENT_ID"
require_json_value /tmp/flow07-webhook.json status paid

echo "== Flow 7 Step 6: dashboard detail opens after payment =="
detail_http="$(curl -sS -o /tmp/flow07-detail-unlocked.json -w "%{http_code}" \
  -H "$PARENT_AUTH" \
  "$API/dashboard/students/$STUDENT_ID/detail")"
cat /tmp/flow07-detail-unlocked.json
echo
require_code "$detail_http" "200" "Unlocked dashboard detail" /tmp/flow07-detail-unlocked.json
require_json_value /tmp/flow07-detail-unlocked.json student.id "$STUDENT_ID"
json_array_contains_id /tmp/flow07-detail-unlocked.json timeline.items "$LESSON_LOG_ID" || fail "Dashboard detail did not include lesson_log_id $LESSON_LOG_ID"

echo "OK: Flow 7 Parent dashboard + tracking checkout verified end-to-end for student_id $STUDENT_ID payment_id $PAYMENT_ID"
