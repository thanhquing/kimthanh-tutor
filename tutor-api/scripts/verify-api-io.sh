#!/bin/sh
set -eu

API_BASE_URL="${API_BASE_URL:-http://api:3000}"
API_PREFIX="${API_PREFIX:-api/v1}"
BASE="$API_BASE_URL/$API_PREFIX"

fail() {
  echo "FAIL: $*" >&2
  exit 1
}

require_contains() {
  file="$1"
  expected="$2"
  if ! grep -q "$expected" "$file"; then
    echo "Response/body did not contain: $expected" >&2
    echo "--- $file ---" >&2
    cat "$file" >&2
    exit 1
  fi
}

json_get() {
  file="$1"
  path="$2"
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1], 'utf8')); const path=process.argv[2].split('.'); let cur=data; for (const key of path) cur=cur?.[key]; if (cur === undefined || cur === null) process.exit(2); process.stdout.write(String(cur));" "$file" "$path"
}

echo "== Schema validate =="
npx prisma validate --schema /app/tutor-api/prisma/schema.prisma

echo "== Database schema checks =="
psql -v ON_ERROR_STOP=1 -c "select current_database() as database, current_schema() as schema;"
psql -v ON_ERROR_STOP=1 -c "select table_name from information_schema.tables where table_schema = 'public' and table_name in ('users','otp_requests','tutor_profiles','payments','class_contracts','reviews','audit_logs') order by table_name;"
psql -v ON_ERROR_STOP=1 -c "select typname from pg_type where typname in ('UserStatus','ProductType','PaymentStatus','ClassStatus') order by typname;"

echo "== API health output =="
curl -fsS "$API_BASE_URL/healthz" | tee /tmp/healthz.json
echo
require_contains /tmp/healthz.json '"status":"ok"'

echo "== API ready output =="
curl -fsS "$API_BASE_URL/readyz" | tee /tmp/readyz.json
echo
require_contains /tmp/readyz.json '"db":"up"'

echo "== cURL validation input/output =="
invalid_code="$(curl -sS -o /tmp/invalid-otp.json -w "%{http_code}" \
  -X POST "$BASE/auth/otp/request" \
  -H "Content-Type: application/json" \
  --data '{"channel":"fax","destination":""}')"
cat /tmp/invalid-otp.json
echo
[ "$invalid_code" = "400" ] || fail "expected invalid OTP request to return 400, got $invalid_code"
require_contains /tmp/invalid-otp.json '"code":"VALIDATION_ERROR"'

echo "== cURL happy-path OTP request output =="
otp_code="$(curl -sS -o /tmp/otp-request.json -w "%{http_code}" \
  -X POST "$BASE/auth/otp/request" \
  -H "Content-Type: application/json" \
  --data '{"channel":"sms","destination":"0900000000"}')"
cat /tmp/otp-request.json
echo
[ "$otp_code" = "201" ] || fail "expected OTP request to return 201, got $otp_code"
require_contains /tmp/otp-request.json '"request_id"'
require_contains /tmp/otp-request.json '"dev_code"'

REQUEST_ID="$(json_get /tmp/otp-request.json request_id)"
DEV_CODE="$(json_get /tmp/otp-request.json dev_code)"

echo "== cURL OTP verify output =="
verify_code="$(curl -sS -o /tmp/otp-verify.json -w "%{http_code}" \
  -X POST "$BASE/auth/otp/verify" \
  -H "Content-Type: application/json" \
  --data "{\"request_id\":\"$REQUEST_ID\",\"code\":\"$DEV_CODE\"}")"
cat /tmp/otp-verify.json
echo
[ "$verify_code" = "201" ] || fail "expected OTP verify to return 201, got $verify_code"
require_contains /tmp/otp-verify.json '"access_token"'
require_contains /tmp/otp-verify.json '"consent_required":true'

ACCESS_TOKEN="$(json_get /tmp/otp-verify.json access_token)"

echo "== cURL authenticated /auth/me output =="
me_code="$(curl -sS -o /tmp/auth-me.json -w "%{http_code}" \
  -H "Authorization: Bearer $ACCESS_TOKEN" \
  "$BASE/auth/me")"
cat /tmp/auth-me.json
echo
[ "$me_code" = "200" ] || fail "expected /auth/me to return 200, got $me_code"
require_contains /tmp/auth-me.json '"status":"pending_consent"'

echo "== Database write checks =="
psql -v ON_ERROR_STOP=1 -c "select count(*) as users from users;"
psql -v ON_ERROR_STOP=1 -c "select channel, destination, consumed_at is not null as consumed from otp_requests order by created_at desc limit 1;"

echo "OK: schema, database, API input validation, cURL output, OTP write/read flow verified."
