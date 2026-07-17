#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_PREFIX="${API_PREFIX:-api/v1}"
API="$API_BASE_URL/$API_PREFIX"
PSQL_URL="${PSQL_URL:-postgresql://postgres:postgres@db:5432/tutor}"
PHONE="${PHONE:-090$(date +%H%M%S)}"

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
  [ "$actual" = "$expected" ] || {
    echo "--- response ---" >&2
    [ -f "$4" ] && cat "$4" >&2
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

echo "== Flow 1 setup: seed active legal documents =="
psql "$PSQL_URL" -v ON_ERROR_STOP=1 -c "update legal_documents set is_active = false where doc_type in ('terms','privacy'); insert into legal_documents (id, doc_type, version, locale, title, content_url, checksum, is_active, published_at) values ('01KXFLOWTERMS0000000000000','terms','2026-07-flow','vi-VN','Dieu khoan su dung','https://example.test/legal/terms-2026-07','dev-terms-checksum',true,now()), ('01KXFLOWPRIVACY00000000000','privacy','2026-07-flow','vi-VN','Chinh sach bao mat','https://example.test/legal/privacy-2026-07','dev-privacy-checksum',true,now()) on conflict (doc_type, version) do update set is_active = excluded.is_active, content_url = excluded.content_url, checksum = excluded.checksum, published_at = excluded.published_at;"

echo "== Flow 1 Step 1: request OTP =="
otp_http="$(curl -sS -o /tmp/flow01-otp-request.json -w "%{http_code}" \
  -X POST "$API/auth/otp/request" \
  -H "Content-Type: application/json" \
  --data "{\"channel\":\"sms\",\"destination\":\"$PHONE\"}")"
cat /tmp/flow01-otp-request.json
echo
require_code "$otp_http" "201" "OTP request" /tmp/flow01-otp-request.json
REQUEST_ID="$(json_get /tmp/flow01-otp-request.json request_id)"
DEV_CODE="$(json_get /tmp/flow01-otp-request.json dev_code)"
[ "$DEV_CODE" = "272727" ] || fail "Expected local dev OTP code 272727, got $DEV_CODE"

echo "== Flow 1 Step 2: verify OTP =="
verify_http="$(curl -sS -o /tmp/flow01-otp-verify.json -w "%{http_code}" \
  -X POST "$API/auth/otp/verify" \
  -H "Content-Type: application/json" \
  --data "{\"request_id\":\"$REQUEST_ID\",\"code\":\"$DEV_CODE\"}")"
cat /tmp/flow01-otp-verify.json
echo
require_code "$verify_http" "201" "OTP verify" /tmp/flow01-otp-verify.json
require_json_value /tmp/flow01-otp-verify.json consent_required true
ACCESS_TOKEN="$(json_get /tmp/flow01-otp-verify.json access_token)"
REFRESH_TOKEN="$(json_get /tmp/flow01-otp-verify.json refresh_token)"

echo "== Flow 1 Step 3: load active legal documents =="
docs_http="$(curl -sS -o /tmp/flow01-legal-docs.json -w "%{http_code}" "$API/legal/documents/active")"
cat /tmp/flow01-legal-docs.json
echo
require_code "$docs_http" "200" "Legal documents" /tmp/flow01-legal-docs.json
TERMS_ID="$(json_get /tmp/flow01-legal-docs.json terms.id)"
PRIVACY_ID="$(json_get /tmp/flow01-legal-docs.json privacy.id)"

echo "== Flow 1 Step 4A: reject consent before scroll reaches bottom =="
early_consent_http="$(curl -sS -o /tmp/flow01-consent-too-early.json -w "%{http_code}" \
  -X POST "$API/legal/consents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  --data "{\"terms_document_id\":\"$TERMS_ID\",\"privacy_document_id\":\"$PRIVACY_ID\",\"scroll_reached_bottom\":false,\"consent_method\":\"scroll_and_click\"}")"
require_code "$early_consent_http" "400" "Consent before scroll" /tmp/flow01-consent-too-early.json
require_json_value /tmp/flow01-consent-too-early.json code VALIDATION_ERROR

echo "== Flow 1 Step 4B: record consent =="
consent_http="$(curl -sS -o /tmp/flow01-consent.json -w "%{http_code}" \
  -X POST "$API/legal/consents" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  --data "{\"terms_document_id\":\"$TERMS_ID\",\"privacy_document_id\":\"$PRIVACY_ID\",\"scroll_reached_bottom\":true,\"consent_method\":\"scroll_and_click\"}")"
cat /tmp/flow01-consent.json
echo
require_code "$consent_http" "201" "Record consent" /tmp/flow01-consent.json
require_json_value /tmp/flow01-consent.json ok true
require_json_value /tmp/flow01-consent.json user_status active

echo "== Flow 1 Step 5: reload /auth/me =="
me_http="$(curl -sS -o /tmp/flow01-auth-me.json -w "%{http_code}" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "$API/auth/me")"
cat /tmp/flow01-auth-me.json
echo
require_code "$me_http" "200" "Auth me" /tmp/flow01-auth-me.json
require_json_value /tmp/flow01-auth-me.json user.status active

echo "== Flow 1 Step 6: logout and revoke refresh token =="
logout_http="$(curl -sS -o /tmp/flow01-logout.json -w "%{http_code}" \
  -X POST "$API/auth/logout" \
  -H "Content-Type: application/json" \
  --data "{\"refresh_token\":\"$REFRESH_TOKEN\"}")"
require_code "$logout_http" "204" "Logout" /tmp/flow01-logout.json

refresh_http="$(curl -sS -o /tmp/flow01-refresh-after-logout.json -w "%{http_code}" \
  -X POST "$API/auth/refresh" \
  -H "Content-Type: application/json" \
  --data "{\"refresh_token\":\"$REFRESH_TOKEN\"}")"
require_code "$refresh_http" "401" "Refresh after logout" /tmp/flow01-refresh-after-logout.json
require_json_value /tmp/flow01-refresh-after-logout.json code AUTH_REQUIRED

echo "OK: Flow 1 OTP + Consent Gate + Logout verified end-to-end for phone $PHONE"
