#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_PREFIX="${API_PREFIX:-api/v1}"
API="$API_BASE_URL/$API_PREFIX"
TUTOR_PHONE="${TUTOR_PHONE:-0910$(date +%H%M%S)}"
PARENT_PHONE="${PARENT_PHONE:-0911$(date +%H%M%S)}"
UNLOCK_AMOUNT="${UNLOCK_AMOUNT:-49000}"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

json_get() {
  file="$1"
  path="$2"
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); const path=process.argv[2].split('.'); let cur=data; for (const key of path) cur=cur?.[key]; if (cur === undefined) process.exit(2); if (cur === null) { process.stdout.write('null'); process.exit(0); } process.stdout.write(String(cur));" "$file" "$path"
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

echo "== Flow 8 setup: parent + published tutor via Flow 5 =="
TUTOR_PHONE="$TUTOR_PHONE" PARENT_PHONE="$PARENT_PHONE" sh /app/tutor-api/scripts/verify-flow-05-parent-onboarding-trial.sh
TUTOR_PROFILE_ID="$(json_get /tmp/flow02-profile.json id)"
PARENT_TOKEN="$(json_get /tmp/flow01-otp-verify.json access_token)"
PARENT_AUTH="Authorization: Bearer $PARENT_TOKEN"

echo "== Flow 8 Pre-step: parent sees tutor detail locked =="
locked_http="$(curl -sS -o /tmp/flow08-detail-locked.json -w "%{http_code}" \
  -H "$PARENT_AUTH" \
  "$API/tutors/$TUTOR_PROFILE_ID/public")"
cat /tmp/flow08-detail-locked.json
echo
require_code "$locked_http" "200" "Locked tutor detail" /tmp/flow08-detail-locked.json
require_json_value /tmp/flow08-detail-locked.json id "$TUTOR_PROFILE_ID"
require_json_value /tmp/flow08-detail-locked.json unlock_state locked
require_json_value /tmp/flow08-detail-locked.json unlock_via null

echo "== Flow 8 Step 1: checkout single profile unlock =="
checkout_http="$(curl -sS -o /tmp/flow08-checkout.json -w "%{http_code}" \
  -X POST "$API/billing/checkout" \
  -H "Content-Type: application/json" \
  -H "$PARENT_AUTH" \
  -H "Idempotency-Key: unlock-$TUTOR_PROFILE_ID" \
  --data "{
    \"product_type\": \"single_unlock\",
    \"target_ref_id\": \"$TUTOR_PROFILE_ID\"
  }")"
cat /tmp/flow08-checkout.json
echo
require_code "$checkout_http" "201" "Checkout single unlock" /tmp/flow08-checkout.json
require_json_value /tmp/flow08-checkout.json product_type single_unlock
require_json_value /tmp/flow08-checkout.json target_ref_id "$TUTOR_PROFILE_ID"
require_json_value /tmp/flow08-checkout.json amount "$UNLOCK_AMOUNT"
require_json_value /tmp/flow08-checkout.json status pending
PAYMENT_ID="$(json_get /tmp/flow08-checkout.json payment_id)"
PROVIDER_REFERENCE="$(json_get /tmp/flow08-checkout.json provider_reference)"

echo "== Flow 8 Step 1b: simulate SePay webhook paid =="
webhook_http="$(curl -sS -o /tmp/flow08-webhook.json -w "%{http_code}" \
  -X POST "$API/billing/webhook/sepay" \
  -H "Content-Type: application/json" \
  -H "x-sepay-api-key: docker-dev-sepay-key" \
  --data "{
    \"id\": \"txn-flow08-$PAYMENT_ID\",
    \"reference\": \"$PROVIDER_REFERENCE\",
    \"amount\": $UNLOCK_AMOUNT,
    \"content\": \"Thanh toan $PROVIDER_REFERENCE\"
  }")"
cat /tmp/flow08-webhook.json
echo
require_code "$webhook_http" "201" "SePay webhook single unlock" /tmp/flow08-webhook.json
require_json_value /tmp/flow08-webhook.json received true
require_json_value /tmp/flow08-webhook.json payment_id "$PAYMENT_ID"
require_json_value /tmp/flow08-webhook.json status paid

echo "== Flow 8 Step 2: parent sees unlocked tutor detail =="
detail_http="$(curl -sS -o /tmp/flow08-detail-unlocked.json -w "%{http_code}" \
  -H "$PARENT_AUTH" \
  "$API/tutors/$TUTOR_PROFILE_ID/public")"
cat /tmp/flow08-detail-unlocked.json
echo
require_code "$detail_http" "200" "Unlocked tutor detail" /tmp/flow08-detail-unlocked.json
require_json_value /tmp/flow08-detail-unlocked.json id "$TUTOR_PROFILE_ID"
require_json_value /tmp/flow08-detail-unlocked.json unlock_state unlocked
require_json_value /tmp/flow08-detail-unlocked.json unlock_via single_unlock
require_json_value /tmp/flow08-detail-unlocked.json bio "Gia su Toan cap 2, uu tien nen tang co ban va thoi quen tu hoc."
require_json_value /tmp/flow08-detail-unlocked.json intro_video_url null

echo "OK: Flow 8 Single unlock profile verified end-to-end for tutor_profile_id $TUTOR_PROFILE_ID payment_id $PAYMENT_ID"
