#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_PREFIX="${API_PREFIX:-api/v1}"
API="$API_BASE_URL/$API_PREFIX"
TUTOR_PHONE="${TUTOR_PHONE:-0915$(date +%H%M%S)}"
PARENT_PHONE="${PARENT_PHONE:-0916$(date +%H%M%S)}"

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

echo "== Flow 10 setup: active class + payout account via Flow 6 =="
TUTOR_PHONE="$TUTOR_PHONE" PARENT_PHONE="$PARENT_PHONE" sh /app/tutor-api/scripts/verify-flow-06-tutor-inbox-lesson-log.sh
TUTOR_TOKEN="$(json_get /tmp/flow02-otp-verify.json access_token)"
TUTOR_AUTH="Authorization: Bearer $TUTOR_TOKEN"
CLASS_ID="$(json_get /tmp/flow06-transition-active.json id)"
PAYOUT_ACCOUNT_ID="$(json_get /tmp/flow02-payout.json id)"

echo "== Flow 10 setup: checkout and activate tutor_qr subscription =="
checkout_http="$(curl -sS -o /tmp/flow10-tutor-qr-checkout.json -w "%{http_code}" \
  -X POST "$API/billing/checkout" \
  -H "Content-Type: application/json" \
  -H "$TUTOR_AUTH" \
  -H "Idempotency-Key: tutor-qr-$CLASS_ID-202607" \
  --data '{
    "product_type": "tutor_qr"
  }')"
cat /tmp/flow10-tutor-qr-checkout.json
echo
require_code "$checkout_http" "201" "Checkout tutor_qr" /tmp/flow10-tutor-qr-checkout.json
require_json_value /tmp/flow10-tutor-qr-checkout.json product_type tutor_qr
require_json_value /tmp/flow10-tutor-qr-checkout.json status pending
require_json_value /tmp/flow10-tutor-qr-checkout.json entitlement.type tutor_qr
require_json_value /tmp/flow10-tutor-qr-checkout.json entitlement.status pending_payment
PAYMENT_ID="$(json_get /tmp/flow10-tutor-qr-checkout.json payment_id)"
PROVIDER_REFERENCE="$(json_get /tmp/flow10-tutor-qr-checkout.json provider_reference)"
TUTOR_QR_AMOUNT="$(json_get /tmp/flow10-tutor-qr-checkout.json amount)"
[ "$TUTOR_QR_AMOUNT" -gt 0 ] || fail "Expected tutor_qr checkout amount > 0, got $TUTOR_QR_AMOUNT"

webhook_http="$(curl -sS -o /tmp/flow10-tutor-qr-webhook.json -w "%{http_code}" \
  -X POST "$API/billing/webhook/sepay" \
  -H "Content-Type: application/json" \
  -H "x-sepay-api-key: docker-dev-sepay-key" \
  --data "{
    \"id\": \"txn-flow10-$PAYMENT_ID\",
    \"reference\": \"$PROVIDER_REFERENCE\",
    \"amount\": $TUTOR_QR_AMOUNT,
    \"content\": \"Thanh toan $PROVIDER_REFERENCE\"
  }")"
cat /tmp/flow10-tutor-qr-webhook.json
echo
require_code "$webhook_http" "201" "SePay webhook tutor_qr" /tmp/flow10-tutor-qr-webhook.json
require_json_value /tmp/flow10-tutor-qr-webhook.json status paid

echo "== Flow 10 Step 1: create tuition QR record =="
qr_http="$(curl -sS -o /tmp/flow10-qr-record.json -w "%{http_code}" \
  -X POST "$API/qr/records" \
  -H "Content-Type: application/json" \
  -H "$TUTOR_AUTH" \
  --data "{
    \"class_contract_id\": \"$CLASS_ID\",
    \"amount\": 800000,
    \"description\": \"Hoc phi thang 07/2026 - Minh Chau\",
    \"payout_account_id\": \"$PAYOUT_ACCOUNT_ID\"
  }")"
cat /tmp/flow10-qr-record.json
echo
require_code "$qr_http" "201" "Create tuition QR" /tmp/flow10-qr-record.json
require_json_value /tmp/flow10-qr-record.json class_contract_id "$CLASS_ID"
require_json_value /tmp/flow10-qr-record.json payout_account_id "$PAYOUT_ACCOUNT_ID"
require_json_value /tmp/flow10-qr-record.json amount 800000
require_json_value /tmp/flow10-qr-record.json collection_status created
require_json_value /tmp/flow10-qr-record.json transfer_content "Hoc phi thang 07/2026 - Minh Chau"
QR_RECORD_ID="$(json_get /tmp/flow10-qr-record.json id)"

echo "== Flow 10 Step 2: list QR records =="
list_http="$(curl -sS -o /tmp/flow10-qr-list.json -w "%{http_code}" \
  -H "$TUTOR_AUTH" \
  "$API/qr/records?class_contract_id=$CLASS_ID")"
cat /tmp/flow10-qr-list.json
echo
require_code "$list_http" "200" "List tuition QR records" /tmp/flow10-qr-list.json
json_array_contains_id /tmp/flow10-qr-list.json items "$QR_RECORD_ID" || fail "QR list did not include qr_record_id $QR_RECORD_ID"

echo "== Flow 10 Step 3: mark QR collected =="
collected_http="$(curl -sS -o /tmp/flow10-qr-collected.json -w "%{http_code}" \
  -X POST "$API/qr/records/$QR_RECORD_ID/mark-collected" \
  -H "$TUTOR_AUTH")"
cat /tmp/flow10-qr-collected.json
echo
require_code "$collected_http" "201" "Mark tuition QR collected" /tmp/flow10-qr-collected.json
require_json_value /tmp/flow10-qr-collected.json id "$QR_RECORD_ID"
require_json_value /tmp/flow10-qr-collected.json collection_status marked_collected
json_get /tmp/flow10-qr-collected.json marked_collected_at >/dev/null

echo "OK: Flow 10 Tutor QR tuition verified end-to-end for class_id $CLASS_ID qr_record_id $QR_RECORD_ID"
