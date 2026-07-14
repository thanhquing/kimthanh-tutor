#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_PREFIX="${API_PREFIX:-api/v1}"
API="$API_BASE_URL/$API_PREFIX"
PSQL_URL="${PSQL_URL:-postgresql://postgres:postgres@db:5432/tutor}"
TUTOR_PHONE="${TUTOR_PHONE:-0927$(date +%H%M%S)}"
ADMIN_PHONE="${ADMIN_PHONE:-0928$(date +%H%M%S)}"

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

require_contains() {
  file="$1"
  expected="$2"
  if ! grep -q "$expected" "$file"; then
    echo "--- response ---" >&2
    cat "$file" >&2
    fail "Expected $file to contain $expected"
  fi
}

echo "== Flow 12 setup: create active tutor target via Flow 2 =="
PHONE="$TUTOR_PHONE" sh /app/tutor-api/scripts/verify-flow-02-tutor-profile.sh
TARGET_USER_ID="$(json_get /tmp/flow02-otp-verify.json user.id)"
TARGET_TOKEN="$(json_get /tmp/flow02-otp-verify.json access_token)"
TUTOR_PROFILE_ID="$(json_get /tmp/flow02-profile.json id)"
TARGET_AUTH="Authorization: Bearer $TARGET_TOKEN"

echo "== Flow 12 setup: login active admin and grant admin role =="
PHONE="$ADMIN_PHONE" sh /app/tutor-api/scripts/verify-flow-01-auth-consent.sh
ADMIN_TOKEN="$(json_get /tmp/flow01-otp-verify.json access_token)"
ADMIN_USER_ID="$(json_get /tmp/flow01-otp-verify.json user.id)"
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -c "update users set roles = ARRAY['admin'] where id = '$ADMIN_USER_ID'; update users set email = 'target.flow12@example.com' where id = '$TARGET_USER_ID';"
ADMIN_AUTH="Authorization: Bearer $ADMIN_TOKEN"

echo "== Flow 12 Step 1: admin opens overview dashboard =="
overview_http="$(curl -sS -o /tmp/flow12-overview.json -w "%{http_code}" \
  -H "$ADMIN_AUTH" \
  "$API/admin/overview?from=2026-01-01T00:00:00.000Z&to=2030-01-01T00:00:00.000Z")"
cat /tmp/flow12-overview.json
echo
require_code "$overview_http" "200" "Admin overview" /tmp/flow12-overview.json
json_get /tmp/flow12-overview.json users.total >/dev/null
json_get /tmp/flow12-overview.json payments.paid_amount >/dev/null

echo "== Flow 12 Step 2: admin lists tutor users =="
users_http="$(curl -sS -o /tmp/flow12-users.json -w "%{http_code}" \
  -H "$ADMIN_AUTH" \
  "$API/admin/users?role=tutor&status=active&q=target.flow12@example.com&limit=20")"
cat /tmp/flow12-users.json
echo
require_code "$users_http" "200" "Admin users" /tmp/flow12-users.json
json_array_contains_id /tmp/flow12-users.json items "$TARGET_USER_ID" || fail "Admin users did not include target user $TARGET_USER_ID"
require_contains /tmp/flow12-users.json "ta"
[ "$(grep -c "target.flow12@example.com" /tmp/flow12-users.json || true)" = "0" ] || fail "Admin user list leaked raw email"

echo "== Flow 12 Step 3: admin views user detail =="
detail_http="$(curl -sS -o /tmp/flow12-user-detail.json -w "%{http_code}" \
  -H "$ADMIN_AUTH" \
  "$API/admin/users/$TARGET_USER_ID")"
cat /tmp/flow12-user-detail.json
echo
require_code "$detail_http" "200" "Admin user detail" /tmp/flow12-user-detail.json
require_json_value /tmp/flow12-user-detail.json user.id "$TARGET_USER_ID"
require_json_value /tmp/flow12-user-detail.json profiles.tutor.id "$TUTOR_PROFILE_ID"

echo "== Flow 12 Step 4: admin sets platform VietQR account =="
account_http="$(curl -sS -o /tmp/flow12-platform-account.json -w "%{http_code}" \
  -X PATCH "$API/admin/platform/payment-account" \
  -H "Content-Type: application/json" \
  -H "$ADMIN_AUTH" \
  --data '{
    "bank_code": "VCB",
    "account_number": "123456789",
    "account_holder": "KIM THANH TUTOR",
    "is_active": true
  }')"
cat /tmp/flow12-platform-account.json
echo
require_code "$account_http" "200" "Set platform payment account" /tmp/flow12-platform-account.json
require_json_value /tmp/flow12-platform-account.json bank_code VCB
require_json_value /tmp/flow12-platform-account.json account_number_masked "*****6789"
[ "$(grep -c "123456789" /tmp/flow12-platform-account.json || true)" = "0" ] || fail "Platform account response leaked raw account number"

echo "== Flow 12 Step 5: admin sets tutor_qr pricing =="
pricing_http="$(curl -sS -o /tmp/flow12-pricing-tutor-qr.json -w "%{http_code}" \
  -X PATCH "$API/admin/pricing/tutor_qr" \
  -H "Content-Type: application/json" \
  -H "$ADMIN_AUTH" \
  --data '{
    "amount": 35000,
    "period_days": 30,
    "is_enabled": true,
    "reason": "Flow 12 verify tutor_qr launch price"
  }')"
cat /tmp/flow12-pricing-tutor-qr.json
echo
require_code "$pricing_http" "200" "Set pricing" /tmp/flow12-pricing-tutor-qr.json
require_json_value /tmp/flow12-pricing-tutor-qr.json product_type tutor_qr
require_json_value /tmp/flow12-pricing-tutor-qr.json amount 35000
require_json_value /tmp/flow12-pricing-tutor-qr.json is_enabled true

echo "== Flow 12 Step 6: admin disables tutor_qr for target user =="
disable_http="$(curl -sS -o /tmp/flow12-disable-feature.json -w "%{http_code}" \
  -X PATCH "$API/admin/users/$TARGET_USER_ID/paid-features/tutor_qr" \
  -H "Content-Type: application/json" \
  -H "$ADMIN_AUTH" \
  --data '{
    "enabled": false,
    "reason": "Flow 12 temporary hold",
    "expires_at": "2030-01-01T00:00:00.000Z"
  }')"
cat /tmp/flow12-disable-feature.json
echo
require_code "$disable_http" "200" "Disable paid feature" /tmp/flow12-disable-feature.json
require_json_value /tmp/flow12-disable-feature.json user_id "$TARGET_USER_ID"
require_json_value /tmp/flow12-disable-feature.json feature tutor_qr
require_json_value /tmp/flow12-disable-feature.json enabled false

echo "== Flow 12 Step 7: disabled tutor_qr blocks checkout =="
blocked_http="$(curl -sS -o /tmp/flow12-blocked-checkout.json -w "%{http_code}" \
  -X POST "$API/billing/checkout" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: flow12-blocked-$TARGET_USER_ID" \
  -H "$TARGET_AUTH" \
  --data '{"product_type":"tutor_qr"}')"
cat /tmp/flow12-blocked-checkout.json
echo
require_code "$blocked_http" "403" "Blocked tutor_qr checkout" /tmp/flow12-blocked-checkout.json
require_json_value /tmp/flow12-blocked-checkout.json code FORBIDDEN_ROLE

echo "== Flow 12 Step 8: admin enables tutor_qr for target user =="
enable_http="$(curl -sS -o /tmp/flow12-enable-feature.json -w "%{http_code}" \
  -X PATCH "$API/admin/users/$TARGET_USER_ID/paid-features/tutor_qr" \
  -H "Content-Type: application/json" \
  -H "$ADMIN_AUTH" \
  --data '{
    "enabled": true,
    "reason": "Flow 12 allow checkout",
    "expires_at": "2030-01-01T00:00:00.000Z"
  }')"
cat /tmp/flow12-enable-feature.json
echo
require_code "$enable_http" "200" "Enable paid feature" /tmp/flow12-enable-feature.json
require_json_value /tmp/flow12-enable-feature.json enabled true

echo "== Flow 12 Step 9: checkout uses admin pricing and VietQR account =="
checkout_http="$(curl -sS -o /tmp/flow12-tutor-qr-checkout.json -w "%{http_code}" \
  -X POST "$API/billing/checkout" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: flow12-enabled-$TARGET_USER_ID" \
  -H "$TARGET_AUTH" \
  --data '{"product_type":"tutor_qr"}')"
cat /tmp/flow12-tutor-qr-checkout.json
echo
require_code "$checkout_http" "201" "Tutor QR checkout after enable" /tmp/flow12-tutor-qr-checkout.json
require_json_value /tmp/flow12-tutor-qr-checkout.json product_type tutor_qr
require_json_value /tmp/flow12-tutor-qr-checkout.json amount 35000
require_contains /tmp/flow12-tutor-qr-checkout.json "img.vietqr.io/image/VCB-123456789"

echo "== Flow 12 Step 10: admin reads paid feature state =="
features_http="$(curl -sS -o /tmp/flow12-paid-features.json -w "%{http_code}" \
  -H "$ADMIN_AUTH" \
  "$API/admin/users/$TARGET_USER_ID/paid-features")"
cat /tmp/flow12-paid-features.json
echo
require_code "$features_http" "200" "Paid feature state" /tmp/flow12-paid-features.json
require_contains /tmp/flow12-paid-features.json "\"feature\":\"tutor_qr\""
require_contains /tmp/flow12-paid-features.json "\"enabled\":true"

echo "== Flow 12 Step 11: admin suspends target user =="
status_http="$(curl -sS -o /tmp/flow12-user-status.json -w "%{http_code}" \
  -X PATCH "$API/admin/users/$TARGET_USER_ID/status" \
  -H "Content-Type: application/json" \
  -H "$ADMIN_AUTH" \
  --data '{
    "status": "suspended",
    "reason": "Flow 12 verify account lock"
  }')"
cat /tmp/flow12-user-status.json
echo
require_code "$status_http" "200" "Suspend user" /tmp/flow12-user-status.json
require_json_value /tmp/flow12-user-status.json id "$TARGET_USER_ID"
require_json_value /tmp/flow12-user-status.json status suspended

echo "== Flow 12 Step 12: admin views system audit logs =="
logs_http="$(curl -sS -o /tmp/flow12-system-logs.json -w "%{http_code}" \
  -H "$ADMIN_AUTH" \
  "$API/admin/system-logs?type=audit&entity_type=user&entity_id=$TARGET_USER_ID&limit=20")"
cat /tmp/flow12-system-logs.json
echo
require_code "$logs_http" "200" "System logs" /tmp/flow12-system-logs.json
require_json_value /tmp/flow12-system-logs.json items.0.type audit
require_json_value /tmp/flow12-system-logs.json items.0.action admin.user_status

echo "== Flow 12 Step 13: admin uses existing moderation queue =="
queue_http="$(curl -sS -o /tmp/flow12-moderation-queue.json -w "%{http_code}" \
  -H "$ADMIN_AUTH" \
  "$API/admin/moderation/queue")"
cat /tmp/flow12-moderation-queue.json
echo
require_code "$queue_http" "200" "Moderation queue" /tmp/flow12-moderation-queue.json
json_get /tmp/flow12-moderation-queue.json tutors >/dev/null

echo "OK: Flow 12 Tutor Admin Control Center verified end-to-end for target_user_id $TARGET_USER_ID"
